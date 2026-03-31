"""Tests for stage2/quality_gate.py — Sprint 4.

Covers all 6 quality checks (updated for 3-group design):
  1. Forbidden keyword leak (always passes — no Low AF conditions)
  2. Required entity presence
  3. Length constraint
  4. Duplicate detection (Levenshtein)
  5. Language check
  6. CB activity consistency (batch-level, AF_CB only)
Plus the aggregate `check()` and `check_batch()` functions.
"""

from __future__ import annotations

import pytest

from reminder_agent.stage2.quality_gate import (
    CheckResult,
    GateResult,
    check,
    check_batch,
    check_cb_consistency,
    check_cue_priority_compliance,
    check_duplicate,
    check_entity_present,
    check_forbidden_keywords,
    check_language,
    check_length,
    _extract_activity_sentence,
)


# ===================================================================
# 1. Forbidden keyword leak (now always passes — no Low AF conditions)
# ===================================================================

class TestForbiddenKeywords:
    """Test forbidden keyword leak check.

    In the 3-group design all conditions are High AF, so this check always passes.
    """

    FORBIDDEN_KW = {
        "medicine_a": {
            "visual_keywords": ["red", "round", "white label", "bottle"],
            "domain_keywords": ["100mg", "tablet", "100 mg"],
        },
    }

    def test_af_only_always_passes(self) -> None:
        result = check_forbidden_keywords(
            "Remember to take the red round Doxycycline tablet.",
            "medicine_a", "AF_only", self.FORBIDDEN_KW,
        )
        assert result.passed
        assert "skipped" in result.detail.lower()

    def test_af_cb_always_passes(self) -> None:
        result = check_forbidden_keywords(
            "I see you're done eating. Take the red Doxycycline tablet.",
            "medicine_a", "AF_CB", self.FORBIDDEN_KW,
        )
        assert result.passed
        assert "skipped" in result.detail.lower()

    def test_skipped_detail_message(self) -> None:
        result = check_forbidden_keywords(
            "Take the red round 100mg tablet from the bottle.",
            "medicine_a", "AF_only", self.FORBIDDEN_KW,
        )
        assert "No Low AF" in result.detail


# ===================================================================
# 2. Entity presence
# ===================================================================

class TestEntityPresent:
    """Test required entity presence check."""

    def test_entity_found(self) -> None:
        result = check_entity_present(
            "Remember to take your Doxycycline.", "Doxycycline"
        )
        assert result.passed

    def test_entity_missing(self) -> None:
        result = check_entity_present(
            "Remember to take your medicine.", "Doxycycline"
        )
        assert not result.passed
        assert "Doxycycline" in result.detail

    def test_entity_case_insensitive(self) -> None:
        result = check_entity_present(
            "remember to take your doxycycline.", "Doxycycline"
        )
        assert result.passed

    def test_empty_entity_passes(self) -> None:
        result = check_entity_present(
            "Remember to take your medicine.", ""
        )
        assert result.passed


# ===================================================================
# 3. Length constraint
# ===================================================================

