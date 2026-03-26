"""Block timeline engine — reads JSON template, fires events on schedule via WS."""

import asyncio
import json
import time
import logging
from pathlib import Path
from config import DATA_DIR, MESSAGE_COOLDOWN_S
from engine.execution_window import start_window
from engine.message_loader import load_message_pool, build_ws_payload, get_message

logger = logging.getLogger(__name__)

# Active timelines: key = "participant_id:block_number"
_active_timelines: dict[str, asyncio.Task] = {}

# DB factory reference for execution window callbacks
_db_factory = None


def set_db_factory(factory):
    """Set the database session factory for execution window callbacks."""
    global _db_factory
    _db_factory = factory


def _timeline_key(participant_id: str, block_number: int) -> str:
    return f"{participant_id}:{block_number}"


def load_timeline(block_number: int, condition: str, **kwargs) -> dict:
    """Load timeline JSON template for a block.

    Tries generated timeline first, then falls back to JSON files.
    """
    # Try to generate a participant-specific timeline
    unreminded_task_id = kwargs.get("unreminded_task_id")
    if unreminded_task_id is not None or condition in ("AF", "AFCB", "CONTROL"):
        try:
            from engine.timeline_generator import generate_block_timeline
            return generate_block_timeline(
                block_number=block_number,
                condition=condition,
                unreminded_task_id=unreminded_task_id,
                af_variant_index=kwargs.get("af_variant_index", 0),
            )
        except Exception as e:
            logger.warning(f"Timeline generation failed, falling back to JSON: {e}")

    # Fallback to static JSON files
    path = DATA_DIR / "timelines" / f"block_{block_number}_{condition.lower()}.json"
    if not path.exists():
        path = DATA_DIR / "timelines" / f"block_{block_number}.json"
    if not path.exists():
        path = DATA_DIR / "timelines" / "block_default.json"
    if not path.exists():
        logger.warning(f"No timeline template found for block {block_number}, using empty")
        return {"events": [], "duration_seconds": 600}
    try:
        with open(path) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        logger.error(f"Failed to load timeline from {path}: {e}")
        return {"events": [], "duration_seconds": 600}


