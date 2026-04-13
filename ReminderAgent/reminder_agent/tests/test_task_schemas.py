"""Validate all task JSON files against the v2 schema."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "task_schemas"

EXPECTED_TASK_IDS = {"book1_mei", "ticket_jack", "tea_benjamin", "dessert_sophia"}


@pytest.fixture(scope="module")
def all_tasks() -> list[dict]:
    """Load all task JSON files (excluding archive/)."""
    tasks = []
    for path in sorted(DATA_DIR.glob("*.json")):
        with open(path) as f:
            tasks.append(json.load(f))
    return tasks


class TestTaskSchemas:

    def test_all_4_files_exist(self):
        json_files = list(DATA_DIR.glob("*.json"))
        assert len(json_files) == 4

    def test_all_files_valid_json(self):
        for path in DATA_DIR.glob("*.json"):
            with open(path) as f:
                data = json.load(f)
            assert isinstance(data, dict), f"{path.name} is not a JSON object"

    def test_all_files_have_required_zones(self, all_tasks):
        for task in all_tasks:
            tid = task.get("task_id", "unknown")
            assert "reminder_context" in task, f"{tid} missing reminder_context"
            assert "agent_reasoning_context" in task, f"{tid} missing agent_reasoning_context"
            assert "experiment_metadata" in task, f"{tid} missing experiment_metadata"

    def test_all_element1_af_fields_present(self, all_tasks):
        for task in all_tasks:
            tid = task["task_id"]
            el1 = task["reminder_context"]["element1_af"]
            baseline = el1["af_baseline"]
            assert "action_verb" in baseline, f"{tid} missing action_verb"
            assert "recipient" in baseline, f"{tid} missing recipient"
            af_high = el1["af_high"]
            assert "target_entity" in af_high, f"{tid} missing target_entity"
            assert "location" in af_high, f"{tid} missing location"
            te = af_high["target_entity"]
            assert "entity_name" in te, f"{tid} missing entity_name"
            assert "visual_cues" in te, f"{tid} missing visual_cues"
            assert "domain_properties" in te, f"{tid} missing domain_properties"

    def test_task_ids_unique(self, all_tasks):
        ids = [t["task_id"] for t in all_tasks]
        assert len(ids) == len(set(ids)), "Duplicate task_ids found"
        assert set(ids) == EXPECTED_TASK_IDS

    def test_element2_ec_present(self, all_tasks):
        for task in all_tasks:
            tid = task["task_id"]
            el2 = task["reminder_context"]["element2_ec"]
            assert "task_creator" in el2, f"{tid} missing element2_ec.task_creator"
            assert "creation_context" in el2, f"{tid} missing element2_ec.creation_context"

    def test_element3_excluded_present(self, all_tasks):
        for task in all_tasks:
            tid = task["task_id"]
            el3 = task["reminder_context"]["element3_excluded"]
            assert "detected_activity_raw" in el3, f"{tid} missing element3_excluded.detected_activity_raw"

    def test_c_af_candidates_have_diagnosticity(self, all_tasks):
        for task in all_tasks:
            tid = task["task_id"]
            candidates = task["reminder_context"]["element1_af"]["c_af_candidates"]
            assert len(candidates) >= 1, f"{tid} has no c_af_candidates"
            for c in candidates:
                assert "feature" in c, f"{tid} c_af_candidate missing feature"
                assert "diagnosticity" in c, f"{tid} c_af_candidate missing diagnosticity"
                assert c["diagnosticity"] in ("high", "low", "TODO"), (
                    f"{tid} invalid diagnosticity value: {c['diagnosticity']}"
                )

    def test_no_task_pair_fields(self, all_tasks):
        for task in all_tasks:
            assert "task_pair" not in task, f"{task['task_id']} should not have task_pair"
            assert "pair_role" not in task, f"{task['task_id']} should not have pair_role"

    def test_distractors_present(self, all_tasks):
        for task in all_tasks:
            tid = task["task_id"]
            distractors = task["reminder_context"]["element1_af"]["distractors"]
            assert len(distractors) >= 2, f"{tid} should have at least 2 distractors"
