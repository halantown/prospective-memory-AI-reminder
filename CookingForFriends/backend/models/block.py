"""Block, PMTrial, PMAttemptRecord, EncodingQuizAttempt, and ReminderMessage models."""

import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Integer, String, Enum, DateTime, JSON, Float, Boolean, ForeignKey, Text,
    UniqueConstraint, Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from models.base import Base


class BlockStatus(str, enum.Enum):
    PENDING = "pending"
    ENCODING = "encoding"
    PLAYING = "playing"
    MICROBREAK = "microbreak"
    COMPLETED = "completed"


class Block(Base):
    __tablename__ = "blocks"
    __table_args__ = (
        UniqueConstraint('participant_id', 'block_number', name='uq_participant_block'),
        Index('ix_block_participant_number', 'participant_id', 'block_number'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    participant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("participants.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    block_number: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-3
    condition: Mapped[str] = mapped_column(String(20), nullable=False)  # EC+ / EC-
    day_story: Mapped[str] = mapped_column(String(200), nullable=False)
    timeline_config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(
        Enum(BlockStatus), default=BlockStatus.PENDING, nullable=False,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    nasa_tlx: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    participant: Mapped["Participant"] = relationship("Participant", back_populates="blocks")
    pm_trials: Mapped[list["PMTrial"]] = relationship("PMTrial", back_populates="block", cascade="all, delete-orphan")
    ongoing_scores: Mapped[list["OngoingTaskScore"]] = relationship("OngoingTaskScore", back_populates="block", cascade="all, delete-orphan")


class PMTrial(Base):
    __tablename__ = "pm_trials"
    __table_args__ = (
        UniqueConstraint('block_id', 'trial_number', name='uq_block_trial'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    block_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("blocks.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    trial_number: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-4
    has_reminder: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_filler: Mapped[bool] = mapped_column(Boolean, default=False)

    # Task definition
    task_config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    encoding_card: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Reminder
    reminder_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    reminder_audio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reminder_condition: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Runtime
    reminder_played_at: Mapped[float | None] = mapped_column(Float, nullable=True)
    reminder_user_room: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reminder_user_activity: Mapped[str | None] = mapped_column(String(100), nullable=True)
    trigger_fired_at: Mapped[float | None] = mapped_column(Float, nullable=True)
    exec_window_start: Mapped[float | None] = mapped_column(Float, nullable=True)
    exec_window_end: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Results
    user_actions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0-6
    response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resumption_lag_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    block: Mapped["Block"] = relationship("Block", back_populates="pm_trials")
    attempt: Mapped["PMAttemptRecord | None"] = relationship(
        "PMAttemptRecord", back_populates="trial", uselist=False, cascade="all, delete-orphan",
    )
    quiz_attempts: Mapped[list["EncodingQuizAttempt"]] = relationship(
        "EncodingQuizAttempt", back_populates="trial", cascade="all, delete-orphan",
    )


class PMAttemptRecord(Base):
    """Granular record of a single PM attempt with all timing data."""
    __tablename__ = "pm_attempt_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trial_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pm_trials.id", ondelete="CASCADE"), nullable=False, unique=True, index=True,
    )
    participant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("participants.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    block_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("blocks.id", ondelete="CASCADE"), nullable=False, index=True,
    )

    # Timing — all in epoch seconds
    trigger_fired_at: Mapped[float] = mapped_column(Float, nullable=False)
    trigger_received_at: Mapped[float | None] = mapped_column(Float, nullable=True)
    first_action_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    first_room_switch_at: Mapped[float | None] = mapped_column(Float, nullable=True)
    first_pm_room_entered_at: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_selected_at: Mapped[float | None] = mapped_column(Float, nullable=True)
    action_completed_at: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Navigation
    room_sequence: Mapped[list | None] = mapped_column(JSON, nullable=True)
    room: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Execution
    target_selected: Mapped[str | None] = mapped_column(String(100), nullable=True)
    action_performed: Mapped[str | None] = mapped_column(String(100), nullable=True)
    action_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # Computed
    total_elapsed_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0-6

    trial: Mapped["PMTrial"] = relationship("PMTrial", back_populates="attempt")


class EncodingQuizAttempt(Base):
    """Records each quiz attempt during encoding phase."""
    __tablename__ = "encoding_quiz_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trial_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pm_trials.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    participant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("participants.id", ondelete="CASCADE"), nullable=False, index=True,
    )

    question_type: Mapped[str] = mapped_column(String(20), nullable=False)  # trigger / target / action
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)  # 1, 2, ...
    selected_answer: Mapped[str] = mapped_column(String(200), nullable=False)
    correct_answer: Mapped[str] = mapped_column(String(200), nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    trial: Mapped["PMTrial"] = relationship("PMTrial", back_populates="quiz_attempts")


class ReminderMessage(Base):
    """Landing zone for agent-generated reminders."""
    __tablename__ = "reminder_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_type: Mapped[str] = mapped_column(String(100), nullable=False)
    condition: Mapped[str] = mapped_column(String(20), nullable=False)  # EC+ / EC-
    context_activity: Mapped[str | None] = mapped_column(String(100), nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    audio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    extra_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    is_placeholder: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
