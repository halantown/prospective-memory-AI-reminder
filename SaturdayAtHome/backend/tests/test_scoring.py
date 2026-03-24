from models.schemas import PmActionReport
from services.scoring import score_pm_action


def test_score_medicine_correct(tmp_config):
    action = PmActionReport(task_id="medicine_a", choice={"bottle": "red", "amount": "1"})
    assert score_pm_action("medicine_a", action) == 2


def test_score_medicine_partial(tmp_config):
    action = PmActionReport(task_id="medicine_a", choice={"bottle": "red", "amount": "2"})
    assert score_pm_action("medicine_a", action) == 1


def test_score_pressure_cooker(tmp_config):
    a1 = PmActionReport(task_id="chores_g", action="release_steam_open_lid")
    a2 = PmActionReport(task_id="chores_g", action="open_lid_only")
    a3 = PmActionReport(task_id="chores_g", action="skip")
    assert score_pm_action("chores_g", a1) == 2
    assert score_pm_action("chores_g", a2) == 1
    assert score_pm_action("chores_g", a3) == 0
