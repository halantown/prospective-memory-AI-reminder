"""PM Trigger Session — event-driven trigger schedule for one participant."""

import asyncio
import logging
import time
from config import TRIGGER_SCHEDULE, TASK_ORDERS, SESSION_END_DELAY_AFTER_LAST_TRIGGER_S
from engine.game_time import freeze_game_time, get_current_game_time
from engine.game_clock import GameClock
from engine.pm_tasks import get_task

logger = logging.getLogger(__name__)

# Per-session asyncio.Event signaling current pipeline is done
_pipeline_complete_events: dict[str, asyncio.Event] = {}


def signal_pipeline_complete(session_id: str):
    """Called by game_handler when pm_action_complete or fake_trigger_ack arrives."""
    ev = _pipeline_complete_events.get(session_id)
    if ev:
        ev.set()


async def _wait_game_seconds(
    session_id: str,
    seconds: float,
    db_factory,
    clock: GameClock | None = None,
) -> None:
    """Wait until `seconds` of game time have elapsed since this call was made.

    Uses GameClock when available. Falls back to DB polling for legacy callers.
    """
    if clock is not None:
        await clock.sleep_for(seconds)
        return

    from sqlalchemy import select
    from models.experiment import Participant

    try:
        async with db_factory() as db:
            result = await db.execute(select(Participant).where(Participant.id == session_id))
            participant = result.scalar_one_or_none()
            if not participant:
                return
            start_gt = get_current_game_time(participant)
    except Exception:
        logger.exception("_wait_game_seconds: failed to get initial game time for %s", session_id)
        return

    while True:
        await asyncio.sleep(1.0)
        try:
            async with db_factory() as db:
                result = await db.execute(select(Participant).where(Participant.id == session_id))
                participant = result.scalar_one_or_none()
                if not participant:
                    return
                current_gt = get_current_game_time(participant)
                if current_gt - start_gt >= seconds:
                    return
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("_wait_game_seconds: poll error for %s", session_id)


async def _get_current_game_time(
    session_id: str,
    db_factory,
    clock: GameClock | None = None,
) -> float:
    """Return participant game time, or 0 if the participant no longer exists."""
    if clock is not None:
        return clock.now()

    from sqlalchemy import select
    from models.experiment import Participant

    async with db_factory() as db:
        result = await db.execute(select(Participant).where(Participant.id == session_id))
        participant = result.scalar_one_or_none()
        if not participant:
            return 0.0
        return get_current_game_time(participant)


async def _get_resume_state(session_id: str, db_factory) -> tuple[int, float | None]:
    """Return (fired_count, last_trigger_game_time) across real and fake PM events.

    This lets a restarted PM scheduler continue from the next schedule entry
    instead of waiting from zero again.  Game time is monotonic across trigger
    events, so the maximum actual_game_time is the most recent fired trigger.
    """
    from sqlalchemy import select
    from models.pm_module import FakeTriggerEvent, PMTaskEvent

    async with db_factory() as db:
        real_result = await db.execute(
            select(PMTaskEvent.trigger_actual_game_time).where(
                PMTaskEvent.session_id == session_id,
            )
        )
        fake_result = await db.execute(
            select(FakeTriggerEvent.actual_game_time).where(
                FakeTriggerEvent.session_id == session_id,
            )
        )

    trigger_times = [
        t for t in [*real_result.scalars().all(), *fake_result.scalars().all()]
        if t is not None
    ]
    return len(trigger_times), max(trigger_times) if trigger_times else None


