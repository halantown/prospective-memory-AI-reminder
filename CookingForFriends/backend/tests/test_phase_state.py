"""Tests for the canonical experiment phase state machine."""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine.phase_state import ExperimentPhase, next_phase_after, normalize_phase, phase_values


def test_phase_sequence_starts_and_ends_with_full_flow_boundaries():
    values = phase_values()
    assert values[0] == "TOKEN_INPUT"
    assert values[-1] == "COMPLETED"
    assert "MAIN_EXPERIMENT" in values
    assert "EVENING_TRANSITION" in values


@pytest.mark.parametrize(
    ("legacy", "expected"),
    [
        ("welcome", ExperimentPhase.WELCOME),
        ("consent", ExperimentPhase.CONSENT),
        ("introduction", ExperimentPhase.STORY_INTRO),
        ("encoding", ExperimentPhase.ENCODING_VIDEO_1),
        ("playing", ExperimentPhase.MAIN_EXPERIMENT),
        ("post_questionnaire", ExperimentPhase.POST_MANIP_CHECK),
        ("complete", ExperimentPhase.COMPLETED),
    ],
)
def test_normalize_legacy_phase_names(legacy, expected):
    assert normalize_phase(legacy) == expected


def test_next_phase_uses_canonical_order():
    assert next_phase_after("TOKEN_INPUT") == ExperimentPhase.WELCOME
    assert next_phase_after("ASSIGN_4") == ExperimentPhase.RECAP
    assert next_phase_after("MAIN_EXPERIMENT") == ExperimentPhase.POST_MANIP_CHECK
    assert next_phase_after("COMPLETED") is None


def test_unknown_phase_rejected():
    with pytest.raises(ValueError):
        normalize_phase("NO_SUCH_PHASE")

