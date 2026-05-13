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


def test_normalize_accepts_canonical_phase_names():
    assert normalize_phase("WELCOME") == ExperimentPhase.WELCOME
    assert normalize_phase("MAIN_EXPERIMENT") == ExperimentPhase.MAIN_EXPERIMENT
    assert normalize_phase("POST_MANIP_CHECK") == ExperimentPhase.POST_MANIP_CHECK


def test_next_phase_uses_canonical_order():
    assert next_phase_after("TOKEN_INPUT") == ExperimentPhase.WELCOME
    assert next_phase_after("ASSIGN_4") == ExperimentPhase.RECAP
    assert next_phase_after("MAIN_EXPERIMENT") == ExperimentPhase.POST_MANIP_CHECK
    assert next_phase_after("COMPLETED") is None


def test_unknown_phase_rejected():
    with pytest.raises(ValueError):
        normalize_phase("NO_SUCH_PHASE")


def test_removed_legacy_aliases_rejected():
    with pytest.raises(ValueError):
        normalize_phase("playing")
