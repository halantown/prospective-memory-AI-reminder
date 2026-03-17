"""Experiment data endpoints (PRD v2.1).

Most data submission now goes through WebSocket. This module provides
only REST endpoints that are explicitly allowed:
- GET /api/game-items/{skin} — game items for a skin
- GET /api/session/{session_id}/export — CSV export for one session
"""

import csv
import io
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from core.config import DB_PATH
from core.config_loader import load_game_items
from core.database import get_db

logger = logging.getLogger("saturday.routes.experiment")

router = APIRouter()


# ── Game Items ─────────────────────────────────────────────

@router.get("/game-items/{skin}")
async def get_game_items(skin: str):
    """Return game items (email, grocery, podcast, etc.) for a given skin."""
    items = load_game_items(skin)
    if items is None:
        raise HTTPException(404, f"No game items found for skin '{skin}'")
    return {"skin": skin, "items": items}


# ── Session Export ─────────────────────────────────────────

@router.get("/session/{session_id}/export")
async def export_session(session_id: str):
    """Export PM trial data for one session as CSV."""
    db = get_db(DB_PATH)
    trials = db.execute(
        "SELECT * FROM pm_trials WHERE session_id = ? ORDER BY block_number, task_slot",
        (session_id,),
    ).fetchall()
    db.close()

    output = io.StringIO()
    if trials:
        writer = csv.DictWriter(output, fieldnames=trials[0].keys())
        writer.writeheader()
        for t in trials:
            writer.writerow(dict(t))

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=session_{session_id}.csv"},
    )
