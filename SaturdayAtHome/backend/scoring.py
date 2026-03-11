"""PM action scoring — correct answers are defined here (backend-only)."""

from models import PmActionReport


# Correct answers for medicine tasks — NEVER sent to frontend
_MEDICINE_CORRECT = {
    "medicine_a": {"bottle": "round_red",   "amount": "2 tablets"},
    "medicine_b": {"bottle": "round_orange", "amount": "1000mg × 1"},
}


def _score_medicine(task_id: str, action: PmActionReport) -> int:
    correct = _MEDICINE_CORRECT.get(task_id)
    if not correct or not action.choice:
        return 0
    bottle_ok = action.choice.get("bottle") == correct["bottle"]
    amount_ok = action.choice.get("amount") == correct["amount"]
    if bottle_ok and amount_ok:
        return 2
    if bottle_ok or amount_ok:
        return 1
    return 0


# Task-specific scoring functions
_SCORING_TABLE = {
    "medicine_a": _score_medicine,
    "medicine_b": _score_medicine,
    "laundry_c":  lambda tid, a: 2 if a.action == "shirt_rack_jeans_dryer" else (1 if a.action else 0),
    "laundry_d":  lambda tid, a: 2 if a.action == "shirt_only" else (1 if a.action else 0),
    "comm_e":     lambda tid, a: 2 if a.selected_target == "li_wei" and a.selected_detail == "restaurant_b" else (1 if a.selected_target else 0),
    "comm_f":     lambda tid, a: 2 if a.selected_detail == "3pm" else (1 if a.selected_detail else 0),
    "chores_g":   lambda tid, a: 2 if a.action == "off_black_pepper" else (1 if a.action else 0),
    "chores_h":   lambda tid, a: 2 if a.selected_target == "blue_bag" else (1 if a.selected_target else 0),
}


def score_pm_action(task_id: str, action: PmActionReport) -> int:
    """Score a PM action: 0=miss, 1=partial, 2=correct."""
    if action.action == "not_sure":
        return 0
    if action.action is None and action.selected_target is None and action.choice is None:
        return 0

    scorer = _SCORING_TABLE.get(task_id)
    return scorer(task_id, action) if scorer else 0