async def run_timeline(
    participant_id: str,
    block_number: int,
    condition: str,
    send_fn,
    on_complete=None,
    db_factory=None,
):
    """Start and run a block timeline.

    send_fn(event_type: str, data: dict) — pushes to the participant's WS.
    db_factory — async session factory for execution window callbacks.
    """
    key = _timeline_key(participant_id, block_number)

    # Cancel any existing timeline for this slot
    if key in _active_timelines:
        _active_timelines[key].cancel()

    # Use provided or global db_factory
    factory = db_factory or _db_factory

    # Look up unreminded task_id for correct reminder generation (C2 fix)
    unreminded_task_id = None
    if factory and condition != "CONTROL":
        unreminded_task_id = await _get_unreminded_task_id(
            participant_id, block_number, factory
        )

    timeline = load_timeline(
        block_number, condition, unreminded_task_id=unreminded_task_id
    )
    events = timeline.get("events", [])
    duration = timeline.get("duration_seconds", 600)
    logger.info(f"[TIMELINE] Loaded timeline for {key}: {len(events)} events, {duration}s duration")

    async def _run():
        try:
            start_time = time.time()
            logger.info(f"[TIMELINE] _run started: {key} ({len(events)} events, {duration}s)")

            # Build trial lookup for this block
            trial_lookup = {}
            if factory:
                trial_lookup = await _build_trial_lookup(participant_id, block_number, factory)

            # Track last emitted game-clock tick
            last_tick_num = -1

            # Track last phone message send time for runtime cooldown
            last_msg_sent_at: float = 0.0

            for event in events:
                if asyncio.current_task().cancelled():
                    break

                t = event.get("t", 0)
                elapsed = time.time() - start_time

                # While waiting for next event, emit time_tick every 10 real seconds
                while t - elapsed > 1.0:
                    tick_num = int(elapsed) // 10
                    if tick_num != last_tick_num:
                        last_tick_num = tick_num
                        game_minutes = tick_num
                        game_hour = 17 + game_minutes // 60
                        game_min = game_minutes % 60
                        game_clock = f"{game_hour}:{game_min:02d}"
                        try:
                            await send_fn("time_tick", {
                                "elapsed": int(elapsed),
                                "game_clock": game_clock,
                            })
                        except Exception as e:
                            logger.error(f"[TIMELINE] Failed to send time_tick: {e}")
                    await asyncio.sleep(1.0)
                    elapsed = time.time() - start_time

                wait = t - elapsed
                if wait > 0:
                    await asyncio.sleep(wait)

                event_type = event.get("type", "unknown")
                event_data = dict(event.get("data", {}))  # shallow copy to avoid mutating template

                # Resolve reminder placeholders
                if event_type == "robot_speak" and "text" in event_data:
                    text = event_data["text"]
                    if text.startswith("{{reminder:"):
                        task_id = text.strip("{}").split(":")[1]
                        resolved = _resolve_reminder(task_id, condition)
                        if resolved is None:
                            # CONTROL condition — skip sending this reminder entirely
                            logger.debug(f"[TIMELINE] Skipping reminder for {task_id} (CONTROL)")
                            continue
                        event_data["text"] = resolved

                # Handle phone_message events — load full message, push rich payload
                if event_type == "phone_message":
                    # Runtime cooldown: wait if previous message was sent too recently
                    if MESSAGE_COOLDOWN_S > 0 and last_msg_sent_at > 0:
                        cooldown_remaining = MESSAGE_COOLDOWN_S - (time.time() - last_msg_sent_at)
                        if cooldown_remaining > 0:
                            logger.debug(f"[TIMELINE] Message cooldown: waiting {cooldown_remaining:.1f}s")
                            await asyncio.sleep(cooldown_remaining)

                    message_id = event_data.get("message_id", "")
                    msg = get_message(block_number, message_id)
                    if msg:
                        ws_payload = build_ws_payload(msg)
                        ws_payload["server_ts"] = time.time()
                        # Log the message send
                        if factory:
                            await _log_phone_message_sent(
                                participant_id, block_number, msg, time.time(), factory
                            )
                        try:
                            await send_fn("phone_message", ws_payload)
                            last_msg_sent_at = time.time()
                        except Exception as e:
                            logger.error(f"[TIMELINE] Failed to send phone_message: {e}")
                        continue  # phone_message is fully handled here
                    else:
                        logger.warning(f"[TIMELINE] Message not found: {message_id}")
                        continue

                # Handle PM trigger events — start execution window
                if event_type == "pm_trigger":
                    trigger_id = event_data.get("trigger_id", "")
                    trigger_time = time.time()
                    event_data["server_trigger_ts"] = trigger_time

                    if factory and trigger_id in trial_lookup:
                        trial = trial_lookup[trigger_id]
                        # Record trigger_fired_at
                        await _record_trigger_fired(trial["id"], trigger_time, factory)

                        # Start silent execution window
                        start_window(
                            participant_id=participant_id,
                            trial_id=trial["id"],
                            block_id=trial["block_id"],
                            trigger_time=trigger_time,
                            task_config=trial["task_config"],
                            on_expire=_on_window_expire,
                        )

                # Handle activity watch events — register a watcher
                if event_type == "pm_watch_activity":
                    task_id = event_data.get("task_id", "")
                    watch_condition = event_data.get("watch_condition", "")
                    fallback_time_offset = event_data.get("fallback_time", 530)
                    fallback_at = start_time + fallback_time_offset

                    logger.info(
                        f"[TIMELINE] Registering activity watcher: {task_id} "
                        f"condition={watch_condition} fallback_at={fallback_time_offset}s"
                    )

                    # Register watcher — the game_handler will check registered
                    # watchers on each game state update and fire the trigger when met.
                    # For now, also schedule a fallback.
                    _register_activity_watcher(
                        participant_id, task_id, watch_condition,
                        fallback_at, trial_lookup, factory, send_fn,
                    )
                    continue  # don't forward this internal event to frontend

                # Handle fake triggers — forward to frontend like real triggers
                if event_type == "fake_trigger":
                    # Fake triggers use the same frontend handler but have no PM task
                    logger.debug(f"[TIMELINE] Firing fake trigger [{key}] t={t}")

                logger.debug(f"[TIMELINE] Firing event [{key}] t={t}: {event_type}")
                try:
                    await send_fn(event_type, event_data)
                except Exception as e:
                    logger.error(f"[TIMELINE] Failed to send {event_type}: {e}")

            # Wait for remaining duration, continuing to emit time_ticks
            remaining = duration - (time.time() - start_time)
            while remaining > 0:
                elapsed = time.time() - start_time
                tick_num = int(elapsed) // 10
                if tick_num != last_tick_num:
                    last_tick_num = tick_num
                    game_minutes = tick_num
                    game_hour = 17 + game_minutes // 60
                    game_min = game_minutes % 60
                    game_clock = f"{game_hour}:{game_min:02d}"
                    try:
                        await send_fn("time_tick", {
                            "elapsed": int(elapsed),
                            "game_clock": game_clock,
                        })
                    except Exception as e:
                        logger.error(f"[TIMELINE] Failed to send time_tick (tail): {e}")
                await asyncio.sleep(1.0)
                remaining = duration - (time.time() - start_time)

            # Send block_end only if not already fired as part of timeline events
            if not any(e.get("type") == "block_end" for e in events):
                await send_fn("block_end", {})
            logger.info(f"[TIMELINE] Timeline completed: {key}")

            if on_complete:
                await on_complete()

        except asyncio.CancelledError:
            logger.info(f"[TIMELINE] Timeline cancelled: {key}")
            raise
        except Exception as e:
            logger.error(f"[TIMELINE] _run() CRASHED for {key}: {e}", exc_info=True)

    def _on_task_done(t: asyncio.Task):
        """Log if the timeline task failed with an unhandled exception."""
        if t.cancelled():
            return
        exc = t.exception()
        if exc:
            logger.error(f"[TIMELINE] Task failed for {key}: {exc}", exc_info=exc)

    task = asyncio.create_task(_run())
    task.add_done_callback(_on_task_done)
    _active_timelines[key] = task
    return task


