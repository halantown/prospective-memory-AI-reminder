"""Tests for context_extractor — validates that pruning logic correctly
implements the condition field whitelist for all 4 AF × CB conditions.
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


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def medicine_a() -> dict:
    """Load the canonical medicine_a.json task schema."""
    path = DATA_DIR / "medicine_a.json"
    assert path.exists(), f"medicine_a.json not found at {path}"
    with open(path) as f:
        return json.load(f)


@pytest.fixture(scope="module")
def field_map():
    """Load the production condition field map once per module."""
    return load_condition_field_map()


@pytest.fixture()
def medicine_a_no_authority(medicine_a: dict) -> dict:
    """Medicine A variant where creator_is_authority is false."""
    import copy
    task = copy.deepcopy(medicine_a)
    task["reminder_context"]["element2"]["origin"]["creator_is_authority"] = False
    task["reminder_context"]["element2"]["origin"]["task_creator"] = "Self"
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
# LowAF tests — must not contain visual cues or domain properties
# ---------------------------------------------------------------------------

class TestLowAF:

    def test_lowaf_lowcb_contains_action_and_entity(
        self, medicine_a: dict, field_map
    ) -> None:
        pruned = extract(medicine_a, "LowAF_LowCB", field_map=field_map)
        ctx = pruned["reminder_context"]["element1"]
        assert ctx["action_verb"] == "Take"
        assert ctx["target_entity"]["entity_name"] == "Doxycycline"

    def test_lowaf_lowcb_excludes_visual_cues(
        self, medicine_a: dict, field_map
    ) -> None:
        pruned = extract(medicine_a, "LowAF_LowCB", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("cues" in p for p in paths), f"Visual cues leaked: {paths}"

    def test_lowaf_lowcb_excludes_domain_properties(
        self, medicine_a: dict, field_map
    ) -> None:
        pruned = extract(medicine_a, "LowAF_LowCB", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("domain_properties" in p for p in paths)

    def test_lowaf_lowcb_excludes_detected_activity(
        self, medicine_a: dict, field_map
    ) -> None:
        pruned = extract(medicine_a, "LowAF_LowCB", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("detected_activity" in p for p in paths)

    def test_lowaf_lowcb_excludes_agent_reasoning(
        self, medicine_a: dict, field_map
    ) -> None:
        pruned = extract(medicine_a, "LowAF_LowCB", field_map=field_map)
        assert "agent_reasoning_context" not in pruned

    def test_lowaf_lowcb_excludes_placeholder(
        self, medicine_a: dict, field_map
    ) -> None:
        pruned = extract(medicine_a, "LowAF_LowCB", field_map=field_map)
        assert "placeholder" not in pruned

    def test_lowaf_lowcb_only_two_leaf_values(
        self, medicine_a: dict, field_map
    ) -> None:
        pruned = extract(medicine_a, "LowAF_LowCB", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert len(paths) == 2, f"Expected 2 leaf values, got {len(paths)}: {paths}"


# ---------------------------------------------------------------------------
# HighAF tests — must contain visual cues and domain properties
# ---------------------------------------------------------------------------

class TestHighAF:

    def test_highaf_lowcb_contains_visual_cues(
        self, medicine_a: dict, field_map
    ) -> None:
        pruned = extract(medicine_a, "HighAF_LowCB", field_map=field_map)
        visual = pruned["reminder_context"]["element1"]["target_entity"]["cues"]["visual"]
        assert "Red round bottle" in visual

    def test_highaf_lowcb_contains_domain_properties(
        self, medicine_a: dict, field_map
    ) -> None:
        pruned = extract(medicine_a, "HighAF_LowCB", field_map=field_map)
        props = pruned["reminder_context"]["element1"]["target_entity"]["domain_properties"]
        assert props["dosage"] == "100mg"
        assert props["form"] == "Tablet"

    def test_highaf_lowcb_excludes_detected_activity(
        self, medicine_a: dict, field_map
    ) -> None:
        pruned = extract(medicine_a, "HighAF_LowCB", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("detected_activity" in p for p in paths)


# ---------------------------------------------------------------------------
# HighCB tests — must contain detected_activity
# ---------------------------------------------------------------------------

class TestHighCB:

    def test_lowaf_highcb_contains_detected_activity(
        self, medicine_a: dict, field_map
    ) -> None:
        pruned = extract(medicine_a, "LowAF_HighCB", field_map=field_map)
        activity = pruned["reminder_context"]["element3"]["detected_activity_raw"]
        assert "dinner" in activity.lower()

    def test_lowaf_highcb_excludes_visual_cues(
        self, medicine_a: dict, field_map
    ) -> None:
        pruned = extract(medicine_a, "LowAF_HighCB", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("cues" in p for p in paths)

    def test_highaf_highcb_contains_all_fields(
        self, medicine_a: dict, field_map
    ) -> None:
        pruned = extract(medicine_a, "HighAF_HighCB", field_map=field_map)
        # Should have: action_verb, entity_name, cues.visual, domain_properties, detected_activity_raw
        paths = _collect_leaf_paths(pruned)
        assert any("action_verb" in p for p in paths)
        assert any("entity_name" in p for p in paths)
        assert any("cues.visual" in p for p in paths)
        assert any("domain_properties" in p for p in paths)
        assert any("detected_activity_raw" in p for p in paths)


# ---------------------------------------------------------------------------
# Conditional field: Task_Creator (authority check)
# ---------------------------------------------------------------------------

class TestConditionalAuthority:

    def test_highaf_includes_creator_when_authority(
        self, medicine_a: dict, field_map
    ) -> None:
        pruned = extract(medicine_a, "HighAF_LowCB", field_map=field_map)
        creator = pruned["reminder_context"]["element2"]["origin"]["task_creator"]
        assert creator == "Doctor"

    def test_highaf_excludes_creator_when_not_authority(
        self, medicine_a_no_authority: dict, field_map
    ) -> None:
        pruned = extract(medicine_a_no_authority, "HighAF_LowCB", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("task_creator" in p for p in paths)

    def test_highaf_highcb_includes_creator_when_authority(
        self, medicine_a: dict, field_map
    ) -> None:
        pruned = extract(medicine_a, "HighAF_HighCB", field_map=field_map)
        creator = pruned["reminder_context"]["element2"]["origin"]["task_creator"]
        assert creator == "Doctor"


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------

class TestErrors:

    def test_missing_required_field_raises(self, field_map) -> None:
        incomplete_task = {
            "task_id": "broken",
            "reminder_context": {
                "element1": {
                    "action_verb": "Take",
                    # missing target_entity.entity_name
                },
            },
        }
        with pytest.raises(MissingRequiredFieldError, match="entity_name"):
            extract(incomplete_task, "LowAF_LowCB", field_map=field_map)

    def test_unknown_condition_raises(self, medicine_a: dict, field_map) -> None:
        with pytest.raises(ValueError, match="Unknown condition"):
            extract(medicine_a, "InvalidCondition", field_map=field_map)


# ---------------------------------------------------------------------------
# LowCB tests — must not contain detected_activity
# ---------------------------------------------------------------------------

class TestLowCB:

    def test_lowaf_lowcb_no_detected_activity(
        self, medicine_a: dict, field_map
    ) -> None:
        pruned = extract(medicine_a, "LowAF_LowCB", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("detected_activity" in p for p in paths)

    def test_highaf_lowcb_no_detected_activity(
        self, medicine_a: dict, field_map
    ) -> None:
        pruned = extract(medicine_a, "HighAF_LowCB", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("detected_activity" in p for p in paths)
