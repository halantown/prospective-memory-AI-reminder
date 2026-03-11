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

    neutral_1 = "厨房好香啊！"
    neutral_2 = "准备得怎么样了？"

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
            "from": "张芳",
            "subject": "今晚聚会",
            "body": "嘿！今晚聚会几点开始？我好安排一下时间。",
            "option_a": "7点",
            "option_b": "8点",
            "correct": "option_a",
            "avatar": "芳",
        }),
        (130,  "message_bubble", {
            "from": "外卖平台",
            "subject": "配送确认",
            "body": "您的订单即将送达，请问放在门口还是需要送上楼？",
            "option_a": "放门口",
            "option_b": "送上楼",
            "correct": "option_a",
            "avatar": "🛵",
        }),
        (220,  "message_bubble", {
            "from": "李明",
            "subject": "停车问题",
            "body": "我开车过来，A12号车位靠入口那个还是B07号靠花园那个是你的？",
            "option_a": "A12",
            "option_b": "B07",
            "correct": "option_b",
            "avatar": "明",
        }),
        (310,  "message_bubble", {
            "from": "物业",
            "subject": "快递通知",
            "body": "您有一个包裹到了，请问放在门卫处还是送到家门口？",
            "option_a": "门卫处",
            "option_b": "家门口",
            "correct": "option_a",
            "avatar": "📦",
        }),
        (400,  "message_bubble", {
            "from": "张芳",
            "subject": "甜点选择",
            "body": "我顺路买个甜点过来，你觉得巧克力蛋糕好还是苹果派好？",
            "option_a": "巧克力蛋糕",
            "option_b": "苹果派",
            "correct": "option_b",
            "avatar": "芳",
        }),
        (460,  "message_bubble", {
            "from": "王阿姨",
            "subject": "来串门",
            "body": "我想过来坐坐，你在家吗？要不要我带点水果过来？",
            "option_a": "好的，来吧",
            "option_b": "今天不太方便",
            "correct": "option_a",
            "avatar": "王",
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
