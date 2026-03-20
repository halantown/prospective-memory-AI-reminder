"""Pydantic request/response schemas."""

from pydantic import BaseModel
from typing import Optional


class TokenStartRequest(BaseModel):
    token: str


class SessionStartResponse(BaseModel):
    session_id: str
    participant_id: str
    group: str
    condition_order: list[str]
    current_block: int


class ParticipantCreateResponse(BaseModel):
    participant_id: str
    group: str
    token: str
    session_id: str


class BlockEncodingResponse(BaseModel):
    block_number: int
    condition: str
    day_story: str
    pm_tasks: list[dict]


class NasaTLXRequest(BaseModel):
    mental_demand: int  # 1-21
    effort: int
    frustration: int


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


class StatusResponse(BaseModel):
    status: str
    current_block: Optional[int] = None
    phase: Optional[str] = None