async def _build_trial_lookup(participant_id: str, block_number: int, db_factory) -> dict:
    """Build a mapping from task_id to trial info for quick lookup."""
    from sqlalchemy import select
    from models.block import Block, PMTrial

    async with db_factory() as db:
        result = await db.execute(
            select(Block).where(
                Block.participant_id == participant_id,
                Block.block_number == block_number,
            )
        )
        block = result.scalar_one_or_none()
        if not block:
            return {}

        result = await db.execute(
            select(PMTrial).where(PMTrial.block_id == block.id)
        )
        trials = result.scalars().all()

        lookup = {}
        for trial in trials:
            cfg = trial.task_config or {}
            task_id = cfg.get("task_id", "")
            if task_id:
                lookup[task_id] = {
                    "id": trial.id,
                    "block_id": block.id,
                    "task_config": cfg,
                }
        return lookup


async def _record_trigger_fired(trial_id: int, trigger_time: float, db_factory):
    """Record trigger_fired_at on the PMTrial."""
    from sqlalchemy import update
    from models.block import PMTrial

    async with db_factory() as db:
        await db.execute(
            update(PMTrial)
            .where(PMTrial.id == trial_id)
            .values(
                trigger_fired_at=trigger_time,
                exec_window_start=trigger_time,
            )
        )
        await db.commit()


async def _get_unreminded_task_id(
    participant_id: str, block_number: int, db_factory,
) -> str | None:
    """Look up the task_id of the unreminded (filler) trial for a block."""
    from sqlalchemy import select
    from models.block import Block, PMTrial

    try:
        async with db_factory() as db:
            result = await db.execute(
                select(Block).where(
                    Block.participant_id == participant_id,
                    Block.block_number == block_number,
                )
            )
            block = result.scalar_one_or_none()
            if not block:
                return None
            result = await db.execute(
                select(PMTrial).where(
                    PMTrial.block_id == block.id,
                    PMTrial.is_filler == True,
                    PMTrial.has_reminder == False,
                ).limit(1)
            )
            trial = result.scalar_one_or_none()
            if trial and trial.task_config:
                return trial.task_config.get("task_id")
    except Exception as e:
        logger.warning(f"[TIMELINE] Failed to look up unreminded task: {e}")
    return None


