"""Tests for stage2/quality_gate.py — v3 EC operationalization.

Covers quality checks:
  1. Baseline present (action + target + recipient)
  2. EC features present (entity + causality for EC_on)
  3. No extra dimensions (no unselected dimension leak for EC_on)
  4. No fabrication (no invented entities for EC_on)
  5. Length constraint (per-condition word limits)
  6. Duplicate detection (Levenshtein)
  7. Language check
  8. Hyphen compression check
Plus the aggregate `check()` orchestrator.
"""

from __future__ import annotations

import pytest

from reminder_agent.stage2.quality_gate import (
    CONDITION_MAX_WORDS,
    CheckResult,
    GateResult,
    check,
    check_baseline_present,
    check_duplicate,
    check_ec_features_present,
    check_hyphen_compression,
    check_language,
    check_length,
    check_no_extra_dimensions,
    check_no_fabrication,
)

# ===================================================================
# Shared fixture data
# ===================================================================

BOOK_TASK_JSON = {
    "task_id": "book1_mei",
    "reminder_context": {
        "baseline": {
            "action_verb": "give",
            "target": "the baking book",
            "recipient": "Mei",
        },
        "episode_dimensions": {
            "time": "last week",
            "space": "home (baking together)",
            "entity": ["Mei", "baking book", "chocolate cake", "recipe"],
            "causality": "Mei liked the book and wanted to borrow it",
            "intentionality": "Mei wants to try the recipes at home",
        },
        "ec_priority_dimensions": ["entity", "causality"],
        "ec_selected_features": {
            "entity": ["Mei", "baking book"],
            "causality": "Mei liked the book and wanted to borrow it",
        },
    },
}

BASELINE = BOOK_TASK_JSON["reminder_context"]["baseline"]
EPISODE_DIMS = BOOK_TASK_JSON["reminder_context"]["episode_dimensions"]
EC_FEATURES = BOOK_TASK_JSON["reminder_context"]["ec_selected_features"]


# ===================================================================
# 1. Baseline present
# ===================================================================

class TestCheckBaselinePresent:
    """Verify action + target + recipient appear in text."""

    def test_all_baseline_elements_found(self) -> None:
        result = check_baseline_present(
            "Remember to give Mei the baking book.", BASELINE,
        )
        assert result.passed

    def test_missing_target(self) -> None:
        result = check_baseline_present(
            "Remember to give Mei something.", BASELINE,
        )
        assert not result.passed
        assert "target" in result.detail.lower()

    def test_missing_recipient(self) -> None:
        result = check_baseline_present(
            "Remember to give the baking book.", BASELINE,
        )
        assert not result.passed
        assert "recipient" in result.detail.lower()

    def test_empty_baseline_passes(self) -> None:
        result = check_baseline_present(
            "Remember to do something.", {},
        )
        assert result.passed


# ===================================================================
# 2. EC features present (EC_on only)
# ===================================================================

class TestCheckEcFeaturesPresent:
    """Verify entity + causality features paraphrased in text for EC_on."""

    def test_ec_off_skipped(self) -> None:
        result = check_ec_features_present(
            "Remember to give the book.", "EC_off", EC_FEATURES,
        )
        assert result.passed
        assert "skipped" in result.detail.lower()

    def test_entity_and_causality_present(self) -> None:
        result = check_ec_features_present(
            "Mei liked the book and wanted to borrow it.",
            "EC_on", EC_FEATURES,
        )
        assert result.passed

    def test_entity_missing(self) -> None:
        result = check_ec_features_present(
            "Someone liked the thing and wanted to borrow it.",
            "EC_on", EC_FEATURES,
        )
        assert not result.passed
        assert "entity" in result.detail.lower()

    def test_causality_missing(self) -> None:
        result = check_ec_features_present(
            "Mei is around and needs the baking stuff.", "EC_on", EC_FEATURES,
        )
        assert not result.passed
        assert "causality" in result.detail.lower()


# ===================================================================
# 3. No extra dimensions (EC_on only)
# ===================================================================

class TestCheckNoExtraDimensions:
    """Verify unselected dimension keywords don't leak into EC_on text."""

    def test_ec_off_skipped(self) -> None:
        result = check_no_extra_dimensions(
            "Remember to give the book last week.",
            "EC_off", EPISODE_DIMS, EC_FEATURES,
        )
        assert result.passed
        assert "skipped" in result.detail.lower()

    def test_clean_text_passes(self) -> None:
        result = check_no_extra_dimensions(
            "Mei liked the baking book and wanted to borrow it.",
            "EC_on", EPISODE_DIMS, EC_FEATURES,
        )
        assert result.passed

    def test_time_leak(self) -> None:
        result = check_no_extra_dimensions(
            "Mei liked the baking book last week and wanted to borrow it.",
            "EC_on", EPISODE_DIMS, EC_FEATURES,
        )
        assert not result.passed
        assert "time" in result.detail.lower()


# ===================================================================
# 4. No fabrication (EC_on only)
# ===================================================================

