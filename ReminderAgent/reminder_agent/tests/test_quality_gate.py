"""Tests for stage2/quality_gate.py — 2×2 AF × EC design.

Covers quality checks:
  1. Forbidden keyword leak (AF_low conditions)
  2. Required entity presence
  3. Length constraint
  4. Duplicate detection (Levenshtein)
  5. Language check
  6. EC source present (EC_on conditions)
  7. EC source absent (EC_off conditions)
Plus the aggregate `check()` function.
"""

from __future__ import annotations

import pytest

from reminder_agent.stage2.quality_gate import (
    CheckResult,
    GateResult,
    check,
    check_duplicate,
    check_ec_source_absent,
    check_ec_source_present,
    check_entity_present,
    check_forbidden_keywords,
    check_language,
    check_length,
)


# ===================================================================
# 1. Forbidden keyword leak (AF_low conditions)
# ===================================================================

class TestForbiddenKeywords:
    """Test forbidden keyword leak check for AF_low conditions."""

    FORBIDDEN_KW = {
        "example_book": {
            "visual_keywords": ["red", "mountain", "landscape", "cover"],
            "domain_keywords": ["erta ale", "paperback"],
        },
    }

    def test_af_high_always_passes(self) -> None:
        result = check_forbidden_keywords(
            "Remember to find the red book with the mountain cover.",
            "example_book", "AF_high_EC_off", self.FORBIDDEN_KW,
        )
        assert result.passed
        assert "skipped" in result.detail.lower()

    def test_af_low_with_leak_fails(self) -> None:
        result = check_forbidden_keywords(
            "Remember to find the red book.",
            "example_book", "AF_low_EC_off", self.FORBIDDEN_KW,
        )
        assert not result.passed
        assert "red" in result.detail.lower()

    def test_af_low_without_leak_passes(self) -> None:
        result = check_forbidden_keywords(
            "Remember to find and bring the book.",
            "example_book", "AF_low_EC_off", self.FORBIDDEN_KW,
        )
        assert result.passed

    def test_unknown_task_passes(self) -> None:
        result = check_forbidden_keywords(
            "Remember to find the red book.",
            "unknown_task", "AF_low_EC_off", self.FORBIDDEN_KW,
        )
        assert result.passed


# ===================================================================
# 2. Entity presence
# ===================================================================

class TestEntityPresent:
    """Test required entity presence check."""

    def test_entity_found(self) -> None:
        result = check_entity_present(
            "Remember to find and bring the book.", "book"
        )
        assert result.passed

    def test_entity_missing(self) -> None:
        result = check_entity_present(
            "Remember to get the item.", "book"
        )
        assert not result.passed
        assert "book" in result.detail

    def test_entity_case_insensitive(self) -> None:
        result = check_entity_present(
            "remember to find the BOOK.", "book"
        )
        assert result.passed

    def test_empty_entity_passes(self) -> None:
        result = check_entity_present(
            "Remember to get the item.", ""
        )
        assert result.passed


# ===================================================================
# 3. Length constraint
# ===================================================================

class TestLength:
    """Test word count constraint check."""

    def test_within_range(self) -> None:
        result = check_length(
            "Remember to find and bring the book from the study.", 5, 45
        )
        assert result.passed

    def test_too_short(self) -> None:
        result = check_length("Get book.", 5, 45)
        assert not result.passed
        assert "Too short" in result.detail

    def test_too_long(self) -> None:
        long_text = " ".join(["word"] * 50)
        result = check_length(long_text, 5, 45)
        assert not result.passed
        assert "Too long" in result.detail

    def test_exact_min(self) -> None:
        result = check_length("one two three four five", 5, 45)
        assert result.passed

    def test_exact_max(self) -> None:
        text = " ".join(["word"] * 45)
        result = check_length(text, 5, 45)
        assert result.passed


# ===================================================================
# 4. Duplicate detection
# ===================================================================

class TestDuplicate:
    """Test Levenshtein duplicate detection."""

    def test_no_prior_variants(self) -> None:
        result = check_duplicate("Some reminder text.", [], 0.85)
        assert result.passed

    def test_identical_text_fails(self) -> None:
        result = check_duplicate(
            "Remember to find and bring the book.",
            ["Remember to find and bring the book."],
            0.85,
        )
        assert not result.passed

    def test_very_similar_fails(self) -> None:
        result = check_duplicate(
            "Remember to find and bring the book today.",
            ["Remember to find and bring the book now."],
            0.85,
        )
        assert not result.passed

    def test_different_text_passes(self) -> None:
        result = check_duplicate(
            "Don't forget the book for Mei.",
            ["By the way, remember to find the red paperback from the study."],
            0.85,
        )
        assert result.passed

    def test_case_insensitive(self) -> None:
        result = check_duplicate(
            "REMEMBER TO FIND THE BOOK.",
            ["remember to find the book."],
            0.85,
        )
        assert not result.passed

    def test_multiple_prior_checks_all(self) -> None:
        result = check_duplicate(
            "Remember to find and bring the book.",
            [
                "A completely different sentence about something else entirely.",
                "Remember to find and bring the book.",
            ],
            0.85,
        )
        assert not result.passed
        assert "variant 1" in result.detail


