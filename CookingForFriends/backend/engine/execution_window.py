"""Execution Window Manager — silent backend timer for PM trials.

After a trigger fires, tracks the execution window (30s primary, 60s extended).
If no pm_attempt arrives within 60s, auto-scores the trial as 0.
No information about the window is ever sent to the frontend.
"""

import asyncio
import logging
import time
from typing import Callable, Awaitable

from config import EXECUTION_WINDOW_S, LATE_WINDOW_S

logger = logging.getLogger(__name__)

# Active windows: key = "participant_id:trial_id"
_active_windows: dict[str, asyncio.Task] = {}

# Room sequence tracking: key = participant_id, value = list of (room, timestamp)
_room_sequences: dict[str, list[dict]] = {}

# Active trigger info: key = participant_id
_active_triggers: dict[str, dict] = {}


def _window_key(participant_id: str, trial_id: int) -> str:
    return f"{participant_id}:{trial_id}"


def start_window(
    participant_id: str,
    trial_id: int,
    block_id: int,
    trigger_time: float,
    task_config: dict,
    on_expire: Callable[[str, int, int, float, dict], Awaitable[None]],
):
    """Start a silent execution window for a PM trial.

    on_expire(participant_id, trial_id, block_id, trigger_time, task_config)
    is called if no attempt arrives within LATE_WINDOW_S.
    """
    key = _window_key(participant_id, trial_id)

    # Cancel any existing window for this slot
    if key in _active_windows:
        _active_windows[key].cancel()

    # Reset room sequence tracking for this participant
    _room_sequences[participant_id] = []

    # Store active trigger info
    _active_triggers[participant_id] = {
        "trial_id": trial_id,
        "block_id": block_id,
        "trigger_time": trigger_time,
        "task_config": task_config,
        "target_room": task_config.get("target_room", ""),
    }

    async def _window_timer():
        try:
            await asyncio.sleep(LATE_WINDOW_S)
            # Window expired — auto-score 0
            logger.info(
                f"Execution window expired: participant={participant_id} trial={trial_id}"
            )
            await on_expire(participant_id, trial_id, block_id, trigger_time, task_config)
        except asyncio.CancelledError:
            pass
        finally:
            _active_windows.pop(key, None)

    task = asyncio.create_task(_window_timer())
    _active_windows[key] = task
    logger.info(
        f"Execution window started: participant={participant_id} trial={trial_id} "
        f"(primary={EXECUTION_WINDOW_S}s, extended={LATE_WINDOW_S}s)"
    )


def cancel_window(participant_id: str, trial_id: int):
    """Cancel an active window (called when pm_attempt is received)."""
    key = _window_key(participant_id, trial_id)
    if key in _active_windows:
        _active_windows[key].cancel()
        del _active_windows[key]
        logger.debug(f"Execution window cancelled: {key}")


def get_active_trigger(participant_id: str) -> dict | None:
    """Get the active trigger info for a participant, or None."""
    return _active_triggers.get(participant_id)


def clear_active_trigger(participant_id: str):
    """Clear active trigger info after scoring."""
    _active_triggers.pop(participant_id, None)


def record_room_switch(participant_id: str, room: str, timestamp: float):
    """Record a room switch during an active execution window."""
    if participant_id not in _active_triggers:
        return
    if participant_id not in _room_sequences:
        _room_sequences[participant_id] = []
    _room_sequences[participant_id].append({"room": room, "timestamp": timestamp})


def get_room_sequence(participant_id: str) -> list[dict]:
    """Get the accumulated room sequence for a participant since last trigger."""
    return _room_sequences.get(participant_id, [])


def get_first_pm_room_entry(participant_id: str) -> float | None:
    """Get timestamp of first entry into the PM target room after trigger."""
    trigger = _active_triggers.get(participant_id)
    if not trigger:
        return None
    target_room = trigger["target_room"].lower()
    seq = _room_sequences.get(participant_id, [])
    for entry in seq:
        if entry["room"].lower() == target_room:
            return entry["timestamp"]
    return None


def cancel_all_windows():
    """Cancel all active windows (shutdown)."""
    for key, task in _active_windows.items():
        task.cancel()
    _active_windows.clear()
    _room_sequences.clear()
    _active_triggers.clear()
