"""Block event schedule generation (PRD v2.1).

Produces a deterministic, auditable, conflict-checked list of ScheduledEvents
for one experiment block.  Uses a seeded RNG so every run with the same seed
yields the same schedule — enabling replay and auditing.

New paradigm: three cognitive games (A=semantic_cat, B=go_nogo, C=trivia)
with daily-life visual skins.  PM execution is MCQ-based via sidebar trigger.

Usage:
    seed = derive_seed(session_id, block_num)
    events = generate_block_schedule(block_num, condition, seed)
"""

import hashlib
import logging
import random
from typing import List

from core.config_loader import (
    get_timeline_config, get_config,
    get_block_skins, get_room_label,
    get_block_pm_tasks, get_neutral_comments,
)
from core.event_schedule import EventType, ScheduledEvent

logger = logging.getLogger("saturday.block_scheduler")

# Minimum gap between neutral comments
_NEUTRAL_COMMENT_MIN_GAP_S = 30.0


# ── Helpers ──────────────────────────────────────────────────────────────────

def derive_seed(session_id: str, block_num: int) -> int:
    """Deterministic seed from session + block, reproducible across restarts."""
    raw = hashlib.md5(f"{session_id}:{block_num}".encode()).hexdigest()[:8]
    return int(raw, 16)


def _jitter(rng: random.Random, base: float, half: float) -> float:
    """Return base ± uniform(half)."""
    return base + rng.uniform(-half, half)


# ── Main schedule generator ──────────────────────────────────────────────────

