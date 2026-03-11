"""Pydantic request/response models for the API."""

from typing import Optional
from pydantic import BaseModel


# ── Session ────────────────────────────────────────────────

class SessionStartRequest(BaseModel):
    participant_id: str


class SessionStartResponse(BaseModel):
    session_id: str
    participant_id: str
    group: str
    condition_order: list[str]


# ── Experiment data reports ────────────────────────────────

class EncodingReport(BaseModel):
    quiz_attempts: int = 1


class PmActionReport(BaseModel):
    task_id: str
    action: Optional[str] = None
    selected_target: Optional[str] = None
    selected_detail: Optional[str] = None
    choice: Optional[dict] = None  # Structured tasks like medicine: {bottle, amount}
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
    intrusiveness: Optional[int] = None
    helpfulness: Optional[int] = None
    comment: Optional[str] = None


class SteakActionReport(BaseModel):
    hob_id: int
    action: str  # "flip", "serve", "clean"


# ── Admin ──────────────────────────────────────────────────

class FireEventRequest(BaseModel):
    session_id: str
    event: str
    data: dict = {}
