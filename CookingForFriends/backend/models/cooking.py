"""Cooking models — CookingStepRecord and CookingDishScore.

Track per-step results and per-dish aggregate scores for the multi-dish cooking task.
"""

from sqlalchemy import Integer, String, Float, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class CookingStepRecord(Base):
    """Individual cooking step outcome.

    One row per step activation (correct / wrong / missed).
    """
    __tablename__ = "cooking_step_records"
    __table_args__ = (
        Index("ix_cookstep_block_dish", "block_id", "dish_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    participant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("participants.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    block_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("blocks.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    dish_id: Mapped[str] = mapped_column(String(30), nullable=False)       # e.g. 'steak'
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)       # 0-based
    step_id: Mapped[str] = mapped_column(String(50), nullable=False)       # e.g. 'flip_steak'
    station: Mapped[str] = mapped_column(String(30), nullable=False)       # e.g. 'burner3'
    result: Mapped[str] = mapped_column(String(10), nullable=False)        # 'correct' | 'wrong' | 'missed'
    chosen_option: Mapped[str | None] = mapped_column(String(100), nullable=True)  # what participant selected
    correct_option: Mapped[str] = mapped_column(String(100), nullable=False)
    activated_at: Mapped[float] = mapped_column(Float, nullable=False)     # server timestamp when step became active
    completed_at: Mapped[float | None] = mapped_column(Float, nullable=True)  # when participant acted (or timeout)
    response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)  # ms from activation to action


class CookingDishScore(Base):
    """Aggregate score for one dish within a block."""
    __tablename__ = "cooking_dish_scores"
    __table_args__ = (
        Index("ix_cookdish_block", "block_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    participant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("participants.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    block_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("blocks.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    dish_id: Mapped[str] = mapped_column(String(30), nullable=False)       # e.g. 'spaghetti'
    total_steps: Mapped[int] = mapped_column(Integer, nullable=False)
    steps_correct: Mapped[int] = mapped_column(Integer, default=0)
    steps_wrong: Mapped[int] = mapped_column(Integer, default=0)
    steps_missed: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[float | None] = mapped_column(Float, nullable=True)
    completed_at: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)  # sum of all step response times
