"""Context Extractor — prunes a full Task JSON to only condition-permitted fields.

v3 EC operationalization: 2 conditions (EC_off, EC_on).
Uses the simplified visible_fields format from condition_field_map.yaml.
Field paths are relative to reminder_context.

The LLM receives only the pruned output. It cannot leak information it never sees.
This implements Design Principle P1 (input truncation over output filtering).
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from reminder_agent.stage2.config_loader import (
    ConditionEntry,
    ConditionFieldMap,
    load_condition_field_map,
)

logger = logging.getLogger(__name__)


class MissingRequiredFieldError(Exception):
    """Raised when a required field is absent from the input Task JSON."""


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _resolve_path(data: dict, dotted_path: str) -> Any:
    """Traverse a nested dict using a dot-separated path.

    Returns the value at the path, or raises KeyError if any segment is missing.
    """
    keys = dotted_path.split(".")
    current = data
    for key in keys:
        if not isinstance(current, dict) or key not in current:
            raise KeyError(dotted_path)
        current = current[key]
    return current


def _set_path(target: dict, dotted_path: str, value: Any) -> None:
    """Set a value in a nested dict, creating intermediate dicts as needed."""
    keys = dotted_path.split(".")
    current = target
    for key in keys[:-1]:
        current = current.setdefault(key, {})
    current[keys[-1]] = value


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_field_map(
    condition: str,
    field_map: ConditionFieldMap | None = None,
) -> ConditionEntry:
    """Load the field whitelist for a specific condition.

    Args:
        condition: One of the active condition names (e.g. "EC_off", "EC_on").
        field_map: Pre-loaded field map. If None, loads from default config path.

    Returns:
        The ConditionEntry for the requested condition.
    """
    if field_map is None:
        field_map = load_condition_field_map()

    if condition not in field_map.conditions:
        raise ValueError(
            f"Unknown condition '{condition}'. "
            f"Valid: {sorted(field_map.conditions.keys())}"
        )
    return field_map.conditions[condition]


def extract(
    task_json: dict,
    condition: str,
    field_map: ConditionFieldMap | None = None,
) -> dict:
    """Prune a full Task JSON to contain only fields permitted by the condition.

    v3 format: visible_fields are dot-paths relative to reminder_context.
    Returns a dict with the same structure under reminder_context.

    Args:
        task_json: The complete Task JSON dict.
        condition: One of the active condition names ("EC_off" or "EC_on").
        field_map: Pre-loaded field map. If None, loads from default config path.

    Returns:
        A new dict containing only the whitelisted fields under reminder_context.

    Raises:
        MissingRequiredFieldError: If a required field is absent from task_json.
    """
    entry = load_field_map(condition, field_map)
    task_id = task_json.get("task_id", "<unknown>")
    rc = task_json.get("reminder_context", {})
    result_rc: dict = {}

    for field_path in entry.visible_fields:
        try:
            value = _resolve_path(rc, field_path)
        except KeyError:
            raise MissingRequiredFieldError(
                f"Required field 'reminder_context.{field_path}' missing from "
                f"task '{task_id}' for condition '{condition}'"
            )
        _set_path(result_rc, field_path, value)
        logger.debug("  [%s] INCLUDED: %s", condition, field_path)

    result = {"reminder_context": result_rc}

    logger.info(
        "Extracted context for task=%s condition=%s: %d fields included",
        task_id,
        condition,
        _count_leaf_values(result),
    )
    return result


def _count_leaf_values(d: dict) -> int:
    """Count the number of leaf (non-dict) values in a nested dict."""
    count = 0
    for v in d.values():
        if isinstance(v, dict):
            count += _count_leaf_values(v)
        elif isinstance(v, list):
            count += len(v)
        else:
            count += 1
    return count


# ---------------------------------------------------------------------------
# CLI entry point — demo extraction for book1_mei
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json

    logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(message)s")

    data_dir = Path(__file__).resolve().parent.parent / "data" / "task_schemas"
    task_path = data_dir / "book1_mei.json"

    if not task_path.exists():
        print(f"Task file not found: {task_path}")
        raise SystemExit(1)

    with open(task_path) as f:
        task_json = json.load(f)

    conditions = ["EC_off", "EC_on"]
    fm = load_condition_field_map()

    for cond in conditions:
        print(f"\n{'='*60}")
        print(f"  {cond}")
        print(f"{'='*60}")
        pruned = extract(task_json, cond, field_map=fm)
        print(json.dumps(pruned, indent=2))