async def run_pm_session(
    session_id: str,
    task_order: str,
    send_fn,
    db_factory,
    on_pipeline_start=None,
    clock: GameClock | None = None,
):
    """Drive the PM trigger schedule for one session as a background task.

    For each TRIGGER_SCHEDULE entry:
      1. Wait delay_after_previous_s of game time (frozen time excluded)
      2. Snapshot/freeze game time
      3. Pause non-PM gameplay via on_pipeline_start, if provided
      4. Fire pm_trigger WS event (real or fake)
      5. Wait for pipeline-complete signal (set by signal_pipeline_complete)

    After all 6 entries: wait SESSION_END_DELAY game seconds, send session_end.
    """
    ev = asyncio.Event()
    _pipeline_complete_events[session_id] = ev

    try:
        ordered_tasks = TASK_ORDERS[task_order]

        from sqlalchemy import select
        from models.experiment import Participant

        # Read participant condition once
        async with db_factory() as db:
            result = await db.execute(select(Participant).where(Participant.id == session_id))
            participant = result.scalar_one_or_none()
            if not participant:
                logger.error("run_pm_session: participant not found: %s", session_id)
                return
            condition = participant.condition

        fired_count, last_trigger_game_time = await _get_resume_state(session_id, db_factory)
        if fired_count:
            logger.info(
                "[PM_SESSION] Resuming after %d fired trigger(s), last_game_time=%s (session=%s)",
                fired_count, last_trigger_game_time, session_id,
            )

        for entry_index, entry in enumerate(TRIGGER_SCHEDULE[fired_count:], start=fired_count + 1):
            schedule_index = entry_index
            delay = entry["delay_after_previous_s"]
            current_gt = await _get_current_game_time(session_id, db_factory, clock)
            if last_trigger_game_time is None:
                delay_remaining = max(0.0, delay - current_gt)
            else:
                delay_remaining = max(0.0, delay - (current_gt - last_trigger_game_time))

            logger.info(
                "[PM_SESSION] Waiting %.1fs game time before trigger %d (delay=%ds, current_gt=%.1f, last_trigger_gt=%s, session=%s)",
                delay_remaining, schedule_index, delay, current_gt, last_trigger_game_time, session_id,
            )
            await _wait_game_seconds(session_id, delay_remaining, db_factory, clock)

            # Freeze game time and snapshot the fired game time
            async with db_factory() as db:
                result = await db.execute(select(Participant).where(Participant.id == session_id))
                participant = result.scalar_one_or_none()
                if not participant:
                    return
                if clock is not None:
                    game_time_fired = clock.now()
                    participant.game_time_elapsed_s = game_time_fired
                    participant.frozen_since = time.time()
                else:
                    freeze_game_time(participant)
                    game_time_fired = participant.game_time_elapsed_s
                await db.commit()

            if on_pipeline_start:
                try:
                    maybe_awaitable = on_pipeline_start()
                    if asyncio.iscoroutine(maybe_awaitable):
                        await maybe_awaitable
                except Exception:
                    logger.exception(
                        "[PM_SESSION] on_pipeline_start failed (session=%s)",
                        session_id,
                    )

            ev.clear()

            if entry["type"] == "real":
                task_position = entry["task_position"]  # 1-based
                task_id = ordered_tasks[task_position - 1]
                task_def = get_task(task_id)

                from models.pm_module import PMTaskEvent
                async with db_factory() as db:
                    event_row = PMTaskEvent(
                        session_id=session_id,
                        task_id=task_id,
                        position_in_order=task_position,
                        condition=condition,
                        trigger_scheduled_game_time=game_time_fired,
                        trigger_actual_game_time=game_time_fired,
                        trigger_type=task_def.trigger_type,
                    )
                    db.add(event_row)
                    await db.commit()

                await send_fn("pm_trigger", {
                    "is_fake": False,
                    "task_id": task_id,
                    "trigger_type": task_def.trigger_type,
                    "position": task_position,
                    "schedule_index": schedule_index,
                    "game_time_fired": game_time_fired,
                })
                logger.info(
                    "[PM_SESSION] Real trigger fired: task=%s pos=%d (session=%s)",
                    task_id, task_position, session_id,
                )

            else:  # fake
                trigger_type = entry["trigger_type"]

                from models.pm_module import FakeTriggerEvent
                async with db_factory() as db:
                    event_row = FakeTriggerEvent(
                        session_id=session_id,
                        scheduled_game_time=game_time_fired,
                        actual_game_time=game_time_fired,
                        trigger_type=trigger_type,
                    )
                    db.add(event_row)
                    await db.commit()

                await send_fn("pm_trigger", {
                    "is_fake": True,
                    "trigger_type": trigger_type,
                    "schedule_index": schedule_index,
                    "game_time_fired": game_time_fired,
                })
                logger.info(
                    "[PM_SESSION] Fake trigger fired: type=%s (session=%s)",
                    trigger_type, session_id,
                )

            # Wait for the frontend pipeline to complete
            await ev.wait()
            last_trigger_game_time = game_time_fired
            logger.info(
                "[PM_SESSION] Pipeline complete (trigger %d, session=%s)",
                schedule_index, session_id,
            )

        # All 6 triggers done — wait then send session_end
        logger.info(
            "[PM_SESSION] All triggers done. Waiting %ds game time (session=%s)",
            SESSION_END_DELAY_AFTER_LAST_TRIGGER_S, session_id,
        )
        await _wait_game_seconds(
            session_id,
            SESSION_END_DELAY_AFTER_LAST_TRIGGER_S,
            db_factory,
            clock,
        )

        await send_fn("session_end", {"reason": "pm_schedule_complete"})
        logger.info("[PM_SESSION] session_end sent (session=%s)", session_id)

    except asyncio.CancelledError:
        logger.info("[PM_SESSION] run_pm_session cancelled (session=%s)", session_id)
        raise
    except Exception:
        logger.exception("[PM_SESSION] Unexpected error (session=%s)", session_id)
    finally:
        _pipeline_complete_events.pop(session_id, None)
