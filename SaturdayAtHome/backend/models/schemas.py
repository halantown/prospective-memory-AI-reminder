"""Pydantic request/response models for the API."""

from typing import Optional
from pydantic import BaseModel


# ── Session ────────────────────────────────────────────────

class TokenSessionStartRequest(BaseModel):
    token: str


class SessionStartResponse(BaseModel):
    session_id: str
    participant_id: str
    group: str
    condition_order: list[str]


class SessionResumeResponse(BaseModel):
    phase: str
    block_idx: int
    elapsed_t: float
    condition: Optional[str] = None