def generate_block_schedule(
    block_num: int, condition: str, seed: int
) -> List[ScheduledEvent]:
    """Return a sorted, conflict-resolved list of ScheduledEvents for one block.

    Schedule structure (PRD §4.4):
    - Block start → Game A → transition → Game B → transition → Game C → block end
    - PM slot A: reminder at 60s, trigger at 150s, window close at 180s
    - PM slot B: reminder at 270s, trigger at 360s, window close at 390s
    - Neutral comments (jittered) at ~30s, ~300s, ~450s
    - Ambient pulses (jittered noise events)
    """
    rng = random.Random(seed)
    tc = get_timeline_config()
    cfg = get_config()

    duration = float(tc.get("block_duration_s", 510))
    exec_window_ms = int(cfg.get("execution_window_ms", 30000))

    # Game segment timings
    game_a = tc.get("game_a", {})
    game_b = tc.get("game_b", {})
    game_c = tc.get("game_c", {})
    trans_ab = tc.get("transition_ab", {})
    trans_bc = tc.get("transition_bc", {})

    # PM slot timings
    pm_a = tc.get("pm_slot_a", {})
    pm_b = tc.get("pm_slot_b", {})

    # Block skins
    skins = get_block_skins(block_num)
    skin_a = skins.get("game_a", "email_v1")
    skin_b = skins.get("game_b", "grocery_v1")
    skin_c = skins.get("game_c", "podcast_v1")

    # PM tasks for this block
    pm_tasks = get_block_pm_tasks(block_num)
    task_a = pm_tasks[0] if len(pm_tasks) > 0 else None
    task_b = pm_tasks[1] if len(pm_tasks) > 1 else None

    task_a_id = task_a["task_id"] if task_a else "unknown_a"
    task_b_id = task_b["task_id"] if task_b else "unknown_b"

    # Reminder text based on condition
    reminder_text_a = ""
    reminder_text_b = ""
    if task_a:
        reminder_text_a = task_a.get("reminders", {}).get(condition, "Remember your task.")
    if task_b:
        reminder_text_b = task_b.get("reminders", {}).get(condition, "Remember your task.")

    # Room labels
    room_a = get_room_label(skin_a)
    room_b = get_room_label(skin_b)
    room_c = get_room_label(skin_c)

    events: List[ScheduledEvent] = []

    # ── Block start ──────────────────────────────────────────────────────
    events.append(ScheduledEvent(
        event_type=EventType.BLOCK_START, t=0.0,
        payload={
            "block_number": block_num, "condition": condition,
            "skins": skins,
        },
    ))

    # ── Game A ───────────────────────────────────────────────────────────
    events.append(ScheduledEvent(
        event_type=EventType.GAME_START,
        t=float(game_a.get("start_s", 0)),
        payload={
            "game_slot": "A",
            "game_type": game_a.get("type", "semantic_cat"),
            "skin": skin_a,
            "room": room_a,
        },
    ))
    events.append(ScheduledEvent(
        event_type=EventType.GAME_END,
        t=float(game_a.get("end_s", 180)),
        payload={"game_slot": "A", "skin": skin_a},
    ))

    # ── Transition A→B ───────────────────────────────────────────────────
    events.append(ScheduledEvent(
        event_type=EventType.ROOM_TRANSITION,
        t=float(trans_ab.get("start_s", 180)),
        payload={
            "from_room": room_a.get("room", ""),
            "to_room": room_b.get("room", ""),
        },
    ))

    # ── Game B ───────────────────────────────────────────────────────────
    events.append(ScheduledEvent(
        event_type=EventType.GAME_START,
        t=float(game_b.get("start_s", 210)),
        payload={
            "game_slot": "B",
            "game_type": game_b.get("type", "go_nogo"),
            "skin": skin_b,
            "room": room_b,
        },
    ))
    events.append(ScheduledEvent(
        event_type=EventType.GAME_END,
        t=float(game_b.get("end_s", 390)),
        payload={"game_slot": "B", "skin": skin_b},
    ))

    # ── Transition B→C ───────────────────────────────────────────────────
    events.append(ScheduledEvent(
        event_type=EventType.ROOM_TRANSITION,
        t=float(trans_bc.get("start_s", 390)),
        payload={
            "from_room": room_b.get("room", ""),
            "to_room": room_c.get("room", ""),
        },
    ))

    # ── Game C ───────────────────────────────────────────────────────────
    events.append(ScheduledEvent(
        event_type=EventType.GAME_START,
        t=float(game_c.get("start_s", 420)),
        payload={
            "game_slot": "C",
            "game_type": game_c.get("type", "trivia"),
            "skin": skin_c,
            "room": room_c,
        },
    ))
    events.append(ScheduledEvent(
        event_type=EventType.GAME_END,
        t=float(game_c.get("end_s", 480)),
        payload={"game_slot": "C", "skin": skin_c},
    ))

    # ── PM slot A ────────────────────────────────────────────────────────
    events.append(ScheduledEvent(
        event_type=EventType.REMINDER_FIRE,
        t=float(pm_a.get("reminder_s", 60)),
        payload={
            "text": reminder_text_a, "slot": "A",
            "task_id": task_a_id, "condition": condition,
            "activity_context": room_a.get("activity", ""),
        },
    ))
    events.append(ScheduledEvent(
        event_type=EventType.TRIGGER_FIRE,
        t=float(pm_a.get("trigger_s", 150)),
        payload={
            "task_id": task_a_id, "slot": "A",
            "window_ms": exec_window_ms,
            "trigger": task_a.get("trigger", {}) if task_a else {},
            "block_number": block_num, "condition": condition,
        },
    ))
    events.append(ScheduledEvent(
        event_type=EventType.WINDOW_CLOSE,
        t=float(pm_a.get("window_close_s", 180)),
        payload={
            "task_id": task_a_id, "slot": "A",
            "block_number": block_num, "condition": condition,
        },
    ))

    # ── PM slot B ────────────────────────────────────────────────────────
    events.append(ScheduledEvent(
        event_type=EventType.REMINDER_FIRE,
        t=float(pm_b.get("reminder_s", 270)),
        payload={
            "text": reminder_text_b, "slot": "B",
            "task_id": task_b_id, "condition": condition,
            "activity_context": room_b.get("activity", ""),
        },
    ))
    events.append(ScheduledEvent(
        event_type=EventType.TRIGGER_FIRE,
        t=float(pm_b.get("trigger_s", 360)),
        payload={
            "task_id": task_b_id, "slot": "B",
            "window_ms": exec_window_ms,
            "trigger": task_b.get("trigger", {}) if task_b else {},
            "block_number": block_num, "condition": condition,
        },
    ))
    events.append(ScheduledEvent(
        event_type=EventType.WINDOW_CLOSE,
        t=float(pm_b.get("window_close_s", 390)),
        payload={
            "task_id": task_b_id, "slot": "B",
            "block_number": block_num, "condition": condition,
        },
    ))

    # ── Block end ────────────────────────────────────────────────────────
    events.append(ScheduledEvent(
        event_type=EventType.BLOCK_END, t=duration,
        payload={"block_number": block_num},
    ))

    # ── Floating events: neutral comments (seeded jitter) ────────────────
    neutral_cfg = tc.get("neutral_comments", [])
    for idx, nc in enumerate(neutral_cfg):
        base = float(nc.get("base_s", 30))
        jit = float(nc.get("jitter_s", 5))
        t = _jitter(rng, base, jit)

        # Pick a comment text from data file based on current game skin
        if t < float(game_a.get("end_s", 180)):
            comments = get_neutral_comments(skin_a)
        elif t < float(game_b.get("end_s", 390)):
            comments = get_neutral_comments(skin_b)
        else:
            comments = get_neutral_comments(skin_c)

        text = comments[idx % len(comments)] if comments else ""

        events.append(ScheduledEvent(
            event_type=EventType.ROBOT_NEUTRAL,
            t=t,
            payload={"text": text, "idx": idx},
            is_fixed=False,
        ))

    # ── Floating events: ambient pulses ──────────────────────────────────
    ambient_cfg = tc.get("ambient_pulses", [])
    for idx, ap in enumerate(ambient_cfg):
        base = float(ap.get("base_s", 100))
        jit = float(ap.get("jitter_s", 10))
        icon = ap.get("icon", "bell")
        events.append(ScheduledEvent(
            event_type=EventType.AMBIENT_PULSE,
            t=_jitter(rng, base, jit),
            payload={"icon": icon, "idx": idx},
            is_fixed=False,
        ))

    # ── Conflict resolution ──────────────────────────────────────────────
    # Ensure neutral comments are spaced apart
    neutrals = sorted(
        [e for e in events if e.event_type == EventType.ROBOT_NEUTRAL],
        key=lambda e: e.t,
    )
    for i in range(1, len(neutrals)):
        if neutrals[i].t - neutrals[i - 1].t < _NEUTRAL_COMMENT_MIN_GAP_S:
            neutrals[i].t = neutrals[i - 1].t + _NEUTRAL_COMMENT_MIN_GAP_S
            logger.debug(f"Neutral comment {i} shifted to {neutrals[i].t:.1f}s for min gap")

    events.sort(key=lambda e: e.t)
    logger.info(
        f"Block {block_num} schedule generated: {len(events)} events "
        f"(seed={seed}, condition={condition})"
    )

    # ── Pre-create pm_trials rows for scoring later ──────────────────────
    _precreate_pm_trials(block_num, condition, task_a, task_b,
                         reminder_text_a, reminder_text_b,
                         room_a, room_b, pm_a, pm_b)

    return events


def _precreate_pm_trials(
    block_num: int, condition: str,
    task_a: dict | None, task_b: dict | None,
    reminder_text_a: str, reminder_text_b: str,
    room_a: dict, room_b: dict,
    pm_a: dict, pm_b: dict,
):
    """Pre-create pm_trials rows so trigger_click/mcq_answer can UPDATE them.

    This is called during schedule generation; the actual session_id is not
    available here so we defer to when the timeline runs.
    """
    # The actual DB writes happen in timeline.py when the block starts,
    # because only then do we know the session_id.
    pass
