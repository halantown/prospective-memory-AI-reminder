"""Game WebSocket handler — bidirectional communication during gameplay."""

import asyncio
import json
import logging
import time
from fastapi import WebSocket, WebSocketDisconnect
from websocket.connection_manager import manager, ws_pump
from engine.timeline import run_timeline, cancel_timeline, pause_timeline, resume_timeline
from engine.cooking_engine import CookingEngine
from engine.game_clock import GameClock
from engine.game_time import start_game_time, unfreeze_game_time, get_current_game_time
from engine.pm_session import run_pm_session, signal_pipeline_complete
from models.logging import InteractionLog, MouseTrack, PhoneMessageLog

logger = logging.getLogger(__name__)

# Per-participant CookingEngine instances
_cooking_engines: dict[str, CookingEngine] = {}

# Per-participant gameplay clocks shared by timeline and cooking.
_game_clocks: dict[str, GameClock] = {}

# Per-participant PM session tasks
_pm_session_tasks: dict[str, asyncio.Task] = {}


def _get_game_clock(participant_id: str) -> GameClock:
    clock = _game_clocks.get(participant_id)
    if clock is None:
        clock = GameClock()
        _game_clocks[participant_id] = clock
    return clock


def _pause_gameplay_for_pm(participant_id: str, block_number: int) -> None:
    """Pause non-PM gameplay while a PM/fake trigger modal owns the UI."""
    timeline_paused = pause_timeline(participant_id, block_number)
    cooking = _cooking_engines.get(participant_id)
    if cooking:
        cooking.pause()
    logger.info(
        "[GAME_HANDLER] Gameplay paused for PM pipeline: participant=%s timeline=%s cooking=%s",
        participant_id,
        timeline_paused,
        cooking is not None,
    )


def _resume_gameplay_after_pm(participant_id: str, block_number: int) -> None:
    """Resume non-PM gameplay after the PM/fake trigger pipeline completes."""
    cooking = _cooking_engines.get(participant_id)
    if cooking:
        cooking.resume()
    timeline_resumed = resume_timeline(participant_id, block_number)
    logger.info(
        "[GAME_HANDLER] Gameplay resumed after PM pipeline: participant=%s timeline=%s cooking=%s",
        participant_id,
        timeline_resumed,
        cooking is not None,
    )


def _ensure_pm_session_task(participant_id: str, task_order: str, block_number: int, send_fn, db_factory) -> None:
    """Start or resume the PM scheduler if this process is not already running one."""
    existing = _pm_session_tasks.get(participant_id)
    if existing and not existing.done():
        logger.info(f"[GAME_HANDLER] PM session task already running for {participant_id}, skipping restart")
        return

    pm_task = asyncio.create_task(
        run_pm_session(
            participant_id,
            task_order,
            send_fn,
            db_factory,
            on_pipeline_start=lambda: _pause_gameplay_for_pm(participant_id, block_number),
        )
    )
    _pm_session_tasks[participant_id] = pm_task
    logger.info(f"[GAME_HANDLER] PM session task ensured for {participant_id} (order={task_order})")


