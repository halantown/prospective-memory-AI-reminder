"""Tests for CSV export field consistency.

Ensures exported CSV headers match the DB model columns and
that no fields are silently dropped or remapped.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models.cooking import CookingStepRecord, CookingDishScore
from models.logging import PhoneMessageLog
from models.pm_module import PMTaskEvent, CutsceneEvent, IntentionCheckEvent


class TestCookingStepExportFields:
    EXPECTED_CSV_FIELDS = {
        "step_id", "dish_id", "step_index",
        "activated_at", "completed_at", "result",
        "response_time_ms", "station", "chosen_option", "correct_option",
    }

    def test_model_has_all_exported_fields(self):
        model_columns = {c.name for c in CookingStepRecord.__table__.columns}
        missing = self.EXPECTED_CSV_FIELDS - model_columns
        assert not missing, f"CSV exports fields not in DB model: {missing}"

    def test_no_data_columns_missing_from_export(self):
        model_columns = {c.name for c in CookingStepRecord.__table__.columns}
        internal_only = {"id", "participant_id", "block_id"}
        exportable = model_columns - internal_only
        missing = exportable - self.EXPECTED_CSV_FIELDS
        assert not missing, f"DB columns not in CSV export: {missing}"


class TestCookingDishScoreExportFields:
    EXPECTED_CSV_FIELDS = {
        "dish_id", "total_steps",
        "steps_correct", "steps_wrong", "steps_missed",
        "started_at", "completed_at", "total_response_time_ms",
    }

    def test_model_has_all_exported_fields(self):
        model_columns = {c.name for c in CookingDishScore.__table__.columns}
        missing = self.EXPECTED_CSV_FIELDS - model_columns
        assert not missing, f"CSV exports fields not in DB model: {missing}"

    def test_no_data_columns_missing_from_export(self):
        model_columns = {c.name for c in CookingDishScore.__table__.columns}
        internal_only = {"id", "participant_id", "block_id"}
        exportable = model_columns - internal_only
        missing = exportable - self.EXPECTED_CSV_FIELDS
        assert not missing, f"DB columns not in CSV export: {missing}"


class TestCutsceneEventExportFields:
    EXPECTED_CSV_FIELDS = {
        "task_id", "segment_number",
        "display_time", "dismiss_time",
        "detailcheck_question", "detailcheck_answer", "detailcheck_correct",
    }

    def test_model_has_all_exported_fields(self):
        model_columns = {c.name for c in CutsceneEvent.__table__.columns}
        missing = self.EXPECTED_CSV_FIELDS - model_columns
        assert not missing, f"CSV exports fields not in DB model: {missing}"

    def test_no_data_columns_missing_from_export(self):
        model_columns = {c.name for c in CutsceneEvent.__table__.columns}
        internal_only = {"id", "session_id"}
        exportable = model_columns - internal_only
        missing = exportable - self.EXPECTED_CSV_FIELDS
        assert not missing, f"DB columns not in CSV export: {missing}"


class TestIntentionCheckExportFields:
    EXPECTED_CSV_FIELDS = {
        "task_id", "position",
        "selected_option_index", "correct_option_index",
        "response_time_ms",
    }

    def test_model_has_all_exported_fields(self):
        model_columns = {c.name for c in IntentionCheckEvent.__table__.columns}
        missing = self.EXPECTED_CSV_FIELDS - model_columns
        assert not missing, f"CSV exports fields not in DB model: {missing}"

    def test_no_data_columns_missing_from_export(self):
        model_columns = {c.name for c in IntentionCheckEvent.__table__.columns}
        internal_only = {"id", "session_id"}
        exportable = model_columns - internal_only
        missing = exportable - self.EXPECTED_CSV_FIELDS
        assert not missing, f"DB columns not in CSV export: {missing}"
