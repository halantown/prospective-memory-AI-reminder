"""Deterministic cooking timeline — maps absolute time offsets to dish step activations.

This is the single source of truth for WHEN each cooking step becomes active.
Every participant sees the same sequence at the same times.

Source: cooking_system_design.md Section 4.

Each entry is (time_offset_seconds, dish_id, step_index).
- Active steps have a 30-second action window (configurable via COOKING_STEP_WINDOW_S).
- Wait steps auto-progress and have no action window.
"""

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class TimelineEntry:
    """One scheduled cooking event."""
    t: int                                    # seconds from block start
    dish_id: str                              # e.g. 'roasted_vegetables'
    step_index: int                           # 0-based index into recipe steps
    step_type: Literal["active", "wait"]      # active = participant must act; wait = auto


@dataclass(frozen=True)
class RobotIdleComment:
    """One non-interactive robot comment scheduled in cooking game time."""
    t: int
    comment_id: str
    text: str


# ─── Full 15-minute cooking timeline ──────────────────────────────────────────
#
# Design principles:
# - After initial ramp-up, ≥2 dishes have a pending active step at any moment.
# - Gaps exist at 4:30-5:00 and 6:00-7:00 — lighter periods (1 dish active).
# - Wait steps are listed at their start time; they auto-progress after duration.
# - Active steps get a 30s window; next event fires after window expires or on action.

COOKING_TIMELINE: list[TimelineEntry] = [
    # ── Roasted Vegetables: prep then long oven wait ──────────────────────────
    TimelineEntry(t=0,    dish_id="roasted_vegetables", step_index=0, step_type="active"),    # select vegetables
    TimelineEntry(t=30,   dish_id="roasted_vegetables", step_index=1, step_type="active"),    # chop vegetables
    TimelineEntry(t=60,   dish_id="roasted_vegetables", step_index=2, step_type="active"),    # season
    TimelineEntry(t=90,   dish_id="roasted_vegetables", step_index=3, step_type="active"),    # place in oven
    TimelineEntry(t=120,  dish_id="roasted_vegetables", step_index=4, step_type="wait"),      # WAIT ~8 min (oven cooking)

    # ── Tomato Soup: start prep during roast veg oven wait ────────────────────
    TimelineEntry(t=120,  dish_id="tomato_soup", step_index=0, step_type="active"),           # select ingredients
    TimelineEntry(t=150,  dish_id="tomato_soup", step_index=1, step_type="active"),           # chop
    TimelineEntry(t=180,  dish_id="spaghetti",   step_index=0, step_type="active"),           # pasta: place pot with water
    TimelineEntry(t=210,  dish_id="tomato_soup", step_index=2, step_type="active"),           # sauté base
    TimelineEntry(t=240,  dish_id="tomato_soup", step_index=3, step_type="active"),           # add water
    TimelineEntry(t=270,  dish_id="tomato_soup", step_index=4, step_type="wait"),             # WAIT ~2 min (simmering)

    # ── Spaghetti: water boiling wait overlaps with soup simmer ───────────────
    TimelineEntry(t=210,  dish_id="spaghetti",   step_index=1, step_type="wait"),             # WAIT ~2 min (water heating)
    TimelineEntry(t=300,  dish_id="spaghetti",   step_index=2, step_type="active"),           # add pasta
    TimelineEntry(t=330,  dish_id="tomato_soup", step_index=5, step_type="active"),           # stir soup
    TimelineEntry(t=330,  dish_id="spaghetti",   step_index=3, step_type="wait"),             # WAIT ~2 min (pasta cooking)

    # ── Soup simmer 2 + pasta cooking ─────────────────────────────────────────
    TimelineEntry(t=360,  dish_id="tomato_soup", step_index=6, step_type="wait"),             # WAIT ~2 min (continue simmering)

    # ── Mid-block: pasta drain + soup season ──────────────────────────────────
    TimelineEntry(t=420,  dish_id="spaghetti",   step_index=4, step_type="active"),           # drain pasta
    TimelineEntry(t=420,  dish_id="tomato_soup", step_index=7, step_type="active"),           # add seasoning
    TimelineEntry(t=450,  dish_id="spaghetti",   step_index=5, step_type="active"),           # add sauce
    TimelineEntry(t=480,  dish_id="spaghetti",   step_index=6, step_type="active"),           # toss pasta
    TimelineEntry(t=480,  dish_id="tomato_soup", step_index=8, step_type="active"),           # ladle into bowl
    TimelineEntry(t=510,  dish_id="spaghetti",   step_index=7, step_type="active"),           # plate spaghetti

    # ── Steak: last to start, most time-pressure ──────────────────────────────
    TimelineEntry(t=540,  dish_id="steak", step_index=0, step_type="active"),                 # select steak
    TimelineEntry(t=570,  dish_id="steak", step_index=1, step_type="active"),                 # season steak

    # ── Roasted Vegetables come out of oven; overlap with steak ───────────────
    TimelineEntry(t=600,  dish_id="roasted_vegetables", step_index=5, step_type="active"),    # remove from oven
    TimelineEntry(t=600,  dish_id="steak", step_index=2, step_type="active"),                 # heat pan
    TimelineEntry(t=630,  dish_id="steak", step_index=3, step_type="active"),                 # place steak
    TimelineEntry(t=630,  dish_id="roasted_vegetables", step_index=6, step_type="active"),    # plate vegetables
    TimelineEntry(t=660,  dish_id="steak", step_index=4, step_type="wait"),                   # WAIT ~1.5 min (cooking side 1)

    # ── Steak flip and finish ─────────────────────────────────────────────────
    TimelineEntry(t=750,  dish_id="steak", step_index=5, step_type="active"),                 # flip steak
    TimelineEntry(t=780,  dish_id="steak", step_index=6, step_type="wait"),                   # WAIT ~1.5 min (cooking side 2)
    TimelineEntry(t=840,  dish_id="steak", step_index=7, step_type="active"),                 # plate steak

    # ── Session wind-down ─────────────────────────────────────────────────────
    # After t=870 (14:30): session winds down, block_end at t=900
]


# ─── Robot idle comments ─────────────────────────────────────────────────────
#
# These are intentionally scheduled in lighter cooking periods and away from
# PM/fake trigger windows.  They create social presence without requiring
# participant interaction.

ROBOT_IDLE_COMMENTS: list[RobotIdleComment] = [
    RobotIdleComment(
        t=130,
        comment_id="idle_oven_vegetables",
        text="Vegetables are in the oven, smells good already.",
    ),
    RobotIdleComment(
        t=250,
        comment_id="idle_soup_simmer",
        text="The soup is coming along nicely.",
    ),
    RobotIdleComment(
        t=710,
        comment_id="idle_almost_there",
        text="Almost there, chef.",
    ),
]


def get_active_steps_at(t_seconds: int) -> list[TimelineEntry]:
    """Return all timeline entries that are active at a given time (within their 30s window).

    Useful for debugging and understanding cognitive load at any point.
    """
    from config import COOKING_STEP_WINDOW_S

    active = []
    for entry in COOKING_TIMELINE:
        if entry.step_type == "active":
            if entry.t <= t_seconds < entry.t + COOKING_STEP_WINDOW_S:
                active.append(entry)
    return active
