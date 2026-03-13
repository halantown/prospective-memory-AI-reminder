"""Block event schedule generation.

Produces a deterministic, auditable, conflict-checked list of ScheduledEvents
for one experiment block.  Uses a seeded RNG so every run with the same seed
yields the same schedule — enabling replay and auditing.

Usage:
    seed = derive_seed(session_id, block_num)
    events = generate_block_schedule(block_num, condition, seed)
"""

import logging
import random
from typing import List

from core.config_loader import get_timeline_config, get_task_pairs, get_reminder_texts, get_config
from core.event_schedule import EventType, ScheduledEvent

logger = logging.getLogger("saturday.block_scheduler")


# ── Conflict-detection thresholds ───────────────────────────────────────────

# FORCE_STEAK_READY must not fall within this many seconds before a trigger window
_FORCE_STEAK_TRIGGER_GUARD_S = 5.0
# FAKE_TRIGGER must not be within this many seconds of a reminder
_FAKE_TRIGGER_REMINDER_GUARD_S = 10.0
# Minimum gap between the two NEUTRAL_COMMENT events
_NEUTRAL_COMMENT_MIN_GAP_S = 30.0


# ── Helpers ──────────────────────────────────────────────────────────────────

def derive_seed(session_id: str, block_num: int) -> int:
    """Deterministic seed from session + block, reproducible across restarts."""
    import hashlib
    raw = hashlib.md5(f"{session_id}:{block_num}".encode()).hexdigest()[:8]
    return int(raw, 16)


def _jitter(rng: random.Random, base: float, half: float) -> float:
    """Return base ± uniform(half)."""
    return base + rng.uniform(-half, half)


# ── Conflict detection ───────────────────────────────────────────────────────

def resolve_conflicts(events: List[ScheduledEvent], ev: dict) -> List[ScheduledEvent]:
    """Shift floating events that violate busy-window rules.

    Rules (only applied to is_fixed=False events):
    1. FORCE_STEAK_READY must not overlap [trigger_open - guard, trigger_close].
       If it does, push it to trigger_open - guard - 1s.
    2. FAKE_TRIGGER must not be within guard seconds of any REMINDER.
       If it is, push it to reminder_t - guard - 2s.
    3. The two NEUTRAL_COMMENTs must be at least 30s apart.
       If not, push the later one forward.
    """
    trigger_windows = [
        (float(ev.get("trigger_a_appear_s", 210)), float(ev.get("trigger_a_close_s", 240))),
        (float(ev.get("trigger_b_appear_s", 390)), float(ev.get("trigger_b_close_s", 420))),
    ]
    reminder_times = [
        float(ev.get("reminder_a_s", 120)),
        float(ev.get("reminder_b_s", 300)),
    ]
    conflicts = 0

    for e in events:
        if e.is_fixed:
            continue

        if e.event_type == EventType.FORCE_STEAK_READY:
            for w_open, w_close in trigger_windows:
                if w_open - _FORCE_STEAK_TRIGGER_GUARD_S <= e.t <= w_close:
                    new_t = w_open - _FORCE_STEAK_TRIGGER_GUARD_S - 1.0
                    logger.debug(
                        f"Conflict: FORCE_STEAK_READY at {e.t:.1f}s → rescheduled to {new_t:.1f}s"
                        f" (trigger window [{w_open}, {w_close}])"
                    )
                    e.t = new_t
                    conflicts += 1

        elif e.event_type == EventType.FAKE_TRIGGER:
            for rt in reminder_times:
                if abs(e.t - rt) < _FAKE_TRIGGER_REMINDER_GUARD_S:
                    new_t = rt - _FAKE_TRIGGER_REMINDER_GUARD_S - 2.0
                    logger.debug(
                        f"Conflict: FAKE_TRIGGER at {e.t:.1f}s → rescheduled to {new_t:.1f}s"
                        f" (reminder at {rt:.1f}s)"
                    )
                    e.t = new_t
                    conflicts += 1

    # Neutral comment minimum gap
    neutrals = sorted(
        [e for e in events if e.event_type == EventType.NEUTRAL_COMMENT],
        key=lambda e: e.t,
    )
    if len(neutrals) >= 2 and neutrals[1].t - neutrals[0].t < _NEUTRAL_COMMENT_MIN_GAP_S:
        old_t = neutrals[1].t
        neutrals[1].t = neutrals[0].t + _NEUTRAL_COMMENT_MIN_GAP_S
        logger.debug(
            f"Conflict: NEUTRAL_COMMENT gap too small "
            f"({old_t:.1f}s → {neutrals[1].t:.1f}s)"
        )
        conflicts += 1

    if conflicts:
        logger.info(f"resolve_conflicts: {conflicts} conflict(s) resolved")

    events.sort(key=lambda e: e.t)
    return events


