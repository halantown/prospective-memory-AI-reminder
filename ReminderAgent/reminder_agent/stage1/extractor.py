"""Stage 1 Demo: ReAct agent for extracting Task JSON from unstructured text.

This is a DEMO module showing that the pipeline CAN start from unstructured
input. The experiment does not use this — it uses pre-authored Task JSONs.

Minimal scope: one source type, one example, basic extraction loop.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = [
    "action_verb",
    "entity_name",
    "cues.visual",
    "domain_properties",
    "location.room",
    "location.spot",
    "task_creator",
    "creator_is_authority",
    "creation_context",
]

EXTRACTION_PROMPT = """You are an information extraction agent. Read the source text below
and extract structured task information for a reminder system.

REQUIRED FIELDS:
- action_verb: what the user needs to do (e.g. "take")
- entity_name: the main object involved (e.g. "Doxycycline")
- visual cues: what the object looks like (e.g. "red bottle")
- domain_properties: specific details (e.g. dosage, form)
- location: where the object is (room + spot)
- task_creator: who created/assigned the task
- creator_is_authority: true if from a professional (doctor, etc.)
- creation_context: why the task exists

OUTPUT FORMAT (JSON only, no explanation):
{
  "reminder_context": {
    "element1": {
      "action_verb": "...",
      "target_entity": {
        "entity_name": "...",
        "cues": {"visual": "..."},
        "domain_properties": {"key": "value"}
      },
      "location": {"room": "...", "spot": "..."}
    },
    "element2": {
      "origin": {"task_creator": "...", "creator_is_authority": true/false},
      "creation_context": "..."
    }
  }
}

For missing fields, use null. Do NOT hallucinate information not in the source.

SOURCE TEXT:
"""


def extract_from_text(source_text: str, backend=None) -> dict:
    """Use an LLM to extract structured task info from unstructured text.

    Args:
        source_text: Raw text (email, note, message).
        backend: LLM backend instance. If None, uses a rule-based fallback.

    Returns:
        Dict with "extracted", "gaps", and "confidence" keys.
    """
    if backend is not None:
        return _llm_extract(source_text, backend)
    return _rule_based_extract(source_text)


def _llm_extract(source_text: str, backend) -> dict:
    """LLM-based extraction with gap detection."""
    system = "You extract structured information from text. Output valid JSON only."
    user = EXTRACTION_PROMPT + source_text

    raw = backend.generate(system, user)

    # Try to parse JSON from LLM output
    try:
        start = raw.index("{")
        end = raw.rindex("}") + 1
        extracted = json.loads(raw[start:end])
    except (ValueError, json.JSONDecodeError):
        logger.warning("Failed to parse LLM output as JSON")
        extracted = {}

    gaps = _find_gaps(extracted)
    confidence = 1.0 - (len(gaps) / len(REQUIRED_FIELDS))

    return {"extracted": extracted, "gaps": gaps, "confidence": round(confidence, 2)}


def _rule_based_extract(source_text: str) -> dict:
    """Simple keyword-based extraction as fallback (no LLM needed)."""
    text_lower = source_text.lower()
    extracted: dict = {"reminder_context": {"element1": {}, "element2": {}}}
    el1 = extracted["reminder_context"]["element1"]
    el2 = extracted["reminder_context"]["element2"]

    # Action verb
    if "take" in text_lower:
        el1["action_verb"] = "take"
    elif "bring" in text_lower:
        el1["action_verb"] = "bring"

    # Entity + properties
    entity: dict = {}
    if "doxycycline" in text_lower:
        entity["entity_name"] = "Doxycycline"
    if "100mg" in text_lower or "100 mg" in text_lower:
        entity.setdefault("domain_properties", {})["dosage"] = "100mg"
    if "tablet" in text_lower:
        entity.setdefault("domain_properties", {})["form"] = "tablet"
    if "red bottle" in text_lower or "red round bottle" in text_lower:
        entity["cues"] = {"visual": "red bottle"}
    if entity:
        el1["target_entity"] = entity

    # Location
    if "kitchen" in text_lower and "shelf" in text_lower:
        el1["location"] = {"room": "kitchen", "spot": "shelf"}

    # Creator
    for line in source_text.split("\n"):
        if line.strip().startswith("From:"):
            creator = line.split("From:")[-1].strip().rstrip(",")
            el2["origin"] = {
                "task_creator": creator,
                "creator_is_authority": "dr." in creator.lower(),
            }
            break

    # Context
    if "prescri" in text_lower:
        el2["creation_context"] = "Medical prescription from doctor visit"

    gaps = _find_gaps(extracted)
    confidence = 1.0 - (len(gaps) / len(REQUIRED_FIELDS))

    return {"extracted": extracted, "gaps": gaps, "confidence": round(confidence, 2)}


def _find_gaps(extracted: dict) -> list[str]:
    """Identify which required fields are missing or null."""
    gaps = []
    ctx = extracted.get("reminder_context", {})
    el1 = ctx.get("element1", {})
    el2 = ctx.get("element2", {})
    te = el1.get("target_entity", {})
    loc = el1.get("location", {})
    origin = el2.get("origin", {})

    if not el1.get("action_verb"):
        gaps.append("action_verb: NOT FOUND")
    if not te.get("entity_name"):
        gaps.append("entity_name: NOT FOUND")
    if not te.get("cues", {}).get("visual"):
        gaps.append("cues.visual: NOT FOUND or incomplete")
    if not te.get("domain_properties"):
        gaps.append("domain_properties: NOT FOUND")
    if not loc.get("room"):
        gaps.append("location.room: NOT FOUND")
    if not loc.get("spot"):
        gaps.append("location.spot: PARTIAL (specific position unknown)")
    if not origin.get("task_creator"):
        gaps.append("task_creator: NOT FOUND")
    if origin.get("creator_is_authority") is None:
        gaps.append("creator_is_authority: NOT DETERMINED")
    if not el2.get("creation_context"):
        gaps.append("creation_context: NOT FOUND")

    return gaps