class TestCheckNoFabrication:
    """Verify no invented named entities appear in EC_on text."""

    def test_ec_off_skipped(self) -> None:
        result = check_no_fabrication(
            "Remember to give Thomas the book.",
            "EC_off", BASELINE, EPISODE_DIMS, EC_FEATURES,
        )
        assert result.passed
        assert "skipped" in result.detail.lower()

    def test_clean_text_passes(self) -> None:
        result = check_no_fabrication(
            "Remember to give Mei the baking book.",
            "EC_on", BASELINE, EPISODE_DIMS, EC_FEATURES,
        )
        assert result.passed

    def test_fabricated_entity(self) -> None:
        result = check_no_fabrication(
            "Remember that Thomas liked the baking book.",
            "EC_on", BASELINE, EPISODE_DIMS, EC_FEATURES,
        )
        assert not result.passed
        assert "Thomas" in result.detail


# ===================================================================
# 5. Length constraint (per-condition word limits)
# ===================================================================

class TestCheckLength:
    """Test condition-aware word limits (EC_off: 12, EC_on: 25)."""

    def test_ec_off_max_12(self) -> None:
        text_13 = " ".join(["word"] * 13)
        result = check_length(text_13, condition="EC_off")
        assert not result.passed
        assert "Too long" in result.detail

    def test_ec_on_max_25(self) -> None:
        text_26 = " ".join(["word"] * 26)
        result = check_length(text_26, condition="EC_on")
        assert not result.passed
        assert "Too long" in result.detail

    def test_within_ec_off_limits(self) -> None:
        text_8 = "Remember to give Mei the baking book please."
        assert len(text_8.split()) == 8
        result = check_length(text_8, condition="EC_off")
        assert result.passed

    def test_within_ec_on_limits(self) -> None:
        text_20 = " ".join(["word"] * 20)
        result = check_length(text_20, condition="EC_on")
        assert result.passed

    def test_too_short(self) -> None:
        result = check_length("Get book now.", condition="EC_off")
        assert not result.passed
        assert "Too short" in result.detail


# ===================================================================
# 6. Duplicate detection
# ===================================================================

class TestCheckDuplicate:
    """Test Levenshtein duplicate detection."""

    def test_no_prior_variants(self) -> None:
        result = check_duplicate("Some reminder text.", [], 0.85)
        assert result.passed

    def test_unique_enough(self) -> None:
        result = check_duplicate(
            "Don't forget the book for Mei.",
            ["By the way, remember to give the baking book when you see her."],
            0.85,
        )
        assert result.passed

    def test_too_similar(self) -> None:
        result = check_duplicate(
            "Remember to give Mei the baking book.",
            ["Remember to give Mei the baking book."],
            0.85,
        )
        assert not result.passed


# ===================================================================
# 7. Language check
# ===================================================================

class TestCheckLanguage:
    """Test language detection check."""

    def test_english_passes(self) -> None:
        result = check_language(
            "Remember to find and bring the book from the study for Mei."
        )
        assert result.passed

    def test_short_ascii_passes(self) -> None:
        result = check_language("Remember the book for Mei.")
        assert result.passed


# ===================================================================
# 8. Hyphen compression
# ===================================================================

class TestCheckHyphenCompression:
    """Test hyphen-compressed phrase detection."""

    def test_natural_text_passes(self) -> None:
        result = check_hyphen_compression("Remember to give Mei the book.")
        assert result.passed

    def test_compressed_fails(self) -> None:
        result = check_hyphen_compression(
            "Last-week-movie reminder — give the book to Mei."
        )
        assert not result.passed


# ===================================================================
# 9. Aggregate check() orchestrator
# ===================================================================

class TestCheckOrchestrator:
    """Test the main check() orchestrator with v3 task_json."""

    def test_ec_off_all_pass(self) -> None:
        result = check(
            text="Remember to give Mei the baking book.",
            condition="EC_off",
            task_id="book1_mei",
            entity_name="book",
            task_json=BOOK_TASK_JSON,
        )
        assert result.passed
        assert len(result.failures) == 0

    def test_ec_on_all_pass(self) -> None:
        result = check(
            text="Mei liked the baking book and wanted to borrow it. Remember to give her the book.",
            condition="EC_on",
            task_id="book1_mei",
            entity_name="book",
            task_json=BOOK_TASK_JSON,
        )
        assert result.passed
        assert len(result.failures) == 0

    def test_ec_off_too_long(self) -> None:
        long_text = (
            "Remember to give Mei the baking book when you see her "
            "next time at her house on Tuesday after dinner."
        )
        result = check(
            text=long_text,
            condition="EC_off",
            task_id="book1_mei",
            entity_name="book",
            task_json=BOOK_TASK_JSON,
        )
        assert not result.passed
        failed_names = [f.check_name for f in result.failures]
        assert "length" in failed_names

    def test_ec_on_without_context(self) -> None:
        result = check(
            text="Remember to give Mei the baking treat she asked about during the afternoon gathering.",
            condition="EC_on",
            task_id="book1_mei",
            entity_name="book",
            task_json=BOOK_TASK_JSON,
        )
        assert not result.passed
        failed_names = [f.check_name for f in result.failures]
        assert "ec_features_present" in failed_names

