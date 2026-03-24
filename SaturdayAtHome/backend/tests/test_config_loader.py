from core.config_loader import get_game_config, get_task_pairs


def test_game_config_strips_correct_answers(tmp_config):
    cfg = get_game_config()
    assert "correct" not in cfg["pm_tasks"]["medicine_a"]
    assert "correct" not in cfg["pm_tasks"]["medicine_b"]
    assert "correct" not in cfg["timeline"]["messages"][0]


def test_task_pairs_key_normalization(tmp_config):
    pairs = get_task_pairs()
    assert 1 in pairs
    assert pairs[1] == ["medicine_a", "medicine_b"]
