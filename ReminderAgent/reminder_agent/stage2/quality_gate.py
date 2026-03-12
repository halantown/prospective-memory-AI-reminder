"""Quality Gate — automated compliance checks for generated reminder texts.

Implements checks from TECH_DOC v0.4 §4.2 / DEV_PLAN v0.3 S4:
  1. Forbidden keyword leak (Low AF only)
  2. Required entity presence
  3. Length constraint (word count)
  4. Duplicate detection (Levenshtein similarity)
  5. Language check (English only)
  6. CB activity consistency (batch-level, High CB only)
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

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

    Only applies to LowAF conditions. High AF conditions always pass.
    """
    if "LowAF" not in condition:
        return CheckResult("forbidden_keywords", True, "Not a LowAF condition — skipped")

    if forbidden_kw is None:
        forbidden_kw = load_forbidden_keywords()

    task_kw = forbidden_kw.get(task_id)
    if task_kw is None:
        logger.warning("No forbidden keywords defined for task '%s'", task_id)
        return CheckResult("forbidden_keywords", True, f"No keywords defined for {task_id}")

    text_lower = text.lower()
    all_forbidden = task_kw["visual_keywords"] + task_kw["domain_keywords"]
    found = [kw for kw in all_forbidden if kw in text_lower]

    if found:
        return CheckResult("forbidden_keywords", False, f"Leaked keywords: {found}")
    return CheckResult("forbidden_keywords", True)


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


# ---------------------------------------------------------------------------
# CB activity consistency (batch-level check)
# ---------------------------------------------------------------------------

_CB_ACTIVITY_PATTERNS = [
    re.compile(r"I (?:can )?see (?:that )?you['\u2019]?(?:re|are)\b", re.IGNORECASE),
    re.compile(r"I notice (?:that )?you['\u2019]?(?:re|are)?\b", re.IGNORECASE),
    re.compile(r"(?:Since|While|Now that) you['\u2019]?(?:re|ve|are|have)\b", re.IGNORECASE),
    re.compile(r"(?:It (?:looks|seems) like) you['\u2019]?(?:re|are)?\b", re.IGNORECASE),
]


def _extract_activity_sentence(text: str) -> str | None:
    """Extract the activity phrase from the CB reference.

    Splits on sentence boundaries AND common reminder phrase boundaries
    (e.g. ", remember", ", don't forget") to isolate just the activity part.
    Returns the activity fragment if a CB pattern is found, else None.
    """
    # Split on sentence-ending punctuation first, then on reminder phrase boundaries
    segments = re.split(r"[.!?]+", text)
    refined: list[str] = []
    for seg in segments:
        # Further split on ", remember" / ", don't forget" / ", by the way" boundaries
        parts = re.split(r",\s*(?=remember|don['\u2019]t forget|by the way)", seg, flags=re.IGNORECASE)
        refined.extend(parts)

    for segment in refined:
        segment = segment.strip()
        if not segment:
            continue
        for pattern in _CB_ACTIVITY_PATTERNS:
            if pattern.search(segment):
                return segment
    return None


def check_cb_consistency(
    variants: list[str],
    condition: str,
    similarity_threshold: float = 0.40,
) -> CheckResult:
    """Check that High CB variants all reference the same activity.

    Only applies to HighCB conditions. Compares activity sentences
    pairwise using normalised Levenshtein similarity. Flags if any pair
    has similarity below the threshold (meaning they describe different activities).

    Args:
        variants: All generated variants for this (task, condition) batch.
        condition: The condition string (only HighCB is checked).
        similarity_threshold: Minimum pairwise similarity for activity sentences.
    """
    if "HighCB" not in condition:
        return CheckResult("cb_consistency", True, "Not a HighCB condition — skipped")

    if len(variants) < 2:
        return CheckResult("cb_consistency", True, "Fewer than 2 variants — skipped")

    activity_sentences = []
    for i, v in enumerate(variants):
        sent = _extract_activity_sentence(v)
        if sent is None:
            return CheckResult(
                "cb_consistency", False,
                f"Variant {i} has no detectable CB activity reference"
            )
        activity_sentences.append(sent.lower().strip())

    # Pairwise similarity check
    min_sim = 1.0
    worst_pair = (0, 0)
    for i in range(len(activity_sentences)):
        for j in range(i + 1, len(activity_sentences)):
            dist = Levenshtein.normalized_distance(activity_sentences[i], activity_sentences[j])
            sim = 1.0 - dist
            if sim < min_sim:
                min_sim = sim
                worst_pair = (i, j)

    if min_sim < similarity_threshold:
        return CheckResult(
            "cb_consistency", False,
            f"Activity divergence between variants {worst_pair[0]} and {worst_pair[1]} "
            f"(similarity={min_sim:.3f}, threshold={similarity_threshold})"
        )
    return CheckResult(
        "cb_consistency", True,
        f"All activity sentences consistent (min_sim={min_sim:.3f})"
    )


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
) -> GateResult:
    """Run all per-variant quality checks.

    Args:
        text: The generated reminder text.
        condition: e.g. "LowAF_LowCB".
        task_id: e.g. "medicine_a".
        entity_name: The entity name that must appear in the text.
        prior_variants: Previously accepted variants in this batch.
        gen_config: Generation config (for thresholds). Loaded if None.
        forbidden_kw: Forbidden keywords dict. Loaded if None.

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

    all_passed = all(r.passed for r in results)
    return GateResult(passed=all_passed, checks=results)


def check_batch(
    variants: list[str],
    condition: str,
    cb_similarity_threshold: float = 0.40,
) -> CheckResult:
    """Run batch-level checks (CB activity consistency).

    Call this after all variants for a (task, condition) pair are generated.
    """
    return check_cb_consistency(variants, condition, cb_similarity_threshold)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    # Demo: check a good and a bad text for medicine_a
    good_low_af = "Remember to take your Doxycycline after dinner."
    bad_low_af = "Remember to take the red round Doxycycline tablet."

    print("=== Quality Gate Demo (medicine_a, LowAF_LowCB) ===\n")

    for label, text in [("Good", good_low_af), ("Bad (leaked keywords)", bad_low_af)]:
        result = check(
            text=text,
            condition="LowAF_LowCB",
            task_id="medicine_a",
            entity_name="Doxycycline",
        )
        print(f"{label}: {text!r}")
        print(f"  → {result.summary()}")
        for c in result.checks:
            status = "✓" if c.passed else "✗"
            print(f"    {status} {c.check_name}: {c.detail}")
        print()
