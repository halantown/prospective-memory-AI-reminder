"""Runtime-plan timeline engine for phone, clock, and block lifecycle events."""

import asyncio
import time
import logging
from dataclasses import dataclass
from config import MESSAGE_COOLDOWN_S
from engine.game_clock import (
    DEFAULT_CLOCK_END_SECONDS,
    GameClock,
    format_game_clock,
)
from engine.message_loader import build_ws_payload, get_message, get_contacts
from engine.runtime_plan_loader import load_runtime_plan, timeline_from_plan

logger = logging.getLogger(__name__)

# Active timelines: key = "participant_id:block_number"
_active_timelines: dict[str, asyncio.Task] = {}


@dataclass
class TimelineControl:
    task: asyncio.Task | None = None
    clock: GameClock | None = None


_timeline_controls: dict[str, TimelineControl] = {}

# Per-participant unanswered chat tracking for nudge mechanism
# key = participant_id, value = set of unanswered message_ids
_unanswered_chats: dict[str, set[str]] = {}

# DB factory reference for execution window callbacks
_db_factory = None


def mark_chat_answered(participant_id: str, message_id: str):
    """Remove a message from the unanswered set (called when participant replies)."""
    if participant_id in _unanswered_chats:
        _unanswered_chats[participant_id].discard(message_id)


def set_db_factory(factory):
    """Set the database session factory for execution window callbacks."""
    global _db_factory
    _db_factory = factory


def _timeline_key(participant_id: str, block_number: int) -> str:
    return f"{participant_id}:{block_number}"


def _timeline_elapsed(start_time: float, control: TimelineControl) -> float:
    """Return timeline seconds with explicit pause intervals excluded."""
    if control.clock is not None:
        return control.clock.now()
    return max(0.0, time.time() - start_time)


async def _sleep_timeline(seconds: float, control: TimelineControl) -> None:
    """Sleep for unpaused timeline seconds."""
    if control.clock is not None:
        await control.clock.sleep_for(seconds)
        return
    await asyncio.sleep(max(0.0, seconds))


async def _emit_time_tick(
    send_fn,
    elapsed: float,
    clock_end_seconds: int,
    *,
    tail: bool = False,
) -> None:
    """Emit one authoritative gameplay clock tick."""
    try:
        await send_fn("time_tick", {
            "elapsed": int(elapsed),  # Backward-compatible field.
            "game_time_s": int(elapsed),
            "game_clock": format_game_clock(elapsed, clock_end_seconds),
            "frozen": False,
            "clock_end_seconds": clock_end_seconds,
        })
    except Exception as e:
        suffix = " (tail)" if tail else ""
        logger.error(f"[TIMELINE] Failed to send time_tick{suffix}: {e}")


def pause_timeline(participant_id: str, block_number: int) -> bool:
    """Pause a running timeline so phone/HUD events stop during PM overlays."""
    key = _timeline_key(participant_id, block_number)
    control = _timeline_controls.get(key)
    if not control or not control.task or control.task.done():
        return False
    if control.clock and control.clock.is_paused:
        return True
    if control.clock and control.clock.pause("pm"):
        logger.info(f"[TIMELINE] Paused: {key}")
        return True
    return False


def resume_timeline(participant_id: str, block_number: int) -> bool:
    """Resume a previously paused timeline."""
    key = _timeline_key(participant_id, block_number)
    control = _timeline_controls.get(key)
    if not control or not control.clock:
        return False
    if control.clock.resume("pm"):
        logger.info(f"[TIMELINE] Resumed: {key}")
        return True
    return False


def load_timeline(
    block_number: int,
    condition: str,
    *,
    runtime_plan: dict | None = None,
) -> dict:
    """Build the non-PM/non-cooking event timeline from the runtime plan."""
    plan = runtime_plan or load_runtime_plan()
    return timeline_from_plan(plan, block_number=block_number, condition=condition)


