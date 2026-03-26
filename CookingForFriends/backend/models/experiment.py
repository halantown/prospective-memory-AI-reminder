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
    latin_square_group: Mapped[str] = mapped_column(String(10), nullable=False)
    condition_order: Mapped[list] = mapped_column(JSON, nullable=False)  # ["CONTROL","AF","AFCB"]
    status: Mapped[str] = mapped_column(
        Enum(ParticipantStatus), default=ParticipantStatus.REGISTERED, nullable=False,
    )
    current_block: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    demographic_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    debrief_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    last_heartbeat: Mapped[float | None] = mapped_column(Float, nullable=True)

    experiment: Mapped["Experiment"] = relationship(back_populates="participants")
    blocks: Mapped[list["Block"]] = relationship("Block", back_populates="participant", cascade="all, delete-orphan")
