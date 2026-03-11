import asyncio
import json
import sqlite3
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from database import init_db, get_db
from timeline import BlockTimeline

DB_PATH = Path(__file__).parent / "experiment.db"

# Active SSE connections: session_id -> list of asyncio.Queue
sse_queues: dict[str, list[asyncio.Queue]] = {}
# Active block timelines: session_id -> BlockTimeline
active_timelines: dict[str, BlockTimeline] = {}


# ── Hob state tracking ────────────────────────────────────

class HobStatus(str, Enum):
    EMPTY = "empty"
    COOKING = "cooking"
    READY = "ready"
    BURNING = "burning"


DIFFICULTY_CONFIG = {
    "slow":   {"cooking_ms": 25000, "ready_ms": 15000, "max_steaks": 2},
    "medium": {"cooking_ms": 18000, "ready_ms": 6000,  "max_steaks": 3},
    "fast":   {"cooking_ms": 12000, "ready_ms": 6000,  "max_steaks": 3},
}


@dataclass
class Hob:
    id: int
    status: HobStatus = HobStatus.EMPTY
    started_at: float = 0.0


# Per-session hob state (in-memory)
session_hobs: dict[str, list[Hob]] = {}


def get_session_hobs(session_id: str) -> list[Hob]:
    if session_id not in session_hobs:
        session_hobs[session_id] = [Hob(id=i) for i in range(3)]
    return session_hobs[session_id]


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db(DB_PATH)
    yield
    for tl in active_timelines.values():
        tl.cancel()