async def _on_window_expire(
    participant_id: str,
    trial_id: int,
    block_id: int,
    trigger_time: float,
    task_config: dict,
):
    """Called when execution window expires — auto-score trial as 0."""
    from sqlalchemy import update
    from models.block import PMTrial
    from engine.execution_window import clear_active_trigger

    factory = _db_factory
    if not factory:
        logger.error("No db_factory set — cannot auto-score expired trial")
        return

    async with factory() as db:
        await db.execute(
            update(PMTrial)
            .where(PMTrial.id == trial_id)
            .values(
                score=0,
                exec_window_end=time.time(),
            )
        )
        await db.commit()

    clear_active_trigger(participant_id)
    logger.info(f"Auto-scored expired trial: trial={trial_id} score=0")


def cancel_timeline(participant_id: str, block_number: int):
    """Cancel a running timeline."""
    key = _timeline_key(participant_id, block_number)
    if key in _active_timelines:
        _active_timelines[key].cancel()
        del _active_timelines[key]
        logger.info(f"Timeline cancelled: {key}")


def cancel_all():
    """Cancel all active timelines (shutdown)."""
    from engine.execution_window import cancel_all_windows
    for key, task in _active_timelines.items():
        task.cancel()
    _active_timelines.clear()
    cancel_all_windows()
    cancel_activity_watchers()


async def _log_phone_message_sent(
    participant_id: str, block_number: int, message: dict, sent_at: float, db_factory
):
    """Log that a phone message was sent to the participant."""
    from sqlalchemy import select
    from models.block import Block
    from models.logging import PhoneMessageLog

    try:
        async with db_factory() as db:
            result = await db.execute(
                select(Block.id).where(
                    Block.participant_id == participant_id,
                    Block.block_number == block_number,
                )
            )
            block_id = result.scalar_one_or_none()
            if block_id is None:
                return

            log = PhoneMessageLog(
                participant_id=participant_id,
                block_id=block_id,
                message_id=message.get("id", ""),
                sender=message.get("sender", ""),
                message_type=message.get("type", "chat"),
                sent_at=sent_at,
            )
            db.add(log)
            await db.commit()
    except Exception as e:
        logger.error(f"[TIMELINE] Failed to log phone message: {e}")


# ──────────────────────────────────────────────
# Activity Watcher System
# ──────────────────────────────────────────────
# Watches for game-state conditions (all_steaks_plated, table_full_set,
# message_batch_end) and fires the associated PM trigger when met —
# or when a fallback deadline elapses.

_activity_watchers: dict[str, dict] = {}  # key = "participant_id:task_id"


def _register_activity_watcher(
    participant_id: str,
    task_id: str,
    watch_condition: str,
    fallback_at: float,
    trial_lookup: dict,
    db_factory,
    send_fn,
):
    """Register an activity watcher with a fallback timer.

    The watcher stores all info needed to fire the PM trigger.
    - game_handler calls `check_activity_watchers()` on each state update.
    - A fallback asyncio task fires the trigger if the condition isn't met by deadline.
    """
    watcher_key = f"{participant_id}:{task_id}"

    async def _fallback():
        """Fire the trigger if condition not met by deadline."""
        wait = fallback_at - time.time()
        if wait > 0:
            await asyncio.sleep(wait)

        if watcher_key not in _activity_watchers:
            return  # already fired by condition

        logger.info(f"[ACTIVITY_WATCHER] Fallback fired for {task_id} ({participant_id})")
        await _fire_activity_trigger(watcher_key, send_fn, trial_lookup, db_factory)

    fallback_task = asyncio.create_task(_fallback())

    _activity_watchers[watcher_key] = {
        "participant_id": participant_id,
        "task_id": task_id,
        "condition": watch_condition,
        "fallback_task": fallback_task,
        "trial_lookup": trial_lookup,
        "db_factory": db_factory,
        "send_fn": send_fn,
    }

    logger.info(
        f"[ACTIVITY_WATCHER] Registered: {watcher_key} "
        f"condition={watch_condition} fallback_at={fallback_at:.0f}"
    )


