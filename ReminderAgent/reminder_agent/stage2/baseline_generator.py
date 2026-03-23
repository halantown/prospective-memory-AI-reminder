"""Generate Layer 0 (Baseline) reminder texts from Task JSON.

Baseline reminders use a fixed template with only action_verb + entity_name.
No LLM is needed — this is purely template-based.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from reminder_agent.stage2.config_loader import ConditionFieldMap, load_condition_field_map
from reminder_agent.stage2.context_extractor import extract

logger = logging.getLogger(__name__)

TASK_DIR = Path(__file__).resolve().parent.parent / "data" / "task_schemas"


def generate_baseline(task_json: dict, field_map: ConditionFieldMap | None = None) -> str:
    """Generate a single baseline reminder text.

    Uses context_extractor to prune the JSON to Baseline fields,
    then applies a fixed template.

    Args:
        task_json: Full task JSON dict.
        field_map: Optional pre-loaded ConditionFieldMap.

    Returns:
        Baseline reminder string, e.g. "Remember to find and bring the book."
    """
    if field_map is None:
        field_map = load_condition_field_map()

    pruned = extract(task_json, "Baseline", field_map)

    action_verb = pruned["reminder_context"]["element1"]["action_verb"]
    entity_name = pruned["reminder_context"]["element1"]["target_entity"]["entity_name"]

    return f"Remember to {action_verb} the {entity_name}."


def generate_all_baselines(
    task_jsons: list[dict] | None = None,
    field_map: ConditionFieldMap | None = None,
) -> dict[str, str]:
    """Generate baseline text for all task JSON files.

    Args:
        task_jsons: List of task JSON dicts. If None, loads from task_schemas dir.
        field_map: Optional pre-loaded ConditionFieldMap.

    Returns:
        Dict mapping task_id to baseline text.
    """
    if task_jsons is None:
        task_jsons = load_all_task_jsons()

    if field_map is None:
        field_map = load_condition_field_map()

    return {
        tj["task_id"]: generate_baseline(tj, field_map)
        for tj in task_jsons
    }


def load_all_task_jsons(task_dir: Path | None = None) -> list[dict]:
    """Load all task JSON files from the task_schemas directory.

    Returns:
        List of task JSON dicts, sorted by task_id.
    """
    task_dir = task_dir or TASK_DIR
    tasks = []
    for path in sorted(task_dir.glob("*.json")):
        with open(path) as f:
            tasks.append(json.load(f))
    return tasks


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    tasks = load_all_task_jsons()
    baselines = generate_all_baselines(tasks)

    print(f"\n=== Baseline Reminders ({len(baselines)} tasks) ===\n")
    for task_id, text in baselines.items():
        print(f"  {task_id:20s} → {text}")
