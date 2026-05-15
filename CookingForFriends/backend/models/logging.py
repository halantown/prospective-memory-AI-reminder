"""Logging models — InteractionLog, MouseTrack, OngoingTaskScore, GameStateSnapshot, PhoneMessageLog."""

from datetime import datetime
from sqlalchemy import Integer, String, DateTime, JSON, Float, ForeignKey, Boolean, Index, UniqueConstraint, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from models.base import Base


class InteractionLog(Base):
    __tablename__ = "interaction_logs"
    __table_args__ = (
        Index('ix_interaction_participant_block', 'participant_id', 'block_id'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    participant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("participants.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    block_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("blocks.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    timestamp: Mapped[float] = mapped_column(Float, nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    event_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    room: Mapped[str | None] = mapped_column(String(50), nullable=True)


class MouseTrack(Base):
    """Mouse trajectory data — batch-packed."""
    __tablename__ = "mouse_tracks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    participant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("participants.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    block_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("blocks.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    data: Mapped[list] = mapped_column(JSON, nullable=False)  # [{x, y, t}, ...]


class RobotIdleCommentLog(Base):
    """Robot idle comments shown during ongoing cooking."""
    __tablename__ = "robot_idle_comment_logs"
    __table_args__ = (
        Index('ix_robot_idle_participant_block', 'participant_id', 'block_id'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    participant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("participants.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    block_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("blocks.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    comment_id: Mapped[str] = mapped_column(String(80), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    shown_at: Mapped[float] = mapped_column(Float, nullable=False)


class RobotProactivePromptLog(Base):
    """Robot proactive prompts triggered by consecutive cooking errors."""
    __tablename__ = "robot_proactive_prompt_logs"
    __table_args__ = (
        Index('ix_robot_proactive_participant_block', 'participant_id', 'block_id'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    participant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("participants.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    block_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("blocks.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    trigger_reason: Mapped[str] = mapped_column(String(50), nullable=False)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    comment_text: Mapped[str] = mapped_column(Text, nullable=False)
    game_time: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    shown_at: Mapped[float] = mapped_column(Float, nullable=False)


class OngoingTaskScore(Base):
    __tablename__ = "ongoing_task_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    block_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("blocks.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)
    events: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    score: Mapped[int] = mapped_column(Integer, default=0)

    block: Mapped["Block"] = relationship("Block", back_populates="ongoing_scores")


class GameStateSnapshot(Base):
    __tablename__ = "game_state_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    participant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("participants.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    block_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("blocks.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    timestamp: Mapped[float] = mapped_column(Float, nullable=False)
    state: Mapped[dict] = mapped_column(JSON, nullable=False)


class PhoneMessageLog(Base):
    """Tracks every phone message sent, participant answers, and expiry status.

    Categories:  question | notification | pm_trigger
    Status values:  answered_correct | answered_incorrect | expired | seen
    """
    __tablename__ = "phone_message_logs"
    __table_args__ = (
        Index('ix_phonemsg_participant_block', 'participant_id', 'block_id'),
        UniqueConstraint('participant_id', 'block_id', 'message_id', name='uq_phonemsg_participant_block_message'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    participant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("participants.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    block_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("blocks.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    message_id: Mapped[str] = mapped_column(String(50), nullable=False)
    sender: Mapped[str] = mapped_column(String(100), nullable=False)
    message_type: Mapped[str] = mapped_column(String(30), nullable=False)  # question / notification / pm_trigger
    category: Mapped[str] = mapped_column(String(30), nullable=False, default="notification")  # question | notification | pm_trigger
    sent_at: Mapped[float] = mapped_column(Float, nullable=False)  # arrivedAt
    read_at: Mapped[float | None] = mapped_column(Float, nullable=True)  # seen
    replied_at: Mapped[float | None] = mapped_column(Float, nullable=True)  # respondedAt
    response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    user_choice: Mapped[str | None] = mapped_column(Text, nullable=True)   # selected reply text
    correct_answer: Mapped[str | None] = mapped_column(Text, nullable=True)  # correct reply text
    reply_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    correct_position_shown: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0 = correct first, 1 = correct second
    status: Mapped[str | None] = mapped_column(String(30), nullable=True)  # answered_correct | answered_incorrect | expired | seen
