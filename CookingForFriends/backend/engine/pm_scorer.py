"""PM Scoring Engine — 0-6 scale per experiment_plan_v3.md.

Score criteria:
  6 — Perfect: correct room, correct target, correct action, ≤15s
  5 — Correct but delayed: all correct, >15s but within 30s
  4 — Target correct, action error: found right target, wrong action step
  3 — Room correct, target wrong: right room, wrong item from 2 similar
  2 — PM intent, wrong direction: showed PM behavior but wrong room
  1 — Very late response: after primary window (30s) but before extended (60s)
  0 — No response: no PM-related behavior within 60s
"""

from config import EXECUTION_WINDOW_S, LATE_WINDOW_S

DELAYED_THRESHOLD_S = 15.0


def score_pm_attempt(
    trigger_fired_at: float,
    attempt_time: float,
    room: str,
    target_selected: str | None,
    action_performed: str | None,
    task_config: dict,
) -> tuple[int, int]:
    """Score a PM attempt using objective behavioral data.

    Returns (score, response_time_ms).
    """
    elapsed = attempt_time - trigger_fired_at
    response_time_ms = int(elapsed * 1000)

    if elapsed > LATE_WINDOW_S:
        return 0, response_time_ms

    if elapsed > EXECUTION_WINDOW_S:
        return 1, response_time_ms

    # Within primary window — evaluate correctness
    target_room = task_config.get("target_room", "")
    correct_target = task_config.get("target_object", "")
    correct_action = task_config.get("target_action", "")
    task_id = task_config.get("task_id", "")

    room_correct = room.lower() == target_room.lower()

    # Target matching: accept both full description match and ID-based match
    # Frontend sends IDs like "b1_book_target" or "b1_book_distractor"
    target_correct = False
    if target_selected is not None:
        sel = target_selected.lower()
        if sel == correct_target.lower():
            target_correct = True
        elif task_id and sel == f"{task_id}_target":
            target_correct = True
        elif task_id and sel.endswith("_target") and sel.startswith(task_id):
            target_correct = True

    action_correct = (
        action_performed is not None
        and action_performed.lower() == correct_action.lower()
    )

    if room_correct and target_correct and action_correct:
        if elapsed <= DELAYED_THRESHOLD_S:
            return 6, response_time_ms
        else:
            return 5, response_time_ms

    if room_correct and target_correct and not action_correct:
        return 4, response_time_ms

    if room_correct and not target_correct:
        return 3, response_time_ms

    # Wrong room but showed PM intent
    return 2, response_time_ms


# Keep legacy function for backward compat during transition
def score_pm_trial(
    trigger_fired_at: float,
    user_actions: list[dict] | None,
    task_config: dict,
    current_time: float,
) -> tuple[int, int | None]:
    """Legacy scoring interface — delegates to score_pm_attempt."""
    if not user_actions:
        return 0, None

    first = user_actions[0]
    return score_pm_attempt(
        trigger_fired_at=trigger_fired_at,
        attempt_time=first.get("timestamp", current_time),
        room=first.get("room", ""),
        target_selected=first.get("target_selected"),
        action_performed=first.get("action"),
        task_config=task_config,
    )

