"""Quality Gate — automated compliance checks for generated reminder texts.

Implements checks from TECH_DOC v0.4 §4.2 / DEV_PLAN v0.3 S4:
  1. Forbidden keyword leak (AF_low conditions)
  2. Required entity presence
  3. Length constraint (word count)
  4. Duplicate detection (Levenshtein similarity)
  5. Language check (English only)
  6. EC source present (EC_on conditions)
  7. EC source absent (EC_off conditions)
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from langdetect import detect, LangDetectException
from rapidfuzz.distance import Levenshtein

from reminder_agent.stage2.config_loader import GenerationConfig, load_generation_config
from reminder_agent.stage2.prompt_constructor import select_active_high_features

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class CheckResult:
    """Result of a single quality check."""
    check_name: str
    passed: bool
    detail: str = ""


@dataclass
class GateResult:
    """Aggregate result of all per-variant checks."""
    passed: bool
    checks: list[CheckResult] = field(default_factory=list)

    @property
    def failures(self) -> list[CheckResult]:
        return [c for c in self.checks if not c.passed]

    def summary(self) -> str:
        if self.passed:
            return "PASS (all checks)"
        names = [f.check_name for f in self.failures]
        return f"FAIL ({', '.join(names)})"


# ---------------------------------------------------------------------------
# Forbidden keywords loader
# ---------------------------------------------------------------------------

_FORBIDDEN_CACHE: dict | None = None


def load_forbidden_keywords(path: Path | None = None) -> dict[str, dict[str, list[str]]]:
    """Load forbidden_keywords.yaml. Cached after first call."""
    global _FORBIDDEN_CACHE
    if _FORBIDDEN_CACHE is not None and path is None:
        return _FORBIDDEN_CACHE

    if path is None:
        path = Path(__file__).resolve().parent.parent / "config" / "forbidden_keywords.yaml"

    with open(path) as f:
        data = yaml.safe_load(f)

    # Normalise: ensure every task has both keyword lists
    result = {}
    for task_id, entry in data.items():
        result[task_id] = {
            "visual_keywords": [kw.lower() for kw in (entry.get("visual_keywords") or [])],
            "domain_keywords": [kw.lower() for kw in (entry.get("domain_keywords") or [])],
        }

    if path is None or path == Path(__file__).resolve().parent.parent / "config" / "forbidden_keywords.yaml":
        _FORBIDDEN_CACHE = result
    return result


def _clear_forbidden_cache() -> None:
    """Clear the cached forbidden keywords (for testing)."""
    global _FORBIDDEN_CACHE
    _FORBIDDEN_CACHE = None


# ---------------------------------------------------------------------------
# Condition-specific word limits
# ---------------------------------------------------------------------------

CONDITION_MAX_WORDS: dict[str, int] = {
    "AF_low_EC_off": 15,
    "AF_high_EC_off": 22,
    "AF_low_EC_on": 22,
    "AF_high_EC_on": 28,
}


# ---------------------------------------------------------------------------
# Per-task occasion anchors for ec_source_present check
# ---------------------------------------------------------------------------

OCCASION_ANCHORS: dict[str, list[str]] = {
    "book1_mei": ["baking", "baked", "bakery"],
    "ticket_jack": ["film", "movie", "cinema", "watched"],
    "tea_benjamin": ["visited", "visit", "england", "english"],
    "dessert_sophia": ["facetime", "call", "video"],
}


# ---------------------------------------------------------------------------
# Individual checks
# ---------------------------------------------------------------------------

def check_forbidden_keywords(
    text: str,
    task_id: str,
    condition: str,
    forbidden_kw: dict[str, dict[str, list[str]]] | None = None,
) -> CheckResult:
    """Check that Low AF text does not contain forbidden visual/domain keywords.

    For AF_low conditions, checks that visual/domain cues didn't leak into the text.
    For AF_high conditions, this check always passes.
    """
    if "AF_low" not in condition:
        return CheckResult("forbidden_keywords", True, "Not AF_low — skipped")

    if forbidden_kw is None:
        forbidden_kw = load_forbidden_keywords()

    task_kw = forbidden_kw.get(task_id)
    if task_kw is None:
        return CheckResult("forbidden_keywords", True, f"No forbidden keywords for task '{task_id}'")

    text_lower = text.lower()
    leaked = []
    for kw in task_kw.get("visual_keywords", []) + task_kw.get("domain_keywords", []):
        if kw.lower() in text_lower:
            leaked.append(kw)

    if leaked:
        return CheckResult(
            "forbidden_keywords", False,
            f"AF_low leak: forbidden keywords found: {leaked}"
        )
    return CheckResult("forbidden_keywords", True, "No forbidden keyword leaks")


def check_entity_present(text: str, entity_name: str) -> CheckResult:
    """Check that the entity name appears in the generated text.

    Uses case-insensitive matching.
    """
    if not entity_name:
        return CheckResult("entity_present", True, "No entity name to check")

    if entity_name.lower() in text.lower():
        return CheckResult("entity_present", True)
    return CheckResult("entity_present", False, f"Entity '{entity_name}' not found in text")


def check_length(
    text: str,
    min_words: int = 5,
    max_words: int = 45,
    condition: str = "",
) -> CheckResult:
    """Check that word count is within [min_words, max_words].

    When *condition* is provided, overrides max_words with the
    condition-specific limit from CONDITION_MAX_WORDS.
    """
    effective_max = CONDITION_MAX_WORDS.get(condition, max_words) if condition else max_words
    word_count = len(text.split())
    if word_count < min_words:
        return CheckResult("length", False, f"Too short: {word_count} words (min {min_words})")
    if word_count > effective_max:
        return CheckResult("length", False, f"Too long: {word_count} words (max {effective_max})")
    return CheckResult("length", True, f"{word_count} words (max {effective_max})")


def check_duplicate(
    text: str,
    prior_variants: list[str],
    threshold: float = 0.85,
) -> CheckResult:
    """Check that text is not too similar to any prior variant in the same batch.

    Uses normalised Levenshtein similarity (1 - normalised_distance).
    """
    if not prior_variants:
        return CheckResult("duplicate", True, "No prior variants")

    text_lower = text.lower().strip()
    max_sim = 0.0
    most_similar_idx = -1

    for i, prior in enumerate(prior_variants):
        prior_lower = prior.lower().strip()
        dist = Levenshtein.normalized_distance(text_lower, prior_lower)
        sim = 1.0 - dist
        if sim > max_sim:
            max_sim = sim
            most_similar_idx = i

    if max_sim > threshold:
        return CheckResult(
            "duplicate", False,
            f"Too similar to variant {most_similar_idx} (similarity={max_sim:.3f}, threshold={threshold})"
        )
    return CheckResult("duplicate", True, f"Max similarity={max_sim:.3f}")


def check_language(text: str) -> CheckResult:
    """Check that the text is in English using langdetect.

    For short texts (≤10 words), langdetect is unreliable (e.g. "Sophia's"
    detected as Norwegian).  Fall back to ASCII character-set check instead.
    """
    word_count = len(text.split())
    if word_count <= 10:
        # ASCII check: allow letters, digits, common punctuation, smart quotes
        non_ascii = [c for c in text if ord(c) > 127 and c not in "—–''"""]
        if non_ascii:
            return CheckResult("language", False, f"Non-ASCII characters in short text: {non_ascii[:5]}")
        return CheckResult("language", True, f"Short text ({word_count} words) — ASCII check passed")

    try:
        lang = detect(text)
    except LangDetectException:
        return CheckResult("language", False, "Language detection failed")

    if lang == "en":
        return CheckResult("language", True)
    return CheckResult("language", False, f"Detected language: {lang} (expected en)")


