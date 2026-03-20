"""Game WebSocket handler — bidirectional communication during gameplay."""

import asyncio
import json
import logging
import time
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from websocket.connection_manager import manager, ws_pump
from engine.timeline import run_timeline, cancel_timeline
from engine.pm_scorer import score_pm_attempt
from engine.execution_window import (
    start_window, cancel_window, get_active_trigger, clear_active_trigger,
    record_room_switch, get_room_sequence, get_first_pm_room_entry,
)
from models.logging import InteractionLog, MouseTrack
from models.block import PMTrial, PMAttemptRecord

logger = logging.getLogger(__name__)


async def handle_game_ws(
    ws: WebSocket,
    participant_id: str,
    block_number: int,
    db_factory,
):
    """Handle a game WebSocket connection for a participant block."""
    queue = await manager.connect_participant(participant_id, ws)

    # Create send function bound to this participant
    async def send_event(event_type: str, data: dict):
        await manager.send_to_participant(participant_id, event_type, data)

    # Start pump and receiver concurrently
    pump_task = asyncio.create_task(ws_pump(queue, ws))
    receiver_task = asyncio.create_task(
        _ws_receiver(ws, participant_id, block_number, db_factory)
    )

    try:
        # Wait for either task to complete (usually due to disconnect)
        done, pending = await asyncio.wait(
            [pump_task, receiver_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
    except Exception as e:
        logger.error(f"Game WS error for {participant_id}: {e}")
    finally:
        manager.disconnect_participant(participant_id, ws)
        pump_task.cancel()
        receiver_task.cancel()


async def _ws_receiver(
    ws: WebSocket,
    participant_id: str,
    block_number: int,
    db_factory,
):
    """Listen for client messages and dispatch."""
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type", "")
            data = msg.get("data", {})

            if msg_type == "heartbeat":
                await _handle_heartbeat(participant_id, db_factory)
            elif msg_type == "room_switch":
                await _handle_room_switch(participant_id, block_number, data, db_factory)
            elif msg_type == "task_action":
                await _handle_task_action(participant_id, block_number, data, db_factory)
            elif msg_type == "pm_attempt":
                await _handle_pm_attempt(participant_id, block_number, data, db_factory)
                await ws.send_text(json.dumps({"event": "pm_received", "data": {}}))
            elif msg_type == "trigger_ack":
                await _handle_trigger_ack(participant_id, data, db_factory)
            elif msg_type == "phone_unlock":
                await _handle_interaction(participant_id, block_number, "phone_unlock", data, db_factory)
            elif msg_type == "phone_action":
                await _handle_interaction(participant_id, block_number, "phone_action", data, db_factory)
            elif msg_type == "mouse_position":
                await _handle_mouse(participant_id, block_number, data, db_factory)
            else:
                logger.debug(f"Unknown client message type: {msg_type}")

    except WebSocketDisconnect:
        logger.info(f"WS receiver ended for {participant_id}")
    except Exception as e:
        logger.error(f"WS receiver error for {participant_id}: {e}")


async def _handle_heartbeat(participant_id: str, db_factory):
    """Update heartbeat timestamp."""
    async with db_factory() as db:
        from sqlalchemy import update
        from models.experiment import Participant
        await db.execute(
            update(Participant)
            .where(Participant.id == participant_id)
            .values(last_heartbeat=time.time(), is_online=True)
        )
        await db.commit()


async def _handle_room_switch(participant_id, block_number, data, db_factory):
    """Log a room switch and track for PM execution window."""
    ts = data.get("timestamp", time.time())
    to_room = data.get("to", "")

    # Track room switches for active PM execution window
    record_room_switch(participant_id, to_room, ts)

    # Log interaction
    await _handle_interaction(participant_id, block_number, "room_switch", data, db_factory)


async def _handle_task_action(participant_id, block_number, data, db_factory):
    """Log ongoing task action — also used for resumption lag detection."""
    ts = data.get("timestamp", time.time())

    # Check if this is a resumption event (returning to ongoing task after PM)
    trigger = get_active_trigger(participant_id)
    if trigger and trigger.get("pm_completed"):
        # This is the first ongoing task action after PM completion
        pm_completed_at = trigger.get("pm_completed_at", 0)
        resumption_lag_ms = int((ts - pm_completed_at) * 1000)
        await _record_resumption_lag(
            trigger["trial_id"], resumption_lag_ms, db_factory,
        )
        clear_active_trigger(participant_id)

    await _handle_interaction(participant_id, block_number, "task_action", data, db_factory)


async def _handle_trigger_ack(participant_id, data, db_factory):
    """Handle trigger acknowledgment from frontend — records trigger_received_at."""
    trigger_id = data.get("trigger_id")
    received_at = data.get("received_at", time.time())

    if not trigger_id:
        return

    async with db_factory() as db:
        from sqlalchemy import select
        trigger = get_active_trigger(participant_id)
        if trigger:
            # Store trigger_received_at for latency measurement
            trigger["trigger_received_at"] = received_at


async def _handle_interaction(participant_id, block_number, event_type, data, db_factory):
    """Log a generic interaction."""
    async with db_factory() as db:
        from sqlalchemy import select
        from models.block import Block
        result = await db.execute(
            select(Block.id).where(
                Block.participant_id == participant_id,
                Block.block_number == block_number,
            )
        )
        block_id = result.scalar_one_or_none()
        if block_id is None:
            return

        log = InteractionLog(
            participant_id=participant_id,
            block_id=block_id,
            timestamp=data.get("timestamp", time.time()),
            event_type=event_type,
            event_data=data,
            room=data.get("room") or data.get("to") or data.get("from"),
        )
        db.add(log)
        await db.commit()


async def _handle_pm_attempt(participant_id, block_number, data, db_factory):
    """Process a PM attempt — build detailed record and score silently."""
    async with db_factory() as db:
        from sqlalchemy import select, update
        from models.block import Block

        result = await db.execute(
            select(Block).where(
                Block.participant_id == participant_id,
                Block.block_number == block_number,
            )
        )
        block = result.scalar_one_or_none()
        if not block:
            return

        # Find the active PM trial (most recently triggered, unscored)
        result = await db.execute(
            select(PMTrial).where(
                PMTrial.block_id == block.id,
                PMTrial.trigger_fired_at.isnot(None),
                PMTrial.score.is_(None),
            ).order_by(PMTrial.trigger_fired_at.desc()).limit(1)
        )
        trial = result.scalar_one_or_none()
        if not trial:
            return

        # Cancel the execution window timer
        cancel_window(participant_id, trial.id)

        # Gather timing data
        trigger = get_active_trigger(participant_id)
        room_seq = get_room_sequence(participant_id)
        first_pm_room_ts = get_first_pm_room_entry(participant_id)
        first_room_switch_ts = room_seq[0]["timestamp"] if room_seq else None

        attempt_time = data.get("timestamp", time.time())
        action_step = data.get("action_step", data.get("action", ""))
        target_selected = data.get("target_selected", "")
        attempt_room = data.get("room", "")

        # Score using the new scorer
        score, rt_ms = score_pm_attempt(
            trigger_fired_at=trial.trigger_fired_at,
            attempt_time=attempt_time,
            room=attempt_room,
            target_selected=target_selected,
            action_performed=action_step,
            task_config=trial.task_config or {},
        )

        # Determine action correctness
        correct_action = trial.task_config.get("target_action", "")
        action_correct = action_step.lower() == correct_action.lower() if action_step else False

        # Create detailed attempt record
        attempt_record = PMAttemptRecord(
            trial_id=trial.id,
            participant_id=participant_id,
            block_id=block.id,
            trigger_fired_at=trial.trigger_fired_at,
            trigger_received_at=(
                trigger.get("trigger_received_at") if trigger else None
            ),
            first_action_time=attempt_time,
            first_room_switch_at=first_room_switch_ts,
            first_pm_room_entered_at=first_pm_room_ts,
            target_selected_at=data.get("target_selected_at"),
            action_completed_at=data.get("action_completed_at", attempt_time),
            room_sequence=[e["room"] for e in room_seq],
            room=attempt_room,
            target_selected=target_selected,
            action_performed=action_step,
            action_correct=action_correct,
            total_elapsed_ms=rt_ms,
            score=score,
        )
        db.add(attempt_record)

        # Update trial with results
        await db.execute(
            update(PMTrial)
            .where(PMTrial.id == trial.id)
            .values(
                user_actions=[data],
                score=score,
                response_time_ms=rt_ms,
            )
        )
        await db.commit()

        # Mark trigger as PM-completed for resumption lag tracking
        if trigger:
            trigger["pm_completed"] = True
            trigger["pm_completed_at"] = data.get("action_completed_at", attempt_time)

        logger.info(
            f"PM scored: participant={participant_id} trial={trial.id} "
            f"score={score} rt={rt_ms}ms"
        )


async def _record_resumption_lag(trial_id: int, lag_ms: int, db_factory):
    """Record the resumption lag for a completed PM trial."""
    async with db_factory() as db:
        from sqlalchemy import update
        await db.execute(
            update(PMTrial)
            .where(PMTrial.id == trial_id)
            .values(resumption_lag_ms=lag_ms)
        )
        await db.commit()
        logger.info(f"Resumption lag recorded: trial={trial_id} lag={lag_ms}ms")


async def _handle_mouse(participant_id, block_number, data, db_factory):
    """Store mouse tracking batch."""
    async with db_factory() as db:
        from sqlalchemy import select
        from models.block import Block
        result = await db.execute(
            select(Block.id).where(
                Block.participant_id == participant_id,
                Block.block_number == block_number,
            )
        )
        block_id = result.scalar_one_or_none()
        if block_id is None:
            return

        track = MouseTrack(
            participant_id=participant_id,
            block_id=block_id,
            data=data if isinstance(data, list) else [data],
        )
        db.add(track)
        await db.commit()

