"""PM scoring for PRD v2.0 isomorphic tasks.

0 = not executed
1 = executed with error (content or execution)
2 = fully correct
"""

from __future__ import annotations

from typing import Any

from core.config_loader import get_correct_answer, get_pm_task
from models.schemas import PmActionReport


def _legacy_medicine_score(task_id: str, action: PmActionReport) -> tuple[int, str | None]:
    correct = get_correct_answer(task_id)
    if not correct or not action.choice:
        return 0, None

    bottle_ok = action.choice.get("bottle") == correct.get("bottle")
    amount_ok = action.choice.get("amount") == correct.get("amount")

    if bottle_ok and amount_ok:
        return 2, None
    if bottle_ok or amount_ok:
        return 1, "content_error"
    return 0, "content_error"


def _normalize_choice(choice: dict[str, Any] | None) -> dict[str, Any]:
    return choice if isinstance(choice, dict) else {}


def score_pm_action_with_error(task_id: str, action: PmActionReport) -> tuple[int, str | None]:
    """Return `(score, pm_error_type)` according to task schema."""
    if action.action == "not_sure":
        return 0, None

    task = get_pm_task(task_id)

    # Backward compatibility for legacy tasks.
    if not task:
        return _legacy_medicine_score(task_id, action)

    choice = _normalize_choice(action.choice)
    selected_target = (
        choice.get("target_id")
        or choice.get("target")
        or action.selected_target
        or ""
    )
    expected_target = str(task.get("target", {}).get("id", ""))

    required_steps = [
        str(step.get("id"))
        for step in (task.get("steps") or [])
        if bool(step.get("required", True)) and step.get("id")
    ]

    completed_steps = set()
    raw_steps_done = choice.get("steps_done")
    if isinstance(raw_steps_done, list):
        completed_steps = {str(s) for s in raw_steps_done}

    if not completed_steps and required_steps:
        # Accept simple boolean flags from frontend without step id list.
        if bool(choice.get("step1_done")):
            completed_steps.add(required_steps[0])
        if len(required_steps) > 1 and bool(choice.get("step2_done")):
            completed_steps.add(required_steps[1])

    steps_ok = bool(required_steps) and all(step_id in completed_steps for step_id in required_steps)
    target_ok = bool(expected_target) and selected_target == expected_target

    any_interaction = bool(selected_target) or bool(completed_steps) or bool(action.action)
    if not any_interaction:
        return 0, None

    if target_ok and steps_ok:
        return 2, None

    # Partial execution with explicit error classification.
    if not target_ok:
        return 1, "content_error"
    return 1, "execution_error"


def score_pm_action(task_id: str, action: PmActionReport) -> int:
    score, _ = score_pm_action_with_error(task_id, action)
    return score
