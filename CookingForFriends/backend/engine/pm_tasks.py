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


@dataclass(frozen=True)
class PMTaskDef:
    task_id: str             # "T1" | "T2" | "T3" | "T4"
    guest_name: str          # "Mei" | "Lina" | "Tom" | "Delivery"
    trigger_type: str        # "doorbell" | "phone_call"
    target_room: str | None  # room where the target item lives (None for T4)
    action_type: str         # "bring_item" | "take_from_fridge" | "reply_in_chat"


@dataclass(frozen=True)
class DecoyOption:
    id: str          # "target" | "intra1" | "intra2" | "cross1" | "cross2" | "unrelated"
    label: str       # item name (Chinese label, hardcoded)
    is_target: bool


# ──────────────────────────────────────────────
# Task definitions
# ──────────────────────────────────────────────

TASK_DEFINITIONS: dict[str, PMTaskDef] = {
    "T1": PMTaskDef(
        task_id="T1",
        guest_name="Mei",
        trigger_type="doorbell",
        target_room="study",
        action_type="bring_item",
    ),
    "T2": PMTaskDef(
        task_id="T2",
        guest_name="Lina",
        trigger_type="doorbell",
        target_room="kitchen",
        action_type="bring_item",
    ),
    "T3": PMTaskDef(
        task_id="T3",
        guest_name="Tom",
        trigger_type="phone_call",
        target_room="kitchen",
        action_type="take_from_fridge",
    ),
    "T4": PMTaskDef(
        task_id="T4",
        guest_name="Delivery",
        trigger_type="phone_call",
        target_room=None,
        action_type="reply_in_chat",
    ),
}

# ──────────────────────────────────────────────
# Decoy options (hardcoded Chinese labels)
# Cross-distractor rule: each intra item appears in at most one other task's pool.
# ──────────────────────────────────────────────

TASK_DECOYS: dict[str, list[DecoyOption]] = {
    "T1": [  # Mei → 烘焙书
        DecoyOption("target",    "烘焙书",             True),
        DecoyOption("intra1",    "游戏手柄",            False),
        DecoyOption("intra2",    "蛋糕盒子",            False),
        DecoyOption("cross1",    "礼品袋",              False),  # T2 intra1
        DecoyOption("cross2",    "烧烤架",              False),  # T3 intra1
        DecoyOption("unrelated", "[T1 unrelated TBD]", False),
    ],
    "T2": [  # Lina → 巧克力
        DecoyOption("target",    "巧克力",              True),
        DecoyOption("intra1",    "礼品袋",              False),
        DecoyOption("intra2",    "明信片",              False),
        DecoyOption("cross1",    "游戏手柄",            False),  # T1 intra1
        DecoyOption("cross2",    "旧电池",              False),  # T4 intra1
        DecoyOption("unrelated", "[T2 unrelated TBD]", False),
    ],
    "T3": [  # Tom → 苹果汁
        DecoyOption("target",    "苹果汁",              True),
        DecoyOption("intra1",    "烧烤架",              False),
        DecoyOption("intra2",    "蓝牙音箱",            False),
        DecoyOption("cross1",    "蛋糕盒子",            False),  # T1 intra2
        DecoyOption("cross2",    "纸箱",                False),  # T4 intra2
        DecoyOption("unrelated", "[T3 unrelated TBD]", False),
    ],
    "T4": [  # Delivery → 垃圾袋
        DecoyOption("target",    "垃圾袋",              True),
        DecoyOption("intra1",    "旧电池",              False),
        DecoyOption("intra2",    "纸箱",                False),
        DecoyOption("cross1",    "明信片",              False),  # T2 intra2
        DecoyOption("cross2",    "蓝牙音箱",            False),  # T3 intra2
        DecoyOption("unrelated", "[T4 unrelated TBD]", False),
    ],
}


# ──────────────────────────────────────────────
# Public accessors
# ──────────────────────────────────────────────

def get_task(task_id: str) -> PMTaskDef:
    """Return task definition by ID (T1–T4). Raises KeyError for unknown IDs."""
    return TASK_DEFINITIONS[task_id]


def get_decoys(task_id: str) -> list[DecoyOption]:
    """Return the 6 decoy options for the given task."""
    return TASK_DECOYS[task_id]


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