async def handle_game_ws(
    ws: WebSocket,
    participant_id: str,
    db_factory,
):
    """Handle a game WebSocket connection for a participant."""
    block_number = 1  # single-session: always block 1

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
                task_order = "A"
                participant_result = await db.execute(
                    select(Participant).where(Participant.id == participant_id)
                )
                participant = participant_result.scalar_one_or_none()
                if participant:
                    task_order = participant.task_order
                    start_game_time(participant)
                    await db.commit()
                # Use the block's real start time so past events are skipped instead
                # of re-fired (prevents duplicate phone messages on reconnect).
                # Guard: if the block started longer ago than the block duration (stale
                # test session / block never properly closed), fall back to a fresh
                # timeline so the WS doesn't immediately fire block_end and close.
                block_start_ts: float | None = None
                if block.started_at:
                    age_s = time.time() - block.started_at.timestamp()
                    from config import COOKING_TOTAL_DURATION_S
                    if age_s < COOKING_TOTAL_DURATION_S:
                        block_start_ts = block.started_at.timestamp()
                    else:
                        logger.warning(
                            f"[GAME_HANDLER] Block {block_number} started {age_s:.0f}s ago "
                            f"(> {COOKING_TOTAL_DURATION_S}s), ignoring stale start time"
                        )
                logger.info(f"[GAME_HANDLER] Auto-starting timeline (block already PLAYING) for {participant_id} block {block_number}")
                clock = _get_game_clock(participant_id)
                timeline_task = await run_timeline(
                    participant_id=participant_id,
                    block_number=block_number,
                    condition=condition,
                    send_fn=send_event,
                    db_factory=db_factory,
                    block_start_time=block_start_ts,
                    clock=clock,
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
                            clock=clock,
                        )
                        _cooking_engines[participant_id] = cooking
                        cooking.start(block_start_ts)
                        logger.info(f"[GAME_HANDLER] CookingEngine restarted on reconnect for {participant_id} block {block_number}")
                    except Exception as ce:
                        logger.error(f"[GAME_HANDLER] CookingEngine restart failed on reconnect: {ce}")
                else:
                    logger.info(f"[GAME_HANDLER] CookingEngine already running for {participant_id}, skipping restart")

                try:
                    _ensure_pm_session_task(participant_id, task_order, block_number, send_event, db_factory)
                except Exception as pe:
                    logger.error(f"[GAME_HANDLER] PM session resume failed on reconnect: {pe}")
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
        # Wait for pump or receiver to end (i.e. client disconnects).
        # The timeline task is NOT included here: timeline completion (e.g.
        # block_end) must be delivered to the client before the WS closes, so
        # the connection lifetime is controlled by the client, not the server.
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
        # Only cancel timeline/pm_session if this connection is still the latest.
        # A newer connection may have already started a new timeline.
        if manager.is_latest_connection(participant_id, conn_id):
            if timeline_task and not timeline_task.done():
                timeline_task.cancel()
            cancel_timeline(participant_id, block_number)
            # Stop and save cooking engine
            cooking = _cooking_engines.pop(participant_id, None)
            if cooking:
                await cooking.save_dish_scores()
                await cooking.stop()
            _game_clocks.pop(participant_id, None)
            # Cancel PM session task
            pm_task = _pm_session_tasks.pop(participant_id, None)
            if pm_task and not pm_task.done():
                pm_task.cancel()
        else:
            logger.info(f"Skipping timeline/pm_session cleanup for {participant_id} — superseded by newer connection")
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
                    ack_data = await _handle_heartbeat(participant_id, db_factory)
                    await ws.send_text(json.dumps({"event": "heartbeat_ack", "data": ack_data}))
                elif msg_type == "start_game":
                    logger.info(f"[GAME_HANDLER] Received start_game from {participant_id} block {block_number}")
                    await _handle_start_game(participant_id, block_number, db_factory,
                                             lambda et, d: manager.send_to_participant(participant_id, et, d))
                elif msg_type == "room_switch":
                    await _handle_room_switch(participant_id, block_number, data, db_factory)
                elif msg_type == "task_action":
                    await _handle_task_action(participant_id, block_number, data, db_factory)
                elif msg_type == "pm_greeting_complete":
                    await _handle_pm_greeting_complete(participant_id, data, db_factory)
                elif msg_type == "pm_reminder_ack":
                    await _handle_pm_reminder_ack(participant_id, data, db_factory)
                elif msg_type == "pm_decoy_selected":
                    await _handle_pm_decoy_selected(participant_id, data, db_factory)
                elif msg_type == "pm_confidence_rated":
                    await _handle_pm_confidence_rated(participant_id, data, db_factory)
                elif msg_type == "pm_action_complete":
                    await _handle_pm_action_complete(participant_id, block_number, data, db_factory)
                elif msg_type == "fake_trigger_ack":
                    await _handle_fake_trigger_ack(participant_id, block_number, data, db_factory)
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

        # Load participant to get task_order and initialise game time
        from models.experiment import Participant
        p_result = await db.execute(select(Participant).where(Participant.id == participant_id))
        participant = p_result.scalar_one_or_none()
        task_order = "A"
        if participant:
            task_order = participant.task_order
            start_game_time(participant)

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
            _game_clocks.pop(participant_id, None)

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
    clock = _get_game_clock(participant_id)
    try:
        task = await run_timeline(
            participant_id=participant_id,
            block_number=block_number,
            condition=condition,
            send_fn=send_fn,
            on_complete=_on_block_complete,
            db_factory=db_factory,
            clock=clock,
        )
        logger.info(f"[GAME_HANDLER] Timeline task created: {task}")
    except Exception as e:
        logger.error(f"[GAME_HANDLER] Timeline start failed, rolling back block status: {e}")
        _game_clocks.pop(participant_id, None)
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
            clock=clock,
        )
        _cooking_engines[participant_id] = cooking
        cooking.start()
        logger.info(f"[GAME_HANDLER] CookingEngine started for {participant_id} block {block_number}")
    except Exception as e:
        logger.error(f"[GAME_HANDLER] CookingEngine start failed: {e}")

    # Start the PM session task
    try:
        _ensure_pm_session_task(participant_id, task_order, block_number, send_fn, db_factory)
    except Exception as e:
        logger.error(f"[GAME_HANDLER] PM session start failed: {e}")


