"""Unit tests for the CookingEngine state machine."""

import asyncio
import sys
import os
import pytest

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine.cooking_engine import CookingEngine, StepResult, DishProgress
from data.cooking_recipes import ALL_RECIPES
from data.cooking_timeline import COOKING_TIMELINE


class MockDB:
    """Fake DB factory that does nothing."""
    def __call__(self):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    def add(self, obj):
        pass

    async def commit(self):
        pass


class FakeSender:
    """Collect all sent messages for assertions."""
    def __init__(self):
        self.messages: list[tuple[str, dict]] = []

    async def __call__(self, event_type: str, data: dict):
        self.messages.append((event_type, data))


@pytest.fixture
def sender():
    return FakeSender()


@pytest.fixture
def engine(sender):
    return CookingEngine(
        participant_id="test_participant",
        block_id=1,
        send_fn=sender,
        db_factory=MockDB(),
    )


class TestCookingEngineInit:
    def test_creates_all_dishes(self, engine):
        assert len(engine.dishes) == 4
        assert "spaghetti" in engine.dishes
        assert "steak" in engine.dishes
        assert "tomato_soup" in engine.dishes
        assert "roasted_vegetables" in engine.dishes

    def test_all_dishes_start_idle(self, engine):
        for dish in engine.dishes.values():
            assert dish.phase == "idle"
            assert dish.current_step_index == 0
            assert dish.results == []


class TestHandleAction:
    @pytest.mark.asyncio
    async def test_correct_action(self, engine, sender):
        """Simulate a correct action on an active step."""
        # Manually activate a step for spaghetti (step 0)
        from data.cooking_timeline import TimelineEntry
        entry = TimelineEntry(t=0, dish_id="spaghetti", step_index=0, step_type="active")
        await engine._activate_entry(entry)

        # Verify step_activate was sent
        assert len(sender.messages) == 1
        event_type, data = sender.messages[0]
        assert event_type == "ongoing_task_event"
        assert data["event"] == "step_activate"
        assert data["dish"] == "spaghetti"
        assert data["step_index"] == 0

        # Submit correct answer
        step_def = ALL_RECIPES["spaghetti"][0]
        result = await engine.handle_action(
            dish_id="spaghetti",
            chosen_option_id=f"option_{step_def.correct_index}",
            chosen_option_text=step_def.options[step_def.correct_index],
            station=step_def.station,
            timestamp=0,
        )

        assert result["result"] == "correct"
        assert result["dish"] == "spaghetti"

        # Verify result was recorded in dish progress
        dish = engine.dishes["spaghetti"]
        assert len(dish.results) == 1
        assert dish.results[0].result == "correct"

    @pytest.mark.asyncio
    async def test_wrong_action(self, engine, sender):
        """Simulate a wrong action on an active step."""
        from data.cooking_timeline import TimelineEntry
        entry = TimelineEntry(t=0, dish_id="spaghetti", step_index=0, step_type="active")
        await engine._activate_entry(entry)

        result = await engine.handle_action(
            dish_id="spaghetti",
            chosen_option_id="distractor_0",
            chosen_option_text="Wrong choice",
            station=ALL_RECIPES["spaghetti"][0].station,
            timestamp=0,
        )

        assert result["result"] == "wrong"
        dish = engine.dishes["spaghetti"]
        assert dish.results[0].result == "wrong"

    @pytest.mark.asyncio
    async def test_action_no_active_step(self, engine, sender):
        """Action on dish with no active step returns error."""
        result = await engine.handle_action(
            dish_id="spaghetti",
            chosen_option_id="correct",
            chosen_option_text="Whatever",
            station="fridge",
            timestamp=0,
        )
        assert result["result"] == "no_active_step"

    @pytest.mark.asyncio
    async def test_action_wrong_station(self, engine, sender):
        """Action at wrong station returns error."""
        from data.cooking_timeline import TimelineEntry
        entry = TimelineEntry(t=0, dish_id="spaghetti", step_index=0, step_type="active")
        await engine._activate_entry(entry)

        result = await engine.handle_action(
            dish_id="spaghetti",
            chosen_option_id="correct",
            chosen_option_text="Correct",
            station="oven",  # Wrong station
            timestamp=0,
        )
        assert result["result"] == "wrong_station"


