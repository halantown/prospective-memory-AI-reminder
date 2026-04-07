"""Tests for diagnosticity_analyzer module."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import yaml

from reminder_agent.stage2.diagnosticity_analyzer import (
    BLOCK_ASSIGNMENTS,
    TASK_TO_BLOCK,
    analyze_task,
    get_block_peers,
    load_all_tasks,
    load_report,
    save_report,
    _parse_json_response,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_task():
    """A minimal task JSON for testing."""
    return {
        "task_id": "b1_book",
        "reminder_context": {
            "element1": {
                "action_verb": "find and bring",
                "target_entity": {
                    "entity_name": "book",
                    "object_type": "personal item",
                    "cues": {"visual": "Red cover with mountain landscape illustration"},
                    "domain_properties": {"title": "Erta Ale", "format": "paperback"},
                },
                "location": {"room": "study", "spot": "second shelf of the bookcase"},
            },
            "element2": {"origin": {"task_creator": "friend Mei"}},
            "element3": {"detected_activity_raw": "User is flipping steak"},
        },
        "agent_reasoning_context": {
            "encoding_info": {
                "encoding_text": "Your friend Mei asked to borrow a travel book. It is a red paperback with a mountain illustration on the cover, titled Erta Ale.",
            },
            "distractor_info": {
                "distractors": [
                    {
                        "id": "d1",
                        "description": "Red paperback with ocean wave illustration",
                        "shared_features_with_target": ["color: red"],
                        "distinguishing_features": ["cover: wave (not mountain)"],
                    },
                    {
                        "id": "d2",
                        "description": "Blue paperback with mountain illustration",
                        "shared_features_with_target": ["cover: mountain"],
                        "distinguishing_features": ["color: blue (not red)"],
                    },
                ],
                "target_unique_conjunction": "red + mountain",
            },
        },
    }


@pytest.fixture
def sample_report():
    """A minimal diagnosticity report for testing."""
    return {
        "task_id": "b1_book",
        "analysis_version": "0.1",
        "model_used": "test-model",
        "analyzed_at": "2026-03-31T12:00:00Z",
        "review_status": "pending",
        "candidate_features": [
            {"feature_id": "f1", "feature": "red cover", "source": "encoding_text", "feature_type": "visual_color"},
            {"feature_id": "f2", "feature": "mountain illustration", "source": "encoding_text", "feature_type": "visual_pattern"},
        ],
        "diagnosticity": [
            {"feature_id": "f1", "level_a": {"rating": "medium", "reasoning": "test"}, "level_b": {"rating": "medium", "reasoning": "test"}, "combined": "MEDIUM"},
            {"feature_id": "f2", "level_a": {"rating": "high", "reasoning": "test"}, "level_b": {"rating": "medium", "reasoning": "test"}, "combined": "HIGH"},
        ],
        "recommended_cues": {
            "include": [
                {"feature_id": "f1", "priority": 1, "reason": "conjunction member"},
                {"feature_id": "f2", "priority": 1, "reason": "conjunction member"},
            ],
            "exclude": [],
        },
        "target_conjunction": "red + mountain illustration",
        "minimum_cues_for_discrimination": ["f1", "f2"],
    }


# ---------------------------------------------------------------------------
# Unit tests
# ---------------------------------------------------------------------------

class TestBlockAssignments:

    def test_all_12_tasks_assigned(self):
        all_tasks = [tid for tids in BLOCK_ASSIGNMENTS.values() for tid in tids]
        assert len(all_tasks) == 12
        assert len(set(all_tasks)) == 12

    def test_task_to_block_mapping(self):
        assert TASK_TO_BLOCK["b1_book"] == "B1"
        assert TASK_TO_BLOCK["b2_vinyl"] == "B2"
        assert TASK_TO_BLOCK["b3_vase"] == "B3"

    def test_get_block_peers(self):
        # After the AF×EC migration only example tasks exist on disk,
        # so b1_book peers won't be found.  Verify the function still
        # works when given a synthetic all_tasks dict containing the
        # full B1 block.
        fake_tasks = {tid: {"task_id": tid} for tid in BLOCK_ASSIGNMENTS["B1"]}
        peers = get_block_peers("b1_book", fake_tasks)
        peer_ids = [t["task_id"] for t in peers]
        assert "b1_book" not in peer_ids
        assert len(peer_ids) == 3
        assert set(peer_ids) == {"b1_giftbag", "b1_dish", "b1_soap"}


class TestJsonParsing:

    def test_plain_json(self):
        result = _parse_json_response('{"key": "value"}')
        assert result == {"key": "value"}

    def test_markdown_fenced_json(self):
        text = '```json\n{"key": "value"}\n```'
        result = _parse_json_response(text)
        assert result == {"key": "value"}

    def test_markdown_fenced_no_lang(self):
        text = '```\n{"key": "value"}\n```'
        result = _parse_json_response(text)
        assert result == {"key": "value"}


class TestReportIO:

    def test_save_and_load(self, sample_report, tmp_path):
        path = save_report(sample_report, output_dir=tmp_path)
        assert path.exists()
        assert path.suffix == ".yaml"

        loaded = load_report("b1_book", report_dir=tmp_path)
        assert loaded["task_id"] == "b1_book"
        assert loaded["review_status"] == "pending"
        assert len(loaded["candidate_features"]) == 2

    def test_load_nonexistent_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            load_report("nonexistent_task", report_dir=tmp_path)


class TestAnalyzeTask:

    def test_analyze_with_mocked_backend(self, sample_task):
        """Test that analyze_task calls LLM and produces valid report structure."""
        mock_backend = MagicMock()
        mock_backend.config = MagicMock()
        mock_backend.config.model_name = "test-model"

        # Mock feature extraction response
        features_response = json.dumps({
            "features": [
                {"feature_id": "f1", "feature": "red cover", "source": "encoding_text",
                 "feature_type": "visual_color", "exact_quote": "red paperback"},
                {"feature_id": "f2", "feature": "mountain illustration", "source": "encoding_text",
                 "feature_type": "visual_pattern", "exact_quote": "mountain illustration"},
            ]
        })

        # Mock diagnosticity assessment response
        assessment_response = json.dumps({
            "diagnosticity": [
                {"feature_id": "f1", "level_a": {"rating": "medium", "reasoning": "ok"},
                 "level_b": {"rating": "medium", "reasoning": "ok"}, "combined": "MEDIUM"},
                {"feature_id": "f2", "level_a": {"rating": "high", "reasoning": "ok"},
                 "level_b": {"rating": "medium", "reasoning": "ok"}, "combined": "HIGH"},
            ],
            "recommended_include": [
                {"feature_id": "f1", "priority": 1, "reason": "conjunction"},
                {"feature_id": "f2", "priority": 1, "reason": "conjunction"},
            ],
            "recommended_exclude": [],
            "target_conjunction": "red + mountain",
            "minimum_cues_for_discrimination": ["f1", "f2"],
        })

        mock_backend.generate.side_effect = [features_response, assessment_response]

        # Create mock block peers (minimal)
        block_peers = [
            {"task_id": "b1_giftbag", "reminder_context": {"element1": {"target_entity": {"entity_name": "gift bag", "cues": {"visual": "Small blue bag"}}}}},
        ]

        report = analyze_task(sample_task, block_peers, mock_backend)

        assert report["task_id"] == "b1_book"
        assert report["review_status"] == "pending"
        assert len(report["candidate_features"]) == 2
        assert len(report["diagnosticity"]) == 2
        assert len(report["recommended_cues"]["include"]) == 2
        assert report["target_conjunction"] == "red + mountain"
        assert mock_backend.generate.call_count == 2
