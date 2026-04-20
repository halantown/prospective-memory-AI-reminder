"""
Block Timeline Generator — builds per-participant timeline JSON.

Generates a complete block timeline with PM triggers, reminders, neutral
utterances, fake triggers, and ongoing task events properly spaced according
to the experimental design rules.
"""

import json
import random
from pathlib import Path
from engine.pm_tasks import (
    get_task,
    get_task_config,
    get_tasks_for_block,
    BLOCK_TRIGGER_ORDER,
    BLOCK_TRIGGER_TIMES,
    BLOCK_GUESTS,
    ACTIVITY_WATCH_CONFIG,
    NEUTRAL_UTTERANCES,
    PMTaskDef,
)
from config import REMINDER_LEAD_S, MESSAGE_COOLDOWN_S, COOKING_TOTAL_DURATION_S

# Fake trigger definitions per block
_FAKE_TRIGGERS: dict[int, list[dict]] = {
    1: [
        {"type": "fake_trigger", "trigger_type": "visitor",
         "content": "Courier drops off a flyer, leaves immediately", "duration": 5},
    ],
    2: [
        {"type": "fake_trigger", "trigger_type": "appliance",
         "content": "Microwave beeps briefly — nothing to do", "duration": 3},
    ],
    3: [
        {"type": "fake_trigger", "trigger_type": "visitor",
         "content": "Neighbor waves hello through the window", "duration": 4},
    ],
}


