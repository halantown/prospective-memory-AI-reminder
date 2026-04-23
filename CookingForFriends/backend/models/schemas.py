"""Pydantic request/response schemas."""

from pydantic import BaseModel, Field
from typing import Optional


class TokenStartRequest(BaseModel):
    token: str


class SessionStartResponse(BaseModel):
    session_id: str
    participant_id: str
    condition: str


class ParticipantCreateResponse(BaseModel):
    participant_id: str
    condition: str
    token: str
    session_id: str


class BlockEncodingResponse(BaseModel):
    condition: str
    day_story: str
    cards: list[dict]


class DebriefRequest(BaseModel):
    demographic: dict
    preference: dict
    open_responses: dict
    manipulation_check: Optional[dict] = None


class PMAttemptMessage(BaseModel):
    action: str
    target_selected: Optional[str] = None
    room: str
    timestamp: float


class QuizAnswerItem(BaseModel):
    trial_number: int
    question_type: str  # "trigger" | "target" | "action"
    selected_answer: str
    response_time_ms: Optional[int] = None


class QuizSubmitRequest(BaseModel):
    answers: list[QuizAnswerItem]


class EncodingQuizAttemptRequest(BaseModel):
    """Single quiz attempt during encoding — sent per question."""
    trial_number: int
    question_type: str  # "trigger" | "target" | "action"
    attempt_number: int
    selected_answer: str
    correct_answer: str
    is_correct: bool
    response_time_ms: Optional[int] = None


class QuizResultItem(BaseModel):
    trial_number: int
    question_type: str
    is_correct: bool
    correct_answer: str
    attempt_number: int


class QuizSubmitResponse(BaseModel):
    results: list[QuizResultItem]
    all_correct: bool
    failed_trials: list[int]  # trial numbers that had wrong answers


class ReminderImportItem(BaseModel):
    """Schema for a single reminder in the batch import payload."""
    task_type: str
    condition: str
    text: str
    context_activity: Optional[str] = None
    audio_url: Optional[str] = None
    metadata: Optional[dict] = None


class StatusResponse(BaseModel):
    status: str
    phase: Optional[str] = None