def check_hyphen_compression(text: str) -> CheckResult:
    """Check for unnatural hyphenated word compression (e.g. 'Last-week-movie').

    Detects 3+ words joined by hyphens, which indicates the LLM compressed
    phrases to meet length constraints instead of using natural English.
    """
    matches = re.findall(r'\b\w+-\w+-\w+(?:-\w+)*\b', text)
    if matches:
        return CheckResult(
            "hyphen_compression", False,
            f"Hyphen-compressed phrases found: {matches}"
        )
    return CheckResult("hyphen_compression", True, "No hyphen compression")


def check_cue_priority_compliance(
    text: str,
    diagnosticity_report: dict | None = None,
    task_json: dict | None = None,
) -> CheckResult:
    """Check that high-diagnosticity features appear in the text.

    Supports v2 static labels from task_json c_af_candidates (preferred)
    and legacy diagnosticity report format.
    """
    # v2: read static labels from task JSON
    if task_json is not None:
        candidates = (
            task_json
            .get("reminder_context", {})
            .get("element1_af", {})
            .get("c_af_candidates", [])
        )
        high_features = select_active_high_features(task_json)
        if not high_features:
            return CheckResult("cue_priority", True, "No high-diagnosticity features — skipped")

        missing = []
        for feature in high_features:
            key_terms = [t.strip().lower() for t in feature.split() if len(t.strip()) > 3]
            if key_terms and not any(term in text.lower() for term in key_terms):
                missing.append(feature)

        if missing:
            return CheckResult("cue_priority", False, f"Missing high-diagnosticity features: {missing}")
        return CheckResult("cue_priority", True, f"All {len(high_features)} high-diagnosticity features present")

    # Legacy: read from external diagnosticity report
    if diagnosticity_report is None:
        return CheckResult("cue_priority", True, "No diagnosticity report — skipped")

    include = diagnosticity_report.get("recommended_cues", {}).get("include", [])
    if not include:
        return CheckResult("cue_priority", True, "No recommended cues — skipped")

    features_by_id = {
        f["feature_id"]: f.get("feature", "")
        for f in diagnosticity_report.get("candidate_features", [])
    }

    high_priority = [
        cue for cue in include if cue.get("priority", 99) <= 2
    ]

    missing = []
    for cue in high_priority:
        fid = cue.get("feature_id", "?")
        feature_text = features_by_id.get(fid, "").lower()
        # Check if any key term (>3 chars) from the feature appears in the text
        key_terms = [t.strip() for t in feature_text.split() if len(t.strip()) > 3]
        if key_terms and not any(term in text.lower() for term in key_terms):
            missing.append(fid)

    if missing:
        return CheckResult("cue_priority", False, f"Missing high-priority cues: {missing}")
    return CheckResult("cue_priority", True, f"All {len(high_priority)} high-priority cues present")


