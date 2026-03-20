"""Game WebSocket handler — bidirectional communication during gameplay."""

import asyncio
import json
import logging
import time
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from websocket.connection_manager import manager, ws_pump
from engine.timeline import run_timeline, cancel_timeline
from engine.pm_scorer import score_pm_trial
from models.logging import InteractionLog, MouseTrack
from models.block import PMTrial

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
                await _handle_interaction(participant_id, block_number, "room_switch", data, db_factory)
            elif msg_type == "task_action":
                await _handle_interaction(participant_id, block_number, "task_action", data, db_factory)
            elif msg_type == "pm_attempt":
                await _handle_pm_attempt(participant_id, block_number, data, db_factory)
                # Send ack (no score info!)
                await ws.send_text(json.dumps({"event": "pm_received", "data": {}}))
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
            room=data.get("room") or data.get("from"),
        )
        db.add(log)
        await db.commit()


async def _handle_pm_attempt(participant_id, block_number, data, db_factory):
    """Process a PM attempt — score it silently."""
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

        # Find the active PM trial (most recently triggered)
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

        # Score the attempt
        score, rt_ms = score_pm_trial(
            trigger_fired_at=trial.trigger_fired_at,
            user_actions=[data],
            task_config=trial.task_config or {},
            current_time=time.time(),
        )

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
        logger.info(f"PM scored: participant={participant_id} trial={trial.id} score={score}")


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
