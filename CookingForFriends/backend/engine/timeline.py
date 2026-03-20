"""Block timeline engine — reads JSON template, fires events on schedule via WS."""

import asyncio
import json
import time
import logging
from pathlib import Path
from config import DATA_DIR

logger = logging.getLogger(__name__)

# Active timelines: key = "participant_id:block_number"
_active_timelines: dict[str, asyncio.Task] = {}


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
):
    """Start and run a block timeline.

    send_fn(event_type: str, data: dict) — pushes to the participant's WS.
    """
    key = _timeline_key(participant_id, block_number)

    # Cancel any existing timeline for this slot
    if key in _active_timelines:
        _active_timelines[key].cancel()

    timeline = load_timeline(block_number, condition)
    events = timeline.get("events", [])
    duration = timeline.get("duration_seconds", 600)

    async def _run():
        start_time = time.time()
        logger.info(f"Timeline started: {key} ({len(events)} events, {duration}s)")

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


def cancel_timeline(participant_id: str, block_number: int):
    """Cancel a running timeline."""
    key = _timeline_key(participant_id, block_number)
    if key in _active_timelines:
        _active_timelines[key].cancel()
        del _active_timelines[key]
        logger.info(f"Timeline cancelled: {key}")


def cancel_all():
    """Cancel all active timelines (shutdown)."""
    for key, task in _active_timelines.items():
        task.cancel()
    _active_timelines.clear()


def _resolve_reminder(task_id: str, condition: str) -> str:
    """Resolve a reminder placeholder. For now returns placeholder text."""
    return f"[Placeholder] Remember to do {task_id} (condition: {condition})"
