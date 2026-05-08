"""Tests for PM session lifecycle guards."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine.pm_session import _is_main_experiment_phase


def test_pm_session_only_runs_during_main_experiment():
    assert _is_main_experiment_phase("MAIN_EXPERIMENT") is True
    assert _is_main_experiment_phase("playing") is True

    assert _is_main_experiment_phase("POST_MANIP_CHECK") is False
    assert _is_main_experiment_phase("post_questionnaire") is False
    assert _is_main_experiment_phase("NO_SUCH_PHASE") is False
