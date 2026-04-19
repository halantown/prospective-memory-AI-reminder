"""Prompt Constructor — assembles system and user prompts for reminder generation.

v3 EC operationalization: 2 conditions (EC_off, EC_on).
  EC_off — baseline only: action + target + recipient
  EC_on  — baseline + encoding context features (entity + causality)

Prompt templates follow EC_Operationalization_Dev_Doc.md §4.
Tone constant (intention-reactivation framing).
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
# System prompts (v3 — EC operationalization)
# ---------------------------------------------------------------------------

EC_OFF_SYSTEM_PROMPT = """You are generating a short reminder message for a participant in a memory experiment.

The reminder should contain ONLY the action and target. No context, no backstory.

Rules:
- Use intention-reactivation framing ONLY:
  ✓ "Remember to...", "By the way, remember...", "Don't forget to..."
  ✗ "It's time to...", "You need to now...", "Make sure you..."
  ✗ Never imply the task should be executed immediately.
- The full reminder must be a single sentence, no longer than 12 words.
- Do not use relative clauses (which / that / who).
- Do not compress phrases into hyphenated words.
- Natural spoken English — warm and brief.
- Do NOT use bullet points, numbering, or explanations.
- Do NOT add quotation marks around the reminder.
- Always refer to the target item by its specific name — never use "it" or "the item".
- Do not introduce any objects or details not present in the task data provided.
- Output ONLY the reminder text, nothing else.

Example: "Remember to give Mei the baking book."
"""

EC_ON_SYSTEM_PROMPT = """You are generating a reminder message for a participant in a memory experiment.

The reminder should have two parts:
1. A context sentence that naturally paraphrases the encoding episode features below.
2. The action instruction.

Rules:
- Use intention-reactivation framing for the action part:
  ✓ "Remember to...", "By the way, remember...", "Don't forget to..."
  ✗ "It's time to...", "You need to now...", "Make sure you..."
  ✗ Never imply the task should be executed immediately.
- The context sentence must paraphrase the features — do not copy verbatim.
- Each variant should use a different paraphrase.
- Do not invent details not present in the features.
- Do not introduce time, space, or intentionality details unless they appear in the features.
- Do not compress phrases into hyphenated words.
- Total length: under 25 words.
- Format: [context paraphrase] + [action instruction]
- Natural spoken English — warm and brief.
- Do NOT use bullet points, numbering, or explanations.
- Do NOT add quotation marks around the reminder.
- Always refer to the target item by its specific name — never use "it" or "the item".
- Do not use first-person plural ("we", "our", "us").
- Output ONLY the reminder text, nothing else.

Example: "Last week you baked together and Mei liked your baking book. Remember to give Mei the baking book."
"""

SYSTEM_PROMPTS = {
    "EC_off": EC_OFF_SYSTEM_PROMPT,
    "EC_on": EC_ON_SYSTEM_PROMPT,
}


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

def build_system_prompt(condition: str) -> str:
    """Build the system prompt for a given condition."""
    prompt = SYSTEM_PROMPTS.get(condition)
    if prompt is None:
        raise ValueError(f"Unknown condition: {condition}")
    return prompt.strip()


# ---------------------------------------------------------------------------
# Context formatting
# ---------------------------------------------------------------------------

def format_context_v3(pruned_dict: dict, condition: str) -> str:
    """Format pruned v3 context for inclusion in the user prompt.

    Args:
        pruned_dict: Output from context_extractor.extract() (v3 format).
        condition: "EC_off" or "EC_on".
    """
    rc = pruned_dict.get("reminder_context", pruned_dict)
    baseline = rc.get("baseline", {})
    parts: list[str] = []

    # Baseline is always present
    action = baseline.get("action_verb", "")
    target = baseline.get("target", "")
    recipient = baseline.get("recipient", "")

    parts.append("Task:")
    parts.append(f"- Action: {action}")
    parts.append(f"- Target: {target}")
    parts.append(f"- Recipient: {recipient}")

    # EC_on: add encoding context features
    if condition == "EC_on":
        ec_features = rc.get("ec_selected_features", {})
        entity_features = ec_features.get("entity", [])
        causality_features = ec_features.get("causality", "")

        parts.append("")
        parts.append("Encoding context features:")
        if entity_features:
            if isinstance(entity_features, list):
                parts.append(f"- Entity: {', '.join(entity_features)}")
            else:
                parts.append(f"- Entity: {entity_features}")
        if causality_features:
            parts.append(f"- Causality: {causality_features}")

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# User prompt builder
# ---------------------------------------------------------------------------

def build_user_prompt(
    pruned_context: dict,
    condition: str = "",
    prior_variants: list[str] | None = None,
    task_json: dict | None = None,
) -> str:
    """Build the user prompt with task context and optional diversity instruction.

    Args:
        pruned_context: Output from context_extractor.extract() (v3 format).
        condition: The experimental condition ("EC_off" or "EC_on").
        prior_variants: Previously generated variants (for diversity).
        task_json: Full task JSON (unused in v3 but kept for API compat).
    """
    formatted = format_context_v3(pruned_context, condition)

    prompt_parts = [formatted]

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
        pruned, condition=condition, prior_variants=prior_variants,
        task_json=task_json,
    )
    return system, user


# ---------------------------------------------------------------------------
# CLI entry point — prints assembled prompt for book1_mei × EC_on
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    data_dir = Path(__file__).resolve().parent.parent / "data" / "task_schemas"
    task_path = data_dir / "book1_mei.json"

    if not task_path.exists():
        print(f"Task file not found: {task_path}")
        raise SystemExit(1)

    with open(task_path) as f:
        task_json = json.load(f)

    gen_cfg = load_generation_config()
    fm = load_condition_field_map()

    for condition in ["EC_off", "EC_on"]:
        system, user = build_prompts(
            task_json, condition, field_map=fm, gen_config=gen_cfg
        )

        print(f"{'='*60}")
        print(f"  Condition: {condition}")
        print(f"{'='*60}")
        print(f"\n--- SYSTEM PROMPT ---\n{system}")
        print(f"\n--- USER PROMPT ---\n{user}")
        print()
