"""Tests for baseline_generator.py"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from reminder_agent.stage2.baseline_generator import generate_baseline, generate_all_baselines, load_all_task_jsons
from reminder_agent.stage2.config_loader import load_condition_field_map
from reminder_agent.stage2.context_extractor import MissingRequiredFieldError

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "task_schemas"

EXPECTED_BASELINES = {
    "b1_book": "Remember to find and bring the book.",
    "b1_giftbag": "Remember to get and bring the gift bag.",
    "b1_dish": "Remember to get and bring the baking dish.",
    "b1_soap": "Remember to get and place the hand soap.",
    "b2_vinyl": "Remember to find and place the vinyl record.",
    "b2_napkinrings": "Remember to get and place the napkin rings.",
    "b2_pot": "Remember to get and use the flower pot.",
    "b2_softener": "Remember to get and add the fabric softener.",
    "b3_hanger": "Remember to get and use the hanger.",
    "b3_speaker": "Remember to get and set up the Bluetooth speaker.",
    "b3_vase": "Remember to get and prepare the vase.",
    "b3_handcream": "Remember to get and bring the hand cream.",
}


@pytest.fixture(scope="module")
def field_map():
    return load_condition_field_map()


@pytest.fixture(scope="module")
def book_task() -> dict:
    with open(DATA_DIR / "b1_book.json") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def soap_task() -> dict:
    with open(DATA_DIR / "b1_soap.json") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def vinyl_task() -> dict:
    with open(DATA_DIR / "b2_vinyl.json") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def all_tasks() -> list[dict]:
    return load_all_task_jsons()


class TestBaselineContent:

    def test_baseline_contains_action_verb(self, book_task, field_map):
        result = generate_baseline(book_task, field_map)
        assert "find and bring" in result

    def test_baseline_contains_entity_name(self, book_task, field_map):
        result = generate_baseline(book_task, field_map)
        assert "book" in result

    def test_baseline_starts_with_remember(self, book_task, field_map):
        result = generate_baseline(book_task, field_map)
        assert result.startswith("Remember to")

    def test_baseline_is_single_sentence(self, book_task, field_map):
        result = generate_baseline(book_task, field_map)
        assert result.count(".") == 1
        assert result.endswith(".")


class TestBaselineExclusions:

    def test_baseline_excludes_visual_cues(self, book_task, field_map):
        result = generate_baseline(book_task, field_map).lower()
        assert "red" not in result
        assert "mountain" not in result
        assert "cover" not in result

    def test_baseline_excludes_location(self, book_task, field_map):
        result = generate_baseline(book_task, field_map).lower()
        assert "study" not in result
        assert "bookcase" not in result
        assert "shelf" not in result

    def test_baseline_excludes_domain_properties(self, book_task, field_map):
        result = generate_baseline(book_task, field_map).lower()
        assert "erta ale" not in result
        assert "paperback" not in result

    def test_baseline_excludes_detected_activity(self, book_task, field_map):
        result = generate_baseline(book_task, field_map).lower()
        assert "steak" not in result
        assert "flipping" not in result

    def test_baseline_excludes_task_creator(self, book_task, field_map):
        result = generate_baseline(book_task, field_map).lower()
        assert "mei" not in result


class TestBaselineSpecificTasks:

    def test_baseline_book(self, book_task, field_map):
        assert generate_baseline(book_task, field_map) == EXPECTED_BASELINES["b1_book"]

    def test_baseline_soap(self, soap_task, field_map):
        assert generate_baseline(soap_task, field_map) == EXPECTED_BASELINES["b1_soap"]

    def test_baseline_vinyl(self, vinyl_task, field_map):
        assert generate_baseline(vinyl_task, field_map) == EXPECTED_BASELINES["b2_vinyl"]


class TestGenerateAllBaselines:

    def test_generate_all_baselines_count(self, all_tasks, field_map):
        baselines = generate_all_baselines(all_tasks, field_map)
        assert len(baselines) == 12

    def test_generate_all_baselines_keys(self, all_tasks, field_map):
        baselines = generate_all_baselines(all_tasks, field_map)
        assert set(baselines.keys()) == set(EXPECTED_BASELINES.keys())

    @pytest.mark.parametrize("task_id,expected", list(EXPECTED_BASELINES.items()))
    def test_all_baselines_match_expected(self, task_id, expected, all_tasks, field_map):
        baselines = generate_all_baselines(all_tasks, field_map)
        assert baselines[task_id] == expected, f"Mismatch for {task_id}"


class TestBaselineErrors:

    def test_missing_required_field_raises(self, field_map):
        broken_task = {
            "task_id": "broken",
            "reminder_context": {
                "element1": {
                    "action_verb": "take",
                    # missing target_entity
                },
            },
        }
        with pytest.raises(MissingRequiredFieldError):
            generate_baseline(broken_task, field_map)
