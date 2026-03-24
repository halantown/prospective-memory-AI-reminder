"""Tests for context_extractor.py — Baseline condition."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from reminder_agent.stage2.config_loader import load_condition_field_map
from reminder_agent.stage2.context_extractor import extract
from reminder_agent.stage2.baseline_generator import load_all_task_jsons

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "task_schemas"


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


@pytest.fixture(scope="module")
def field_map():
    return load_condition_field_map()


@pytest.fixture(scope="module")
def book_task() -> dict:
    with open(DATA_DIR / "b1_book.json") as f:
        return json.load(f)


class TestBaselineExtraction:

    def test_baseline_extracts_action_verb(self, book_task, field_map):
        pruned = extract(book_task, "Baseline", field_map)
        assert pruned["reminder_context"]["element1"]["action_verb"] == "find and bring"

    def test_baseline_extracts_entity_name(self, book_task, field_map):
        pruned = extract(book_task, "Baseline", field_map)
        assert pruned["reminder_context"]["element1"]["target_entity"]["entity_name"] == "book"

    def test_baseline_excludes_visual_cues(self, book_task, field_map):
        pruned = extract(book_task, "Baseline", field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("cues" in p for p in paths)
        assert not any("visual" in p for p in paths)

    def test_baseline_excludes_domain_properties(self, book_task, field_map):
        pruned = extract(book_task, "Baseline", field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("domain_properties" in p for p in paths)

    def test_baseline_excludes_location(self, book_task, field_map):
        pruned = extract(book_task, "Baseline", field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("location" in p for p in paths)

    def test_baseline_excludes_element2(self, book_task, field_map):
        pruned = extract(book_task, "Baseline", field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("element2" in p for p in paths)

    def test_baseline_excludes_element3(self, book_task, field_map):
        pruned = extract(book_task, "Baseline", field_map)
        paths = _collect_leaf_paths(pruned)
        assert not any("element3" in p for p in paths)

    def test_baseline_excludes_agent_reasoning_zone(self, book_task, field_map):
        pruned = extract(book_task, "Baseline", field_map)
        assert "agent_reasoning_context" not in pruned

    @pytest.mark.parametrize("task_json", load_all_task_jsons(), ids=lambda t: t["task_id"])
    def test_baseline_extraction_works_for_all_tasks(self, task_json, field_map):
        pruned = extract(task_json, "Baseline", field_map)
        paths = _collect_leaf_paths(pruned)
        assert any("action_verb" in p for p in paths)
        assert any("entity_name" in p for p in paths)
        assert not any("visual" in p for p in paths)
        assert not any("element3" in p for p in paths)
