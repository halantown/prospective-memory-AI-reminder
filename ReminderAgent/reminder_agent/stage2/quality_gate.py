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
from dataclasses import dataclass, field
from pathlib import Path

import yaml
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
    max_words: int = 35,
) -> CheckResult:
    """Check that word count is within [min_words, max_words]."""
    word_count = len(text.split())
    if word_count < min_words:
        return CheckResult("length", False, f"Too short: {word_count} words (min {min_words})")
    if word_count > max_words:
        return CheckResult("length", False, f"Too long: {word_count} words (max {max_words})")
    return CheckResult("length", True, f"{word_count} words")


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
    """Check that the text is in English using langdetect."""
    try:
        lang = detect(text)
    except LangDetectException:
        return CheckResult("language", False, "Language detection failed")

    if lang == "en":
        return CheckResult("language", True)
    return CheckResult("language", False, f"Detected language: {lang} (expected en)")


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
        high_features = [c["feature"] for c in candidates if c.get("diagnosticity") == "high"]
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
    """For EC_on conditions: verify source context appears in the text."""
    if "EC_on" not in condition:
        return CheckResult("ec_source_present", True, "Not EC_on — skipped")

    el2 = task_json.get("reminder_context", {}).get("element2_ec", {})
    creator = el2.get("task_creator", "")
    creation_ctx = el2.get("creation_context", "")

    text_lower = text.lower()

    # Check creator name (use words >2 chars to handle "friend Mei" → "mei")
    creator_found = False
    if creator:
        creator_words = [w.lower() for w in creator.split() if len(w) > 2]
        creator_found = any(w in text_lower for w in creator_words)

    # Check creation context keywords
    context_found = False
    if creation_ctx:
        context_words = [w.lower() for w in creation_ctx.split() if len(w) > 4]
        context_found = any(w in text_lower for w in context_words)

    if not creator_found and not context_found:
        return CheckResult(
            "ec_source_present", False,
            f"EC_on but no source context found. Expected '{creator}' or context keywords."
        )
    return CheckResult("ec_source_present", True)


def check_ec_source_absent(
    text: str,
    condition: str,
    task_json: dict,
) -> CheckResult:
    """For EC_off conditions: verify source context did NOT leak into text."""
    if "EC_off" not in condition:
        return CheckResult("ec_source_absent", True, "Not EC_off — skipped")

    el2 = task_json.get("reminder_context", {}).get("element2_ec", {})
    creator = el2.get("task_creator", "")

    if creator and creator.lower() != "self":
        creator_words = [w.lower() for w in creator.split() if len(w) > 2]
        text_lower = text.lower()
        for w in creator_words:
            if w in text_lower:
                return CheckResult(
                    "ec_source_absent", False,
                    f"EC_off but creator word '{w}' found in text — source context leak"
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
    results.append(check_length(text, gen_config.min_words, gen_config.max_words))
    results.append(check_duplicate(text, prior_variants, gen_config.similarity_threshold))
    results.append(check_language(text))

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