async def _handle_heartbeat(participant_id: str, db_factory) -> dict:
    """Update heartbeat timestamp. Returns state dict for heartbeat_ack."""
    async with db_factory() as db:
        from sqlalchemy import select
        from models.experiment import Participant
        result = await db.execute(select(Participant).where(Participant.id == participant_id))
        p = result.scalar_one_or_none()
        if not p:
            return {"frozen": False, "game_time_elapsed_s": 0.0}
        p.last_heartbeat = time.time()
        p.is_online = True
        p.disconnected_at = None
        frozen = p.frozen_since is not None
        game_time = get_current_game_time(p)
        await db.commit()
    return {"frozen": frozen, "game_time_elapsed_s": game_time}


async def _handle_room_switch(participant_id, block_number, data, db_factory):
    """Log a room switch."""
    await _handle_interaction(participant_id, block_number, "room_switch", data, db_factory)


async def _handle_task_action(participant_id, block_number, data, db_factory):
    """Log ongoing task action."""
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
    client_step_index = data.get("step_index")
    if not isinstance(client_step_index, int):
        client_step_index = None
    ts = data.get("timestamp", time.time())

    result = await cooking.handle_action(
        dish_id=dish_id,
        chosen_option_id=chosen_option_id,
        chosen_option_text=chosen_option_text,
        station=station,
        timestamp=ts,
        client_step_index=client_step_index,
    )
    if result.get("result") in {"no_active_step", "wrong_station", "stale_step"}:
        logger.warning(
            "[GAME_HANDLER] rejected cooking_action participant=%s dish=%s client_step=%s station=%s result=%s",
            participant_id,
            dish_id,
            client_step_index,
            station,
            result,
        )

    # Also log as interaction for general event tracking
    await _handle_interaction(participant_id, block_number, "cooking_action", data, db_factory)


async def _handle_pm_greeting_complete(participant_id: str, data: dict, db_factory):
    """Mark PM greeting animation as complete."""
    task_id = data.get("task_id")
    if not task_id:
        return
    async with db_factory() as db:
        from sqlalchemy import select
        from models.pm_module import PMTaskEvent
        result = await db.execute(
            select(PMTaskEvent).where(
                PMTaskEvent.session_id == participant_id,
                PMTaskEvent.task_id == task_id,
                PMTaskEvent.action_animation_complete_time.is_(None),
            ).order_by(PMTaskEvent.id.desc()).limit(1)
        )
        evt = result.scalar_one_or_none()
        if evt:
            evt.greeting_complete_time = data.get("game_time", time.time())
            await db.commit()


async def _handle_pm_reminder_ack(participant_id: str, data: dict, db_factory):
    """Record reminder display + acknowledge times."""
    task_id = data.get("task_id")
    if not task_id:
        return
    async with db_factory() as db:
        from sqlalchemy import select
        from models.pm_module import PMTaskEvent
        result = await db.execute(
            select(PMTaskEvent).where(
                PMTaskEvent.session_id == participant_id,
                PMTaskEvent.task_id == task_id,
                PMTaskEvent.action_animation_complete_time.is_(None),
            ).order_by(PMTaskEvent.id.desc()).limit(1)
        )
        evt = result.scalar_one_or_none()
        if evt:
            ts = data.get("game_time", time.time())
            if evt.reminder_display_time is None:
                evt.reminder_display_time = ts
            evt.reminder_acknowledge_time = ts
            await db.commit()


async def _handle_pm_decoy_selected(participant_id: str, data: dict, db_factory):
    """Record decoy task selection."""
    task_id = data.get("task_id")
    if not task_id:
        return
    async with db_factory() as db:
        from sqlalchemy import select
        from models.pm_module import PMTaskEvent
        result = await db.execute(
            select(PMTaskEvent).where(
                PMTaskEvent.session_id == participant_id,
                PMTaskEvent.task_id == task_id,
                PMTaskEvent.action_animation_complete_time.is_(None),
            ).order_by(PMTaskEvent.id.desc()).limit(1)
        )
        evt = result.scalar_one_or_none()
        if evt:
            evt.decoy_options_order = data.get("decoy_options_order", [])
            evt.decoy_selected_option = data.get("selected_option", "")
            evt.decoy_correct = data.get("decoy_correct", False)
            rt_ms = data.get("response_time_ms")
            evt.decoy_response_time = rt_ms / 1000.0 if rt_ms is not None else None
            await db.commit()