class TestTimeout:
    @pytest.mark.asyncio
    async def test_step_timeout(self, engine, sender):
        """Step times out after COOKING_STEP_WINDOW_S and is marked missed."""
        from data.cooking_timeline import TimelineEntry
        from unittest.mock import patch

        entry = TimelineEntry(t=0, dish_id="tomato_soup", step_index=0, step_type="active")

        # Patch window to 0.05s for fast test
        with patch("engine.cooking_engine.COOKING_STEP_WINDOW_S", 0.05):
            await engine._activate_entry(entry)
            # Wait for timeout
            await asyncio.sleep(0.15)

        dish = engine.dishes["tomato_soup"]
        assert len(dish.results) == 1
        assert dish.results[0].result == "missed"

        # Verify timeout event was sent
        timeout_msgs = [(t, d) for t, d in sender.messages if d.get("event") == "step_timeout"]
        assert len(timeout_msgs) == 1
        assert timeout_msgs[0][1]["dish"] == "tomato_soup"

    @pytest.mark.asyncio
    async def test_action_cancels_timeout(self, engine, sender):
        """Answering before timeout cancels the timeout task."""
        from data.cooking_timeline import TimelineEntry
        from unittest.mock import patch

        entry = TimelineEntry(t=0, dish_id="spaghetti", step_index=0, step_type="active")

        with patch("engine.cooking_engine.COOKING_STEP_WINDOW_S", 1.0):
            await engine._activate_entry(entry)

            # Answer immediately
            await engine.handle_action(
                dish_id="spaghetti",
                chosen_option_id=f"option_{ALL_RECIPES['spaghetti'][0].correct_index}",
                chosen_option_text=ALL_RECIPES["spaghetti"][0].options[ALL_RECIPES["spaghetti"][0].correct_index],
                station=ALL_RECIPES["spaghetti"][0].station,
                timestamp=0,
            )

            # Wait and verify no timeout fires
            await asyncio.sleep(0.1)

        dish = engine.dishes["spaghetti"]
        assert len(dish.results) == 1
        assert dish.results[0].result == "correct"
        # No missed results
        missed = [r for r in dish.results if r.result == "missed"]
        assert len(missed) == 0

    @pytest.mark.asyncio
    async def test_next_step_marks_previous_unanswered_step_missed(self, engine, sender):
        """A scheduled next step cannot overwrite an unanswered active step."""
        from data.cooking_timeline import TimelineEntry

        await engine._activate_entry(TimelineEntry(t=0, dish_id="tomato_soup", step_index=0, step_type="active"))
        await engine._activate_entry(TimelineEntry(t=30, dish_id="tomato_soup", step_index=1, step_type="active"))

        dish = engine.dishes["tomato_soup"]
        assert len(dish.results) == 1
        assert dish.results[0].step_index == 0
        assert dish.results[0].result == "missed"

        events = [data["event"] for _, data in sender.messages]
        assert events == ["step_activate", "step_timeout", "step_activate"]
        assert engine.get_state()["tomato_soup"]["active_step"] == 1

    @pytest.mark.asyncio
    async def test_pause_prevents_active_step_timeout_until_resume(self, engine, sender):
        """PM pause should stop cooking step timeout countdown."""
        from data.cooking_timeline import TimelineEntry
        from unittest.mock import patch

        entry = TimelineEntry(t=0, dish_id="tomato_soup", step_index=0, step_type="active")

        with patch("engine.cooking_engine.COOKING_STEP_WINDOW_S", 0.05):
            await engine._activate_entry(entry)
            engine.pause()
            await asyncio.sleep(0.08)

            dish = engine.dishes["tomato_soup"]
            assert dish.results == []
            assert engine.get_state()["tomato_soup"]["active_step"] == 0

            engine.resume()
            await asyncio.sleep(0.08)

        dish = engine.dishes["tomato_soup"]
        assert len(dish.results) == 1
        assert dish.results[0].result == "missed"

    @pytest.mark.asyncio
    async def test_response_time_excludes_pm_pause(self, engine, sender):
        """Cooking response time is measured in game time, not paused wall time."""
        from data.cooking_timeline import TimelineEntry
        from unittest.mock import patch

        entry = TimelineEntry(t=0, dish_id="spaghetti", step_index=0, step_type="active")
        step_def = ALL_RECIPES["spaghetti"][0]

        with patch("engine.cooking_engine.COOKING_STEP_WINDOW_S", 1.0):
            await engine._activate_entry(entry)
            await asyncio.sleep(0.02)
            engine.pause()
            await asyncio.sleep(0.08)
            engine.resume()
            await asyncio.sleep(0.02)

            result = await engine.handle_action(
                dish_id="spaghetti",
                chosen_option_id=f"option_{step_def.correct_index}",
                chosen_option_text=step_def.options[step_def.correct_index],
                station=step_def.station,
                timestamp=0,
            )

        assert result["result"] == "correct"
        assert result["response_time_ms"] < 80


