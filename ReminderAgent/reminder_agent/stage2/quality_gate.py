"""Quality Gate — automated compliance checks for generated reminder texts.

v3 EC operationalization checks (EC_Operationalization_Dev_Doc.md §5):
  1. Baseline present (action + target + recipient)
  2. EC features present (EC_on: entity + causality paraphrased)
  3. No extra dimensions (EC_on: no time/space/intentionality leak)
  4. No fabrication (EC_on: no details absent from episode_dimensions)
  5. Length constraint (per-condition word limits)
  6. Duplicate detection (Levenshtein similarity)
  7. Language check (English only)
  8. Hyphen compression check
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any

from langdetect import detect, LangDetectException
from rapidfuzz.distance import Levenshtein

from reminder_agent.stage2.config_loader import GenerationConfig, load_generation_config

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
# Condition-specific word limits (v3)
# ---------------------------------------------------------------------------

CONDITION_MAX_WORDS: dict[str, int] = {
    "EC_off": 12,
    "EC_on": 25,
}


# ---------------------------------------------------------------------------
# Generic checks (shared across v2/v3)
# ---------------------------------------------------------------------------

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

    For short texts (≤10 words), langdetect is unreliable — fall back to ASCII check.
    """
    word_count = len(text.split())
    if word_count <= 10:
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

    Detects 3+ words joined by hyphens.
    """
    matches = re.findall(r'\b\w+-\w+-\w+(?:-\w+)*\b', text)
    if matches:
        return CheckResult(
            "hyphen_compression", False,
            f"Hyphen-compressed phrases found: {matches}"
        )
    return CheckResult("hyphen_compression", True, "No hyphen compression")


# ---------------------------------------------------------------------------
# v3 EC-specific checks
# ---------------------------------------------------------------------------

def check_baseline_present(text: str, baseline: dict) -> CheckResult:
    """Verify that action + target + recipient from baseline appear in text.

    Uses flexible matching: checks key content words (>2 chars) from each
    baseline field against the generated text.
    """
    text_lower = text.lower()
    missing = []

    for field_name in ("action_verb", "target", "recipient"):
        value = baseline.get(field_name, "")
        if not value:
            continue
        # Extract content words (>2 chars) from the field value
        words = [w.lower() for w in re.findall(r"[a-zA-Z]+", value) if len(w) > 2]
        if words and not any(w in text_lower for w in words):
            missing.append(f"{field_name}={value!r}")

    if missing:
        return CheckResult(
            "baseline_present", False,
            f"Baseline elements missing: {', '.join(missing)}"
        )
    return CheckResult("baseline_present", True, "All baseline elements present")


def check_ec_features_present(
    text: str,
    condition: str,
    ec_selected_features: dict,
) -> CheckResult:
    """For EC_on: verify entity and causality features are paraphrased in text.

    Checks that at least one entity keyword AND at least one causality keyword
    appear in the text. Uses flexible word matching to allow paraphrasing.
    """
    if condition != "EC_on":
        return CheckResult("ec_features_present", True, "Not EC_on — skipped")

    text_lower = text.lower()
    entity_features = ec_selected_features.get("entity", [])
    causality_feature = ec_selected_features.get("causality", "")

    # Entity check: at least one entity name (>2 chars) must appear
    entity_found = False
    if entity_features:
        entity_list = entity_features if isinstance(entity_features, list) else [entity_features]
        for entity in entity_list:
            words = [w.lower() for w in re.findall(r"[a-zA-Z]+", entity) if len(w) > 2]
            if any(w in text_lower for w in words):
                entity_found = True
                break
    else:
        entity_found = True  # no entity features to check

    # Causality check: at least one content word from causality appears
    causality_found = False
    if causality_feature:
        words = [w.lower() for w in re.findall(r"[a-zA-Z]+", causality_feature) if len(w) > 3]
        causality_found = any(w in text_lower for w in words)
    else:
        causality_found = True  # no causality to check

    if not entity_found and not causality_found:
        return CheckResult(
            "ec_features_present", False,
            "Neither entity nor causality features found in text"
        )
    if not entity_found:
        return CheckResult(
            "ec_features_present", False,
            f"Entity features not found. Expected one of: {entity_features}"
        )
    if not causality_found:
        return CheckResult(
            "ec_features_present", False,
            f"Causality not paraphrased. Source: {causality_feature!r}"
        )
    return CheckResult("ec_features_present", True, "Entity and causality features present")


def check_no_extra_dimensions(
    text: str,
    condition: str,
    episode_dimensions: dict,
    ec_selected_features: dict,
) -> CheckResult:
    """For EC_on: verify text doesn't introduce unselected dimension details.

    The selected dimensions (from ec_selected_features) are entity + causality.
    The unselected dimensions are time, space, intentionality. If keywords from
    these unselected dimensions appear in text, it's a leak.
    """
    if condition != "EC_on":
        return CheckResult("no_extra_dimensions", True, "Not EC_on — skipped")

    text_lower = text.lower()
    selected_keys = set(ec_selected_features.keys())
    leaked = []

    for dim_name, dim_value in episode_dimensions.items():
        if dim_name in selected_keys:
            continue  # this dimension is allowed

        if not dim_value:
            continue

        # Extract content words from the dimension value
        if isinstance(dim_value, str):
            words = [w.lower() for w in re.findall(r"[a-zA-Z]+", dim_value) if len(w) > 3]
        elif isinstance(dim_value, list):
            words = []
            for item in dim_value:
                if isinstance(item, str):
                    words.extend(w.lower() for w in re.findall(r"[a-zA-Z]+", item) if len(w) > 3)
        else:
            continue

        # Filter out words that also appear in selected features (overlap is OK)
        selected_words = set()
        for feat_val in ec_selected_features.values():
            if isinstance(feat_val, str):
                selected_words.update(w.lower() for w in re.findall(r"[a-zA-Z]+", feat_val))
            elif isinstance(feat_val, list):
                for item in feat_val:
                    if isinstance(item, str):
                        selected_words.update(w.lower() for w in re.findall(r"[a-zA-Z]+", item))

        for w in words:
            if w in text_lower and w not in selected_words:
                leaked.append(f"{dim_name}:'{w}'")

    if leaked:
        return CheckResult(
            "no_extra_dimensions", False,
            f"Unselected dimension details found: {', '.join(leaked)}"
        )
    return CheckResult("no_extra_dimensions", True, "No unselected dimension leaks")


def check_no_fabrication(
    text: str,
    condition: str,
    baseline: dict,
    episode_dimensions: dict,
    ec_selected_features: dict,
) -> CheckResult:
    """For EC_on: basic fabrication check — verify named entities in text come from task data.

    Extracts capitalized words (likely proper nouns / named entities) from the
    generated text and checks each one appears somewhere in the task data.
    This catches the LLM inventing names, places, or objects.
    """
    if condition != "EC_on":
        return CheckResult("no_fabrication", True, "Not EC_on — skipped")

    # Build a set of all known words from task data
    known_words: set[str] = set()

    def _add_words(val: Any) -> None:
        if isinstance(val, str):
            known_words.update(w.lower() for w in re.findall(r"[a-zA-Z]+", val))
        elif isinstance(val, list):
            for item in val:
                _add_words(item)
        elif isinstance(val, dict):
            for v in val.values():
                _add_words(v)

    _add_words(baseline)
    _add_words(episode_dimensions)
    _add_words(ec_selected_features)

    # Common English words that aren't fabrication even if not in task data
    common_words = {
        "remember", "forget", "give", "bring", "take", "make", "prepare",
        "the", "and", "for", "with", "from", "about", "that", "this",
        "your", "you", "her", "him", "his", "she", "mentioned", "asked",
        "said", "told", "wanted", "liked", "loved", "enjoyed", "bought",
        "way", "don", "when", "last", "next", "time", "week", "month",
        "visit", "back", "some", "one", "two", "been", "has", "had",
        "was", "were", "will", "would", "could", "should",
    }

    # Extract capitalized words from text (potential proper nouns)
    # Skip first word of sentences (capitalized by grammar, not semantics)
    sentences = re.split(r'[.!?]\s+', text)
    fabricated = []
    for sent in sentences:
        words = sent.split()
        for w in words[1:]:  # skip sentence-initial word
            clean = re.sub(r"[^a-zA-Z]", "", w)
            if clean and clean[0].isupper() and len(clean) > 2:
                if clean.lower() not in known_words and clean.lower() not in common_words:
                    fabricated.append(clean)

    if fabricated:
        return CheckResult(
            "no_fabrication", False,
            f"Possibly fabricated entities: {fabricated}"
        )
    return CheckResult("no_fabrication", True, "No fabricated entities detected")


# ---------------------------------------------------------------------------
# Main gate function (v3)
# ---------------------------------------------------------------------------

def check(
    text: str,
    condition: str,
    task_id: str,
    entity_name: str,
    prior_variants: list[str] | None = None,
    gen_config: GenerationConfig | None = None,
    task_json: dict | None = None,
    **kwargs: Any,
) -> GateResult:
    """Run all quality checks for a generated reminder variant (v3).

    Args:
        text: The generated reminder text.
        condition: "EC_off" or "EC_on".
        task_id: e.g. "book1_mei".
        entity_name: The entity/target name that must appear in the text.
        prior_variants: Previously accepted variants in this batch.
        gen_config: Generation config (for thresholds). Loaded if None.
        task_json: Full task JSON for EC checks.

    Returns:
        GateResult with pass/fail and details of each check.
    """
    if gen_config is None:
        gen_config = load_generation_config()
    if prior_variants is None:
        prior_variants = []

    # Read per-condition word limits from config
    word_limits = gen_config.get_word_limits(condition)
    if word_limits:
        min_w, max_w = word_limits
    else:
        min_w, max_w = gen_config.min_words, gen_config.max_words

    results: list[CheckResult] = []

    # --- Universal checks ---
    results.append(check_length(text, min_w, max_w, condition))
    results.append(check_duplicate(text, prior_variants, gen_config.similarity_threshold))
    results.append(check_language(text))
    results.append(check_hyphen_compression(text))

    # --- v3 EC checks (require task_json) ---
    rc = (task_json or {}).get("reminder_context", {})
    baseline = rc.get("baseline", {})
    episode_dims = rc.get("episode_dimensions", {})
    ec_features = rc.get("ec_selected_features", {})

    results.append(check_baseline_present(text, baseline))

    if condition == "EC_on":
        results.append(check_ec_features_present(text, condition, ec_features))
        results.append(check_no_extra_dimensions(text, condition, episode_dims, ec_features))
        results.append(check_no_fabrication(text, condition, baseline, episode_dims, ec_features))

    all_passed = all(r.passed for r in results)
    return GateResult(passed=all_passed, checks=results)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json
    from pathlib import Path

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    data_dir = Path(__file__).resolve().parent.parent / "data" / "task_schemas"
    task_path = data_dir / "book1_mei.json"

    with open(task_path) as f:
        task_json = json.load(f)

    print("=== Quality Gate Demo (v3 — book1_mei) ===\n")

    samples = {
        "EC_off good": (
            "EC_off",
            "Remember to give Mei the baking book.",
        ),
        "EC_off too long": (
            "EC_off",
            "Remember to give Mei the baking book when you see her next time at her house on Tuesday.",
        ),
        "EC_on good": (
            "EC_on",
            "Mei liked your baking book and wanted to borrow it. Remember to give Mei the baking book.",
        ),
        "EC_on missing causality": (
            "EC_on",
            "Remember to give Mei the baking book.",
        ),
    }

    for label, (cond, text) in samples.items():
        result = check(
            text=text,
            condition=cond,
            task_id="book1_mei",
            entity_name="book",
            task_json=task_json,
        )
        print(f"{label}: {text!r}")
        print(f"  → {result.summary()}")
        for c in result.checks:
            status = "✓" if c.passed else "✗"
            print(f"    {status} {c.check_name}: {c.detail}")
        print()