async def run_timeline(
    participant_id: str,
    block_number: int,
    condition: str,
    send_fn,
    on_complete=None,
    db_factory=None,
    block_start_time: float | None = None,
    clock: GameClock | None = None,
    runtime_plan: dict | None = None,
):
    """Start and run a block timeline.

    send_fn(event_type: str, data: dict) — pushes to the participant's WS.
    db_factory — async session factory for execution window callbacks.
    block_start_time — if provided (reconnect case), treat this as the real t=0
        so that events already past their scheduled time are skipped instead of
        re-fired.  phone_message events that have already been delivered are the
        primary concern; other one-shot events (pm_trigger, block_end, etc.) are
        also skipped to avoid double-firing.
    """
    key = _timeline_key(participant_id, block_number)

    # Cancel any existing timeline for this slot
    if key in _active_timelines:
        old_task = _active_timelines.pop(key)
        _timeline_controls.pop(key, None)
        old_task.cancel()
        try:
            await old_task
        except (asyncio.CancelledError, Exception):
            pass

    # Use provided or global db_factory
    factory = db_factory or _db_factory

    timeline = load_timeline(block_number, condition, runtime_plan=runtime_plan)
    events = timeline.get("events", [])
    duration = timeline.get("duration_seconds", 600)
    clock_end_seconds = timeline.get("clock_end_seconds", DEFAULT_CLOCK_END_SECONDS)
    logger.info(f"[TIMELINE] Loaded timeline for {key}: {len(events)} events, {duration}s duration")

    timeline_clock = clock or GameClock(clock_end_seconds=clock_end_seconds)
    timeline_clock.clock_end_seconds = clock_end_seconds
    control = TimelineControl(clock=timeline_clock)

    async def _run():
        try:
            start_time = block_start_time if block_start_time else time.time()
            if control.clock:
                control.clock.start(start_time)
            # How far into the block are we already?  0 on first start, >0 on reconnect.
            resume_offset = _timeline_elapsed(start_time, control) if block_start_time else 0.0
            logger.info(f"[TIMELINE] _run started: {key} ({len(events)} events, {duration}s, resume_offset={resume_offset:.1f}s)")

            # Send contacts list for phone chat UI
            contacts = get_contacts(block_number)
            try:
                await send_fn("phone_contacts", {"contacts": contacts})
            except Exception as e:
                logger.error(f"[TIMELINE] Failed to send phone_contacts: {e}")

            # Track last emitted game-clock tick
            last_tick_num = -1

            # Track last phone message send time in timeline seconds for runtime cooldown
            last_msg_sent_at: float = 0.0
            # Initialize unanswered chat tracking for nudge mechanism
            _unanswered_chats[participant_id] = set()
            last_nudge_at: float = 0.0
            NUDGE_THRESHOLD = 5
            NUDGE_COOLDOWN_S = 60.0

            for event in events:
                if asyncio.current_task().cancelled():
                    break

                t = event.get("t", 0)
                elapsed = _timeline_elapsed(start_time, control)

                # On reconnect, skip events whose scheduled time has already passed.
                # phone_message events in particular must not be re-delivered; other
                # one-shot events (pm_trigger, block_end, etc.) would also double-fire.
                if resume_offset > 0 and t <= resume_offset:
                    logger.debug(f"[TIMELINE] Skipping past event t={t}s (resume_offset={resume_offset:.1f}s): {event.get('type')}")
                    continue

                # While waiting for next event, emit time_tick every 10 timeline seconds
                while t - elapsed > 1.0:
                    tick_num = int(elapsed) // 10
                    if tick_num != last_tick_num:
                        last_tick_num = tick_num
                        await _emit_time_tick(send_fn, elapsed, clock_end_seconds)
                    await _sleep_timeline(1.0, control)
                    elapsed = _timeline_elapsed(start_time, control)

                wait = t - elapsed
                if wait > 0:
                    if control.clock is not None:
                        await control.clock.sleep_until(t)
                    else:
                        await _sleep_timeline(wait, control)

                event_type = event.get("type", "unknown")
                event_data = dict(event.get("data", {}))  # shallow copy to avoid mutating template

                # Handle phone_message events — load full message, push rich payload
                if event_type == "phone_message":
                    # Runtime cooldown: wait if previous message was sent too recently
                    if MESSAGE_COOLDOWN_S > 0 and last_msg_sent_at > 0:
                        cooldown_remaining = MESSAGE_COOLDOWN_S - (
                            _timeline_elapsed(start_time, control) - last_msg_sent_at
                        )
                        if cooldown_remaining > 0:
                            logger.debug(f"[TIMELINE] Message cooldown: waiting {cooldown_remaining:.1f}s")
                            await _sleep_timeline(cooldown_remaining, control)

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
                            last_msg_sent_at = _timeline_elapsed(start_time, control)
                            # Track unanswered chats for nudge
                            if msg.get("channel") == "chat":
                                _unanswered_chats.setdefault(participant_id, set()).add(message_id)
                                # Nudge: if too many unanswered and cooldown elapsed
                                now = time.time()
                                unanswered_count = len(_unanswered_chats.get(participant_id, set()))
                                if (unanswered_count >= NUDGE_THRESHOLD
                                        and now - last_nudge_at > NUDGE_COOLDOWN_S):
                                    nudge_payload = {
                                        "id": f"nudge_{int(now)}",
                                        "sender": "Phone 📱",
                                        "text": "You have several unread messages",
                                        "channel": "notification",
                                        "server_ts": now,
                                    }
                                    try:
                                        await send_fn("phone_message", nudge_payload)
                                        last_nudge_at = now
                                        logger.info(f"[TIMELINE] Nudge sent: {unanswered_count} unanswered")
                                    except Exception as e:
                                        logger.error(f"[TIMELINE] Failed to send nudge: {e}")
                        except Exception as e:
                            logger.error(f"[TIMELINE] Failed to send phone_message: {e}")
                        continue  # phone_message is fully handled here
                    else:
                        logger.warning(f"[TIMELINE] Message not found: {message_id}")
                        continue

                logger.debug(f"[TIMELINE] Firing event [{key}] t={t}: {event_type}")
                try:
                    await send_fn(event_type, event_data)
                except Exception as e:
                    logger.error(f"[TIMELINE] Failed to send {event_type}: {e}")

            # Wait for remaining duration, continuing to emit time_ticks
            remaining = duration - _timeline_elapsed(start_time, control)
            while remaining > 0:
                elapsed = _timeline_elapsed(start_time, control)
                tick_num = int(elapsed) // 10
                if tick_num != last_tick_num:
                    last_tick_num = tick_num
                    await _emit_time_tick(send_fn, elapsed, clock_end_seconds, tail=True)
                await _sleep_timeline(1.0, control)
                remaining = duration - _timeline_elapsed(start_time, control)

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
        if _active_timelines.get(key) is t:
            _active_timelines.pop(key, None)
            _timeline_controls.pop(key, None)
        if t.cancelled():
            return
        exc = t.exception()
        if exc:
            logger.error(f"[TIMELINE] Task failed for {key}: {exc}", exc_info=exc)

    task = asyncio.create_task(_run())
    control.task = task
    task.add_done_callback(_on_task_done)
    _active_timelines[key] = task
    _timeline_controls[key] = control
    return task


