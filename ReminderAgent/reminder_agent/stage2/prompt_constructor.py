"""Prompt Constructor — assembles system and user prompts for reminder generation.

Implements the dual format strategy (prose/json) from TECH_DOC v0.3 §4.2.
Tone constant (intention-reactivation framing) per TECH_DOC v0.4 §2.4.

2×2 factorial design: AF (low/high) × EC (off/on)
  AF_low_EC_off  — minimal: action + entity only
  AF_high_EC_off — detailed item features, no source context
  AF_low_EC_on   — minimal item + source context
  AF_high_EC_on  — full information
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from reminder_agent.stage2.config_loader import (
    ConditionFieldMap,
    GenerationConfig,
    load_condition_field_map,
    load_generation_config,
)
from reminder_agent.stage2.context_extractor import extract

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Condition descriptions (plain English for LLM system prompt)
# ---------------------------------------------------------------------------

CONDITION_DESCRIPTIONS: dict[str, dict[str, str]] = {
    "AF_low_EC_off": {
        "include": "only the intended action and the entity name",
        "exclude": "visual appearance, specific properties, location, who assigned the task, any background about when/why the task was created, and any reference to the user's current activity",
        "tone": "Keep it minimal and brief. Just the action and the object.",
    },
    "AF_high_EC_off": {
        "include": "the action, entity name, visual appearance of the target (colour, shape, distinguishing features), specific discriminating properties, and the location (room and spot)",
        "exclude": "who assigned the task, any background about when/why the task was created, and any reference to the user's current activity",
        "tone": "Be specific and descriptive about the target object so the user can identify it among similar items.",
    },
    "AF_low_EC_on": {
        "include": "the intended action, the entity name, AND source context: who communicated the task and the situational background of when/how it was communicated",
        "exclude": "visual appearance, specific properties, location, and any reference to the user's current activity",
        "tone": "Mention who asked and the circumstance, then state the task simply.",
    },
    "AF_high_EC_on": {
        "include": "everything: the action, entity name, visual appearance, specific discriminating properties, location (room and spot), AND source context (who communicated the task and the situational background)",
        "exclude": "any reference to the user's current activity",
        "tone": "Give full details: who asked, the context, plus a detailed description of the target object and where to find it.",
    },
}


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

def build_system_prompt(condition: str) -> str:
    """Build the system prompt for a given condition.

    Includes role definition, condition rules, length constraints, and tone.
    """
    desc = CONDITION_DESCRIPTIONS.get(condition)
    if desc is None:
        raise ValueError(f"Unknown condition: {condition}")

    return f"""You are generating reminder messages for a robot assistant in a cognitive psychology experiment.
The reminder is spoken aloud by the robot (max 12 seconds of speech).

Condition: {condition}
You MUST include: {desc['include']}.
You MUST NOT include: {desc['exclude']}.

{desc['tone']}

Tone rule (applies to ALL conditions):
Use intention-reactivation framing ONLY:
  ✓ "Remember to...", "By the way, remember...", "Don't forget to..."
  ✗ "It's time to...", "You need to now...", "Make sure you..."
  ✗ Never imply the task should be executed immediately.

Constraints:
- Length: 8–40 words.
- Output: one reminder sentence or two short sentences.
- Natural spoken English — warm and brief. Not clinical. Not robotic.
- Do NOT use bullet points, numbering, or explanations.
- Do NOT add quotation marks around the reminder.
- When CUE PRIORITY is provided, you MUST include all high-priority cues.
  Include medium-priority cues when they fit naturally.
  Do NOT include low-priority cues unless needed for grammatical completeness.
