"""Block timeline engine — schedules SSE events per GDD §12.2."""

import asyncio
import logging
import random
from typing import Callable, Coroutine

from core.config_loader import get_timeline_config, get_difficulty, get_task_pairs, get_reminder_texts, get_config

logger = logging.getLogger("saturday.timeline")


def build_timeline(block_num: int, condition: str, difficulty: str = "medium") -> list[tuple[float, str, dict]]:
    """Build the event timeline for a block.  All timings come from game_config.yaml."""

    tc = get_timeline_config()
    ev = tc.get("events", {})
    task_pairs = get_task_pairs()
    reminder_texts = get_reminder_texts()
    neutrals = tc.get("neutral_comments", ["", ""])
    exec_window_ms = 30000

    task_a = task_pairs.get(block_num, ["medicine_a", "medicine_b"])[0]
    task_b = task_pairs.get(block_num, ["medicine_a", "medicine_b"])[1]
    reminder_a_text = reminder_texts.get(condition, "Remember your task.")
    reminder_b_text = reminder_texts.get(condition, "Remember your task.")

    timeline = [
        (0, "block_start", {"block_number": block_num, "condition": condition}),

        # Fake trigger
        (ev.get("fake_trigger_s", 35), "fake_trigger_fire", {"type": "delivery"}),

        # Robot neutral #1
        (ev.get("robot_neutral_1_s", 75), "robot_neutral", {"text": neutrals[0] if neutrals else ""}),

        # Force yellow before Reminder A
        (ev.get("force_yellow_1_s", 95), "force_yellow_steak", {"hob_id": ev.get("force_yellow_1_hob", 0)}),

        # Reminder A
        (ev.get("reminder_a_s", 120), "reminder_fire", {"text": reminder_a_text, "slot": "A", "condition": condition}),

        # Trigger A
        (ev.get("trigger_a_appear_s", 210), "trigger_appear", {"task_id": task_a, "slot": "A", "window_ms": exec_window_ms}),
        (ev.get("trigger_a_close_s", 240), "window_close", {"task_id": task_a, "slot": "A"}),

        # Robot neutral #2
        (ev.get("robot_neutral_2_s", 270), "robot_neutral", {"text": neutrals[1] if len(neutrals) > 1 else ""}),

        # Force yellow before Reminder B
        (ev.get("force_yellow_2_s", 275), "force_yellow_steak", {"hob_id": ev.get("force_yellow_2_hob", 1)}),

        # Reminder B
        (ev.get("reminder_b_s", 300), "reminder_fire", {"text": reminder_b_text, "slot": "B", "condition": condition}),

        # Trigger B
        (ev.get("trigger_b_appear_s", 390), "trigger_appear", {"task_id": task_b, "slot": "B", "window_ms": exec_window_ms}),
        (ev.get("trigger_b_close_s", 420), "window_close", {"task_id": task_b, "slot": "B"}),

        # Block end
        (tc.get("block_duration_s", 510), "block_end", {"block_number": block_num}),
    ]

    # Steak spawns — per-hob cooking times
    steak_cfg = get_config().get("steak", {})
    base_times = steak_cfg.get("hob_base_cooking_ms", [11000, 13000, 15000])
    jitter = steak_cfg.get("cooking_jitter_ms", 1000)
    ready_ms = steak_cfg.get("ready_ms", 4000)

    ss = tc.get("steak_spawn", {})
    t = ss.get("start_s", 3)
    end_s = ss.get("end_s", 490)
    imin = ss.get("interval_min_s", 8)
    imax = ss.get("interval_max_s", 15)
    hob_cycle = 0
    while t < end_s:
        hob_id = hob_cycle % 3
        base_cooking = base_times[hob_id] if hob_id < len(base_times) else 13000
        cooking = base_cooking + random.randint(-jitter, jitter)
        dur = {"cooking": cooking, "ready": ready_ms}
        timeline.append((t, "steak_spawn", {"hob_id": hob_id, "duration": dur}))
        hob_cycle += 1
        t += random.randint(imin, imax)

    # Message bubbles from config (3-option format)
    for msg in tc.get("messages", []):
        timeline.append((msg["time_s"], "message_bubble", {
            "from": msg.get("from", "Unknown"),
            "subject": msg.get("subject", ""),
            "body": msg.get("body", ""),
            "options": msg.get("options", ["OK", "Skip", "Later"]),
            "correct": msg.get("correct", 0),
            "avatar": msg.get("avatar", "?"),
        }))

    # Plant needs water
    pw = tc.get("plant_water", {})
    plant_t = pw.get("start_s", 60) + random.randint(0, pw.get("start_jitter_s", 30))
    pw_min = pw.get("interval_min_s", 60)
    pw_max = pw.get("interval_max_s", 90)
    while plant_t < end_s:
        timeline.append((plant_t, "plant_needs_water", {}))
        plant_t += random.randint(pw_min, pw_max)

    timeline.sort(key=lambda x: x[0])
    return timeline


class BlockTimeline:
    """Manages the async execution of a block's event timeline."""

    def __init__(self, session_id: str, block_num: int, condition: str,
                 send_fn: Callable[..., Coroutine], difficulty: str = "medium"):
        self.session_id = session_id
        self.block_num = block_num
        self.condition = condition
        self.send_fn = send_fn
        self.timeline = build_timeline(block_num, condition, difficulty)
        self._tasks: list[asyncio.Task] = []
        self._cancelled = False

    async def run(self):
        for delay, event, data in self.timeline:
            if self._cancelled:
                break
            task = asyncio.create_task(self._fire_after(delay, event, data))
            self._tasks.append(task)
        await asyncio.gather(*self._tasks, return_exceptions=True)

    async def _fire_after(self, delay: float, event: str, data: dict):
        try:
            await asyncio.sleep(delay)
            if not self._cancelled:
                logger.info(f"Timeline [{self.session_id}] t={delay}s → {event}")
                await self.send_fn(self.session_id, event, data)
        except asyncio.CancelledError:
            pass

    def cancel(self):
        self._cancelled = True
        for t in self._tasks:
            if not t.done():
                t.cancel()
