"""Tests for centralized experiment materials and phase-scoped config."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from data.materials import (
    get_experiment_config_for_phase,
    get_task_orders,
    get_trigger_schedule,
)


def _contains_key(value, forbidden_key: str) -> bool:
    if isinstance(value, dict):
        return any(
            key == forbidden_key or _contains_key(child, forbidden_key)
            for key, child in value.items()
        )
    if isinstance(value, list):
        return any(_contains_key(child, forbidden_key) for child in value)
    return False


def test_task_orders_load_from_materials():
    assert get_task_orders() == {
        "A": ["T1", "T2", "T4", "T3"],
        "B": ["T2", "T3", "T1", "T4"],
        "C": ["T3", "T4", "T2", "T1"],
        "D": ["T4", "T1", "T3", "T2"],
    }


def test_trigger_schedule_loads_from_materials():
    schedule = get_trigger_schedule()
    assert len(schedule) == 6
    assert schedule[0]["type"] == "real"
    assert schedule[0]["task_position"] == 1
    assert schedule[1]["type"] == "fake"


def test_manip_check_config_does_not_expose_correct_answer():
    config = get_experiment_config_for_phase(
        phase="MANIP_CHECK_1",
        condition="EC+",
        task_order="A",
    )
    assert config["task_id"] == "T1"
    assert "manipulation_check" in config
    assert not _contains_key(config, "correct_option_id")
    assert not _contains_key(config, "correct_index")
    assert not _contains_key(config, "correct_answer")


def test_main_experiment_returns_only_selected_condition_reminders():
    config = get_experiment_config_for_phase(
        phase="MAIN_EXPERIMENT",
        condition="EC-",
        task_order="A",
    )
    first_task = config["tasks"][0]
    assert first_task["task_id"] == "T1"
    assert first_task["reminder_text"] == "You promised to give Mei something."
    assert "reminders" not in first_task


def test_recap_follows_latin_square_order():
    config = get_experiment_config_for_phase(
        phase="RECAP",
        condition="EC+",
        task_order="B",
    )
    assert [task["task_id"] for task in config["tasks"]] == ["T2", "T3", "T1", "T4"]