# ── Main schedule generator ──────────────────────────────────────────────────

def generate_block_schedule(block_num: int, condition: str, seed: int) -> List[ScheduledEvent]:
    """Return a sorted, conflict-resolved list of ScheduledEvents for one block.

    All floating event times are drawn from a seeded RNG — same seed → same
    schedule, enabling full replay and audit via the block_events DB table.

    Steak spawns, message bubbles, and plant events are appended here too so
    the returned list represents the *complete* block timeline.
    """
    rng = random.Random(seed)
    tc = get_timeline_config()
    ev = tc.get("events", {})
    task_pairs = get_task_pairs()
    reminder_texts = get_reminder_texts()
    neutrals = tc.get("neutral_comments", ["", ""])
    duration = float(tc.get("block_duration_s", 510))
    exec_window_ms = 30000

    pair = task_pairs.get(block_num, ["medicine_a", "medicine_b"])
    task_a, task_b = pair[0], pair[1]
    # Support both new per-slot format {A: ..., B: ...} and legacy flat string
    cond_texts = reminder_texts.get(condition, {})
    if isinstance(cond_texts, dict):
        reminder_text_a = cond_texts.get("A", "Remember your task.")
        reminder_text_b = cond_texts.get("B", "Remember your task.")
    else:
        reminder_text_a = reminder_text_b = cond_texts or "Remember your task."

    events: List[ScheduledEvent] = []

    # ── Fixed PM events ──────────────────────────────────────────────────
    events.append(ScheduledEvent(
        event_type=EventType.BLOCK_START, t=0.0,
        payload={"block_number": block_num, "condition": condition},
    ))
    events.append(ScheduledEvent(
        event_type=EventType.REMINDER,
        t=float(ev.get("reminder_a_s", 120)),
        payload={"text": reminder_text_a, "slot": "A", "condition": condition},
    ))
    events.append(ScheduledEvent(
        event_type=EventType.TRIGGER_WINDOW_OPEN,
        t=float(ev.get("trigger_a_appear_s", 210)),
        payload={"task_id": task_a, "slot": "A", "window_ms": exec_window_ms},
    ))
    events.append(ScheduledEvent(
        event_type=EventType.TRIGGER_WINDOW_CLOSE,
        t=float(ev.get("trigger_a_close_s", 240)),
        payload={"task_id": task_a, "slot": "A"},
    ))
    events.append(ScheduledEvent(
        event_type=EventType.REMINDER,
        t=float(ev.get("reminder_b_s", 300)),
        payload={"text": reminder_text_b, "slot": "B", "condition": condition},
    ))
    events.append(ScheduledEvent(
        event_type=EventType.TRIGGER_WINDOW_OPEN,
        t=float(ev.get("trigger_b_appear_s", 390)),
        payload={"task_id": task_b, "slot": "B", "window_ms": exec_window_ms},
    ))
    events.append(ScheduledEvent(
        event_type=EventType.TRIGGER_WINDOW_CLOSE,
        t=float(ev.get("trigger_b_close_s", 420)),
        payload={"task_id": task_b, "slot": "B"},
    ))
    events.append(ScheduledEvent(
        event_type=EventType.BLOCK_END, t=duration,
        payload={"block_number": block_num},
    ))

    # ── Floating experiment events (seeded jitter) ───────────────────────
    ft_base  = float(ev.get("fake_trigger_s", 35))
    ft_half  = float(ev.get("fake_trigger_jitter_s", 8))
    events.append(ScheduledEvent(
        event_type=EventType.FAKE_TRIGGER,
        t=_jitter(rng, ft_base, ft_half),
        payload={"type": "delivery"},
        is_fixed=False,
    ))

    n1_base = float(ev.get("robot_neutral_1_s", 75))
    n1_half = float(ev.get("robot_neutral_1_jitter_s", 12))
    events.append(ScheduledEvent(
        event_type=EventType.NEUTRAL_COMMENT,
        t=_jitter(rng, n1_base, n1_half),
        payload={"text": neutrals[0] if neutrals else "", "idx": 0},
        is_fixed=False,
    ))

    fy1_base = float(ev.get("force_yellow_1_s", 95))
    fy1_half = float(ev.get("force_yellow_1_jitter_s", 8))
    events.append(ScheduledEvent(
        event_type=EventType.FORCE_STEAK_READY,
        t=_jitter(rng, fy1_base, fy1_half),
        payload={"hob_id": ev.get("force_yellow_1_hob", 0), "idx": 0},
        is_fixed=False,
    ))

    n2_base = float(ev.get("robot_neutral_2_s", 270))
    n2_half = float(ev.get("robot_neutral_2_jitter_s", 12))
    events.append(ScheduledEvent(
        event_type=EventType.NEUTRAL_COMMENT,
        t=_jitter(rng, n2_base, n2_half),
        payload={"text": neutrals[1] if len(neutrals) > 1 else "", "idx": 1},
        is_fixed=False,
    ))

    fy2_base = float(ev.get("force_yellow_2_s", 275))
    fy2_half = float(ev.get("force_yellow_2_jitter_s", 8))
    events.append(ScheduledEvent(
        event_type=EventType.FORCE_STEAK_READY,
        t=_jitter(rng, fy2_base, fy2_half),
        payload={"hob_id": ev.get("force_yellow_2_hob", 1), "idx": 1},
        is_fixed=False,
    ))

    # ── Conflict detection ───────────────────────────────────────────────
    events.sort(key=lambda e: e.t)
    events = resolve_conflicts(events, ev)

    # ── Ongoing-task events (steak spawns, messages, plant) ─────────────
    # These use the same seeded RNG so the full schedule is reproducible.
    events.extend(_gen_steak_spawns(rng, tc, duration))
    events.extend(_gen_messages(tc))
    events.extend(_gen_plant_water(rng, tc, duration))

    events.sort(key=lambda e: e.t)
    logger.info(
        f"Block {block_num} schedule generated: {len(events)} events "
        f"(seed={seed}, condition={condition})"
    )
    return events