def generate_block_timeline(
    block_number: int,
    condition: str,
    unreminded_task_id: str | None,
    af_variant_index: int = 0,
) -> dict:
    """Generate a complete block timeline JSON.

    Args:
        block_number: 1, 2, or 3
        condition: "CONTROL", "AF", or "AFCB"
        unreminded_task_id: task_id of the unreminded trial (None for CONTROL)
        af_variant_index: participant's variant index for AF/AFCB reminders

    Returns:
        Timeline dict compatible with the existing timeline engine.
    """
    guest = BLOCK_GUESTS[block_number]
    trigger_order = BLOCK_TRIGGER_ORDER[block_number]
    events: list[dict] = []

    # ── Block start ──
    events.append({"t": 0, "type": "block_start", "data": {}})

    # ── Cooking events are now driven by CookingEngine (started via game_handler).
    #    No steak/dining events are generated here. The CookingEngine runs its own
    #    timeline in parallel and emits ongoing_task_event messages directly. ──

    # ── PM reminders + triggers ──
    for task_id in trigger_order:
        task_def = get_task(task_id)

        if task_def.trigger_type == "activity":
            # Activity trigger: watch for game state condition
            watch_cfg = ACTIVITY_WATCH_CONFIG[task_id]
            events.append({
                "t": watch_cfg["watch_from"],
                "type": "pm_watch_activity",
                "data": {
                    "task_id": task_id,
                    "watch_condition": watch_cfg["condition"],
                    "fallback_time": watch_cfg["fallback"],
                },
            })
            trigger_time = watch_cfg["fallback"]  # for reminder timing calc
        else:
            # Fixed-time trigger
            trigger_time = BLOCK_TRIGGER_TIMES[block_number][task_id]
            events.append({
                "t": trigger_time,
                "type": "pm_trigger",
                "data": {
                    "trigger_id": task_id,
                    "trigger_event": task_def.trigger_visual,
                    "trigger_type": task_def.trigger_type,
                    "task_id": task_id,
                    "signal": {
                        "audio": task_def.trigger_audio,
                        "visual": task_def.trigger_visual,
                    },
                    "task_config": get_task_config(task_id),
                },
            })

        # Reminder: fires ~REMINDER_LEAD_S before trigger (skip for unreminded / CONTROL)
        is_reminded = (
            condition != "CONTROL"
            and task_id != unreminded_task_id
        )
        if is_reminded:
            reminder_time = max(60, trigger_time - REMINDER_LEAD_S)
            # Ensure reminder fires strictly before its trigger
            if reminder_time >= trigger_time:
                reminder_time = max(1, trigger_time - 5)
            events.append({
                "t": reminder_time,
                "type": "robot_speak",
                "data": {
                    "text": f"{{{{reminder:{task_id}}}}}",
                    "log_tag": "reminder",
                    "task_id": task_id,
                    "condition": condition,
                },
            })

        # PM triggers are now handled as phone calls (separate UI), not phone messages

    # ── Neutral robot utterances ──
    utterances = list(NEUTRAL_UTTERANCES[block_number])
    # Place at roughly even intervals, avoiding ±20s of triggers
    trigger_times_set = set()
    for task_id in trigger_order:
        if task_id in BLOCK_TRIGGER_TIMES.get(block_number, {}):
            trigger_times_set.add(BLOCK_TRIGGER_TIMES[block_number][task_id])
        if task_id in ACTIVITY_WATCH_CONFIG:
            trigger_times_set.add(ACTIVITY_WATCH_CONFIG[task_id]["fallback"])

    neutral_times = [45, 150, 260, 470]  # default placement
    for i, utt in enumerate(utterances):
        t = neutral_times[i] if i < len(neutral_times) else 100 + i * 120
        events.append({
            "t": t,
            "type": "robot_speak",
            "data": {"text": utt, "log_tag": "neutral"},
        })

    # ── Fake triggers ──
    for fake in _FAKE_TRIGGERS.get(block_number, []):
        # Place 30s before first real trigger to set expectations
        first_trigger_time = min(trigger_times_set) if trigger_times_set else 200
        fake_time = max(90, first_trigger_time - 45)
        events.append({
            "t": fake_time,
            "type": "fake_trigger",
            "data": {
                "trigger_type": fake["trigger_type"],
                "content": fake["content"],
                "duration": fake["duration"],
            },
        })

    # ── Phone messages (from message pool JSON) ──
    # Load actual message IDs and times from the pool file
    messages_path = Path(__file__).parent.parent / "data" / "messages" / f"messages_day{block_number}.json"
    if not messages_path.exists():
        messages_path = Path(__file__).parent.parent / "data" / "messages" / "messages_day1.json"

    if messages_path.exists():
        with open(messages_path) as f:
            msg_data = json.load(f)

        msg_events: list[dict] = []
        # Load from chats array
        for msg in msg_data.get("chats", []):
            msg_id = msg.get("id", "")
            msg_t = msg.get("t", 0)
            if msg_id:
                msg_events.append({
                    "t": msg_t,
                    "type": "phone_message",
                    "data": {"message_id": msg_id},
                })
        # Load from notifications array
        for msg in msg_data.get("notifications", []):
            msg_id = msg.get("id", "")
            msg_t = msg.get("t", 0)
            if msg_id:
                msg_events.append({
                    "t": msg_t,
                    "type": "phone_message",
                    "data": {"message_id": msg_id},
                })

        # Enforce minimum cooldown between consecutive messages
        if MESSAGE_COOLDOWN_S > 0 and len(msg_events) > 1:
            msg_events.sort(key=lambda e: e["t"])
            for i in range(1, len(msg_events)):
                gap = msg_events[i]["t"] - msg_events[i - 1]["t"]
                if gap < MESSAGE_COOLDOWN_S:
                    msg_events[i]["t"] = msg_events[i - 1]["t"] + MESSAGE_COOLDOWN_S

        # Cap message times to stay within block duration
        for msg_event in msg_events:
            if msg_event["t"] >= COOKING_TOTAL_DURATION_S:
                msg_event["t"] = COOKING_TOTAL_DURATION_S - 1

        events.extend(msg_events)

    # ── Block end ──
    events.append({"t": COOKING_TOTAL_DURATION_S, "type": "block_end", "data": {}})

    # Sort by time, then by type priority (block_start first, block_end last)
    type_priority = {"block_start": 0, "block_end": 99}
    events.sort(key=lambda e: (e["t"], type_priority.get(e["type"], 50)))

    return {
        "block_number": block_number,
        "condition": condition,
        "guest": guest,
        "day_story": f"Day {block_number}: Cooking dinner for {guest}",
        "duration_seconds": COOKING_TOTAL_DURATION_S,
        "events": events,
    }
