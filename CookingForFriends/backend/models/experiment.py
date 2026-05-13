"""Experiment and Participant models."""

import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Integer, String, Enum, DateTime, JSON, Float, Boolean, ForeignKey, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from models.base import Base


class ExperimentStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"


class ParticipantStatus(str, enum.Enum):
    REGISTERED = "registered"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DROPPED = "dropped"


class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(
        Enum(ExperimentStatus), default=ExperimentStatus.DRAFT, nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc),
    )

    participants: Mapped[list["Participant"]] = relationship(back_populates="experiment")


class Participant(Base):
    __tablename__ = "participants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))  # UUID
    experiment_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    participant_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)  # P001
    token: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    condition: Mapped[str] = mapped_column(String(20), nullable=False)  # EE1 / EE0
    status: Mapped[str] = mapped_column(
        Enum(ParticipantStatus), default=ParticipantStatus.REGISTERED, nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    demographic_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    debrief_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    last_heartbeat: Mapped[float | None] = mapped_column(Float, nullable=True)

    # PM Task Module — EE1/EE0 experiment
    task_order: Mapped[str] = mapped_column(String(2), nullable=False, default="A")
    is_test: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    current_phase: Mapped[str] = mapped_column(String(30), nullable=False, default="WELCOME")

    # Game time freeze mechanism (all values are epoch-seconds floats)
    game_time_elapsed_s: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    frozen_since: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_unfreeze_at: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Disconnect tracking
    disconnected_at: Mapped[float | None] = mapped_column(Float, nullable=True)
    incomplete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    experiment: Mapped["Experiment"] = relationship(back_populates="participants")
    blocks: Mapped[list["Block"]] = relationship("Block", back_populates="participant", cascade="all, delete-orphan")