app = FastAPI(title="Saturday At Home — Experiment Server", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic models ────────────────────────────────────────

class SessionStartRequest(BaseModel):
    participant_id: str

class SessionStartResponse(BaseModel):
    session_id: str
    participant_id: str
    group: str
    condition_order: list[str]

class EncodingReport(BaseModel):
    quiz_attempts: int = 1

class PmActionReport(BaseModel):
    task_id: str
    action: Optional[str] = None
    selected_target: Optional[str] = None
    selected_detail: Optional[str] = None

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


# ── Latin Square stub ──────────────────────────────────────

LATIN_SQUARE = {
    "A": ["LowAF_LowCB", "HighAF_LowCB", "LowAF_HighCB", "HighAF_HighCB"],
    "B": ["HighAF_LowCB", "LowAF_HighCB", "HighAF_HighCB", "LowAF_LowCB"],
    "C": ["LowAF_HighCB", "HighAF_HighCB", "LowAF_LowCB", "HighAF_LowCB"],
    "D": ["HighAF_HighCB", "LowAF_LowCB", "HighAF_LowCB", "LowAF_HighCB"],
}

TASK_PAIRS = {1: ("medicine_a", "medicine_b"), 2: ("laundry_c", "laundry_d"),
              3: ("comm_e", "comm_f"), 4: ("chores_g", "chores_h")}

_session_counter = 0

def assign_group() -> str:
    global _session_counter
    groups = list(LATIN_SQUARE.keys())
    group = groups[_session_counter % len(groups)]
    _session_counter += 1
    return group


# ── Scoring logic ──────────────────────────────────────────

def score_pm_action(task_id: str, action: PmActionReport) -> int:
    """Score PM action: 0=miss, 1=wrong, 2=correct"""
    if action.action is None and action.selected_target is None:
        return 0

    scoring = {
        "medicine_a": lambda a: 2 if a.selected_target == "round_red" and a.selected_detail == "1_tablet" else (1 if a.selected_target else 0),
        "medicine_b": lambda a: 2 if a.selected_target == "orange_round" and a.selected_detail == "1_tablet" else (1 if a.selected_target else 0),
        "laundry_c":  lambda a: 2 if a.action == "shirt_rack_jeans_dryer" else (1 if a.action else 0),
        "laundry_d":  lambda a: 2 if a.action == "shirt_only" else (1 if a.action else 0),
        "comm_e":     lambda a: 2 if a.selected_target == "li_wei" and a.selected_detail == "restaurant_b" else (1 if a.selected_target else 0),
        "comm_f":     lambda a: 2 if a.selected_detail == "3pm" else (1 if a.selected_detail else 0),
        "chores_g":   lambda a: 2 if a.action == "off_black_pepper" else (1 if a.action else 0),
        "chores_h":   lambda a: 2 if a.selected_target == "blue_bag" else (1 if a.selected_target else 0),
    }
    scorer = scoring.get(task_id)
    return scorer(action) if scorer else 0


# ── SSE helpers ────────────────────────────────────────────

async def send_sse(session_id: str, event: str, data: dict):
    """Push an SSE event to all connected clients for this session."""
    if session_id not in sse_queues:
        return
    payload = {"event": event, "data": data, "ts": time.time()}
    for q in sse_queues[session_id]:
        await q.put(payload)


# ── API Endpoints ──────────────────────────────────────────

@app.post("/session/start", response_model=SessionStartResponse)
async def start_session(req: SessionStartRequest):
    session_id = str(uuid.uuid4())[:8]
    group = assign_group()
    condition_order = LATIN_SQUARE[group]

    db = get_db(DB_PATH)
    db.execute(
        """INSERT INTO sessions (session_id, participant_id, latin_square_group, condition_order, phase, created_at)
           VALUES (?, ?, ?, ?, 'welcome', ?)""",
        (session_id, req.participant_id, group, json.dumps(condition_order), time.time()),
    )
    db.commit()
    db.close()

    return SessionStartResponse(
        session_id=session_id,
        participant_id=req.participant_id,
        group=group,
        condition_order=condition_order,
    )


@app.get("/session/{session_id}/block/{block_num}")
async def get_block_config(session_id: str, block_num: int):
    db = get_db(DB_PATH)
    row = db.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
    db.close()

    if not row:
        raise HTTPException(404, "Session not found")

    condition_order = json.loads(row["condition_order"])
    if block_num < 1 or block_num > 4:
        raise HTTPException(400, "Block number must be 1-4")

    condition = condition_order[block_num - 1]
    task_pair = TASK_PAIRS[block_num]

    # Placeholder reminder texts
    reminder_texts = {
        "LowAF_LowCB": "By the way, remember — after dinner today, take your medicine.",
        "HighAF_LowCB": "By the way, remember — after dinner today, take your Doxycycline from the red round bottle, the one your cardiologist prescribed.",
        "LowAF_HighCB": "I can see you're keeping an eye on the stove. By the way — after dinner today, remember to take your medicine.",
        "HighAF_HighCB": "I can see you're keeping an eye on the stove. By the way — after dinner today, take your Doxycycline from the red round bottle, the one your cardiologist prescribed.",
    }

    return {
        "block_number": block_num,
        "condition": condition,
        "task_pair_id": block_num,
        "task_a": task_pair[0],
        "task_b": task_pair[1],
        "reminder_text_a": reminder_texts.get(condition, ""),
        "reminder_text_b": reminder_texts.get(condition, ""),
    }


@app.get("/session/{session_id}/block/{block_num}/stream")
async def block_stream(session_id: str, block_num: int):
    """SSE endpoint — pushes block timeline events to the frontend."""

    queue: asyncio.Queue = asyncio.Queue()
    if session_id not in sse_queues:
        sse_queues[session_id] = []
    sse_queues[session_id].append(queue)

    # Start block timeline if not already running
    timeline_key = f"{session_id}_{block_num}"
    if timeline_key not in active_timelines:
        # Get block config
        db = get_db(DB_PATH)
        row = db.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
        db.close()

        if row:
            condition_order = json.loads(row["condition_order"])
            condition = condition_order[block_num - 1] if block_num <= len(condition_order) else "HighAF_HighCB"

            tl = BlockTimeline(session_id, block_num, condition, send_sse)
            active_timelines[timeline_key] = tl
            asyncio.create_task(tl.run())

    async def event_generator():
        try:
            while True:
                payload = await asyncio.wait_for(queue.get(), timeout=60)
                yield f"event: {payload['event']}\ndata: {json.dumps(payload['data'])}\n\n"
        except asyncio.TimeoutError:
            yield f"event: keepalive\ndata: {{}}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            if session_id in sse_queues:
                sse_queues[session_id].remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@app.post("/session/{session_id}/block/{block_num}/encoding")
async def report_encoding(session_id: str, block_num: int, report: EncodingReport):
    db = get_db(DB_PATH)
    db.execute(
        """INSERT INTO encoding_logs (session_id, block_number, quiz_attempts, confirmed_at)
           VALUES (?, ?, ?, ?)""",
        (session_id, block_num, report.quiz_attempts, time.time()),
    )
    db.commit()
    db.close()
    return {"status": "ok"}


@app.post("/session/{session_id}/block/{block_num}/action")
async def report_pm_action(session_id: str, block_num: int, report: PmActionReport):
    score = score_pm_action(report.task_id, report)

    db = get_db(DB_PATH)
    # Deduplicate
    existing = db.execute(
        "SELECT id FROM pm_trials WHERE session_id = ? AND block_number = ? AND task_id = ?",
        (session_id, block_num, report.task_id),
    ).fetchone()

    if existing:
        db.close()
        return {"status": "duplicate", "score": score}

    db.execute(
        """INSERT INTO pm_trials (session_id, block_number, task_id, action, selected_target, selected_detail, pm_score, acted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (session_id, block_num, report.task_id, report.action, report.selected_target, report.selected_detail, score, time.time()),
    )
    db.commit()
    db.close()

    return {"status": "ok", "score": score}


@app.post("/session/{session_id}/block/{block_num}/steak-action")
async def report_steak_action(session_id: str, block_num: int, report: SteakActionReport):
    """Validate and apply a steak action (flip/serve/clean)."""
    hobs = get_session_hobs(session_id)
    if report.hob_id < 0 or report.hob_id >= len(hobs):
        raise HTTPException(400, "Invalid hob_id")

    hob = hobs[report.hob_id]
    score = 0

    if report.action == "flip" and hob.status == HobStatus.READY:
        hob.status = HobStatus.COOKING
        hob.started_at = time.time()
        score = 5
    elif report.action == "serve" and hob.status == HobStatus.READY:
        hob.status = HobStatus.EMPTY
        hob.started_at = 0.0
        score = 5
    elif report.action == "clean" and hob.status == HobStatus.BURNING:
        hob.status = HobStatus.EMPTY
        hob.started_at = 0.0
        score = 0
    else:
        raise HTTPException(
            400,
            f"Invalid action '{report.action}' for hob status '{hob.status.value}'",
        )

    # Log score delta
    db = get_db(DB_PATH)
    db.execute(
        """INSERT INTO ongoing_snapshots (session_id, block_number, ts, delta, cumulative)
           VALUES (?, ?, ?, ?, 0)""",
        (session_id, block_num, time.time(), score),
    )
    db.commit()
    db.close()

    return {"status": "ok", "score": score, "hob_status": hob.status.value}
async def report_ongoing(session_id: str, block_num: int, report: OngoingScoreReport):
    db = get_db(DB_PATH)
    db.execute(
        """INSERT INTO ongoing_snapshots (session_id, block_number, ts, delta, cumulative)
           VALUES (?, ?, ?, ?, ?)""",
        (session_id, block_num, report.ts, report.delta, report.cumulative),
    )
    db.commit()
    db.close()
    return {"status": "ok"}


@app.post("/session/{session_id}/block/{block_num}/fake")
async def report_fake_trigger(session_id: str, block_num: int, report: FakeTriggerReport):
    db = get_db(DB_PATH)
    db.execute(
        """INSERT INTO fake_trigger_logs (session_id, block_number, trigger_type, response, false_alarm, ts)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (session_id, block_num, report.trigger_type, report.response, report.false_alarm, time.time()),
    )
    db.commit()
    db.close()
    return {"status": "ok"}


@app.post("/session/{session_id}/questionnaire")
async def report_questionnaire(session_id: str, report: QuestionnaireReport):
    db = get_db(DB_PATH)
    db.execute(
        """INSERT INTO questionnaire_logs (session_id, intrusiveness, helpfulness, comment, ts)
           VALUES (?, ?, ?, ?, ?)""",
        (session_id, report.intrusiveness, report.helpfulness, report.comment, time.time()),
    )
    db.commit()
    db.close()
    return {"status": "ok"}


@app.get("/session/{session_id}/export")
async def export_session(session_id: str):
    db = get_db(DB_PATH)
    trials = db.execute("SELECT * FROM pm_trials WHERE session_id = ?", (session_id,)).fetchall()
    db.close()

    import csv
    import io
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)