async def _handle_pm_confidence_rated(participant_id: str, data: dict, db_factory):
    """Record confidence rating and trigger avatar action."""
    task_id = data.get("task_id")
    if not task_id:
        return

    # DB logging is best-effort — a failure must NOT block avatar_action from being sent
    try:
        async with db_factory() as db:
            from sqlalchemy import select
            from models.pm_module import PMTaskEvent
            result = await db.execute(
                select(PMTaskEvent).where(
                    PMTaskEvent.session_id == participant_id,
                    PMTaskEvent.task_id == task_id,
                    PMTaskEvent.action_animation_complete_time.is_(None),
                ).order_by(PMTaskEvent.id.desc()).limit(1)
            )
            evt = result.scalar_one_or_none()
            if evt:
                evt.confidence_rating = data.get("confidence_rating")
                rt_ms = data.get("response_time_ms")
                evt.confidence_response_time = rt_ms / 1000.0 if rt_ms is not None else None
                await db.commit()
    except Exception:
        logger.exception(
            "[GAME_HANDLER] pm_confidence_rated DB error (participant=%s task=%s) — "
            "avatar_action will still be sent",
            participant_id, task_id,
        )

    # Tell the frontend to start the avatar action animation.
    # This is sent regardless of DB outcome so the modal never blocks permanently.
    await manager.send_to_participant(participant_id, "avatar_action", {
        "task_id": task_id,
    })


async def _handle_pm_action_complete(participant_id: str, block_number: int, data: dict, db_factory):
    """Record action animation completion; resume cooking and signal PM pipeline."""
    task_id = data.get("task_id")
    if not task_id:
        return
    async with db_factory() as db:
        from sqlalchemy import select
        from models.experiment import Participant
        from models.pm_module import PMTaskEvent
        result = await db.execute(
            select(PMTaskEvent).where(
                PMTaskEvent.session_id == participant_id,
                PMTaskEvent.task_id == task_id,
                PMTaskEvent.action_animation_complete_time.is_(None),
            ).order_by(PMTaskEvent.id.desc()).limit(1)
        )
        evt = result.scalar_one_or_none()
        now = time.time()
        if evt:
            evt.action_animation_start_time = data.get("action_animation_start_time", now)
            evt.action_animation_complete_time = data.get("action_animation_complete_time", now)
            await db.commit()

        # Unfreeze game time
        p_result = await db.execute(select(Participant).where(Participant.id == participant_id))
        p = p_result.scalar_one_or_none()
        if p:
            unfreeze_game_time(p)
            await db.commit()

    _resume_gameplay_after_pm(participant_id, block_number)

    # Advance PM session to next trigger
    signal_pipeline_complete(participant_id)


async def _handle_fake_trigger_ack(participant_id: str, block_number: int, data: dict, db_factory):
    """Acknowledge a fake trigger and resume the game."""
    trigger_type = data.get("trigger_type", "")
    async with db_factory() as db:
        from sqlalchemy import select
        from models.experiment import Participant
        from models.pm_module import FakeTriggerEvent
        result = await db.execute(
            select(FakeTriggerEvent).where(
                FakeTriggerEvent.session_id == participant_id,
                FakeTriggerEvent.trigger_type == trigger_type,
                FakeTriggerEvent.acknowledged == False,  # noqa: E712
            ).order_by(FakeTriggerEvent.id.desc()).limit(1)
        )
        evt = result.scalar_one_or_none()
        if evt:
            evt.acknowledged = True
            await db.commit()

        # Unfreeze game time
        p_result = await db.execute(
            select(Participant).where(Participant.id == participant_id)
        )
        p = p_result.scalar_one_or_none()
        if p:
            unfreeze_game_time(p)
            await db.commit()

    _resume_gameplay_after_pm(participant_id, block_number)

    signal_pipeline_complete(participant_id)


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
            from sqlalchemy import select, update
            from models.experiment import Participant
            result = await db.execute(select(Participant).where(Participant.id == participant_id))
            p = result.scalar_one_or_none()
            if p:
                p.is_online = False
                if p.disconnected_at is None:
                    p.disconnected_at = time.time()
                await db.commit()
            logger.info(f"Participant {participant_id} marked offline")
    except Exception as e:
        logger.error(f"Failed to mark participant offline: {e}")
