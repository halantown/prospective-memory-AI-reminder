"""PM MCQ scoring (PRD v2.1).

Score: 0 = no trigger click (prospective failure)
       1 = trigger clicked but wrong MCQ answer (retrospective failure)
       2 = trigger clicked + correct MCQ answer
"""

from core.config_loader import get_pm_task


def score_mcq(task_id: str, selected: int) -> tuple[int, str | None]:
    """Score an MCQ answer. Returns (score, error_type).

    error_type is None on correct, 'retrospective_failure' on wrong answer.
    """
    task = get_pm_task(task_id)
    if not task:
        return 1, "retrospective_failure"

    mcq = task.get("mcq", {})
    correct = mcq.get("correct")

    if correct is not None and selected == correct:
        return 2, None

    return 1, "retrospective_failure"
