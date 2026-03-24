"""Logging models — InteractionLog, MouseTrack, OngoingTaskScore, GameStateSnapshot, PhoneMessageLog."""

from datetime import datetime
from sqlalchemy import Integer, String, DateTime, JSON, Float, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from models.base import Base


class InteractionLog(Base):
    __tablename__ = "interaction_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    participant_id: Mapped[str] = mapped_column(String(36), ForeignKey("participants.id"), nullable=False)
    block_id: Mapped[int] = mapped_column(Integer, ForeignKey("blocks.id"), nullable=False)
    timestamp: Mapped[float] = mapped_column(Float, nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    event_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    room: Mapped[str | None] = mapped_column(String(50), nullable=True)


class MouseTrack(Base):
    """Mouse trajectory data — batch-packed."""
    __tablename__ = "mouse_tracks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    participant_id: Mapped[str] = mapped_column(String(36), ForeignKey("participants.id"), nullable=False)
    block_id: Mapped[int] = mapped_column(Integer, ForeignKey("blocks.id"), nullable=False)
    data: Mapped[list] = mapped_column(JSON, nullable=False)  # [{x, y, t}, ...]


class OngoingTaskScore(Base):
    __tablename__ = "ongoing_task_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    block_id: Mapped[int] = mapped_column(Integer, ForeignKey("blocks.id"), nullable=False)
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)
    events: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    score: Mapped[int] = mapped_column(Integer, default=0)

    block: Mapped["Block"] = relationship("Block", back_populates="ongoing_scores")


class GameStateSnapshot(Base):
    __tablename__ = "game_state_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    participant_id: Mapped[str] = mapped_column(String(36), ForeignKey("participants.id"), nullable=False)
    block_id: Mapped[int] = mapped_column(Integer, ForeignKey("blocks.id"), nullable=False)
    timestamp: Mapped[float] = mapped_column(Float, nullable=False)
    state: Mapped[dict] = mapped_column(JSON, nullable=False)


class PhoneMessageLog(Base):
    """Tracks every phone message sent and participant replies."""
    __tablename__ = "phone_message_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    participant_id: Mapped[str] = mapped_column(String(36), ForeignKey("participants.id"), nullable=False)
    block_id: Mapped[int] = mapped_column(Integer, ForeignKey("blocks.id"), nullable=False)
    message_id: Mapped[str] = mapped_column(String(50), nullable=False)
    sender: Mapped[str] = mapped_column(String(100), nullable=False)
    message_type: Mapped[str] = mapped_column(String(30), nullable=False)  # arithmetic / commonsense / social / ad / chat / pm_trigger
    sent_at: Mapped[float] = mapped_column(Float, nullable=False)
    read_at: Mapped[float | None] = mapped_column(Float, nullable=True)
    replied_at: Mapped[float | None] = mapped_column(Float, nullable=True)
    reply_selected: Mapped[str | None] = mapped_column(String(200), nullable=True)
    reply_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

