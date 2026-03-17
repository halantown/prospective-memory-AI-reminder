from core.config_loader import get_game_config, get_task_pairs


def test_game_config_strips_correct_answers_and_normalizes_options(tmp_config):
    cfg = get_game_config()
    medicine = cfg["pm_tasks"]["medicine"]

    assert "correct" not in medicine
    assert "target" not in medicine
    assert "distractor" not in medicine
    assert len(medicine["options"]) == 2


def test_task_pairs_key_normalization(tmp_config):
    pairs = get_task_pairs()
    assert 1 in pairs
    assert pairs[1] == ["medicine", "tea"]
