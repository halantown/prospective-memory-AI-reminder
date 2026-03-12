"""Tests for stage2/quality_gate.py — Sprint 4.

Covers all 6 quality checks:
  1. Forbidden keyword leak (Low AF)
  2. Required entity presence
  3. Length constraint
  4. Duplicate detection (Levenshtein)
  5. Language check
  6. CB activity consistency (batch-level)
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
    check_duplicate,
    check_entity_present,
    check_forbidden_keywords,
    check_language,
    check_length,
    _extract_activity_sentence,
)


# ===================================================================
# 1. Forbidden keyword leak
# ===================================================================

class TestForbiddenKeywords:
    """Test forbidden keyword leak check (Low AF only)."""

    FORBIDDEN_KW = {
        "medicine_a": {
            "visual_keywords": ["red", "round", "white label", "bottle"],
            "domain_keywords": ["100mg", "tablet", "100 mg"],
        },
    }

    def test_low_af_clean_text_passes(self) -> None:
        result = check_forbidden_keywords(
            "Remember to take your Doxycycline after dinner.",
            "medicine_a", "LowAF_LowCB", self.FORBIDDEN_KW,
        )
        assert result.passed

    def test_low_af_visual_keyword_fails(self) -> None:
        result = check_forbidden_keywords(
            "Remember to take the red Doxycycline.",
            "medicine_a", "LowAF_LowCB", self.FORBIDDEN_KW,
        )
        assert not result.passed
        assert "red" in result.detail

    def test_low_af_domain_keyword_fails(self) -> None:
        result = check_forbidden_keywords(
            "Remember to take your Doxycycline tablet.",
            "medicine_a", "LowAF_LowCB", self.FORBIDDEN_KW,
        )
        assert not result.passed
        assert "tablet" in result.detail

    def test_low_af_multiple_keywords_reports_all(self) -> None:
        result = check_forbidden_keywords(
            "Take the red round 100mg Doxycycline tablet from the bottle.",
            "medicine_a", "LowAF_LowCB", self.FORBIDDEN_KW,
        )
        assert not result.passed
        # Should find multiple leaked keywords
        assert "red" in result.detail
        assert "round" in result.detail

    def test_low_af_case_insensitive(self) -> None:
        result = check_forbidden_keywords(
            "Remember to take the RED ROUND Doxycycline.",
            "medicine_a", "LowAF_LowCB", self.FORBIDDEN_KW,
        )
        assert not result.passed

    def test_high_af_always_passes(self) -> None:
        result = check_forbidden_keywords(
            "Take the red round 100mg tablet from the bottle.",
            "medicine_a", "HighAF_LowCB", self.FORBIDDEN_KW,
        )
        assert result.passed
        assert "skipped" in result.detail.lower()

    def test_high_af_high_cb_always_passes(self) -> None:
        result = check_forbidden_keywords(
            "Take the red round tablet.",
            "medicine_a", "HighAF_HighCB", self.FORBIDDEN_KW,
        )
        assert result.passed

    def test_low_af_high_cb_still_checked(self) -> None:
        """LowAF_HighCB is still a Low AF condition — keywords should be checked."""
        result = check_forbidden_keywords(
            "I see you're done eating. Take the red Doxycycline.",
            "medicine_a", "LowAF_HighCB", self.FORBIDDEN_KW,
        )
        assert not result.passed

    def test_unknown_task_id_passes_with_warning(self) -> None:
        result = check_forbidden_keywords(
            "Take the red pill.",
            "unknown_task", "LowAF_LowCB", self.FORBIDDEN_KW,
        )
        assert result.passed
        assert "No keywords defined" in result.detail

    def test_multi_word_keyword(self) -> None:
        result = check_forbidden_keywords(
            "Look for the bottle with the white label.",
            "medicine_a", "LowAF_LowCB", self.FORBIDDEN_KW,
        )
        assert not result.passed
        assert "white label" in result.detail


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
        # 8 words
        result = check_length(
            "Remember to take your Doxycycline after dinner today.", 5, 35
        )
        assert result.passed

    def test_too_short(self) -> None:
        # 3 words
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
        # Just check it returns a valid CheckResult
        assert isinstance(result, CheckResult)


# ===================================================================
# 6. CB activity consistency
# ===================================================================

class TestCBConsistency:
    """Test CB activity consistency (batch-level)."""

    def test_low_cb_always_passes(self) -> None:
        result = check_cb_consistency(
            ["Some text.", "Other text."], "LowAF_LowCB"
        )
        assert result.passed
        assert "skipped" in result.detail.lower()

    def test_high_cb_consistent_variants(self) -> None:
        variants = [
            "I can see you're finishing dinner. Remember to take your Doxycycline.",
            "I can see you're finishing dinner. Don't forget your Doxycycline.",
            "Since you're finishing dinner, remember to take your Doxycycline.",
        ]
        result = check_cb_consistency(variants, "HighAF_HighCB")
        assert result.passed

    def test_high_cb_inconsistent_variants(self) -> None:
        variants = [
            "I can see you're finishing dinner. Remember to take your Doxycycline.",
            "I can see you're watching television in the living room. Don't forget your Doxycycline.",
        ]
        result = check_cb_consistency(variants, "LowAF_HighCB", similarity_threshold=0.60)
        assert not result.passed
        assert "divergence" in result.detail.lower()

    def test_high_cb_missing_activity_reference(self) -> None:
        variants = [
            "I can see you're finishing dinner. Remember your Doxycycline.",
            "Remember to take your Doxycycline.",  # no CB reference
        ]
        result = check_cb_consistency(variants, "HighAF_HighCB")
        assert not result.passed
        assert "no detectable cb activity" in result.detail.lower()

    def test_single_variant_passes(self) -> None:
        result = check_cb_consistency(
            ["I can see you're eating. Remember your medicine."],
            "HighAF_HighCB",
        )
        assert result.passed
        assert "fewer than 2" in result.detail.lower()

    def test_high_af_low_cb_skipped(self) -> None:
        result = check_cb_consistency(
            ["Some text.", "Other text."], "HighAF_LowCB"
        )
        assert result.passed


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

    def test_valid_low_af_passes(self) -> None:
        result = check(
            text="Remember to take your Doxycycline after dinner tonight.",
            condition="LowAF_LowCB",
            task_id="medicine_a",
            entity_name="Doxycycline",
            forbidden_kw=self.FORBIDDEN_KW,
        )
        assert result.passed
        assert len(result.failures) == 0

    def test_valid_high_af_passes(self) -> None:
        result = check(
            text="Remember to take the red round Doxycycline 100mg tablet from the bottle.",
            condition="HighAF_LowCB",
            task_id="medicine_a",
            entity_name="Doxycycline",
            forbidden_kw=self.FORBIDDEN_KW,
        )
        assert result.passed

    def test_leaked_keyword_fails_aggregate(self) -> None:
        result = check(
            text="Remember to take the red Doxycycline from the bottle.",
            condition="LowAF_LowCB",
            task_id="medicine_a",
            entity_name="Doxycycline",
            forbidden_kw=self.FORBIDDEN_KW,
        )
        assert not result.passed
        failed_names = [f.check_name for f in result.failures]
        assert "forbidden_keywords" in failed_names

    def test_missing_entity_fails_aggregate(self) -> None:
        result = check(
            text="Remember to take your medicine after dinner tonight.",
            condition="LowAF_LowCB",
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
            condition="LowAF_LowCB",
            task_id="medicine_a",
            entity_name="Doxycycline",
            forbidden_kw=self.FORBIDDEN_KW,
        )
        assert not result.passed
        failed_names = [f.check_name for f in result.failures]
        assert "length" in failed_names

    def test_duplicate_fails_aggregate(self) -> None:
        prior = ["Remember to take your Doxycycline after dinner tonight."]
        result = check(
            text="Remember to take your Doxycycline after dinner tonight.",
            condition="LowAF_LowCB",
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
            text="Remember to take your Doxycycline after dinner tonight.",
            condition="LowAF_LowCB",
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

    def test_batch_low_cb_passes(self) -> None:
        result = check_batch(
            ["text1", "text2"], "LowAF_LowCB"
        )
        assert result.passed

    def test_batch_high_cb_consistent(self) -> None:
        variants = [
            "I can see you're finishing dinner. Remember to take your Doxycycline.",
            "I can see you're finishing dinner. Don't forget your Doxycycline.",
        ]
        result = check_batch(variants, "HighAF_HighCB")
        assert result.passed

    def test_batch_high_cb_inconsistent(self) -> None:
        variants = [
            "I can see you're finishing dinner. Remember your Doxycycline.",
            "I can see you're playing video games. Remember your Doxycycline.",
        ]
        result = check_batch(variants, "LowAF_HighCB", cb_similarity_threshold=0.60)
        assert not result.passed
