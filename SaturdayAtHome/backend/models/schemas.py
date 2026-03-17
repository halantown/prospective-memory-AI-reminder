"""Pydantic request/response models for the API."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


# ── Session ───────────────────────────────────────────────────────────────────

class SessionStartRequest(BaseModel):
    participant_id: str


class SessionStartResponse(BaseModel):
    session_id: str
    participant_id: str
    group: str
    condition_order: list[str]


class ParticipantCreateResponse(BaseModel):
    participant_id: str
    group: str
    token: str


class TokenSessionStartRequest(BaseModel):
    token: str


class SessionResumeResponse(BaseModel):
    phase: str
    block_idx: int
    elapsed_t: float
    condition: Optional[str] = None


# ── Experiment data reports ──────────────────────────────────────────────────

class EncodingReport(BaseModel):
    quiz_attempts: int = 1


class PmActionReport(BaseModel):
    task_id: str
    task_slot: Optional[str] = None
    action: Optional[str] = None
    selected_target: Optional[str] = None
    selected_detail: Optional[str] = None
    choice: Optional[dict[str, Any]] = None
    client_ts: Optional[float] = None


class OngoingScoreReport(BaseModel):
    ts: float
    delta: int
    cumulative: int


class FakeTriggerReport(BaseModel):
    trigger_type: str
    response: Optional[str] = None
    false_alarm: bool = False


class QuestionnaireReport(BaseModel):
    block_number: Optional[int] = None
    intrusiveness: Optional[int] = None
    helpfulness: Optional[int] = None
    ongoing_interaction_count: Optional[int] = None
    comment: Optional[str] = None


class SteakActionReport(BaseModel):
    hob_id: int
    action: str


# ── Admin ─────────────────────────────────────────────────────────────────────

class FireEventRequest(BaseModel):
    session_id: str
    event: str
    data: dict[str, Any] = {}