def cancel_timeline(participant_id: str, block_number: int):
    """Cancel a running timeline."""
    key = _timeline_key(participant_id, block_number)
    if key in _active_timelines:
        task = _active_timelines.pop(key)
        _timeline_controls.pop(key, None)
        task.cancel()
        logger.info(f"Timeline cancelled: {key}")


def cancel_all():
    """Cancel all active timelines (shutdown)."""
    for key, task in _active_timelines.items():
        task.cancel()
    _active_timelines.clear()
    _timeline_controls.clear()


async def _log_phone_message_sent(
    participant_id: str, block_number: int, message: dict, sent_at: float, db_factory
):
    """Log that a phone message was sent to the participant.

    Uses upsert so re-sending the same message_id (e.g. after reconnect) updates
    the existing row instead of creating a duplicate.
    """
    from sqlalchemy import select
    from sqlalchemy.dialects.postgresql import insert as pg_insert
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

            channel = message.get("channel", "notification")
            message_id = message.get("id", "")
            # For chats: derive sender from contact_id; for notifications: use sender field
            sender = message.get("sender", message.get("contact_id", ""))

            stmt = (
                pg_insert(PhoneMessageLog)
                .values(
                    participant_id=participant_id,
                    block_id=block_id,
                    message_id=message_id,
                    sender=sender,
                    message_type=channel,
                    category=channel,
                    correct_answer=message.get("correct_choice") if channel == "chat" else None,
                    sent_at=sent_at,
                )
                .on_conflict_do_update(
                    index_elements=["participant_id", "block_id", "message_id"],
                    set_={"sent_at": sent_at},
                )
            )
            await db.execute(stmt)
            await db.commit()
    except Exception as e:
        logger.error(f"[TIMELINE] Failed to log phone message: {e}")
