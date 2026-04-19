"""Tests for context_extractor — validates that pruning logic correctly
implements the v3 EC operationalization (2 conditions: EC_off, EC_on).

v3 field paths are relative to reminder_context.
EC_off  → baseline only (action_verb, target, recipient)
EC_on   → baseline + ec_selected_features (entity, causality)
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from reminder_agent.stage2.config_loader import load_condition_field_map
from reminder_agent.stage2.context_extractor import (
    MissingRequiredFieldError,
    extract,
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "task_schemas"
TASK_FILES = ["book1_mei.json", "dessert_sophia.json", "tea_benjamin.json", "ticket_jack.json"]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def book_task() -> dict:
    """Load the canonical book1_mei.json task schema (v3)."""
    path = DATA_DIR / "book1_mei.json"
    assert path.exists(), f"book1_mei.json not found at {path}"
    with open(path) as f:
        return json.load(f)


@pytest.fixture(scope="module")
def field_map():
    """Load the production condition field map once per module."""
    return load_condition_field_map()


# ---------------------------------------------------------------------------
# EC_off — baseline only (action_verb, target, recipient)
# ---------------------------------------------------------------------------

class TestECOff:

    def test_extracts_action_verb(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "EC_off", field_map=field_map)
        assert pruned["reminder_context"]["baseline"]["action_verb"] == "give"

    def test_extracts_target(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "EC_off", field_map=field_map)
        assert pruned["reminder_context"]["baseline"]["target"] == "the baking book"

    def test_extracts_recipient(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "EC_off", field_map=field_map)
        assert pruned["reminder_context"]["baseline"]["recipient"] == "Mei"

    def test_excludes_ec_selected_features(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "EC_off", field_map=field_map)
        assert "ec_selected_features" not in pruned["reminder_context"]

    def test_excludes_episode_dimensions(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "EC_off", field_map=field_map)
        assert "episode_dimensions" not in pruned["reminder_context"]

    def test_excludes_element1_af(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "EC_off", field_map=field_map)
        assert "element1_af" not in pruned["reminder_context"]

    def test_excludes_element2_ec(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "EC_off", field_map=field_map)
        assert "element2_ec" not in pruned["reminder_context"]

    def test_only_baseline_keys(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "EC_off", field_map=field_map)
        rc = pruned["reminder_context"]
        assert set(rc.keys()) == {"baseline"}


# ---------------------------------------------------------------------------
# EC_on — baseline + ec_selected_features (entity, causality)
# ---------------------------------------------------------------------------

class TestECOn:

    def test_extracts_baseline(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "EC_on", field_map=field_map)
        baseline = pruned["reminder_context"]["baseline"]
        assert baseline["action_verb"] == "give"
        assert baseline["target"] == "the baking book"
        assert baseline["recipient"] == "Mei"

    def test_extracts_ec_entity(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "EC_on", field_map=field_map)
        entity = pruned["reminder_context"]["ec_selected_features"]["entity"]
        assert entity == ["Mei", "baking book"]

    def test_extracts_ec_causality(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "EC_on", field_map=field_map)
        causality = pruned["reminder_context"]["ec_selected_features"]["causality"]
        assert "liked" in causality

    def test_excludes_episode_dimensions(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "EC_on", field_map=field_map)
        assert "episode_dimensions" not in pruned["reminder_context"]

    def test_excludes_element1_af(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "EC_on", field_map=field_map)
        assert "element1_af" not in pruned["reminder_context"]

    def test_has_both_baseline_and_ec(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "EC_on", field_map=field_map)
        rc = pruned["reminder_context"]
        assert set(rc.keys()) == {"baseline", "ec_selected_features"}


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------

class TestErrors:

    def test_unknown_condition_raises(self, book_task: dict, field_map) -> None:
        with pytest.raises(ValueError, match="Unknown condition"):
            extract(book_task, "InvalidCondition", field_map=field_map)

    def test_old_condition_af_cb_raises(self, book_task: dict, field_map) -> None:
        """Old condition name 'AF_CB' should no longer be accepted."""
        with pytest.raises(ValueError, match="Unknown condition"):
            extract(book_task, "AF_CB", field_map=field_map)

    def test_old_v2_condition_raises(self, book_task: dict, field_map) -> None:
        """Old v2 condition 'AF_low_EC_off' should no longer be accepted."""
        with pytest.raises(ValueError, match="Unknown condition"):
            extract(book_task, "AF_low_EC_off", field_map=field_map)


# ---------------------------------------------------------------------------
# All tasks — smoke tests across every task file
# ---------------------------------------------------------------------------

class TestAllTasks:

    @pytest.fixture(scope="class")
    def all_tasks(self) -> list[dict]:
        tasks = []
        for fname in TASK_FILES:
            path = DATA_DIR / fname
            assert path.exists(), f"{fname} not found at {path}"
            with open(path) as f:
                tasks.append(json.load(f))
        return tasks

    def test_ec_off_all_tasks(self, all_tasks: list[dict], field_map) -> None:
        for task in all_tasks:
            pruned = extract(task, "EC_off", field_map=field_map)
            rc = pruned["reminder_context"]
            assert "baseline" in rc, f"task {task.get('task_id')}: missing baseline"
            baseline = rc["baseline"]
            assert "action_verb" in baseline
            assert "target" in baseline
            assert "recipient" in baseline

    def test_ec_on_all_tasks(self, all_tasks: list[dict], field_map) -> None:
        for task in all_tasks:
            pruned = extract(task, "EC_on", field_map=field_map)
            rc = pruned["reminder_context"]
            assert "baseline" in rc, f"task {task.get('task_id')}: missing baseline"
            assert "ec_selected_features" in rc, (
                f"task {task.get('task_id')}: missing ec_selected_features"
            )
