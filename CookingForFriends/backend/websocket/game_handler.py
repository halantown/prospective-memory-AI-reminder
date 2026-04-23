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
from engine.cooking_engine import CookingEngine
from models.logging import InteractionLog, MouseTrack, PhoneMessageLog
from models.block import PMTrial, PMAttemptRecord

logger = logging.getLogger(__name__)

# Per-participant locks for PM attempt deduplication
_pm_attempt_locks: dict[str, asyncio.Lock] = {}

# Per-participant CookingEngine instances
_cooking_engines: dict[str, CookingEngine] = {}


async def handle_game_ws(
    ws: WebSocket,
    participant_id: str,
    block_number: int,
    db_factory,
):
    """Handle a game WebSocket connection for a participant block."""
    from config import BLOCKS_PER_PARTICIPANT

    # Validate block_number range
    if not (1 <= block_number <= BLOCKS_PER_PARTICIPANT):
        await ws.close(code=4001, reason=f"Invalid block_number: {block_number}")
        return

    # Validate participant exists before accepting connection
    try:
        async with db_factory() as db:
            from sqlalchemy import select
            from models.experiment import Participant
            result = await db.execute(
                select(Participant.id).where(Participant.id == participant_id)
            )
            if not result.scalar_one_or_none():
                await ws.close(code=4004, reason="Unknown session")
                return
    except Exception:
        await ws.close(code=4000, reason="Validation failed")
        return

    queue, conn_id = await manager.connect_participant(participant_id, ws)

    # Create send function bound to this participant
    async def send_event(event_type: str, data: dict):
        await manager.send_to_participant(participant_id, event_type, data)

    # Determine block condition and start timeline if game is playing
    timeline_task = None
    try:
        async with db_factory() as db:
            from sqlalchemy import select
            from models.block import Block, BlockStatus
            from models.experiment import Participant

            result = await db.execute(
                select(Block).where(
                    Block.participant_id == participant_id,
                    Block.block_number == block_number,
                )
            )
            block = result.scalar_one_or_none()

            if block and block.status == BlockStatus.PLAYING:
                # Resume timeline for reconnecting client
                condition = block.condition
                block_id = block.id
                # Use the block's real start time so past events are skipped instead
                # of re-fired (prevents duplicate phone messages on reconnect).
                block_start_ts: float | None = None
                if block.started_at:
                    block_start_ts = block.started_at.timestamp()
                logger.info(f"[GAME_HANDLER] Auto-starting timeline (block already PLAYING) for {participant_id} block {block_number}")
                timeline_task = await run_timeline(
                    participant_id=participant_id,
                    block_number=block_number,
                    condition=condition,
                    send_fn=send_event,
                    db_factory=db_factory,
                    block_start_time=block_start_ts,
                )
                logger.info(f"[GAME_HANDLER] Timeline resumed for {participant_id} block {block_number}")

                # Also restart CookingEngine — it was stopped when the previous connection closed
                if participant_id not in _cooking_engines:
                    try:
                        cooking = CookingEngine(
                            participant_id=participant_id,
                            block_id=block_id,
                            send_fn=send_event,
                            db_factory=db_factory,
                        )
                        _cooking_engines[participant_id] = cooking
                        cooking.start()
                        logger.info(f"[GAME_HANDLER] CookingEngine restarted on reconnect for {participant_id} block {block_number}")
                    except Exception as ce:
                        logger.error(f"[GAME_HANDLER] CookingEngine restart failed on reconnect: {ce}")
                else:
                    logger.info(f"[GAME_HANDLER] CookingEngine already running for {participant_id}, skipping restart")
            else:
                block_status = block.status if block else "NO_BLOCK"
                logger.info(f"[GAME_HANDLER] Block status on connect: {block_status} (not auto-starting)")
    except Exception as e:
        logger.error(f"Failed to check/start timeline: {e}")

    # Start pump and receiver concurrently
    pump_task = asyncio.create_task(ws_pump(queue, ws))
    receiver_task = asyncio.create_task(
        _ws_receiver(ws, participant_id, block_number, db_factory)
    )

    try:
        # Wait for either task to complete (usually due to disconnect)
        tasks_to_watch = [pump_task, receiver_task]
        if timeline_task:
            tasks_to_watch.append(timeline_task)
        done, pending = await asyncio.wait(
            tasks_to_watch,
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
        # Only cancel timeline/windows if this connection is still the latest.
        # A newer connection may have already started a new timeline.
        if manager.is_latest_connection(participant_id, conn_id):
            if timeline_task and not timeline_task.done():
                timeline_task.cancel()
            cancel_timeline(participant_id, block_number)
            from engine.execution_window import cancel_all_windows_for_participant
            cancel_all_windows_for_participant(participant_id)
            # Stop and save cooking engine
            cooking = _cooking_engines.pop(participant_id, None)
            if cooking:
                await cooking.save_dish_scores()
                await cooking.stop()
        else:
            logger.info(f"Skipping timeline/window cleanup for {participant_id} — superseded by newer connection")
        # Clean up per-participant PM attempt lock
        _pm_attempt_locks.pop(participant_id, None)
        # Only mark offline if no active connections remain
        if not manager.has_active_connections(participant_id):
            await _set_participant_offline(participant_id, db_factory)


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

            # Each handler is wrapped so one failure never kills the receiver loop
            try:
                if msg_type == "heartbeat":
                    await _handle_heartbeat(participant_id, db_factory)
                elif msg_type == "start_game":
                    logger.info(f"[GAME_HANDLER] Received start_game from {participant_id} block {block_number}")
                    await _handle_start_game(participant_id, block_number, db_factory,
                                             lambda et, d: manager.send_to_participant(participant_id, et, d))
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
                elif msg_type == "phone_reply":
                    await _handle_phone_reply(participant_id, block_number, data, db_factory)
                elif msg_type == "phone_read":
                    await _handle_phone_read(participant_id, block_number, data, db_factory)
                elif msg_type == "phone_contact_switch":
                    await _handle_interaction(participant_id, block_number, "phone_contact_switch", data, db_factory)
                elif msg_type == "phone_tab_switch":
                    await _handle_interaction(participant_id, block_number, "phone_tab_switch", data, db_factory)
                elif msg_type == "kitchen_timer_acknowledged":
                    await _handle_interaction(participant_id, block_number, "kitchen_timer_acknowledged", data, db_factory)
                elif msg_type == "cooking_action":
                    await _handle_cooking_action(participant_id, block_number, data, db_factory)
                elif msg_type == "recipe_view":
                    await _handle_interaction(participant_id, block_number, "recipe_view", data, db_factory)
                elif msg_type == "mouse_position":
                    await _handle_mouse(participant_id, block_number, data, db_factory)
                else:
                    logger.debug(f"Unknown client message type: {msg_type}")
            except Exception as handler_err:
                logger.error(
                    f"[GAME_HANDLER] Handler error for '{msg_type}' "
                    f"(participant={participant_id}): {handler_err}",
                    exc_info=True,
                )

    except WebSocketDisconnect:
        logger.info(f"WS receiver ended for {participant_id}")
    except Exception as e:
        logger.error(f"WS receiver error for {participant_id}: {e}", exc_info=True)


async def _handle_start_game(participant_id: str, block_number: int, db_factory, send_fn):
    """Start the block timeline when the frontend enters playing phase."""
    logger.info(f"[GAME_HANDLER] _handle_start_game called: participant={participant_id} block={block_number}")

    async with db_factory() as db:
        from sqlalchemy import select
        from models.block import Block, BlockStatus
        from datetime import datetime, timezone

        result = await db.execute(
            select(Block).where(
                Block.participant_id == participant_id,
                Block.block_number == block_number,
            )
        )
        block = result.scalar_one_or_none()
        if not block:
            logger.warning(f"[GAME_HANDLER] start_game: block not found for {participant_id} block {block_number}")
            return

        logger.info(f"[GAME_HANDLER] Block found: id={block.id} status={block.status} condition={block.condition}")

        # Only start if block is in encoding or pending state
        if block.status not in (BlockStatus.PENDING, BlockStatus.ENCODING):
            logger.info(f"[GAME_HANDLER] start_game: block already in state {block.status}, skipping timeline start")
            return

        block.status = BlockStatus.PLAYING
        block.started_at = block.started_at or datetime.now(timezone.utc)
        await db.commit()
        condition = block.condition
        block_id = block.id

    async def _on_block_complete():
        """Mark block as completed when timeline finishes normally."""
        try:
            # Save cooking scores before marking block complete
            cooking = _cooking_engines.pop(participant_id, None)
            if cooking:
                await cooking.save_dish_scores()
                await cooking.stop()
                logger.info(f"[GAME_HANDLER] CookingEngine scores saved for {participant_id}")

            async with db_factory() as db:
                from sqlalchemy import select
                from models.block import Block, BlockStatus
                result = await db.execute(
                    select(Block).where(
                        Block.participant_id == participant_id,
                        Block.block_number == block_number,
                    )
                )
                blk = result.scalar_one_or_none()
                if blk and blk.status == BlockStatus.PLAYING:
                    blk.status = BlockStatus.COMPLETED
                    await db.commit()
                    logger.info(f"[GAME_HANDLER] Block {block_number} completed for {participant_id}")
        except Exception as e:
            logger.error(f"[GAME_HANDLER] Failed to mark block complete: {e}")

    # Start the timeline — rollback block status on failure
    logger.info(f"[GAME_HANDLER] Creating TimelineEngine for {participant_id} block {block_number} ({condition})")
    try:
        task = await run_timeline(
            participant_id=participant_id,
            block_number=block_number,
            condition=condition,
            send_fn=send_fn,
            on_complete=_on_block_complete,
            db_factory=db_factory,
        )
        logger.info(f"[GAME_HANDLER] Timeline task created: {task}")
    except Exception as e:
        logger.error(f"[GAME_HANDLER] Timeline start failed, rolling back block status: {e}")
        async with db_factory() as db:
            from sqlalchemy import update as sql_update
            await db.execute(
                sql_update(Block)
                .where(Block.id == block_id)
                .values(status=BlockStatus.ENCODING)
            )
            await db.commit()
        raise

    # Start the CookingEngine for this block
    try:
        cooking = CookingEngine(
            participant_id=participant_id,
            block_id=block_id,
            send_fn=send_fn,
            db_factory=db_factory,
        )
        _cooking_engines[participant_id] = cooking
        cooking.start()
        logger.info(f"[GAME_HANDLER] CookingEngine started for {participant_id} block {block_number}")
    except Exception as e:
        logger.error(f"[GAME_HANDLER] CookingEngine start failed: {e}")


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
    """Log ongoing task action — also used for resumption lag detection
    and activity watcher condition checking."""
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

    # Check activity watchers for condition-based PM triggers
    task = data.get("task", "")
    event = data.get("event", "")
    await _check_activity_conditions(participant_id, task, event, data)

    await _handle_interaction(participant_id, block_number, "task_action", data, db_factory)


async def _handle_cooking_action(participant_id, block_number, data, db_factory):
    """Route a cooking action to the CookingEngine and log it."""
    cooking = _cooking_engines.get(participant_id)
    if not cooking:
        logger.warning(f"[GAME_HANDLER] cooking_action but no CookingEngine for {participant_id}")
        return

    dish_id = data.get("dish", "")
    chosen_option_id = data.get("chosen_option_id", "")
    chosen_option_text = data.get("chosen_option_text", "")
    station = data.get("station", "")
    ts = data.get("timestamp", time.time())

    await cooking.handle_action(
        dish_id=dish_id,
        chosen_option_id=chosen_option_id,
        chosen_option_text=chosen_option_text,
        station=station,
        timestamp=ts,
    )

    # Also log as interaction for general event tracking
    await _handle_interaction(participant_id, block_number, "cooking_action", data, db_factory)

    # Check resumption lag (cooking action counts as returning to ongoing task)
    trigger = get_active_trigger(participant_id)
    if trigger and trigger.get("pm_completed"):
        pm_completed_at = trigger.get("pm_completed_at", 0)
        resumption_lag_ms = int((ts - pm_completed_at) * 1000)
        await _record_resumption_lag(trigger["trial_id"], resumption_lag_ms, db_factory)
        clear_active_trigger(participant_id)


async def _handle_trigger_ack(participant_id, data, db_factory):
    """Handle trigger acknowledgment from frontend — records trigger_received_at."""
    trigger_id = data.get("trigger_id")
    received_at = data.get("received_at", time.time())

    if not trigger_id:
        return

    trigger = get_active_trigger(participant_id)
    if trigger:
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
    # Per-participant lock to prevent concurrent duplicate scoring
    lock = _pm_attempt_locks.setdefault(participant_id, asyncio.Lock())
    async with lock:
        trigger = get_active_trigger(participant_id)
        if trigger and trigger.get("attempt_received"):
            logger.warning(f"Duplicate PM attempt from {participant_id}, ignoring")
            return

        if trigger:
            trigger["attempt_received"] = True

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
                logger.debug(f"PM attempt: no unscored trial found for {participant_id}")
                return

            # Cancel the execution window timer
            cancel_window(participant_id, trial.id)

            # Gather timing data
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

            # Atomic update: only score if still unscored (prevents race with window expiry)
            update_result = await db.execute(
                update(PMTrial)
                .where(PMTrial.id == trial.id, PMTrial.score.is_(None))
                .values(
                    user_actions=[data],
                    score=score,
                    response_time_ms=rt_ms,
                    exec_window_end=attempt_time,
                )
            )
            if update_result.rowcount == 0:
                logger.warning(f"PM attempt: trial {trial.id} already scored (race condition prevented)")
                await db.rollback()
                return
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


async def _handle_phone_reply(participant_id, block_number, data, db_factory):
    """Handle a phone message answer — validate chosen text and log."""
    from engine.message_loader import get_message, check_answer
    from sqlalchemy import select, update

    message_id = data.get("message_id", "")
    chosen_text = data.get("chosen_text", "")
    is_correct_client = data.get("is_correct")  # frontend's judgment
    correct_position_shown = data.get("correct_position_shown")  # 0 or 1
    timestamp = data.get("timestamp", time.time())

    if not message_id or not chosen_text:
        return

    # Verify correctness server-side from the message pool
    message = get_message(block_number, message_id)
    is_correct = check_answer(message, chosen_text) if message else is_correct_client

    # Mark as answered in timeline nudge tracker
    from engine.timeline import mark_chat_answered
    mark_chat_answered(participant_id, message_id)

    async with db_factory() as db:
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

        # Compute response time from sent_at
        sent_row = await db.execute(
            select(PhoneMessageLog.sent_at).where(
                PhoneMessageLog.participant_id == participant_id,
                PhoneMessageLog.block_id == block_id,
                PhoneMessageLog.message_id == message_id,
            ).limit(1)
        )
        sent_at = sent_row.scalar_one_or_none()
        response_time_ms = int((timestamp - sent_at) * 1000) if sent_at else None

        status = "answered_correct" if is_correct else "answered_incorrect"

        await db.execute(
            update(PhoneMessageLog)
            .where(
                PhoneMessageLog.participant_id == participant_id,
                PhoneMessageLog.block_id == block_id,
                PhoneMessageLog.message_id == message_id,
            )
            .values(
                replied_at=timestamp,
                user_choice=chosen_text,
                reply_correct=is_correct,
                response_time_ms=response_time_ms,
                status=status,
            )
        )
        await db.commit()

    logger.debug(f"Phone reply: {participant_id} msg={message_id} choice={chosen_text!r} correct={is_correct} pos={correct_position_shown}")

    # Also log as generic interaction
    await _handle_interaction(participant_id, block_number, "phone_reply", data, db_factory)


async def _handle_phone_read(participant_id, block_number, data, db_factory):
    """Handle phone message read — update read_at timestamp."""
    from sqlalchemy import select, update

    message_id = data.get("message_id", "")
    timestamp = data.get("timestamp", time.time())

    if not message_id:
        return

    async with db_factory() as db:
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

        await db.execute(
            update(PhoneMessageLog)
            .where(
                PhoneMessageLog.participant_id == participant_id,
                PhoneMessageLog.block_id == block_id,
                PhoneMessageLog.message_id == message_id,
                PhoneMessageLog.read_at.is_(None),
            )
            .values(read_at=timestamp)
        )
        await db.commit()


async def _handle_mouse(participant_id, block_number, data, db_factory):
    """Store mouse tracking batch."""
    MAX_MOUSE_BATCH = 5000
    samples = data if isinstance(data, list) else [data]
    if len(samples) > MAX_MOUSE_BATCH:
        logger.warning(f"Mouse batch too large ({len(samples)}), truncating to {MAX_MOUSE_BATCH}")
        samples = samples[:MAX_MOUSE_BATCH]

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
            data=samples,
        )
        db.add(track)
        await db.commit()