# ── Sub-generators ───────────────────────────────────────────────────────────

def _gen_steak_spawns(rng: random.Random, tc: dict, end_s: float) -> List[ScheduledEvent]:
    steak_cfg = get_config().get("steak", {})
    base_times = steak_cfg.get("hob_base_cooking_ms", [11000, 13000, 15000])
    jitter = steak_cfg.get("cooking_jitter_ms", 1000)
    ready_ms = steak_cfg.get("ready_ms", 4000)

    ss = tc.get("steak_spawn", {})
    t = float(ss.get("start_s", 3))
    spawn_end = float(ss.get("end_s", 490))
    imin = int(ss.get("interval_min_s", 8))
    imax = int(ss.get("interval_max_s", 15))

    out: List[ScheduledEvent] = []
    hob_cycle = 0
    while t < spawn_end:
        hob_id = hob_cycle % 3
        base = base_times[hob_id] if hob_id < len(base_times) else 13000
        cooking = base + rng.randint(-jitter, jitter)
        out.append(ScheduledEvent(
            event_type=EventType.STEAK_SPAWN, t=t,
            payload={"hob_id": hob_id, "duration": {"cooking": cooking, "ready": ready_ms}},
            is_fixed=False,
        ))
        hob_cycle += 1
        t += rng.randint(imin, imax)
    return out


def _gen_messages(tc: dict) -> List[ScheduledEvent]:
    out: List[ScheduledEvent] = []
    for msg in tc.get("messages", []):
        out.append(ScheduledEvent(
            event_type=EventType.MESSAGE_BUBBLE,
            t=float(msg["time_s"]),
            payload={
                "from":    msg.get("from", "Unknown"),
                "subject": msg.get("subject", ""),
                "body":    msg.get("body", ""),
                "options": msg.get("options", ["OK", "Skip", "Later"]),
                "correct": msg.get("correct", 0),
                "avatar":  msg.get("avatar", "?"),
            },
        ))
    return out


def _gen_plant_water(rng: random.Random, tc: dict, end_s: float) -> List[ScheduledEvent]:
    pw = tc.get("plant_water", {})
    start = float(pw.get("start_s", 45))
    jitter = float(pw.get("start_jitter_s", 15))
    pw_min = int(pw.get("interval_min_s", 40))
    pw_max = int(pw.get("interval_max_s", 60))

    spawn_end = float(tc.get("steak_spawn", {}).get("end_s", 490))
    t = start + rng.uniform(0, jitter)
    out: List[ScheduledEvent] = []
    while t < spawn_end:
        out.append(ScheduledEvent(
            event_type=EventType.PLANT_NEEDS_WATER, t=t, payload={}, is_fixed=False,
        ))
        t += rng.randint(pw_min, pw_max)
    return out
