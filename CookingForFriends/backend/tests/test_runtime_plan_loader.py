"""Tests for the unified gameplay runtime plan."""

import copy
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine.runtime_plan_loader import (
    cooking_timeline_from_plan,
    load_runtime_plan,
    robot_idle_comments_from_plan,
    timeline_from_plan,
    validate_runtime_plan,
)


def test_runtime_plan_loads_all_lanes():
    plan = load_runtime_plan()

    assert plan["duration_seconds"] == 900
    assert len(plan["pm_schedule"]) == 6
    assert len(plan["cooking_schedule"]) == 32
    assert len(plan["robot_idle_comments"]) == 3
    assert len(plan["phone_messages"]) > 0


def test_runtime_plan_builds_runtime_objects():
    plan = load_runtime_plan()

    cooking_entries = cooking_timeline_from_plan(plan)
    robot_comments = robot_idle_comments_from_plan(plan)
    timeline = timeline_from_plan(plan, block_number=1, condition="EC+")

    assert cooking_entries[0].dish_id == "roasted_vegetables"
    assert cooking_entries[0].step_type == "active"
    assert robot_comments[0].comment_id == "idle_oven_vegetables"
    assert timeline["events"][0]["type"] == "block_start"
    assert timeline["events"][-1]["type"] == "block_end"
    assert any(event["type"] == "phone_message" for event in timeline["events"])
    assert not any(event["type"] == "pm_trigger" for event in timeline["events"])


def test_runtime_plan_rejects_bad_message_id():
    plan = copy.deepcopy(load_runtime_plan())
    plan["phone_messages"][0]["message_id"] = "missing_message"

    with pytest.raises(ValueError, match="missing_message"):
        validate_runtime_plan(plan)


def test_runtime_plan_rejects_bad_cooking_step():
    plan = copy.deepcopy(load_runtime_plan())
    plan["cooking_schedule"][0]["step_index"] = 999

    with pytest.raises(ValueError, match="step_index"):
        validate_runtime_plan(plan)