async def _set_participant_offline(participant_id: str, db_factory):
    """Mark participant as offline when WebSocket disconnects."""
    try:
        async with db_factory() as db:
            from sqlalchemy import update
            from models.experiment import Participant
            await db.execute(
                update(Participant)
                .where(Participant.id == participant_id)
                .values(is_online=False)
            )
            await db.commit()
            logger.info(f"Participant {participant_id} marked offline")
    except Exception as e:
        logger.error(f"Failed to mark participant offline: {e}")


async def _check_activity_conditions(
    participant_id: str, task: str, event: str, data: dict
):
    """Map game state changes to activity watcher conditions.

    Conditions:
    - all_steaks_plated: all 3 steak pans reach 'plated' state
    - table_full_set: all 4 dining seats have all utensils placed
    - message_batch_end: a phone message with batch_end flag arrives
    """
    from engine.timeline import check_activity_watchers

    condition = None
    if task == "steak" and event == "steak_plated":
        # Check if all steaks are now plated (data may contain pan states)
        all_plated = data.get("all_plated", False)
        if all_plated:
            condition = "all_steaks_plated"
    elif task == "dining" and event == "table_complete":
        condition = "table_full_set"
    elif task == "phone" and event == "batch_end":
        condition = "message_batch_end"

    if condition:
        await check_activity_watchers(participant_id, condition)