- Output ONLY the reminder text, nothing else."""


# ---------------------------------------------------------------------------
# Context formatting (prose / json)
# ---------------------------------------------------------------------------

def format_context(pruned_dict: dict, style: str = "prose") -> str:
    """Format pruned context for inclusion in the user prompt.

    Args:
        pruned_dict: Output from context_extractor.extract().
        style: "prose" for field-aware natural language, "json" for raw JSON.
    """
    if style == "json":
        return json.dumps(pruned_dict, indent=2)
    elif style == "prose":
        return _to_prose(pruned_dict)
    else:
        raise ValueError(f"Unknown context format: '{style}'. Use 'prose' or 'json'.")


def _to_prose(pruned_dict: dict) -> str:
    """Convert pruned context dict to field-aware prose."""
    parts: list[str] = []
    ctx = pruned_dict.get("reminder_context", pruned_dict)

    # Element 1: action + entity
    el1 = ctx.get("element1", {})
    action = el1.get("action_verb", "")
    entity = el1.get("target_entity", {})
    entity_name = entity.get("entity_name", "")

    if action and entity_name:
        parts.append(f"Task: {action} {entity_name}.")

    # AF+ fields: visual cues, domain properties, location
    visual = entity.get("cues", {}).get("visual", "")
    if visual:
        parts.append(f"Target appearance: {visual}.")

    domain = entity.get("domain_properties", {})
    if domain:
        details = ", ".join(f"{k}: {v}" for k, v in domain.items())
        parts.append(f"Details: {details}.")

    location = el1.get("location", {})
    if location:
        room = location.get("room", "")
        spot = location.get("spot", "")
        if room or spot:
            loc_str = f"{room}, {spot}" if room and spot else (room or spot)
            parts.append(f"Location: {loc_str}.")

    # Element 2: encoding context (EC)
    el2 = ctx.get("element2", {})
    origin = el2.get("origin", {})
    creator = origin.get("task_creator", "")
    if creator:
        parts.append(f"Source: task from {creator}.")

    creation_ctx = el2.get("creation_context", "")
    if creation_ctx:
        parts.append(f"Background: {creation_ctx}.")

    # Element 3: should never appear (excluded from all conditions), but handle gracefully
    el3 = ctx.get("element3", {})
    activity = el3.get("detected_activity_raw", "")
    if activity:
        parts.append(f"Current context: {activity}.")

    return "\n".join(parts)


def _build_cue_priority_section(diagnosticity_report: dict) -> str:
    """Build CUE PRIORITY annotation from a diagnosticity report."""
    include = diagnosticity_report.get("recommended_cues", {}).get("include", [])
    if not include:
        return ""

    features_by_id = {
        f["feature_id"]: f.get("feature", f["feature_id"])
        for f in diagnosticity_report.get("candidate_features", [])
    }

    high = []   # priority 1-2
    medium = []  # priority 3
    low = []     # priority 4+

    for cue in include:
        fid = cue.get("feature_id", "?")
        feature_text = features_by_id.get(fid, fid)
        priority = cue.get("priority", 99)
        if priority <= 2:
            high.append(feature_text)
        elif priority == 3:
            medium.append(feature_text)
        else:
            low.append(feature_text)

    lines = ["CUE PRIORITY (based on diagnosticity analysis):"]
    if high:
        lines.append(f"  MUST include (high diagnosticity): {', '.join(high)}")
    if medium:
        lines.append(f"  SHOULD include (medium): {', '.join(medium)}")
    if low:
        lines.append(f"  MAY omit (low diagnosticity): {', '.join(low)}")

    lines.append("")
    lines.append(
        "The reminder MUST contain at least the high-priority cues. "
        "Include medium-priority cues if they fit naturally within the word limit."
    )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# User prompt builder
# ---------------------------------------------------------------------------

def build_user_prompt(
    pruned_context: dict,
    prior_variants: list[str] | None = None,
    context_format: str = "prose",
    diagnosticity_report: dict | None = None,
) -> str:
    """Build the user prompt with task context and optional diversity instruction.

    Args:
        pruned_context: Output from context_extractor.extract().
        prior_variants: Previously generated variants (for diversity).
        context_format: "prose" or "json".
        diagnosticity_report: Approved diagnosticity report for cue prioritization.
    """
    formatted = format_context(pruned_context, style=context_format)

    prompt_parts = [
        "Task context:",
        formatted,
    ]

    # Append cue priority annotation from diagnosticity report
    if diagnosticity_report:
        cue_section = _build_cue_priority_section(diagnosticity_report)
        if cue_section:
            prompt_parts.append("")
            prompt_parts.append(cue_section)

    if prior_variants:
        prompt_parts.append("")
        prompt_parts.append(
            "Previously generated variants (generate something structurally different):"
        )
        for i, variant in enumerate(prior_variants, 1):
            prompt_parts.append(f"  {i}. {variant}")

    prompt_parts.append("")
    prompt_parts.append("Generate one new reminder variant.")

    return "\n".join(prompt_parts)


# ---------------------------------------------------------------------------
# Convenience: build both prompts in one call
# ---------------------------------------------------------------------------

def build_prompts(
    task_json: dict,
    condition: str,
    prior_variants: list[str] | None = None,
    field_map: ConditionFieldMap | None = None,
    gen_config: GenerationConfig | None = None,
    diagnosticity_report: dict | None = None,
) -> tuple[str, str]:
    """Build system + user prompts for a (task, condition) pair.

    Returns:
        (system_prompt, user_prompt)
    """
    if gen_config is None:
        gen_config = load_generation_config()
    if field_map is None:
        field_map = load_condition_field_map()

    pruned = extract(task_json, condition, field_map=field_map)
    system = build_system_prompt(condition)
    user = build_user_prompt(
        pruned, prior_variants=prior_variants, context_format=gen_config.context_format,
        diagnosticity_report=diagnosticity_report,
    )
    return system, user


# ---------------------------------------------------------------------------
# CLI entry point — prints assembled prompt for example_book × AF_high_EC_on
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    data_dir = Path(__file__).resolve().parent.parent / "data" / "task_schemas"
    task_path = data_dir / "example_book.json"

    if not task_path.exists():
        print(f"Task file not found: {task_path}")
        raise SystemExit(1)

    with open(task_path) as f:
        task_json = json.load(f)

    gen_cfg = load_generation_config()
    fm = load_condition_field_map()

    # Demo: AF_high_EC_on with no prior variants
    condition = "AF_high_EC_on"
    system, user = build_prompts(
        task_json, condition, field_map=fm, gen_config=gen_cfg
    )

    print(f"{'='*60}")
    print(f"  Condition: {condition}")
    print(f"  Context format: {gen_cfg.context_format}")
    print(f"{'='*60}")
    print(f"\n--- SYSTEM PROMPT ---\n{system}")
    print(f"\n--- USER PROMPT ---\n{user}")