# ===================================================================
# 5. Language check
# ===================================================================

class TestLanguage:
    """Test language detection check."""

    def test_english_passes(self) -> None:
        result = check_language(
            "Remember to find and bring the book from the study for Mei."
        )
        assert result.passed

    def test_non_english_fails(self) -> None:
        result = check_language(
            "N'oubliez pas de prendre votre médicament après le dîner."
        )
        assert not result.passed
        assert "fr" in result.detail

    def test_very_short_text(self) -> None:
        result = check_language("Hi")
        assert isinstance(result, CheckResult)


# ===================================================================
# 6. EC source present (EC_on only)
# ===================================================================

class TestECSourcePresent:
    """Test EC source presence check for EC_on conditions."""

    TASK_JSON = {
        "reminder_context": {
            "element2": {
                "origin": {
                    "task_creator": "friend Mei",
                    "creator_is_authority": False,
                },
                "creation_context": "Mei asked to borrow it during a phone call yesterday",
            },
        },
    }

    def test_ec_on_source_in_text_passes(self) -> None:
        result = check_ec_source_present(
            "Mei asked you to find the book. Remember to bring it.",
            "AF_low_EC_on",
            self.TASK_JSON,
        )
        assert result.passed

    def test_ec_on_source_missing_fails(self) -> None:
        result = check_ec_source_present(
            "Remember to find and bring the book.",
            "AF_low_EC_on",
            self.TASK_JSON,
        )
        assert not result.passed

    def test_ec_off_always_passes(self) -> None:
        result = check_ec_source_present(
            "Remember to find the book.",
            "AF_low_EC_off",
            self.TASK_JSON,
        )
        assert result.passed
        assert "skipped" in result.detail.lower()


# ===================================================================
# 7. EC source absent (EC_off only)
# ===================================================================

class TestECSourceAbsent:
    """Test EC source absence check for EC_off conditions."""

    TASK_JSON = {
        "reminder_context": {
            "element2": {
                "origin": {
                    "task_creator": "friend Mei",
                    "creator_is_authority": False,
                },
                "creation_context": "Mei asked to borrow it during a phone call yesterday",
            },
        },
    }

    def test_ec_off_no_source_passes(self) -> None:
        result = check_ec_source_absent(
            "Remember to find and bring the book.",
            "AF_low_EC_off",
            self.TASK_JSON,
        )
        assert result.passed

    def test_ec_off_creator_leaked_fails(self) -> None:
        result = check_ec_source_absent(
            "Remember to find the book for Mei.",
            "AF_low_EC_off",
            self.TASK_JSON,
        )
        assert not result.passed
        assert "leak" in result.detail.lower()

    def test_ec_on_always_passes(self) -> None:
        result = check_ec_source_absent(
            "Remember to find the book for Mei.",
            "AF_low_EC_on",
            self.TASK_JSON,
        )
        assert result.passed
        assert "skipped" in result.detail.lower()

    def test_creator_self_passes(self) -> None:
        task = {
            "reminder_context": {
                "element2": {
                    "origin": {
                        "task_creator": "self",
                        "creator_is_authority": False,
                    },
                    "creation_context": "",
                },
            },
        }
        result = check_ec_source_absent(
            "Remember to do this yourself.",
            "AF_low_EC_off",
            task,
        )
        assert result.passed


# ===================================================================
# 8. Aggregate check() function
# ===================================================================

