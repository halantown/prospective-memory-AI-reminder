"""PM Module models — event log tables for the EC+/EC- encoding-context experiment.

All timing fields store epoch-seconds floats (game time where noted, wall time elsewhere).
These tables have no block_id; they reference participants.id directly.
"""

from sqlalchemy import Boolean, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class PhaseEvent(Base):
    """Records start and end of each experiment phase per participant."""
    __tablename__ = "phase_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("participants.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    phase_name: Mapped[str] = mapped_column(String(30), nullable=False)
    start_time: Mapped[float] = mapped_column(Float, nullable=False)         # wall time
    end_time: Mapped[float | None] = mapped_column(Float, nullable=True)     # wall time


class CutsceneEvent(Base):
    """Records display and dismissal of each cutscene segment plus detail-check answer."""
    __tablename__ = "cutscene_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("participants.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    task_id: Mapped[str] = mapped_column(String(4), nullable=False)          # "T1"–"T4"
    segment_number: Mapped[int] = mapped_column(Integer, nullable=False)     # 1–4
    display_time: Mapped[float] = mapped_column(Float, nullable=False)       # wall time
    dismiss_time: Mapped[float | None] = mapped_column(Float, nullable=True) # wall time
    detailcheck_question: Mapped[str | None] = mapped_column(Text, nullable=True)
    detailcheck_answer: Mapped[str | None] = mapped_column(String(500), nullable=True)
    detailcheck_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)


class PMTaskEvent(Base):
    """Full pipeline log for one real PM trigger event.

    Timing fields (trigger_*, greeting_*, reminder_*, decoy_*, confidence_*,
    action_*) use game time (seconds, frozen-adjusted).
    pipeline_was_interrupted=True when a disconnect occurred mid-pipeline and
    the pipeline was restarted from trigger_affordance on reconnect.
    action_correct is intentionally absent: action is system-executed; the
    primary DV is decoy_correct.
    """
    __tablename__ = "pm_task_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("participants.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    task_id: Mapped[str] = mapped_column(String(4), nullable=False)          # "T1"–"T4"
    position_in_order: Mapped[int] = mapped_column(Integer, nullable=False)  # 1–4
    condition: Mapped[str] = mapped_column(String(10), nullable=False)       # "EC+" | "EC-"

    # Trigger timing (game time seconds)
    trigger_scheduled_game_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    trigger_actual_game_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    trigger_type: Mapped[str] = mapped_column(String(20), nullable=False)    # "doorbell" | "phone_call"

    # Pipeline step timings (game time)
    greeting_complete_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    reminder_display_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    reminder_acknowledge_time: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Decoy step
    decoy_options_order: Mapped[list | None] = mapped_column(JSON, nullable=True)   # randomised id list
    decoy_selected_option: Mapped[str | None] = mapped_column(String(20), nullable=True)
    decoy_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    decoy_response_time: Mapped[float | None] = mapped_column(Float, nullable=True) # game time delta

    # Confidence step
    confidence_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence_response_time: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Avatar auto-action animation (game time)
    action_animation_start_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    action_animation_complete_time: Mapped[float | None] = mapped_column(Float, nullable=True)

    pipeline_was_interrupted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class FakeTriggerEvent(Base):
    """Log for fake (sham) trigger events (no decoy/confidence/action steps)."""
    __tablename__ = "fake_trigger_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("participants.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    scheduled_game_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_game_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    trigger_type: Mapped[str] = mapped_column(String(20), nullable=False)    # "doorbell" | "phone_call"
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    pipeline_was_interrupted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class IntentionCheckEvent(Base):
    """Records participant's response to a post-encoding intention-check question."""
    __tablename__ = "intention_check_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("participants.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    task_id: Mapped[str] = mapped_column(String(4), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)               # 1–4 in task_order
    selected_option_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    correct_option_index: Mapped[int] = mapped_column(Integer, nullable=False)
    response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