# ---------------------------------------------------------------------------
# EC source checks
# ---------------------------------------------------------------------------

def check_ec_source_present(
    text: str,
    condition: str,
    task_json: dict,
) -> CheckResult:
    """For EC_on conditions: verify source context appears in the text.

    Two-layer check — BOTH must pass:
      Layer 1 (who): task_creator's name appears in the text.
                     Skipped when creator == recipient (name is AF context).
      Layer 2 (occasion anchor): at least one occasion keyword from
                     OCCASION_ANCHORS appears in the text.

    When creator == recipient, only Layer 2 is required.
    """
    if "EC_on" not in condition:
        return CheckResult("ec_source_present", True, "Not EC_on — skipped")

    rc = task_json.get("reminder_context", {})
    el2 = rc.get("element2_ec", {})
    creator = el2.get("task_creator", "")
    task_id = task_json.get("task_id", "")

    recipient = rc.get("element1_af", {}).get("af_baseline", {}).get("recipient", "")
    creator_is_recipient = (
        creator and creator.strip().lower() == recipient.strip().lower()
    )

    text_lower = text.lower()

    # Layer 1: creator name (skip when creator == recipient)
    who_found = False
    if creator and not creator_is_recipient:
        creator_words = [w.lower() for w in creator.split() if len(w) > 2]
        who_found = any(w in text_lower for w in creator_words)
    else:
        who_found = True  # skip layer — not checkable

    # Layer 2: occasion anchor keywords
    anchors = OCCASION_ANCHORS.get(task_id, [])
    if anchors:
        # Exclude anchors that only appear inside hyphen-compressed compounds
        hyphen_compounds = re.findall(r'\b\w+-\w+-\w+(?:-\w+)*\b', text, re.IGNORECASE)

        def _anchor_valid(anchor: str) -> bool:
            a_low = anchor.lower()
            if a_low not in text_lower:
                return False
            if not hyphen_compounds:
                return True
            # Remove hyphen compounds and check if anchor still present
            cleaned = text_lower
            for hc in hyphen_compounds:
                cleaned = cleaned.replace(hc.lower(), " ")
            return a_low in cleaned

        occasion_found = any(_anchor_valid(a) for a in anchors)
    else:
        occasion_found = True

    if not who_found and not occasion_found:
        return CheckResult(
            "ec_source_present", False,
            f"EC_on but neither creator '{creator}' nor occasion anchors {anchors} found."
        )
    if not who_found:
        return CheckResult(
            "ec_source_present", False,
            f"EC_on but creator '{creator}' not found (occasion anchor present)."
        )
    if not occasion_found:
        return CheckResult(
            "ec_source_present", False,
            f"EC_on but no occasion anchor found. Expected one of {anchors}."
        )
    return CheckResult("ec_source_present", True, "Creator and occasion anchor present")


