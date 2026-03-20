"""Context Extractor — prunes a full Task JSON to only condition-permitted fields.

The LLM receives only the pruned output. It cannot leak information it never sees.
This implements Design Principle P1 (input truncation over output filtering).

3-group design: Only AF_only and AF_CB conditions use this extractor.
Control group generates no text and never calls this module.
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


def _evaluate_condition(condition_expr: str, task_json: dict) -> bool:
    """Evaluate a simple condition expression against the task JSON.

    Supports: "path.to.field == value"
    """
    parts = condition_expr.split(" == ")
    if len(parts) != 2:
        raise ValueError(f"Unsupported condition syntax: {condition_expr}")

    field_path = parts[0].strip()
    expected_raw = parts[1].strip()

    # Parse the expected value
    if expected_raw.lower() == "true":
        expected: Any = True
    elif expected_raw.lower() == "false":
        expected = False
    else:
        expected = expected_raw.strip("\"'")

    try:
        actual = _resolve_path(task_json, field_path)
    except KeyError:
        return False

    return actual == expected


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_field_map(
    condition: str,
    field_map: ConditionFieldMap | None = None,
) -> ConditionEntry:
    """Load the field whitelist for a specific condition.

    Args:
        condition: One of the active condition names (e.g. "AF_only", "AF_CB").
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

    Args:
        task_json: The complete Task JSON dict (with all 3 zones).
        condition: One of the active condition names ("AF_only" or "AF_CB").
        field_map: Pre-loaded field map. If None, loads from default config path.

    Returns:
        A new dict containing only the whitelisted fields.

    Raises:
        MissingRequiredFieldError: If a required field is absent from task_json.
    """
    entry = load_field_map(condition, field_map)
    task_id = task_json.get("task_id", "<unknown>")
    result: dict = {}

    # 1. Include required fields
    for field_path in entry.required_fields:
        try:
            value = _resolve_path(task_json, field_path)
        except KeyError:
            raise MissingRequiredFieldError(
                f"Required field '{field_path}' missing from task '{task_id}' "
                f"for condition '{condition}'"
            )
        _set_path(result, field_path, value)
        logger.debug("  [%s] INCLUDED required: %s", condition, field_path)

    # 2. Include conditional fields (only if their condition evaluates to true)
    for cond_field in entry.conditional_fields:
        if _evaluate_condition(cond_field.condition, task_json):
            try:
                value = _resolve_path(task_json, cond_field.field)
            except KeyError:
                logger.warning(
                    "Conditional field '%s' condition met but field missing in task '%s'",
                    cond_field.field,
                    task_id,
                )
                continue
            _set_path(result, cond_field.field, value)
            logger.debug("  [%s] INCLUDED conditional: %s", condition, cond_field.field)
        else:
            logger.debug(
                "  [%s] SKIPPED conditional: %s (condition not met)",
                condition,
                cond_field.field,
            )

    # Log excluded fields and zones for auditability
    for field_path in entry.excluded_fields:
        logger.debug("  [%s] EXCLUDED field: %s", condition, field_path)
    for zone in entry.excluded_zones:
        logger.debug("  [%s] EXCLUDED zone: %s", condition, zone)

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
        else:
            count += 1
    return count


# ---------------------------------------------------------------------------
# CLI entry point — demo extraction for medicine_a
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json

    logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(message)s")

    data_dir = Path(__file__).resolve().parent.parent / "data" / "task_schemas"
    task_path = data_dir / "medicine_a.json"

    if not task_path.exists():
        print(f"Task file not found: {task_path}")
        raise SystemExit(1)

    with open(task_path) as f:
        task_json = json.load(f)

    conditions = ["AF_only", "AF_CB"]
    fm = load_condition_field_map()

    for cond in conditions:
        print(f"\n{'='*60}")
        print(f"  {cond}")
        print(f"{'='*60}")
        pruned = extract(task_json, cond, field_map=fm)
        print(json.dumps(pruned, indent=2))