class TestWaitStep:
    @pytest.mark.asyncio
    async def test_wait_step_sets_waiting_phase(self, engine, sender):
        """Wait steps set dish phase to 'waiting' and send wait_start event."""
        from data.cooking_timeline import TimelineEntry
        entry = TimelineEntry(t=0, dish_id="spaghetti", step_index=1, step_type="wait")
        await engine._activate_entry(entry)

        dish = engine.dishes["spaghetti"]
        assert dish.phase == "waiting"

        # Check wait_start event
        assert len(sender.messages) == 1
        _, data = sender.messages[0]
        assert data["event"] == "wait_start"
        assert data["dish"] == "spaghetti"

    @pytest.mark.asyncio
    async def test_next_active_step_clears_previous_wait(self, engine, sender):
        """Activating the next same-dish step emits wait_end before step_activate."""
        from data.cooking_timeline import TimelineEntry

        await engine._activate_entry(TimelineEntry(t=0, dish_id="spaghetti", step_index=1, step_type="wait"))
        await engine._activate_entry(TimelineEntry(t=0, dish_id="spaghetti", step_index=2, step_type="active"))

        events = [data["event"] for _, data in sender.messages]
        assert events == ["wait_start", "wait_end", "step_activate"]
        assert sender.messages[1][1]["step_index"] == 1


class TestDishCompletion:
    @pytest.mark.asyncio
    async def test_dish_complete_after_all_active_steps(self, engine, sender):
        """Dish marked done after all active steps are completed."""
        from data.cooking_timeline import TimelineEntry

        dish_id = "roasted_vegetables"
        dish = engine.dishes[dish_id]
        active_steps = [
            (i, s) for i, s in enumerate(dish.steps)
            if s.step_type == "active"
        ]

        for step_idx, step_def in active_steps:
            entry = TimelineEntry(t=0, dish_id=dish_id, step_index=step_idx, step_type="active")
            await engine._activate_entry(entry)
            await engine.handle_action(
                dish_id=dish_id,
                chosen_option_id=f"option_{step_def.correct_index}",
                chosen_option_text=step_def.options[step_def.correct_index],
                station=step_def.station,
                timestamp=0,
            )

        assert dish.phase == "done"
        assert dish.completed_at is not None


class TestScoring:
    @pytest.mark.asyncio
    async def test_get_scores(self, engine, sender):
        """get_scores returns correct summary."""
        from data.cooking_timeline import TimelineEntry

        # Complete 2 steps: one correct, one wrong
        dish_id = "spaghetti"
        steps = ALL_RECIPES[dish_id]

        entry0 = TimelineEntry(t=0, dish_id=dish_id, step_index=0, step_type="active")
        await engine._activate_entry(entry0)
        await engine.handle_action(
            dish_id,
            f"option_{steps[0].correct_index}",
            steps[0].options[steps[0].correct_index],
            steps[0].station,
            0,
        )

        entry1 = TimelineEntry(t=0, dish_id=dish_id, step_index=2, step_type="active")
        await engine._activate_entry(entry1)
        await engine.handle_action(dish_id, "option_0", "B", steps[2].station, 0)

        scores = engine.get_scores()
        assert scores[dish_id]["correct"] == 1
        assert scores[dish_id]["wrong"] == 1
        assert scores[dish_id]["missed"] == 0


class TestGetState:
    @pytest.mark.asyncio
    async def test_state_snapshot(self, engine, sender):
        """get_state() returns proper state dict."""
        from data.cooking_timeline import TimelineEntry

        entry = TimelineEntry(t=0, dish_id="steak", step_index=0, step_type="active")
        await engine._activate_entry(entry)

        state = engine.get_state()
        assert state["steak"]["phase"] == "active"
        assert state["steak"]["active_step"] == 0
        assert state["spaghetti"]["phase"] == "idle"
        assert state["spaghetti"]["active_step"] is None


class TestTimeline:
    def test_timeline_data_integrity(self):
        """All timeline entries reference valid dish/step combinations."""
        for entry in COOKING_TIMELINE:
            assert entry.dish_id in ALL_RECIPES, f"Unknown dish: {entry.dish_id}"
            steps = ALL_RECIPES[entry.dish_id]
            assert 0 <= entry.step_index < len(steps), \
                f"Invalid step_index {entry.step_index} for {entry.dish_id} (has {len(steps)} steps)"
            assert entry.step_type == steps[entry.step_index].step_type, \
                f"Mismatch: timeline says {entry.step_type} but recipe says {steps[entry.step_index].step_type}"

    def test_timeline_chronological(self):
        """Timeline entries are roughly in chronological order (per-dish)."""
        # Since multiple dishes run in parallel, the overall timeline doesn't
        # need to be strictly sorted. But per-dish entries should be ordered.
        from collections import defaultdict
        per_dish: defaultdict[str, list] = defaultdict(list)
        for entry in COOKING_TIMELINE:
            per_dish[entry.dish_id].append(entry)

        for dish_id, entries in per_dish.items():
            for i in range(1, len(entries)):
                assert entries[i].t >= entries[i - 1].t, \
                    f"Timeline not sorted for {dish_id} at step {entries[i].step_index}: t={entries[i].t} < t={entries[i-1].t}"
