"""Tests for PM pipeline data integrity.

Covers: trigger schedule structure, condition-dependent reminders,
item selection options, fake trigger isolation, and counterbalancing.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from data.materials import (
    get_trigger_schedule,
    get_task_orders,
    get_item_options,
    get_reminder_text,
    get_fake_trigger_lines,
    get_pm_materials,
    ordered_task_ids,
    task_id_at_position,
)
from engine.pm_tasks import (
    TASK_DEFINITIONS,
    get_task,
    get_item_options as engine_get_item_options,
    get_reminder_text as engine_get_reminder_text,
    FAKE_TRIGGER_LINES,
)

TASK_IDS = ["T1", "T2", "T3", "T4"]
CONDITIONS = ["EE0", "EE1"]


class TestTriggerSchedule:
    def test_six_triggers_total(self):
        schedule = get_trigger_schedule()
        assert len(schedule) == 6

    def test_four_real_two_fake(self):
        schedule = get_trigger_schedule()
        real = [e for e in schedule if e["type"] == "real"]
        fake = [e for e in schedule if e["type"] == "fake"]
        assert len(real) == 4
        assert len(fake) == 2

    def test_real_triggers_cover_all_positions(self):
        schedule = get_trigger_schedule()
        real = [e for e in schedule if e["type"] == "real"]
        positions = sorted(e["task_position"] for e in real)
        assert positions == [1, 2, 3, 4]

    def test_fake_triggers_have_trigger_type(self):
        schedule = get_trigger_schedule()
        fake = [e for e in schedule if e["type"] == "fake"]
        for entry in fake:
            assert entry["trigger_type"] in ("doorbell", "phone_call")

    def test_all_triggers_have_delay(self):
        schedule = get_trigger_schedule()
        for entry in schedule:
            assert "delay_after_previous_s" in entry
            assert isinstance(entry["delay_after_previous_s"], (int, float))
            assert entry["delay_after_previous_s"] >= 0


class TestConditionReminders:
    @pytest.mark.parametrize("task_id", TASK_IDS)
    def test_ee0_and_ee1_reminders_exist(self, task_id):
        for condition in CONDITIONS:
            text = get_reminder_text(task_id, condition)
            assert isinstance(text, str)
            assert len(text) > 10

    @pytest.mark.parametrize("task_id", TASK_IDS)
    def test_ee0_and_ee1_reminders_differ(self, task_id):
        ee0 = get_reminder_text(task_id, "EE0")
        ee1 = get_reminder_text(task_id, "EE1")
        assert ee0 != ee1

    @pytest.mark.parametrize("task_id", TASK_IDS)
    def test_reminder_does_not_contain_target_item(self, task_id):
        materials = get_pm_materials()
        target_item = materials["tasks"][task_id]["target_item"].lower()
        target_labels = [
            item["label"].lower()
            for item in materials["tasks"][task_id]["decoy_items"]
            if item["is_target"]
        ]

        for condition in CONDITIONS:
            reminder = get_reminder_text(task_id, condition).lower()
            assert target_item not in reminder, \
                f"{task_id} {condition} reminder contains target_item '{target_item}'"
            for label in target_labels:
                assert label not in reminder, \
                    f"{task_id} {condition} reminder contains target label '{label}'"

    def test_engine_get_reminder_matches_materials(self):
        for task_id in TASK_IDS:
            for condition in CONDITIONS:
                assert engine_get_reminder_text(task_id, condition) == \
                    get_reminder_text(task_id, condition)

    def test_invalid_condition_raises(self):
        with pytest.raises(KeyError):
            get_reminder_text("T1", "INVALID")


class TestItemSelectionOptions:
    @pytest.mark.parametrize("task_id", TASK_IDS)
    def test_exactly_three_options(self, task_id):
        options = get_item_options(task_id)
        assert len(options) == 3

    @pytest.mark.parametrize("task_id", TASK_IDS)
    def test_exactly_one_target(self, task_id):
        options = get_item_options(task_id)
        targets = [o for o in options if o["is_target"]]
        assert len(targets) == 1
        assert targets[0]["id"] == "target"

    @pytest.mark.parametrize("task_id", TASK_IDS)
    def test_option_ids_are_target_intra1_intra2(self, task_id):
        options = get_item_options(task_id)
        ids = sorted(o["id"] for o in options)
        assert ids == ["intra1", "intra2", "target"]

    @pytest.mark.parametrize("task_id", TASK_IDS)
    def test_all_options_have_labels(self, task_id):
        options = get_item_options(task_id)
        for o in options:
            assert isinstance(o["label"], str)
            assert len(o["label"]) > 0

    @pytest.mark.parametrize("task_id", TASK_IDS)
    def test_engine_item_options_match(self, task_id):
        engine_opts = engine_get_item_options(task_id)
        material_opts = get_item_options(task_id)
        engine_ids = sorted(o.id for o in engine_opts)
        material_ids = sorted(o["id"] for o in material_opts)
        assert engine_ids == material_ids

        for eo in engine_opts:
            matching = [m for m in material_opts if m["id"] == eo.id]
            assert len(matching) == 1
            assert eo.label == matching[0]["label"]
            assert eo.is_target == matching[0]["is_target"]


class TestFakeTriggerIsolation:
    def test_fake_trigger_lines_exist_for_both_types(self):
        for trigger_type in ("doorbell", "phone_call"):
            lines = get_fake_trigger_lines(trigger_type)
            assert isinstance(lines, list)
            assert len(lines) > 0
            for line in lines:
                assert isinstance(line, str)
                assert len(line) > 0

    def test_engine_fake_trigger_lines_match(self):
        for trigger_type in ("doorbell", "phone_call"):
            engine_lines = FAKE_TRIGGER_LINES[trigger_type]
            material_lines = get_fake_trigger_lines(trigger_type)
            assert list(engine_lines) == material_lines

    def test_fake_schedule_entries_have_no_task_position(self):
        schedule = get_trigger_schedule()
        fake = [e for e in schedule if e["type"] == "fake"]
        for entry in fake:
            assert "task_position" not in entry or entry.get("task_position") is None


class TestTaskDefinitions:
    def test_all_four_tasks_defined(self):
        assert sorted(TASK_DEFINITIONS.keys()) == TASK_IDS

    @pytest.mark.parametrize("task_id", TASK_IDS)
    def test_task_has_greeting_lines(self, task_id):
        task = get_task(task_id)
        assert isinstance(task.greeting_lines, tuple)
        assert len(task.greeting_lines) >= 1

    @pytest.mark.parametrize("task_id", TASK_IDS)
    def test_task_trigger_type_valid(self, task_id):
        task = get_task(task_id)
        assert task.trigger_type in ("doorbell", "phone_call")

    @pytest.mark.parametrize("task_id", TASK_IDS)
    def test_task_has_both_reminders(self, task_id):
        task = get_task(task_id)
        assert isinstance(task.reminder_ee1, str) and len(task.reminder_ee1) > 0
        assert isinstance(task.reminder_ee0, str) and len(task.reminder_ee0) > 0


class TestCounterbalancing:
    def test_four_task_orders(self):
        orders = get_task_orders()
        assert len(orders) == 4

    def test_each_order_contains_all_tasks(self):
        orders = get_task_orders()
        for order_name, tasks in orders.items():
            assert sorted(tasks) == TASK_IDS, \
                f"Order {order_name} doesn't contain all tasks: {tasks}"

    def test_latin_square_each_position_has_each_task(self):
        orders = get_task_orders()
        for pos in range(4):
            tasks_at_pos = {tasks[pos] for tasks in orders.values()}
            assert tasks_at_pos == set(TASK_IDS), \
                f"Position {pos} missing tasks: {set(TASK_IDS) - tasks_at_pos}"

    def test_task_id_at_position(self):
        orders = get_task_orders()
        for order_name, tasks in orders.items():
            for i, task_id in enumerate(tasks, start=1):
                assert task_id_at_position(order_name, i) == task_id

    def test_task_id_at_invalid_position_raises(self):
        with pytest.raises(IndexError):
            task_id_at_position("A", 0)
        with pytest.raises(IndexError):
            task_id_at_position("A", 5)

    def test_ordered_task_ids_returns_correct_list(self):
        orders = get_task_orders()
        for order_name, expected in orders.items():
            assert ordered_task_ids(order_name) == expected

    def test_unknown_task_order_raises(self):
        with pytest.raises(KeyError):
            ordered_task_ids("Z")
