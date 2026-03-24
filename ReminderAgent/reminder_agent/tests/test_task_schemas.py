"""Validate all 12 task JSON files against the schema."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "task_schemas"

EXPECTED_TASK_IDS = {
    "b1_book", "b1_giftbag", "b1_dish", "b1_soap",
    "b2_vinyl", "b2_napkinrings", "b2_pot", "b2_softener",
    "b3_hanger", "b3_speaker", "b3_vase", "b3_handcream",
}


@pytest.fixture(scope="module")
def all_tasks() -> list[dict]:
    """Load all task JSON files."""
    tasks = []
    for path in sorted(DATA_DIR.glob("*.json")):
        with open(path) as f:
            tasks.append(json.load(f))
    return tasks


class TestTaskSchemas:

    def test_all_12_files_exist(self):
        json_files = list(DATA_DIR.glob("*.json"))
        assert len(json_files) == 12

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
            assert "placeholder" in task, f"{tid} missing placeholder"

    def test_all_element1_fields_present(self, all_tasks):
        for task in all_tasks:
            tid = task["task_id"]
            el1 = task["reminder_context"]["element1"]
            assert "action_verb" in el1, f"{tid} missing action_verb"
            assert "target_entity" in el1, f"{tid} missing target_entity"
            assert "location" in el1, f"{tid} missing location"
            te = el1["target_entity"]
            assert "entity_name" in te, f"{tid} missing entity_name"
            assert "cues" in te, f"{tid} missing cues"
            assert "domain_properties" in te, f"{tid} missing domain_properties"

    def test_task_ids_unique(self, all_tasks):
        ids = [t["task_id"] for t in all_tasks]
        assert len(ids) == len(set(ids)), "Duplicate task_ids found"
        assert set(ids) == EXPECTED_TASK_IDS
