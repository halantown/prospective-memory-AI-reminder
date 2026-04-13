"""Tests for context_extractor — validates that pruning logic correctly
implements the condition field whitelist for the 2×2 AF × EC design
(AF_low_EC_off, AF_high_EC_off, AF_low_EC_on, AF_high_EC_on).

Updated for v2 task JSON schema (element1_af/element2_ec structure).
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
def book_task() -> dict:
    """Load the canonical book1_mei.json task schema (v2)."""
    path = DATA_DIR / "book1_mei.json"
    assert path.exists(), f"book1_mei.json not found at {path}"
    with open(path) as f:
        return json.load(f)


@pytest.fixture(scope="module")
def field_map():
    """Load the production condition field map once per module."""
    return load_condition_field_map()


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
# AF_low_EC_off — minimal: action + entity only, no source, no features
# ---------------------------------------------------------------------------

class TestAFLowECOff:

    def test_extracts_action_verb(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_low_EC_off", field_map=field_map)
        assert pruned["reminder_context"]["element1_af"]["af_baseline"]["action_verb"] == "give"

    def test_extracts_recipient(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_low_EC_off", field_map=field_map)
        assert pruned["reminder_context"]["element1_af"]["af_baseline"]["recipient"] == "Mei"

    def test_extracts_entity_name(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_low_EC_off", field_map=field_map)
        assert pruned["reminder_context"]["element1_af"]["af_high"]["target_entity"]["entity_name"] == "book"

    def test_excludes_visual_cues(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_low_EC_off", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("visual_cues" in p for p in paths)

    def test_excludes_domain_properties(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_low_EC_off", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("domain_properties" in p for p in paths)

    def test_excludes_location(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_low_EC_off", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("location" in p for p in paths)

    def test_excludes_element2_ec(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_low_EC_off", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("element2_ec" in p for p in paths)

    def test_excludes_element3(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_low_EC_off", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("element3" in p for p in paths)

    def test_excludes_agent_reasoning_zone(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_low_EC_off", field_map=field_map)
        assert "agent_reasoning_context" not in pruned


# ---------------------------------------------------------------------------
# AF_high_EC_off — detailed item features, no source context
# ---------------------------------------------------------------------------

class TestAFHighECOff:

    def test_extracts_action_and_entity(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_high_EC_off", field_map=field_map)
        baseline = pruned["reminder_context"]["element1_af"]["af_baseline"]
        assert baseline["action_verb"] == "give"
        assert baseline["recipient"] == "Mei"
        entity = pruned["reminder_context"]["element1_af"]["af_high"]["target_entity"]
        assert entity["entity_name"] == "book"

    def test_extracts_visual_cues(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_high_EC_off", field_map=field_map)
        visual = pruned["reminder_context"]["element1_af"]["af_high"]["target_entity"]["visual_cues"]
        assert "red cover" in visual.get("color", "")

    def test_extracts_domain_properties(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_high_EC_off", field_map=field_map)
        props = pruned["reminder_context"]["element1_af"]["af_high"]["target_entity"]["domain_properties"]
        assert props["title"] == "Erta Ale"

    def test_extracts_location(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_high_EC_off", field_map=field_map)
        loc = pruned["reminder_context"]["element1_af"]["af_high"]["location"]
        assert loc["room"] == "study"

    def test_excludes_element2_ec(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_high_EC_off", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("element2_ec" in p for p in paths)

    def test_excludes_element3(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_high_EC_off", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("element3" in p for p in paths)

    def test_excludes_agent_reasoning_zone(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_high_EC_off", field_map=field_map)
        assert "agent_reasoning_context" not in pruned


# ---------------------------------------------------------------------------
# AF_low_EC_on — minimal item + source context
# ---------------------------------------------------------------------------

class TestAFLowECOn:

    def test_extracts_action_and_entity(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_low_EC_on", field_map=field_map)
        baseline = pruned["reminder_context"]["element1_af"]["af_baseline"]
        assert baseline["action_verb"] == "give"
        entity = pruned["reminder_context"]["element1_af"]["af_high"]["target_entity"]
        assert entity["entity_name"] == "book"

    def test_extracts_task_creator(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_low_EC_on", field_map=field_map)
        el2 = pruned["reminder_context"]["element2_ec"]
        assert el2["task_creator"] == "Mei"

    def test_extracts_ec_cue(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_low_EC_on", field_map=field_map)
        ec_cue = pruned["reminder_context"]["element2_ec"]["ec_cue"]
        assert "baking" in ec_cue

    def test_excludes_visual_cues(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_low_EC_on", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("visual_cues" in p for p in paths)

    def test_excludes_domain_properties(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_low_EC_on", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("domain_properties" in p for p in paths)

    def test_excludes_location(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_low_EC_on", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("location" in p for p in paths)

    def test_excludes_element3(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_low_EC_on", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("element3" in p for p in paths)


# ---------------------------------------------------------------------------
# AF_high_EC_on — full information
# ---------------------------------------------------------------------------

class TestAFHighECOn:

    def test_extracts_action_and_entity(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_high_EC_on", field_map=field_map)
        baseline = pruned["reminder_context"]["element1_af"]["af_baseline"]
        assert baseline["action_verb"] == "give"
        entity = pruned["reminder_context"]["element1_af"]["af_high"]["target_entity"]
        assert entity["entity_name"] == "book"

    def test_extracts_visual_cues(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_high_EC_on", field_map=field_map)
        visual = pruned["reminder_context"]["element1_af"]["af_high"]["target_entity"]["visual_cues"]
        assert "red cover" in visual.get("color", "")

    def test_extracts_domain_properties(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_high_EC_on", field_map=field_map)
        props = pruned["reminder_context"]["element1_af"]["af_high"]["target_entity"]["domain_properties"]
        assert props["title"] == "Erta Ale"

    def test_extracts_location(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_high_EC_on", field_map=field_map)
        loc = pruned["reminder_context"]["element1_af"]["af_high"]["location"]
        assert loc["room"] == "study"

    def test_extracts_task_creator(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_high_EC_on", field_map=field_map)
        el2 = pruned["reminder_context"]["element2_ec"]
        assert el2["task_creator"] == "Mei"

    def test_extracts_ec_cue(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_high_EC_on", field_map=field_map)
        ec_cue = pruned["reminder_context"]["element2_ec"]["ec_cue"]
        assert "baking" in ec_cue

    def test_excludes_element3(self, book_task: dict, field_map) -> None:
        pruned = extract(book_task, "AF_high_EC_on", field_map=field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("element3" in p for p in paths)


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------

class TestErrors:

    def test_missing_required_field_raises(self, field_map) -> None:
        incomplete_task = {
            "task_id": "broken",
            "reminder_context": {
                "element1_af": {
                    "af_baseline": {
                        "action_verb": "give",
                        "recipient": "Mei",
                    },
                    # missing af_high.target_entity.entity_name
                },
            },
        }
        with pytest.raises(MissingRequiredFieldError, match="entity_name"):
            extract(incomplete_task, "AF_low_EC_off", field_map=field_map)

    def test_unknown_condition_raises(self, book_task: dict, field_map) -> None:
        with pytest.raises(ValueError, match="Unknown condition"):
            extract(book_task, "InvalidCondition", field_map=field_map)

    def test_old_condition_af_cb_raises(self, book_task: dict, field_map) -> None:
        """Old condition name 'AF_CB' should no longer be accepted."""
        with pytest.raises(ValueError, match="Unknown condition"):
            extract(book_task, "AF_CB", field_map=field_map)

    def test_old_condition_baseline_raises(self, book_task: dict, field_map) -> None:
        """Old condition name 'Baseline' should no longer be accepted."""
        with pytest.raises(ValueError, match="Unknown condition"):
            extract(book_task, "Baseline", field_map=field_map)
