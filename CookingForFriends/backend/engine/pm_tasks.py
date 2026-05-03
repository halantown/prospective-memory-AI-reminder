"""
PM Task Registry — T1–T4 prospective memory tasks (EC+/EC- experiment).

Pure data module, no database dependencies. Used by:
  - database.py     (dev seed)
  - timeline engine (trigger scheduling)
  - encoding API    (task info for frontend)
  - WS handler      (pipeline step logging)

Legacy shim symbols at the bottom preserve module-level import compatibility
for files not yet migrated (admin.py, timeline_generator.py, timeline_editor.py).
Remove shims in Phase 2 when those files are rewritten.
"""

from dataclasses import dataclass
from data.materials import (
    get_decoy_items as _get_material_decoy_items,
    get_fake_trigger_lines,
    get_item_options as _get_material_item_options,
    get_pm_materials,
    get_reminder_text as _get_material_reminder_text,
)


@dataclass(frozen=True)
class PMTaskDef:
    task_id: str             # "T1" | "T2" | "T3" | "T4"
    guest_name: str          # "Mei" | "Lina" | "Tom" | "Delivery"
    trigger_type: str        # "doorbell" | "phone_call"
    target_room: str | None  # room where the target item lives (None for T4)
    action_type: str         # "bring_item" | "take_from_fridge" | "reply_in_chat"
    greeting_lines: tuple[str, ...]
    reminder_ec_plus: str
    reminder_ec_minus: str


@dataclass(frozen=True)
class DecoyOption:
    id: str          # "target" | "intra1" | "intra2" | "cross1" | "cross2" | "unrelated"
    label: str       # item name (Chinese label, hardcoded)
    is_target: bool


def _build_task_definitions() -> dict[str, PMTaskDef]:
    tasks = get_pm_materials()["tasks"]
    return {
        task_id: PMTaskDef(
            task_id=task["task_id"],
            guest_name=task["person"],
            trigger_type=task["trigger_type"],
            target_room=task["target_room"],
            action_type=task["action_type"],
            greeting_lines=tuple(task["greeting_lines"]),
            reminder_ec_plus=task["reminders"]["EC+"],
            reminder_ec_minus=task["reminders"]["EC-"],
        )
        for task_id, task in tasks.items()
    }


def _as_decoy_option(item: dict) -> DecoyOption:
    return DecoyOption(
        id=item["id"],
        label=item["label"],
        is_target=item["is_target"],
    )


TASK_DEFINITIONS: dict[str, PMTaskDef] = _build_task_definitions()
TASK_DECOYS: dict[str, list[DecoyOption]] = {
    task_id: [_as_decoy_option(item) for item in _get_material_decoy_items(task_id)]
    for task_id in TASK_DEFINITIONS
}


# ──────────────────────────────────────────────
# Public accessors
# ──────────────────────────────────────────────

def get_task(task_id: str) -> PMTaskDef:
    """Return task definition by ID (T1–T4). Raises KeyError for unknown IDs."""
    return TASK_DEFINITIONS[task_id]


def get_decoys(task_id: str) -> list[DecoyOption]:
    """Return the 6 decoy options for the given task."""
    return [_as_decoy_option(item) for item in _get_material_decoy_items(task_id)]


def get_item_options(task_id: str) -> list[DecoyOption]:
    """Return the 3 item-selection options: target + episode-internal distractors."""
    return [_as_decoy_option(item) for item in _get_material_item_options(task_id)]


def get_reminder_text(task_id: str, condition: str) -> str:
    """Return the EC+/EC- reminder text for a task."""
    return _get_material_reminder_text(task_id, condition)


FAKE_TRIGGER_LINES: dict[str, tuple[str, ...]] = {
    "doorbell": tuple(get_fake_trigger_lines("doorbell")),
    "phone_call": tuple(get_fake_trigger_lines("phone_call")),
}


# ──────────────────────────────────────────────
# LEGACY SHIMS
# These symbols exist solely to satisfy module-level imports in files that
# have not yet been migrated to the new design (Phase 2/3 work).
#
# Remove when:
#   - engine/timeline_generator.py is rewritten (Phase 2)
#   - routers/admin.py task-registry endpoint is removed (Phase 3)
#   - routers/timeline_editor.py is removed or rewritten (Phase 2/3)
# ──────────────────────────────────────────────

BLOCK_TRIGGER_ORDER: dict[int, list[str]] = {}   # LEGACY_SHIM
BLOCK_TRIGGER_TIMES: dict[int, dict[str, int]] = {}  # LEGACY_SHIM
BLOCK_GUESTS: dict[int, str] = {}                # LEGACY_SHIM
ACTIVITY_WATCH_CONFIG: dict[str, dict] = {}      # LEGACY_SHIM
NEUTRAL_UTTERANCES: dict[int, list[str]] = {}    # LEGACY_SHIM


def get_task_config(task_id: str) -> dict:   # LEGACY_SHIM
    raise NotImplementedError("get_task_config removed; use get_task() with new PMTaskDef")


def get_tasks_for_block(block: int) -> list:  # LEGACY_SHIM
    raise NotImplementedError("get_tasks_for_block removed; blocks replaced by task_order")


def get_all_tasks() -> list:  # LEGACY_SHIM
    raise NotImplementedError("get_all_tasks removed; use TASK_DEFINITIONS.values()")


def get_task_as_dict(task_id: str) -> dict:  # LEGACY_SHIM
    raise NotImplementedError("get_task_as_dict removed")


def task_def_to_config(task_def: PMTaskDef) -> dict:  # LEGACY_SHIM
    raise NotImplementedError("task_def_to_config removed; PMTrial creation replaced by new schema")


def task_def_to_encoding_card(task_def: PMTaskDef) -> dict:  # LEGACY_SHIM
    raise NotImplementedError("task_def_to_encoding_card removed; encoding uses frontend constants")
