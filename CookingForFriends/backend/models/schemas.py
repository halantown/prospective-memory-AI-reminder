"""Pydantic request/response schemas."""

from pydantic import BaseModel, Field
from typing import Optional, Any


# ---------------------------------------------------------------------------
# Session start / status
# ---------------------------------------------------------------------------

class TokenStartRequest(BaseModel):
    token: str


class SessionStartResponse(BaseModel):
    session_id: str
    participant_id: str
    condition: str
    task_order: str
    is_test: bool
    current_phase: str
    cooking_definitions: dict[str, Any]


class StatusResponse(BaseModel):
    status: str
    phase: Optional[str] = None


class SessionStateResponse(BaseModel):
    """Full state snapshot returned on reconnect."""
    session_id: str
    phase: str
    frozen: bool
    game_time_elapsed_s: float
    pipeline_step: Optional[str] = None   # None if no active pipeline
    current_task_id: Optional[str] = None
    is_test: bool
    incomplete: bool


# ---------------------------------------------------------------------------
# Phase transitions
# ---------------------------------------------------------------------------

class PhaseUpdateRequest(BaseModel):
    phase_name: str          # e.g. "encoding", "playing", "post_questionnaire"
    event_type: str          # "start" | "end"


class PhaseAdvanceRequest(BaseModel):
    next_phase: Optional[str] = None


class PhaseAdvanceResponse(BaseModel):
    previous_phase: str
    current_phase: str


class ExperimentResponseItem(BaseModel):
    phase: Optional[str] = None
    question_id: str
    response_type: str
    value: Any = None
    timestamp: Optional[float] = None
    metadata: Optional[dict[str, Any]] = None


class ExperimentResponsesSubmitRequest(BaseModel):
    responses: list[ExperimentResponseItem]


class ManipulationCheckSubmitRequest(BaseModel):
    phase: str
    task_id: str
    selected_option_id: str
    response_time_ms: Optional[int] = None


# ---------------------------------------------------------------------------
# Encoding / cutscene logging
# ---------------------------------------------------------------------------

class CutsceneEventRequest(BaseModel):
    task_id: str                              # "T1" – "T4"
    segment_index: int                        # 0-based index (stored as segment_number=index+1)
    viewed_at: Optional[float] = None         # client-side game time (s) when shown
    duration_ms: Optional[float] = None       # how long it was displayed
    placeholder: Optional[str] = None        # placeholder constant string (for audit)
    detail_check_selected: Optional[int] = None   # 0-based option index selected
    detail_check_correct: Optional[bool] = None
    detail_check_correct_index: Optional[int] = None


class IntentionCheckRequest(BaseModel):
    task_id: str                  # "T1" – "T4"
    task_position: int            # 1-based position in task_order
    selected_index: int           # 0-based option index selected
    correct_index: int            # 0-based correct option index
    is_correct: bool
    response_time_ms: Optional[int] = None


# ---------------------------------------------------------------------------
# PM pipeline step logging
# ---------------------------------------------------------------------------

class PMGreetingCompleteRequest(BaseModel):
    task_id: str
    game_time: float


class PMReminderAckRequest(BaseModel):
    task_id: str
    game_time: float


class PMDecoySelectedRequest(BaseModel):
    task_id: str
    decoy_options_order: list[str]    # shuffled ids in displayed order
    selected_option: str
    decoy_correct: bool
    response_time_ms: int


class PMConfidenceRatedRequest(BaseModel):
    task_id: str
    confidence_rating: int
    response_time_ms: int


class PMActionCompleteRequest(BaseModel):
    task_id: str
    action_animation_start_time: float
    action_animation_complete_time: float


class FakeTriggerAckRequest(BaseModel):
    scheduled_game_time: float
    trigger_type: str


class MouseTrackingBatchRequest(BaseModel):
    session_id: str
    records: list[dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Admin participant management
# ---------------------------------------------------------------------------

class AdminParticipantCreateRequest(BaseModel):
    """Optional manual override for condition + order; omit for auto-assign."""
    condition: Optional[str] = None
    task_order: Optional[str] = None


class ParticipantCreateResponse(BaseModel):
    participant_id: str
    condition: str
    task_order: str
    token: str
    session_id: str
    entry_url: str
    is_test: bool = False


class TestSessionRequest(BaseModel):
    condition: str          # "EE1" | "EE0"
    order: str              # "A" | "B" | "C" | "D"
    start_phase: str        # "welcome" | "consent" | "introduction" | "encoding" | "playing" | "post_questionnaire"


class TestSessionResponse(BaseModel):
    token: str
    entry_url: str
    session_id: str


# ---------------------------------------------------------------------------
# Old schemas kept for backward-compatible endpoints (encoding quiz, debrief)
# ---------------------------------------------------------------------------

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
