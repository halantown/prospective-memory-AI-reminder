"""Execution window management — tracks PM task windows per session.

Per GDD Addendum A1: the participant never knows a window exists.
The backend silently opens a 30s window when trigger_appear fires,
and closes it when window_close fires or the participant submits.
"""

import logging
import time
from dataclasses import dataclass, field

logger = logging.getLogger("saturday.services.window")


@dataclass
class ExecutionWindow:
    task_id: str
    opened_at: float       # Unix timestamp (seconds)
    closes_at: float       # opened_at + window_ms/1000
    status: str = "open"   # "open" | "submitted" | "missed"
    score: int = 0


# Per-session execution windows: session_id → {task_id → ExecutionWindow}
_session_windows: dict[str, dict[str, ExecutionWindow]] = {}


def open_window(session_id: str, task_id: str, window_ms: int = 30000) -> ExecutionWindow:
    """Open a new execution window for a PM task."""
    now = time.time()
    w = ExecutionWindow(
        task_id=task_id,
        opened_at=now,
        closes_at=now + window_ms / 1000.0,
    )
    if session_id not in _session_windows:
        _session_windows[session_id] = {}
    _session_windows[session_id][task_id] = w
    logger.info(f"Window opened [{session_id}] task={task_id} closes_at={w.closes_at:.1f}")
    return w


def get_window(session_id: str, task_id: str) -> ExecutionWindow | None:
    """Get an execution window (may be None if no window exists)."""
    return _session_windows.get(session_id, {}).get(task_id)


def close_window(session_id: str, task_id: str, reason: str = "missed") -> ExecutionWindow | None:
    """Close an execution window. Returns the window if it existed."""
    w = get_window(session_id, task_id)
    if w and w.status == "open":
        w.status = reason
        logger.info(f"Window closed [{session_id}] task={task_id} reason={reason} score={w.score}")
    return w


def submit_to_window(session_id: str, task_id: str, score: int) -> dict:
    """Submit a PM action to an open window.

    Returns a result dict:
    - {"received": True} on success
    - {"error": "no_active_window"} if no window exists (e.g. fake trigger)
    - {"error": "window_closed"} if already submitted or missed
    - {"error": "too_late"} if past closes_at
    """
    w = get_window(session_id, task_id)

    if w is None:
        return {"error": "no_active_window"}

    if w.status != "open":
        return {"error": "window_closed"}

    if time.time() > w.closes_at:
        w.status = "missed"
        return {"error": "too_late"}

    w.status = "submitted"
    w.score = score
    logger.info(f"Window submitted [{session_id}] task={task_id} score={score}")
    return {"received": True}


def clear_session_windows(session_id: str):
    """Remove all windows for a session (on delete)."""
    _session_windows.pop(session_id, None)


def reset_session_windows(session_id: str):
    """Clear all execution windows at block boundary (keeps session entry)."""
    _session_windows[session_id] = {}
    logger.info(f"Execution windows reset [{session_id}]")