def check_ec_source_absent(
    text: str,
    condition: str,
    task_json: dict,
) -> CheckResult:
    """For EC_off conditions: verify source context did NOT leak into text.

    Checks both creator name and ec_cue keywords for leaks.
    Note: if the task creator's name is the same as af_baseline.recipient the
    name is legitimately present in AF context and must not be treated as an
    EC leak.  Only flag the name when it is exclusive to element2_ec.
    """
    if "EC_off" not in condition:
        return CheckResult("ec_source_absent", True, "Not EC_off — skipped")

    rc = task_json.get("reminder_context", {})
    el2 = rc.get("element2_ec", {})
    creator = el2.get("task_creator", "")
    ec_cue = el2.get("ec_cue", "")

    # If creator == recipient the name belongs to AF context too — not an EC leak
    recipient = rc.get("element1_af", {}).get("af_baseline", {}).get("recipient", "")
    entity_name = (
        rc.get("element1_af", {})
        .get("af_high", {})
        .get("target_entity", {})
        .get("entity_name", "")
    )
    creator_is_recipient = (
        creator and creator.strip().lower() == recipient.strip().lower()
    )

    text_lower = text.lower()

    # Check creator name (skip when creator == recipient)
    if creator and not creator_is_recipient and creator.lower() != "self":
        creator_words = [w.lower() for w in creator.split() if len(w) > 2]
        for w in creator_words:
            if w in text_lower:
                return CheckResult(
                    "ec_source_absent", False,
                    f"EC_off but creator word '{w}' found in text — source context leak"
                )

    # Check ec_cue keywords
    if ec_cue:
        creator_lower = creator.lower() if creator else ""
        entity_lower = entity_name.lower() if entity_name else ""
        cleaned = re.findall(r"[a-zA-Z]+", ec_cue)
        cue_words = [
            w.lower()
            for w in cleaned
            if len(w) > 4
            and w.lower() != creator_lower
            and not (
                entity_lower
                and (w.lower() in entity_lower or entity_lower in w.lower())
            )
        ]
        for w in cue_words:
            if w in text_lower:
                return CheckResult(
                    "ec_source_absent", False,
                    f"EC_off but ec_cue keyword '{w}' found in text — source context leak"
                )

    return CheckResult("ec_source_absent", True)


# ---------------------------------------------------------------------------
# Main gate functions
# ---------------------------------------------------------------------------

def check(
    text: str,
    condition: str,
    task_id: str,
    entity_name: str,
    prior_variants: list[str] | None = None,
    gen_config: GenerationConfig | None = None,
    forbidden_kw: dict[str, dict[str, list[str]]] | None = None,
    task_json: dict | None = None,
) -> GateResult:
    """Run all per-variant quality checks.

    Args:
        text: The generated reminder text.
        condition: e.g. "AF_low_EC_off".
        task_id: e.g. "book1_mei".
        entity_name: The entity name that must appear in the text.
        prior_variants: Previously accepted variants in this batch.
        gen_config: Generation config (for thresholds). Loaded if None.
        forbidden_kw: Forbidden keywords dict. Loaded if None.
        task_json: Full task JSON for EC checks.

    Returns:
        GateResult with pass/fail and details of each check.
    """
    if gen_config is None:
        gen_config = load_generation_config()
    if prior_variants is None:
        prior_variants = []

    results: list[CheckResult] = []

    results.append(check_forbidden_keywords(text, task_id, condition, forbidden_kw))
    results.append(check_entity_present(text, entity_name))
    results.append(check_length(text, gen_config.min_words, gen_config.max_words, condition))
    results.append(check_duplicate(text, prior_variants, gen_config.similarity_threshold))
    results.append(check_language(text))
    results.append(check_hyphen_compression(text))

    if task_json is not None:
        results.append(check_ec_source_present(text, condition, task_json))
        results.append(check_ec_source_absent(text, condition, task_json))

    all_passed = all(r.passed for r in results)
    return GateResult(passed=all_passed, checks=results)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    # Demo: check a good and a bad text for book1_mei
    good_af = "Remember to give Mei the book — the red one with a mountain illustration, on the second shelf in the study."
    bad_af = "Remember to give Mei the book."

    print("=== Quality Gate Demo (book1_mei, AF_high_EC_off) ===\n")

    for label, text in [("Good (AF_high)", good_af), ("Bad (missing details)", bad_af)]:
        result = check(
            text=text,
            condition="AF_high_EC_off",
            task_id="book1_mei",
            entity_name="book",
        )
        print(f"{label}: {text!r}")
        print(f"  → {result.summary()}")
        for c in result.checks:
            status = "✓" if c.passed else "✗"
            print(f"    {status} {c.check_name}: {c.detail}")
        print()
