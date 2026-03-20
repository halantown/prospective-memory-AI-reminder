"""PM Scoring Engine — 0-6 scale per experiment_plan_v3.md.

Score criteria:
  6 — Perfect: correct room, correct target, correct action, within window
  5 — Correct but delayed: all correct, response_time > threshold (e.g. 15s)
  4 — Target correct, action error: found right target, wrong action step
  3 — Room correct, target wrong: right room, wrong item from 2 similar
  2 — PM intent, wrong direction: showed PM behavior but wrong room/target/action
  1 — Very late response: after execution window but before late window
  0 — No response: no PM-related behavior
"""

from config import EXECUTION_WINDOW_S, LATE_WINDOW_S

DELAYED_THRESHOLD_S = 15.0


def score_pm_trial(
    trigger_fired_at: float,
    user_actions: list[dict] | None,
    task_config: dict,
    current_time: float,
) -> tuple[int, int | None]:
    """Score a PM trial.

    Returns (score, response_time_ms).
    """
    if not user_actions:
        return 0, None

    first_action = user_actions[0]
    action_time = first_action.get("timestamp", current_time)
    response_time_s = action_time - trigger_fired_at
    response_time_ms = int(response_time_s * 1000)

    # Check if response is within windows
    in_window = response_time_s <= EXECUTION_WINDOW_S
    in_late_window = EXECUTION_WINDOW_S < response_time_s <= LATE_WINDOW_S

    if not in_window and not in_late_window:
        return 0, response_time_ms

    # Very late response
    if in_late_window:
        return 1, response_time_ms

    # Check correctness components
    target_room = task_config.get("target_room", "")
    target_object = task_config.get("target_object", "")
    target_action = task_config.get("target_action", "")

    user_room = first_action.get("room", "")
    user_target = first_action.get("target_selected", "")
    user_action = first_action.get("action", "")

    room_correct = user_room.lower() == target_room.lower()
    target_correct = user_target.lower() == target_object.lower()
    action_correct = user_action.lower() == target_action.lower()

    # Score 6: Perfect execution
    if room_correct and target_correct and action_correct:
        if response_time_s <= DELAYED_THRESHOLD_S:
            return 6, response_time_ms
        else:
            return 5, response_time_ms  # Score 5: Correct but delayed

    # Score 4: Target correct, action error
    if room_correct and target_correct and not action_correct:
        return 4, response_time_ms

    # Score 3: Room correct, target wrong
    if room_correct and not target_correct:
        return 3, response_time_ms

    # Score 2: PM intent but wrong direction
    if _shows_pm_intent(user_actions):
        return 2, response_time_ms

    return 0, response_time_ms


def _shows_pm_intent(actions: list[dict]) -> bool:
    """Check if user showed any PM-related behavior (room navigation, item interaction)."""
    for action in actions:
        if action.get("action") in ("room_switch", "item_click", "item_select"):
            return True
    return False
