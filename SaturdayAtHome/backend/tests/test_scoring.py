from models.schemas import PmActionReport
from services.scoring import score_pm_action, score_pm_action_with_error


def test_score_pm_correct(tmp_config):
    action = PmActionReport(
        task_id="medicine",
        selected_target="red_round",
        choice={"target_id": "red_round", "steps_done": ["prepare_water", "take_tablet"]},
    )
    assert score_pm_action("medicine", action) == 2


def test_score_pm_content_error(tmp_config):
    action = PmActionReport(
        task_id="medicine",
        selected_target="red_square",
        choice={"target_id": "red_square", "steps_done": ["prepare_water", "take_tablet"]},
    )
    score, error = score_pm_action_with_error("medicine", action)
    assert score == 1
    assert error == "content_error"


def test_score_pm_execution_error(tmp_config):
    action = PmActionReport(
        task_id="pot",
        selected_target="silver_handle",
        choice={"target_id": "silver_handle", "steps_done": ["release_valve"]},
    )
    score, error = score_pm_action_with_error("pot", action)
    assert score == 1
    assert error == "execution_error"
