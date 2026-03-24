"""Tests for context_extractor — validates that pruning logic correctly
implements the condition field whitelist for the 3-group design
(Baseline, AF_only, AF_CB).
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from reminder_agent.stage2.config_loader import load_condition_field_map
from reminder_agent.stage2.context_extractor import (
    MissingRequiredFieldError,
    extract,
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "task_schemas"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def book_task() -> dict:
    """Load the canonical b1_book.json task schema."""
    path = DATA_DIR / "b1_book.json"
    assert path.exists(), f"b1_book.json not found at {path}"
    with open(path) as f:
        return json.load(f)


@pytest.fixture(scope="module")
def field_map():
    """Load the production condition field map once per module."""
    return load_condition_field_map()


@pytest.fixture()
def book_task_with_authority(book_task: dict) -> dict:
    """b1_book variant where creator_is_authority is true."""
    task = copy.deepcopy(book_task)
    task["reminder_context"]["element2"]["origin"]["creator_is_authority"] = True
    task["reminder_context"]["element2"]["origin"]["task_creator"] = "Doctor"
    return task


# ---------------------------------------------------------------------------
# Helper to recursively collect all leaf keys from a nested dict
# ---------------------------------------------------------------------------

def _collect_leaf_paths(d: dict, prefix: str = "") -> set[str]:
    """Return all dot-separated paths to leaf values."""
    paths: set[str] = set()
    for k, v in d.items():
        path = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            paths |= _collect_leaf_paths(v, path)
        else:
            paths.add(path)
    return paths


# ---------------------------------------------------------------------------
# AF_only tests — High AF, no CB (no detected_activity)
# ---------------------------------------------------------------------------

class TestAFOnly:

    def test_af_only_contains_action_and_entity(
        self, book_task: dict, field_map
    ) -> None:
        pruned = extract(book_task, "AF_only", field_map=field_map)
        ctx = pruned["reminder_context"]["element1"]
        assert ctx["action_verb"] == "find and bring"
        assert ctx["target_entity"]["entity_name"] == "book"

    def test_af_only_contains_visual_cues(
        self, book_task: dict, field_map
    ) -> None:
        pruned = extract(book_task, "AF_only", field_map=field_map)
        visual = pruned["reminder_context"]["element1"]["target_entity"]["cues"]["visual"]
        assert "Red cover" in visual

    def test_af_only_contains_domain_properties(
        self, book_task: dict, field_map
    ) -> None:
        pruned = extract(book_task, "AF_only", field_map=field_map)
        props = pruned["reminder_context"]["element1"]["target_entity"]["domain_properties"]
        assert props["title"] == "Erta Ale"
        assert props["format"] == "paperback"

    def test_af_only_contains_location(
        self, book_task: dict, field_map
    ) -> None:
        pruned = extract(book_task, "AF_only", field_map=field_map)
        assert "location" in pruned["reminder_context"]["element1"]

    def test_af_only_excludes_detected_activity(
        self, book_task: dict, field_map
    ) -> None:
        pruned = extract(book_task, "AF_only", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("detected_activity" in p for p in paths)

    def test_af_only_excludes_agent_reasoning(
        self, book_task: dict, field_map
    ) -> None:
        pruned = extract(book_task, "AF_only", field_map=field_map)
        assert "agent_reasoning_context" not in pruned

    def test_af_only_excludes_placeholder(
        self, book_task: dict, field_map
    ) -> None:
        pruned = extract(book_task, "AF_only", field_map=field_map)
        assert "placeholder" not in pruned


# ---------------------------------------------------------------------------
# AF_CB tests — High AF + Contextual Bridging (includes detected_activity)
# ---------------------------------------------------------------------------

class TestAFCB:

    def test_af_cb_contains_all_key_fields(
        self, book_task: dict, field_map
    ) -> None:
        pruned = extract(book_task, "AF_CB", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert any("action_verb" in p for p in paths)
        assert any("entity_name" in p for p in paths)
        assert any("cues.visual" in p for p in paths)
        assert any("domain_properties" in p for p in paths)
        assert any("detected_activity_raw" in p for p in paths)

    def test_af_cb_contains_detected_activity(
        self, book_task: dict, field_map
    ) -> None:
        pruned = extract(book_task, "AF_CB", field_map=field_map)
        activity = pruned["reminder_context"]["element3"]["detected_activity_raw"]
        assert "steak" in activity.lower() or "flipping" in activity.lower()

    def test_af_cb_contains_visual_cues(
        self, book_task: dict, field_map
    ) -> None:
        pruned = extract(book_task, "AF_CB", field_map=field_map)
        visual = pruned["reminder_context"]["element1"]["target_entity"]["cues"]["visual"]
        assert "Red cover" in visual

    def test_af_cb_excludes_agent_reasoning(
        self, book_task: dict, field_map
    ) -> None:
        pruned = extract(book_task, "AF_CB", field_map=field_map)
        assert "agent_reasoning_context" not in pruned


# ---------------------------------------------------------------------------
# Conditional field: Task_Creator (authority check)
# ---------------------------------------------------------------------------

class TestConditionalAuthority:

    def test_af_only_includes_creator_when_authority(
        self, book_task_with_authority: dict, field_map
    ) -> None:
        pruned = extract(book_task_with_authority, "AF_only", field_map=field_map)
        creator = pruned["reminder_context"]["element2"]["origin"]["task_creator"]
        assert creator == "Doctor"

    def test_af_only_excludes_creator_when_not_authority(
        self, book_task: dict, field_map
    ) -> None:
        pruned = extract(book_task, "AF_only", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("task_creator" in p for p in paths)

    def test_af_cb_includes_creator_when_authority(
        self, book_task_with_authority: dict, field_map
    ) -> None:
        pruned = extract(book_task_with_authority, "AF_CB", field_map=field_map)
        creator = pruned["reminder_context"]["element2"]["origin"]["task_creator"]
        assert creator == "Doctor"

    def test_af_cb_excludes_creator_when_not_authority(
        self, book_task: dict, field_map
    ) -> None:
        pruned = extract(book_task, "AF_CB", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("task_creator" in p for p in paths)


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------

class TestErrors:

    def test_missing_required_field_raises(self, field_map) -> None:
        incomplete_task = {
            "task_id": "broken",
            "reminder_context": {
                "element1": {
                    "action_verb": "find and bring",
                    # missing target_entity.entity_name
                },
            },
        }
        with pytest.raises(MissingRequiredFieldError, match="entity_name"):
            extract(incomplete_task, "AF_only", field_map=field_map)

    def test_unknown_condition_raises(self, book_task: dict, field_map) -> None:
        with pytest.raises(ValueError, match="Unknown condition"):
            extract(book_task, "InvalidCondition", field_map=field_map)

    def test_old_condition_name_raises(self, book_task: dict, field_map) -> None:
        """Old 2×2 condition names should no longer be accepted."""
        with pytest.raises(ValueError, match="Unknown condition"):
            extract(book_task, "LowAF_LowCB", field_map=field_map)