async def _fire_activity_trigger(watcher_key: str, send_fn, trial_lookup: dict, db_factory):
    """Fire a PM trigger for an activity watcher and clean up."""
    watcher = _activity_watchers.pop(watcher_key, None)
    if not watcher:
        return

    # Cancel fallback if it hasn't fired yet
    fb_task = watcher.get("fallback_task")
    if fb_task and not fb_task.done():
        fb_task.cancel()

    task_id = watcher["task_id"]
    participant_id = watcher["participant_id"]

    try:
        from engine.pm_tasks import get_task, get_task_config
        task_def = get_task(task_id)
    except KeyError:
        logger.error(f"[ACTIVITY_WATCHER] Unknown task: {task_id}")
        return

    trigger_time = time.time()

    # Build trigger event data matching pm_trigger format (with task_config for frontend)
    event_data = {
        "trigger_id": task_id,
        "trigger_event": task_def.trigger_visual,
        "trigger_type": "activity",
        "task_id": task_id,
        "signal": {
            "audio": task_def.trigger_audio,
            "visual": task_def.trigger_visual,
        },
        "server_trigger_ts": trigger_time,
        "task_config": get_task_config(task_id),
    }

    # Start execution window if trial exists
    if db_factory and task_id in trial_lookup:
        trial = trial_lookup[task_id]
        await _record_trigger_fired(trial["id"], trigger_time, db_factory)
        start_window(
            participant_id=participant_id,
            trial_id=trial["id"],
            block_id=trial["block_id"],
            trigger_time=trigger_time,
            task_config=trial["task_config"],
            on_expire=_on_window_expire,
        )

    # Send to frontend
    try:
        await send_fn("pm_trigger", event_data)
    except Exception as e:
        logger.error(f"[ACTIVITY_WATCHER] Failed to send trigger: {e}")

    logger.info(f"[ACTIVITY_WATCHER] Trigger fired: {task_id} ({participant_id})")


async def check_activity_watchers(participant_id: str, condition_met: str):
    """Called by game_handler when a game-state condition changes.

    condition_met: "all_steaks_plated" | "table_full_set" | "message_batch_end"
    """
    to_fire = []
    for key, watcher in list(_activity_watchers.items()):
        if (watcher["participant_id"] == participant_id
                and watcher["condition"] == condition_met):
            to_fire.append(key)

    for key in to_fire:
        watcher = _activity_watchers.get(key)
        if watcher:
            logger.info(
                f"[ACTIVITY_WATCHER] Condition '{condition_met}' met — firing {key}"
            )
            await _fire_activity_trigger(
                key,
                watcher["send_fn"],
                watcher["trial_lookup"],
                watcher["db_factory"],
            )


def cancel_activity_watchers(participant_id: str | None = None):
    """Cancel activity watchers, optionally for a specific participant."""
    keys_to_remove = []
    for key, watcher in _activity_watchers.items():
        if participant_id is None or watcher["participant_id"] == participant_id:
            fb = watcher.get("fallback_task")
            if fb and not fb.done():
                fb.cancel()
            keys_to_remove.append(key)
    for key in keys_to_remove:
        _activity_watchers.pop(key, None)
    if keys_to_remove:
        logger.info(f"[ACTIVITY_WATCHER] Cancelled {len(keys_to_remove)} watchers")


def _resolve_reminder(task_id: str, condition: str) -> str | None:
    """Resolve a reminder placeholder to actual text.

    For CONTROL condition, returns None (no reminder should be sent).
    For AF/AFCB, tries to look up from ReminderMessage DB table,
    falls back to baseline reminder from task registry.
    """
    if condition == "CONTROL":
        return None
    try:
        from engine.pm_tasks import get_task
        task_def = get_task(task_id)
        # For now, always use baseline reminder text from the registry.
        # When AI-generated reminders are imported, this should query
        # the ReminderMessage table for AF/AFCB variants.
        return task_def.baseline_reminder
    except KeyError:
        return f"[Unknown task: {task_id}]"

