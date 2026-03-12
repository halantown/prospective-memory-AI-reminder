"""Prompt Constructor — assembles system and user prompts for reminder generation.

Implements the dual format strategy (prose/json) from TECH_DOC v0.3 §4.2.
Tone constant (intention-reactivation framing) per TECH_DOC v0.4 §2.4.
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
    "LowAF_LowCB": {
        "include": "only the generic action and entity name (e.g., 'take your medicine')",
        "exclude": "any specific details about the target's appearance, dosage, form, who prescribed it, or what the user is currently doing",
        "tone": "Keep it short and generic — a simple nudge.",
    },
    "HighAF_LowCB": {
        "include": "the action, entity name, visual appearance of the target (colour, shape, container), specific properties (dosage, form), and who assigned the task (if a professional)",
        "exclude": "any reference to what the user is currently doing or their detected activity",
        "tone": "Be specific and descriptive about the target object so the user can identify it.",
    },
    "LowAF_HighCB": {
        "include": "the generic action and entity name, plus a reference to what the user is currently doing",
        "exclude": "any specific details about the target's appearance, dosage, form, or who prescribed it",
        "tone": "Acknowledge what the user is doing, then give a brief generic reminder.",
    },
    "HighAF_HighCB": {
        "include": "everything: the action, entity name, visual appearance, specific properties, who assigned it (if a professional), and a reference to what the user is currently doing",
        "exclude": "nothing — this is the full-information condition",
        "tone": "Acknowledge what the user is doing, then give a detailed, specific reminder.",
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
- Length: 8–30 words.
- Output: one reminder sentence or two short sentences.
- Natural spoken English — warm and brief. Not clinical. Not robotic.
- Do NOT use bullet points, numbering, or explanations.
- Do NOT add quotation marks around the reminder.
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
    """Convert pruned context dict to field-aware prose per TECH_DOC v0.3 §4.2."""
    parts: list[str] = []
    ctx = pruned_dict.get("reminder_context", pruned_dict)

    # Element 1: action + entity + cues + domain properties
    el1 = ctx.get("element1", {})
    action = el1.get("action_verb", "")
    entity = el1.get("target_entity", {})
    entity_name = entity.get("entity_name", "")

    if action and entity_name:
        parts.append(f"Task: {action} {entity_name}.")

    visual = entity.get("cues", {}).get("visual", "")
    if visual:
        parts.append(f"Target appearance: {visual}.")

    domain = entity.get("domain_properties", {})
    if domain:
        details = ", ".join(f"{k}: {v}" for k, v in domain.items())
        parts.append(f"Details: {details}.")

    # Element 2: origin / authority
    el2 = ctx.get("element2", {})
    origin = el2.get("origin", {})
    creator = origin.get("task_creator", "")
    if creator:
        parts.append(f"Prescribed by: {creator}.")

    # Element 3: detected activity
    el3 = ctx.get("element3", {})
    activity = el3.get("detected_activity_raw", "")
    if activity:
        parts.append(f"Current context: {activity}.")

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# User prompt builder
# ---------------------------------------------------------------------------

def build_user_prompt(
    pruned_context: dict,
    prior_variants: list[str] | None = None,
    context_format: str = "prose",
) -> str:
    """Build the user prompt with task context and optional diversity instruction.

    Args:
        pruned_context: Output from context_extractor.extract().
        prior_variants: Previously generated variants (for diversity).
        context_format: "prose" or "json".
    """
    formatted = format_context(pruned_context, style=context_format)

    prompt_parts = [
        "Task context:",
        formatted,
    ]

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
        pruned, prior_variants=prior_variants, context_format=gen_config.context_format
    )
    return system, user


# ---------------------------------------------------------------------------
# CLI entry point — prints assembled prompt for medicine_a × HighAF_HighCB
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    data_dir = Path(__file__).resolve().parent.parent / "data" / "task_schemas"
    task_path = data_dir / "medicine_a.json"

    if not task_path.exists():
        print(f"Task file not found: {task_path}")
        raise SystemExit(1)

    with open(task_path) as f:
        task_json = json.load(f)

    gen_cfg = load_generation_config()
    fm = load_condition_field_map()

    # Demo: HighAF_HighCB with no prior variants
    condition = "HighAF_HighCB"
    system, user = build_prompts(
        task_json, condition, field_map=fm, gen_config=gen_cfg
    )

    print(f"{'='*60}")
    print(f"  Condition: {condition}")
    print(f"  Context format: {gen_cfg.context_format}")
    print(f"{'='*60}")
    print(f"\n--- SYSTEM PROMPT ---\n{system}")
    print(f"\n--- USER PROMPT ---\n{user}")

    # Demo: with prior variants
    print(f"\n{'='*60}")
    print("  With prior variants (diversity instruction)")
    print(f"{'='*60}")
    prior = [
        "I can see you just finished dinner. Remember to take your Doxycycline — the 100mg tablet in the red round bottle.",
        "Since you've finished eating, it's time for your Doxycycline. Look for the red round bottle — your doctor prescribed it.",
    ]
    _, user_with_prior = build_prompts(
        task_json, condition, prior_variants=prior, field_map=fm, gen_config=gen_cfg
    )
    print(f"\n--- USER PROMPT ---\n{user_with_prior}")
