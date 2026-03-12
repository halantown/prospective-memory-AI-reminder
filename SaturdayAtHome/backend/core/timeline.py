"""Block timeline engine — schedules SSE events per GDD §12.2."""

import asyncio
import logging
from typing import Callable, Coroutine

logger = logging.getLogger("saturday.timeline")


# Difficulty presets (durations in milliseconds for frontend)
DIFFICULTY_DURATIONS = {
    "slow":   {"cooking": 20000, "ready": 5000},
    "medium": {"cooking": 13000, "ready": 4000},
    "fast":   {"cooking": 9000,  "ready": 3000},
}


def build_timeline(block_num: int, condition: str, difficulty: str = "medium") -> list[tuple[float, str, dict]]:
    """Build the event timeline for a block."""

    dur = DIFFICULTY_DURATIONS.get(difficulty, DIFFICULTY_DURATIONS["medium"])

    reminder_a_text = _get_reminder_text(condition, "A")
    reminder_b_text = _get_reminder_text(condition, "B")

    neutral_1 = "Smells great in the kitchen!"
    neutral_2 = "How's everything coming along?"

    timeline = [
        (0,    "block_start",        {"block_number": block_num, "condition": condition}),

        # Fake trigger
        (35,   "fake_trigger_fire",  {"type": "delivery"}),

        # Robot neutral #1
        (75,   "robot_neutral",      {"text": neutral_1}),

        # Force yellow 25s before Reminder A (GDD A8: give more time to return to kitchen)
        (95,   "force_yellow_steak", {"hob_id": 0}),

        # Reminder A
        (120,  "reminder_fire",      {"text": reminder_a_text, "slot": "A", "condition": condition}),

        # Trigger A (hidden 30s execution window — GDD A1)
        (210,  "trigger_appear",     {"task_id": _get_task_a(block_num), "slot": "A", "window_ms": 30000}),
        (240,  "window_close",       {"task_id": _get_task_a(block_num), "slot": "A"}),

        # Robot neutral #2
        (270,  "robot_neutral",      {"text": neutral_2}),

        # Force yellow before Reminder B (25s lead time)
        (275,  "force_yellow_steak", {"hob_id": 1}),

        # Reminder B
        (300,  "reminder_fire",      {"text": reminder_b_text, "slot": "B", "condition": condition}),

        # Trigger B (hidden 30s execution window — GDD A1)
        (390,  "trigger_appear",     {"task_id": _get_task_b(block_num), "slot": "B", "window_ms": 30000}),
        (420,  "window_close",       {"task_id": _get_task_b(block_num), "slot": "B"}),

        # Block end
        (510,  "block_end",          {"block_number": block_num}),
    ]

    # Steak spawns — every 8-15s on rotating hobs for high concurrent load
    import random
    t = 3
    hob_cycle = 0
    while t < 490:
        timeline.append((t, "steak_spawn", {"hob_id": hob_cycle % 3, "duration": dur}))
        hob_cycle += 1
        t += random.randint(8, 15)

    # Message bubbles — story-coherent NPCs per GDD A3
    # correct field used for backend scoring only
    timeline.extend([
        (55,   "message_bubble", {
            "from": "Sarah",
            "subject": "Tonight's party",
            "body": "Hey! What time does the party start tonight? I need to plan my evening.",
            "option_a": "7 o'clock",
            "option_b": "8 o'clock",
            "correct": "option_a",
            "avatar": "S",
        }),
        (130,  "message_bubble", {
            "from": "FoodDash",
            "subject": "Delivery confirmation",
            "body": "Your order is almost there! Should we leave it at the door or bring it upstairs?",
            "option_a": "Leave at door",
            "option_b": "Bring upstairs",
            "correct": "option_a",
            "avatar": "🛵",
        }),
        (220,  "message_bubble", {
            "from": "David",
            "subject": "Parking question",
            "body": "I'm driving over — is your spot A12 near the entrance or B07 by the garden?",
            "option_a": "A12",
            "option_b": "B07",
            "correct": "option_b",
            "avatar": "D",
        }),
        (310,  "message_bubble", {
            "from": "Building Mgmt",
            "subject": "Package notice",
            "body": "A package arrived for you. Should we keep it at the front desk or deliver to your door?",
            "option_a": "Front desk",
            "option_b": "My door",
            "correct": "option_a",
            "avatar": "📦",
        }),
        (400,  "message_bubble", {
            "from": "Sarah",
            "subject": "Dessert pick",
            "body": "I'll grab dessert on my way — chocolate cake or apple pie? What sounds good?",
            "option_a": "Chocolate cake",
            "option_b": "Apple pie",
            "correct": "option_b",
            "avatar": "S",
        }),
        (460,  "message_bubble", {
            "from": "Neighbor Jan",
            "subject": "Stopping by",
            "body": "I was thinking of popping over for a bit. Are you home? Want me to bring some fruit?",
            "option_a": "Sure, come by!",
            "option_b": "Not a great time",
            "correct": "option_a",
            "avatar": "J",
        }),
    ])

    # Plant needs water — random intervals (60-90s) for living room engagement
    plant_t = 60 + random.randint(0, 30)
    while plant_t < 480:
        timeline.append((plant_t, "plant_needs_water", {}))
        plant_t += random.randint(60, 90)

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
                logger.info(f"Timeline [{self.session_id}] t={delay}s → {event}")
                await self.send_fn(self.session_id, event, data)
        except asyncio.CancelledError:
            pass

    def cancel(self):
        self._cancelled = True
        for t in self._tasks:
            if not t.done():
                t.cancel()
