"""Block timeline engine — reads JSON template, fires events on schedule via WS."""

import asyncio
import json
import time
import logging
from pathlib import Path
from config import DATA_DIR
from engine.execution_window import start_window

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


def load_timeline(block_number: int, condition: str) -> dict:
    """Load timeline JSON template for a block."""
    path = DATA_DIR / "timelines" / f"block_{block_number}_{condition.lower()}.json"
    if not path.exists():
        # Fallback to generic template
        path = DATA_DIR / "timelines" / f"block_{block_number}.json"
    if not path.exists():
        # Use default template
        path = DATA_DIR / "timelines" / "block_default.json"
    if not path.exists():
        logger.warning(f"No timeline template found for block {block_number}, using empty")
        return {"events": [], "duration_seconds": 600}
    with open(path) as f:
        return json.load(f)


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

    timeline = load_timeline(block_number, condition)
    events = timeline.get("events", [])
    duration = timeline.get("duration_seconds", 600)

    # Use provided or global db_factory
    factory = db_factory or _db_factory

    async def _run():
        start_time = time.time()
        logger.info(f"Timeline started: {key} ({len(events)} events, {duration}s)")

        # Build trial lookup for this block
        trial_lookup = {}
        if factory:
            trial_lookup = await _build_trial_lookup(participant_id, block_number, factory)

        for event in events:
            if asyncio.current_task().cancelled():
                break

            t = event.get("t", 0)
            elapsed = time.time() - start_time
            wait = t - elapsed
            if wait > 0:
                await asyncio.sleep(wait)

            event_type = event.get("type", "unknown")
            event_data = event.get("data", {})

            # Resolve reminder placeholders
            if event_type == "robot_speak" and "text" in event_data:
                text = event_data["text"]
                if text.startswith("{{reminder:"):
                    task_id = text.strip("{}").split(":")[1]
                    event_data["text"] = _resolve_reminder(task_id, condition)

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

            logger.debug(f"Timeline event [{key}] t={t}: {event_type}")
            await send_fn(event_type, event_data)

        # Wait for remaining duration
        remaining = duration - (time.time() - start_time)
        if remaining > 0:
            await asyncio.sleep(remaining)

        await send_fn("block_end", {})
        logger.info(f"Timeline completed: {key}")

        if on_complete:
            await on_complete()

    task = asyncio.create_task(_run())
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


def _resolve_reminder(task_id: str, condition: str) -> str:
    """Resolve a reminder placeholder. For now returns placeholder text."""
    return f"[Placeholder] Remember to do {task_id} (condition: {condition})"