class TestAggregateCheck:
    """Test the main check() function that runs all per-variant checks."""

    FORBIDDEN_KW = {
        "example_book": {
            "visual_keywords": ["red", "mountain", "landscape", "cover"],
            "domain_keywords": ["erta ale", "paperback"],
        },
    }

    TASK_JSON = {
        "reminder_context": {
            "element2": {
                "origin": {
                    "task_creator": "friend Mei",
                    "creator_is_authority": False,
                },
                "creation_context": "Mei asked to borrow it during a phone call yesterday",
            },
        },
    }

    def test_valid_af_high_ec_off_passes(self) -> None:
        result = check(
            text="Remember to find and bring the book from the study — the red paperback titled Erta Ale.",
            condition="AF_high_EC_off",
            task_id="example_book",
            entity_name="book",
            forbidden_kw=self.FORBIDDEN_KW,
            task_json=self.TASK_JSON,
        )
        assert result.passed
        assert len(result.failures) == 0

    def test_valid_af_high_ec_on_passes(self) -> None:
        result = check(
            text="Mei asked you about the book yesterday. Remember to find and bring the red paperback titled Erta Ale from the study.",
            condition="AF_high_EC_on",
            task_id="example_book",
            entity_name="book",
            forbidden_kw=self.FORBIDDEN_KW,
            task_json=self.TASK_JSON,
        )
        assert result.passed

    def test_missing_entity_fails_aggregate(self) -> None:
        result = check(
            text="Remember to find the item from the study shelf for your friend.",
            condition="AF_high_EC_off",
            task_id="example_book",
            entity_name="book",
            forbidden_kw=self.FORBIDDEN_KW,
        )
        assert not result.passed
        failed_names = [f.check_name for f in result.failures]
        assert "entity_present" in failed_names

    def test_too_short_fails_aggregate(self) -> None:
        result = check(
            text="Get book.",
            condition="AF_high_EC_off",
            task_id="example_book",
            entity_name="book",
            forbidden_kw=self.FORBIDDEN_KW,
        )
        assert not result.passed
        failed_names = [f.check_name for f in result.failures]
        assert "length" in failed_names

    def test_duplicate_fails_aggregate(self) -> None:
        prior = ["Remember to find and bring the book from the study — the red paperback."]
        result = check(
            text="Remember to find and bring the book from the study — the red paperback.",
            condition="AF_high_EC_off",
            task_id="example_book",
            entity_name="book",
            prior_variants=prior,
            forbidden_kw=self.FORBIDDEN_KW,
        )
        assert not result.passed
        failed_names = [f.check_name for f in result.failures]
        assert "duplicate" in failed_names

    def test_gate_result_summary(self) -> None:
        result = check(
            text="Remember to find and bring the book from the study — the red paperback titled Erta Ale.",
            condition="AF_high_EC_off",
            task_id="example_book",
            entity_name="book",
            forbidden_kw=self.FORBIDDEN_KW,
        )
        assert "PASS" in result.summary()

    def test_ec_source_leak_fails_aggregate(self) -> None:
        result = check(
            text="Remember to find the book for Mei from the study.",
            condition="AF_high_EC_off",
            task_id="example_book",
            entity_name="book",
            forbidden_kw=self.FORBIDDEN_KW,
            task_json=self.TASK_JSON,
        )
        assert not result.passed
        failed_names = [f.check_name for f in result.failures]
        assert "ec_source_absent" in failed_names

    def test_ec_on_missing_source_fails_aggregate(self) -> None:
        result = check(
            text="Remember to find and bring the book from the study.",
            condition="AF_high_EC_on",
            task_id="example_book",
            entity_name="book",
            forbidden_kw=self.FORBIDDEN_KW,
            task_json=self.TASK_JSON,
        )
        assert not result.passed
        failed_names = [f.check_name for f in result.failures]
        assert "ec_source_present" in failed_names


# ===================================================================
# 9. Cue priority compliance (kept for future use)
# ===================================================================

class TestCuePriorityCompliance:
    """Test cue priority compliance check with diagnosticity reports."""

    REPORT = {
        "candidate_features": [
            {"feature_id": "f1", "feature": "red cover"},
            {"feature_id": "f2", "feature": "mountain illustration"},
            {"feature_id": "f3", "feature": "paperback format"},
        ],
        "recommended_cues": {
            "include": [
                {"feature_id": "f1", "priority": 1, "reason": "conjunction member"},
                {"feature_id": "f2", "priority": 1, "reason": "conjunction member"},
                {"feature_id": "f3", "priority": 4, "reason": "low diagnosticity"},
            ],
            "exclude": [],
        },
    }

    def test_no_report_passes(self) -> None:
        from reminder_agent.stage2.quality_gate import check_cue_priority_compliance
        result = check_cue_priority_compliance("any text", None)
        assert result.passed
        assert "skipped" in result.detail.lower()

    def test_all_high_cues_present(self) -> None:
        from reminder_agent.stage2.quality_gate import check_cue_priority_compliance
        text = "Remember the red book with the mountain illustration on the cover."
        result = check_cue_priority_compliance(text, self.REPORT)
        assert result.passed

    def test_missing_high_cue_fails(self) -> None:
        from reminder_agent.stage2.quality_gate import check_cue_priority_compliance
        text = "Remember the book with the mountain illustration."
        result = check_cue_priority_compliance(text, self.REPORT)
        assert not result.passed
        assert "f1" in result.detail

    def test_empty_include_passes(self) -> None:
        from reminder_agent.stage2.quality_gate import check_cue_priority_compliance
        report = {"recommended_cues": {"include": []}, "candidate_features": []}
        result = check_cue_priority_compliance("any text", report)
        assert result.passed
