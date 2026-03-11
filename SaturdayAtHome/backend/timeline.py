"""Block timeline engine — schedules SSE events per GDD §12.2."""

import asyncio
from typing import Callable, Coroutine


# Difficulty presets (durations in milliseconds for frontend)
DIFFICULTY_DURATIONS = {
    "slow":   {"cooking": 25000, "ready": 15000},
    "medium": {"cooking": 18000, "ready": 6000},
    "fast":   {"cooking": 12000, "ready": 6000},
}


def build_timeline(block_num: int, condition: str, difficulty: str = "medium") -> list[tuple[float, str, dict]]:
    """Build the event timeline for a block."""

    dur = DIFFICULTY_DURATIONS.get(difficulty, DIFFICULTY_DURATIONS["medium"])

    reminder_a_text = _get_reminder_text(condition, "A")
    reminder_b_text = _get_reminder_text(condition, "B")

    neutral_1 = "Smells good in the kitchen!"
    neutral_2 = "How's the party prep going?"

    timeline = [
        (0,    "block_start",        {"block_number": block_num, "condition": condition}),

        # Steak spawns (staggered)
        (5,    "steak_spawn",        {"hob_id": 0, "duration": dur}),
        (13,   "steak_spawn",        {"hob_id": 1, "duration": dur}),

        # Fake trigger
        (35,   "fake_trigger_fire",  {"type": "delivery"}),

        # Robot neutral #1
        (75,   "robot_neutral",      {"text": neutral_1}),

        # Force yellow 10s before Reminder A
        (110,  "force_yellow_steak", {"hob_id": 0}),

        # Reminder A
        (120,  "reminder_fire",      {"text": reminder_a_text, "slot": "A", "condition": condition}),

        # Trigger A
        (210,  "trigger_appear",     {"task_id": _get_task_a(block_num), "slot": "A"}),
        (240,  "window_close",       {"task_id": _get_task_a(block_num), "slot": "A"}),

        # New batch after Task A
        (260,  "steak_spawn",        {"hob_id": 2, "duration": dur}),

        # Robot neutral #2
        (270,  "robot_neutral",      {"text": neutral_2}),

        # Force yellow before Reminder B
        (290,  "force_yellow_steak", {"hob_id": 1}),

        # Reminder B
        (300,  "reminder_fire",      {"text": reminder_b_text, "slot": "B", "condition": condition}),

        # Trigger B
        (390,  "trigger_appear",     {"task_id": _get_task_b(block_num), "slot": "B"}),
        (420,  "window_close",       {"task_id": _get_task_b(block_num), "slot": "B"}),

        # Final steak batch
        (425,  "steak_spawn",        {"hob_id": 0, "duration": dur}),

        # Block end
        (510,  "block_end",          {"block_number": block_num}),
    ]

    # Message bubbles (avoid ±60s of reminders/triggers)
    timeline.extend([
        (55,   "message_bubble", {"text": "Hey! Are you still coming tonight?", "option_a": "Yes, definitely!", "option_b": "Maybe later"}),
        (170,  "message_bubble", {"text": "Should I bring anything for the party?", "option_a": "Some drinks!", "option_b": "Nothing, just yourself"}),
        (340,  "message_bubble", {"text": "What time should everyone arrive?", "option_a": "Around 7pm", "option_b": "Whenever you want"}),
    ])

    timeline.sort(key=lambda x: x[0])
    return timeline


def _get_reminder_text(condition: str, slot: str) -> str:
    texts = {
        "LowAF_LowCB":  "By the way, remember — after dinner today, take your medicine.",
        "HighAF_LowCB":  "By the way, remember — after dinner today, take your Doxycycline from the red round bottle, the one your cardiologist prescribed.",
        "LowAF_HighCB":  "I can see you're keeping an eye on the stove. By the way — after dinner today, remember to take your medicine.",
        "HighAF_HighCB": "I can see you're keeping an eye on the stove. By the way — after dinner today, take your Doxycycline from the red round bottle, the one your cardiologist prescribed.",
    }
    return texts.get(condition, "Remember your task.")


def _get_task_a(block_num: int) -> str:
    return {1: "medicine_a", 2: "laundry_c", 3: "comm_e", 4: "chores_g"}.get(block_num, "medicine_a")


def _get_task_b(block_num: int) -> str:
    return {1: "medicine_b", 2: "laundry_d", 3: "comm_f", 4: "chores_h"}.get(block_num, "medicine_b")


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
                await self.send_fn(self.session_id, event, data)
        except asyncio.CancelledError:
            pass

    def cancel(self):
        self._cancelled = True
        for t in self._tasks:
            if not t.done():
                t.cancel()