class TestLength:
    """Test word count constraint check."""

    def test_within_range(self) -> None:
        result = check_length(
            "Remember to take your Doxycycline after dinner today.", 5, 35
        )
        assert result.passed

    def test_too_short(self) -> None:
        result = check_length("Take your medicine.", 5, 35)
        assert not result.passed
        assert "Too short" in result.detail

    def test_too_long(self) -> None:
        long_text = " ".join(["word"] * 40)
        result = check_length(long_text, 5, 35)
        assert not result.passed
        assert "Too long" in result.detail

    def test_exact_min(self) -> None:
        result = check_length("one two three four five", 5, 35)
        assert result.passed

    def test_exact_max(self) -> None:
        text = " ".join(["word"] * 35)
        result = check_length(text, 5, 35)
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
            "Remember to take your Doxycycline.",
            ["Remember to take your Doxycycline."],
            0.85,
        )
        assert not result.passed

    def test_very_similar_fails(self) -> None:
        result = check_duplicate(
            "Remember to take your Doxycycline today.",
            ["Remember to take your Doxycycline now."],
            0.85,
        )
        assert not result.passed

    def test_different_text_passes(self) -> None:
        result = check_duplicate(
            "Don't forget your Doxycycline after dinner.",
            ["By the way, remember to take the red round medicine bottle."],
            0.85,
        )
        assert result.passed

    def test_case_insensitive(self) -> None:
        result = check_duplicate(
            "REMEMBER TO TAKE YOUR DOXYCYCLINE.",
            ["remember to take your doxycycline."],
            0.85,
        )
        assert not result.passed

    def test_multiple_prior_checks_all(self) -> None:
        """Should fail if similar to ANY prior variant."""
        result = check_duplicate(
            "Remember to take your Doxycycline.",
            [
                "A completely different sentence about something else entirely.",
                "Remember to take your Doxycycline.",  # duplicate
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
            "Remember to take your Doxycycline after dinner tonight."
        )
        assert result.passed

    def test_non_english_fails(self) -> None:
        result = check_language(
            "N'oubliez pas de prendre votre médicament après le dîner."
        )
        assert not result.passed
        assert "fr" in result.detail

    def test_very_short_text(self) -> None:
        # langdetect can be unreliable on very short text; we accept either outcome
        result = check_language("Hi")
        assert isinstance(result, CheckResult)


# ===================================================================
# 6. CB activity consistency (AF_CB only)
# ===================================================================

class TestCBConsistency:
    """Test CB activity consistency (batch-level, AF_CB only)."""

    def test_af_only_always_passes(self) -> None:
        result = check_cb_consistency(
            ["Some text.", "Other text."], "AF_only"
        )
        assert result.passed
        assert "skipped" in result.detail.lower()

    def test_af_cb_consistent_variants(self) -> None:
        variants = [
            "I can see you're finishing dinner. Remember to take your Doxycycline.",
            "I can see you're finishing dinner. Don't forget your Doxycycline.",
            "Since you're finishing dinner, remember to take your Doxycycline.",
        ]
        result = check_cb_consistency(variants, "AF_CB")
        assert result.passed

    def test_af_cb_inconsistent_variants(self) -> None:
        variants = [
            "I can see you're finishing dinner. Remember to take your Doxycycline.",
            "I can see you're watching television in the living room. Don't forget your Doxycycline.",
        ]
        result = check_cb_consistency(variants, "AF_CB", similarity_threshold=0.60)
        assert not result.passed
        assert "divergence" in result.detail.lower()

    def test_af_cb_missing_activity_reference(self) -> None:
        variants = [
            "I can see you're finishing dinner. Remember your Doxycycline.",
            "Remember to take your Doxycycline.",  # no CB reference
        ]
        result = check_cb_consistency(variants, "AF_CB")
        assert not result.passed
        assert "no detectable cb activity" in result.detail.lower()

    def test_single_variant_passes(self) -> None:
        result = check_cb_consistency(
            ["I can see you're eating. Remember your medicine."],
            "AF_CB",
        )
        assert result.passed
        assert "fewer than 2" in result.detail.lower()


# ===================================================================
# 6b. Activity sentence extraction helper
# ===================================================================

class TestExtractActivitySentence:
    """Test the _extract_activity_sentence helper."""

    def test_i_can_see(self) -> None:
        text = "I can see you're finishing dinner. Remember your medicine."
        result = _extract_activity_sentence(text)
        assert result is not None
        assert "dinner" in result

    def test_i_notice(self) -> None:
        text = "I notice you're relaxing. Don't forget your Doxycycline."
        result = _extract_activity_sentence(text)
        assert result is not None
        assert "relaxing" in result

    def test_since_you(self) -> None:
        text = "Since you've finished eating, remember to take your medicine."
        result = _extract_activity_sentence(text)
        assert result is not None
        assert "eating" in result

    def test_while_you(self) -> None:
        text = "While you're watching TV, remember your Doxycycline."
        result = _extract_activity_sentence(text)
        assert result is not None

    def test_no_activity_reference(self) -> None:
        text = "Remember to take your Doxycycline after dinner."
        result = _extract_activity_sentence(text)
        assert result is None

    def test_it_looks_like(self) -> None:
        text = "It looks like you're done with dinner. Remember your Doxycycline."
        result = _extract_activity_sentence(text)
        assert result is not None
        assert "dinner" in result


# ===================================================================
# 7. Aggregate check() function
# ===================================================================

class TestAggregateCheck:
    """Test the main check() function that runs all per-variant checks."""

    FORBIDDEN_KW = {
        "medicine_a": {
            "visual_keywords": ["red", "round", "white label", "bottle"],
            "domain_keywords": ["100mg", "tablet", "100 mg"],
        },
    }

    def test_valid_af_only_passes(self) -> None:
        result = check(
            text="Remember to take the red round Doxycycline 100mg tablet from the bottle.",
            condition="AF_only",
            task_id="medicine_a",
            entity_name="Doxycycline",
            forbidden_kw=self.FORBIDDEN_KW,
        )
        assert result.passed
        assert len(result.failures) == 0

    def test_valid_af_cb_passes(self) -> None:
        result = check(
            text="I see you just finished dinner. Remember to take the red round Doxycycline tablet from the bottle.",
            condition="AF_CB",
            task_id="medicine_a",
            entity_name="Doxycycline",
            forbidden_kw=self.FORBIDDEN_KW,
        )
        assert result.passed

    def test_missing_entity_fails_aggregate(self) -> None:
        result = check(
            text="Remember to take your medicine after dinner tonight from the red bottle.",
            condition="AF_only",
            task_id="medicine_a",
            entity_name="Doxycycline",
            forbidden_kw=self.FORBIDDEN_KW,
        )
        assert not result.passed
        failed_names = [f.check_name for f in result.failures]
        assert "entity_present" in failed_names

    def test_too_short_fails_aggregate(self) -> None:
        result = check(
            text="Take Doxycycline.",
            condition="AF_only",
            task_id="medicine_a",
            entity_name="Doxycycline",
            forbidden_kw=self.FORBIDDEN_KW,
        )
        assert not result.passed
        failed_names = [f.check_name for f in result.failures]
        assert "length" in failed_names

    def test_duplicate_fails_aggregate(self) -> None:
        prior = ["Remember to take the red round Doxycycline 100mg tablet from the bottle."]
        result = check(
            text="Remember to take the red round Doxycycline 100mg tablet from the bottle.",
            condition="AF_only",
            task_id="medicine_a",
            entity_name="Doxycycline",
            prior_variants=prior,
            forbidden_kw=self.FORBIDDEN_KW,
        )
        assert not result.passed
        failed_names = [f.check_name for f in result.failures]
        assert "duplicate" in failed_names

    def test_gate_result_summary(self) -> None:
        result = check(
            text="Remember to take the red round Doxycycline 100mg tablet from the bottle.",
            condition="AF_only",
            task_id="medicine_a",
            entity_name="Doxycycline",
            forbidden_kw=self.FORBIDDEN_KW,
        )
        assert "PASS" in result.summary()


# ===================================================================
# 8. check_batch() function
# ===================================================================

class TestCheckBatch:
    """Test the batch-level check_batch() function."""

    def test_batch_af_only_passes(self) -> None:
        result = check_batch(
            ["text1", "text2"], "AF_only"
        )
        assert result.passed

    def test_batch_af_cb_consistent(self) -> None:
        variants = [
            "I can see you're finishing dinner. Remember to take your Doxycycline.",
            "I can see you're finishing dinner. Don't forget your Doxycycline.",
        ]
        result = check_batch(variants, "AF_CB")
        assert result.passed

    def test_batch_af_cb_inconsistent(self) -> None:
        variants = [
            "I can see you're finishing dinner. Remember your Doxycycline.",
            "I can see you're playing video games. Remember your Doxycycline.",
        ]
        result = check_batch(variants, "AF_CB", cb_similarity_threshold=0.60)
        assert not result.passed


# ===================================================================
# 9. Cue priority compliance
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
        result = check_cue_priority_compliance("any text", None)
        assert result.passed
        assert "skipped" in result.detail.lower()

    def test_all_high_cues_present(self) -> None:
        text = "Remember the red book with the mountain illustration on the cover."
        result = check_cue_priority_compliance(text, self.REPORT)
        assert result.passed

    def test_missing_high_cue_fails(self) -> None:
        # "red cover" → key_terms=["cover"] → "cover" not in text → f1 missing
        text = "Remember the book with the mountain illustration."
        result = check_cue_priority_compliance(text, self.REPORT)
        assert not result.passed
        assert "f1" in result.detail

    def test_truly_missing_cue_fails(self) -> None:
        text = "Remember to get the paperback from the shelf."
        result = check_cue_priority_compliance(text, self.REPORT)
        assert not result.passed
        assert "f1" in result.detail or "f2" in result.detail

    def test_empty_include_passes(self) -> None:
        report = {"recommended_cues": {"include": []}, "candidate_features": []}
        result = check_cue_priority_compliance("any text", report)
        assert result.passed
