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

import logging
import random

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("saturday")

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
    "slow":   {"cooking_ms": 20000, "ready_ms": 5000, "max_steaks": 2},
    "medium": {"cooking_ms": 13000, "ready_ms": 4000, "max_steaks": 3},
    "fast":   {"cooking_ms": 9000,  "ready_ms": 3000, "max_steaks": 3},
}


@dataclass
class Hob:
    id: int
    status: HobStatus = HobStatus.EMPTY
    started_at: float = 0.0
    cooking_ms: float = 18000
    ready_ms: float = 6000


# Per-session hob state (in-memory)
session_hobs: dict[str, list[Hob]] = {}


def get_session_hobs(session_id: str) -> list[Hob]:
    if session_id not in session_hobs:
        session_hobs[session_id] = [Hob(id=i) for i in range(3)]
    return session_hobs[session_id]


def reconcile_hob(hob: Hob):
    """Update hob status based on elapsed time — keeps backend in sync with frontend."""
    if hob.status == HobStatus.EMPTY or hob.started_at <= 0:
        return
    elapsed_ms = (time.time() - hob.started_at) * 1000

    if hob.status == HobStatus.COOKING and elapsed_ms >= hob.cooking_ms:
        if elapsed_ms >= hob.cooking_ms + hob.ready_ms:
            hob.status = HobStatus.BURNING
            hob.started_at = 0.0
        else:
            hob.status = HobStatus.READY
            hob.started_at = hob.started_at + hob.cooking_ms / 1000.0
    elif hob.status == HobStatus.READY and elapsed_ms >= hob.ready_ms:
        hob.status = HobStatus.BURNING
        hob.started_at = 0.0


def log_action(session_id: str, block_num: int, action_type: str, payload: dict = None):
    """Persist an action log entry to the database."""
    try:
        db = get_db(DB_PATH)
        db.execute(
            "INSERT INTO action_logs (session_id, block_number, action_type, payload, ts) VALUES (?, ?, ?, ?, ?)",
            (session_id, block_num, action_type, json.dumps(payload) if payload else None, time.time()),
        )
        db.commit()
        db.close()
    except Exception as e:
        logger.error(f"Failed to log action: {e}")


async def _schedule_respawn(session_id: str, block_num: int, hob_id: int):
    """Wait 15-25s then send steak_spawn SSE if the hob is still empty."""
    delay = 15 + random.random() * 10
    logger.info(f"Respawn scheduled [{session_id}] hob={hob_id} in {delay:.1f}s")
    await asyncio.sleep(delay)
    hobs = get_session_hobs(session_id)
    if hob_id < len(hobs) and hobs[hob_id].status == HobStatus.EMPTY:
        cfg = DIFFICULTY_CONFIG.get("medium")
        dur = {"cooking": cfg["cooking_ms"], "ready": cfg["ready_ms"]}
        # send_sse handles setting hob state + durations
        await send_sse(session_id, "steak_spawn", {"hob_id": hob_id, "duration": dur})
        logger.info(f"Respawned steak [{session_id}] hob={hob_id}")


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
    choice: Optional[dict] = None  # For structured tasks like medicine: {bottle, amount}
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
    """Score PM action: 0=miss, 1=partial, 2=correct"""
    if action.action == "not_sure":
        return 0
    if action.action is None and action.selected_target is None and action.choice is None:
        return 0

    # Correct answers (backend-only, never sent to frontend)
    CORRECT = {
        "medicine_a": {"bottle": "round_red",    "amount": "2 tablets"},
        "medicine_b": {"bottle": "round_orange",  "amount": "1000mg × 1"},
    }

    def score_medicine(a):
        correct = CORRECT.get(task_id)
        if not correct or not a.choice:
            return 0
        bottle_ok = a.choice.get("bottle") == correct["bottle"]
        amount_ok = a.choice.get("amount") == correct["amount"]
        if bottle_ok and amount_ok:
            return 2
        if bottle_ok or amount_ok:
            return 1
        return 0

    scoring = {
        "medicine_a": score_medicine,
        "medicine_b": score_medicine,
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
    # For steak_spawn from timeline: only spawn on empty hobs, update backend state
    if event == "steak_spawn":
        hobs = get_session_hobs(session_id)
        hob_id = data.get("hob_id", 0)
        if 0 <= hob_id < len(hobs):
            reconcile_hob(hobs[hob_id])
            if hobs[hob_id].status != HobStatus.EMPTY:
                logger.info(f"SSE [{session_id}] → steak_spawn hob={hob_id} SKIPPED (status={hobs[hob_id].status.value})")
                return
            dur = data.get("duration", {})
            hobs[hob_id].status = HobStatus.COOKING
            hobs[hob_id].started_at = time.time()
            hobs[hob_id].cooking_ms = dur.get("cooking", DIFFICULTY_CONFIG["medium"]["cooking_ms"])
            hobs[hob_id].ready_ms = dur.get("ready", DIFFICULTY_CONFIG["medium"]["ready_ms"])

    logger.info(f"SSE [{session_id}] → {event}: {data}")
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

    logger.info(f"Session started: {session_id} (participant={req.participant_id}, group={group})")
    log_action(session_id, 0, "session_start", {"participant_id": req.participant_id, "group": group})

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
async def block_stream(session_id: str, block_num: int, auto_start: bool = True):
    """SSE endpoint — pushes block timeline events to the frontend.
    
    Use auto_start=false from dashboard to observe without triggering timeline.
    """
    logger.info(f"SSE connect [{session_id}] block={block_num} auto_start={auto_start}")

    queue: asyncio.Queue = asyncio.Queue()
    if session_id not in sse_queues:
        sse_queues[session_id] = []
    sse_queues[session_id].append(queue)

    # Start block timeline if not already running (skip when auto_start=false)
    if auto_start:
        timeline_key = f"{session_id}_{block_num}"
        if timeline_key not in active_timelines:
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
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"event: {payload['event']}\ndata: {json.dumps(payload['data'])}\n\n"
                except asyncio.TimeoutError:
                    yield f"event: keepalive\ndata: {{}}\n\n"
        except asyncio.CancelledError:
            pass
        except GeneratorExit:
            pass
        finally:
            if session_id in sse_queues and queue in sse_queues[session_id]:
                sse_queues[session_id].remove(queue)
            logger.info(f"SSE disconnect [{session_id}]")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@app.post("/session/{session_id}/block/{block_num}/encoding")
async def report_encoding(session_id: str, block_num: int, report: EncodingReport):
    logger.info(f"Encoding [{session_id}] block={block_num} attempts={report.quiz_attempts}")
    db = get_db(DB_PATH)
    db.execute(
        """INSERT INTO encoding_logs (session_id, block_number, quiz_attempts, confirmed_at)
           VALUES (?, ?, ?, ?)""",
        (session_id, block_num, report.quiz_attempts, time.time()),
    )
    db.commit()
    db.close()
    log_action(session_id, block_num, "encoding_confirm", {"quiz_attempts": report.quiz_attempts})
    return {"status": "ok"}


@app.post("/session/{session_id}/block/{block_num}/action")
async def report_pm_action(session_id: str, block_num: int, report: PmActionReport):
    score = score_pm_action(report.task_id, report)
    logger.info(
        f"PM action [{session_id}] block={block_num} task={report.task_id} "
        f"action={report.action} target={report.selected_target} detail={report.selected_detail} → score={score}"
    )

    db = get_db(DB_PATH)
    # Deduplicate
    existing = db.execute(
        "SELECT id FROM pm_trials WHERE session_id = ? AND block_number = ? AND task_id = ?",
        (session_id, block_num, report.task_id),
    ).fetchone()

    if existing:
        logger.warning(f"Duplicate PM action [{session_id}] task={report.task_id}")
        db.close()
        return {"status": "duplicate", "score": score}

    db.execute(
        """INSERT INTO pm_trials (session_id, block_number, task_id, action, selected_target, selected_detail, pm_score, acted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (session_id, block_num, report.task_id, report.action, report.selected_target, report.selected_detail, score, time.time()),
    )
    db.commit()
    db.close()

    log_action(session_id, block_num, "pm_action", {
        "task_id": report.task_id, "action": report.action,
        "selected_target": report.selected_target, "selected_detail": report.selected_detail,
        "choice": report.choice, "client_ts": report.client_ts,
        "score": score,
    })

    return {"status": "ok", "score": score}


@app.post("/session/{session_id}/block/{block_num}/steak-action")
async def report_steak_action(session_id: str, block_num: int, report: SteakActionReport):
    """Validate and apply a steak action (flip/serve/clean)."""
    hobs = get_session_hobs(session_id)
    if report.hob_id < 0 or report.hob_id >= len(hobs):
        raise HTTPException(400, "Invalid hob_id")

    hob = hobs[report.hob_id]
    # Reconcile time-based state before validating the action
    reconcile_hob(hob)
    prev_status = hob.status.value
    score = 0

    if report.action == "flip" and hob.status == HobStatus.READY:
        hob.status = HobStatus.COOKING
        hob.started_at = time.time()
        # Keep existing cooking_ms/ready_ms from this steak
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

    logger.info(
        f"Steak [{session_id}] hob={report.hob_id} {report.action}: "
        f"{prev_status} → {hob.status.value} (score={score})"
    )
    log_action(session_id, block_num, f"steak_{report.action}", {
        "hob_id": report.hob_id, "prev_status": prev_status,
        "new_status": hob.status.value, "score": score,
    })

    # Log score delta
    db = get_db(DB_PATH)
    db.execute(
        """INSERT INTO ongoing_snapshots (session_id, block_number, ts, delta, cumulative)
           VALUES (?, ?, ?, ?, 0)""",
        (session_id, block_num, time.time(), score),
    )
    db.commit()
    db.close()

    # Schedule respawn via SSE after serve/clean (15-25s delay)
    if report.action in ("serve", "clean"):
        asyncio.create_task(_schedule_respawn(session_id, block_num, report.hob_id))

    return {"status": "ok", "score": score, "hob_status": hob.status.value}


@app.post("/session/{session_id}/block/{block_num}/ongoing")
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
    logger.info(
        f"Fake trigger [{session_id}] block={block_num} type={report.trigger_type} "
        f"response={report.response} false_alarm={report.false_alarm}"
    )
    db = get_db(DB_PATH)
    db.execute(
        """INSERT INTO fake_trigger_logs (session_id, block_number, trigger_type, response, false_alarm, ts)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (session_id, block_num, report.trigger_type, report.response, report.false_alarm, time.time()),
    )
    db.commit()
    db.close()
    log_action(session_id, block_num, "fake_trigger", {
        "trigger_type": report.trigger_type, "response": report.response,
        "false_alarm": report.false_alarm,
    })
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


# ── Admin / Dashboard Endpoints ───────────────────────────

class FireEventRequest(BaseModel):
    session_id: str
    event: str
    data: dict = {}


@app.post("/admin/fire-event")
async def admin_fire_event(req: FireEventRequest):
    """Manually fire an SSE event to a session (from dashboard)."""
    logger.info(f"Admin fire [{req.session_id}] → {req.event}: {req.data}")
    await send_sse(req.session_id, req.event, req.data)

    # Update backend hob state for force_yellow events (send_sse handles steak_spawn)
    if req.event == "force_yellow_steak":
        hobs = get_session_hobs(req.session_id)
        hob_id = req.data.get("hob_id", 0)
        if 0 <= hob_id < len(hobs):
            hobs[hob_id].status = HobStatus.READY
            hobs[hob_id].started_at = time.time()

    log_action(req.session_id, 0, f"admin_{req.event}", req.data)
    return {"status": "ok"}


@app.get("/admin/sessions")
async def admin_list_sessions():
    """List all sessions."""
    db = get_db(DB_PATH)
    rows = db.execute("SELECT * FROM sessions ORDER BY created_at DESC").fetchall()
    db.close()
    return [dict(r) for r in rows]


@app.get("/admin/session/{session_id}/state")
async def admin_session_state(session_id: str):
    """Get live session state (hobs, SSE clients, timelines)."""
    hobs = get_session_hobs(session_id)
    for h in hobs:
        reconcile_hob(h)
    return {
        "hobs": [{"id": h.id, "status": h.status.value, "started_at": h.started_at, "cooking_ms": h.cooking_ms, "ready_ms": h.ready_ms} for h in hobs],
        "active_timelines": [k for k in active_timelines.keys() if k.startswith(session_id)],
        "sse_clients": len(sse_queues.get(session_id, [])),
    }


@app.get("/admin/logs/{session_id}")
async def admin_get_logs(session_id: str):
    """Get action logs for a session (most recent first)."""
    db = get_db(DB_PATH)
    rows = db.execute(
        "SELECT * FROM action_logs WHERE session_id = ? ORDER BY ts DESC LIMIT 100",
        (session_id,),
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]


@app.get("/admin/active-session")
async def admin_active_session():
    """Find the currently active session (has SSE clients connected)."""
    for sid, queues in sse_queues.items():
        if len(queues) > 0:
            db = get_db(DB_PATH)
            row = db.execute("SELECT * FROM sessions WHERE session_id = ?", (sid,)).fetchone()
            db.close()
            if row:
                return dict(row)
    # Fallback: return most recent session
    db = get_db(DB_PATH)
    row = db.execute("SELECT * FROM sessions ORDER BY created_at DESC LIMIT 1").fetchone()
    db.close()
    return dict(row) if row else None


@app.delete("/admin/session/{session_id}")
async def admin_delete_session(session_id: str):
    """Delete a session and all its data."""
    db = get_db(DB_PATH)
    db.execute("DELETE FROM action_logs WHERE session_id = ?", (session_id,))
    db.execute("DELETE FROM pm_trials WHERE session_id = ?", (session_id,))
    db.execute("DELETE FROM encoding_logs WHERE session_id = ?", (session_id,))
    db.execute("DELETE FROM ongoing_snapshots WHERE session_id = ?", (session_id,))
    db.execute("DELETE FROM fake_trigger_logs WHERE session_id = ?", (session_id,))
    db.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
    db.commit()
    db.close()
    # Clean up in-memory state
    if session_id in session_hobs:
        del session_hobs[session_id]
    if session_id in sse_queues:
        del sse_queues[session_id]
    tl_key = f"{session_id}"
    for k in list(active_timelines.keys()):
        if k.startswith(tl_key):
            active_timelines[k].cancel()
            del active_timelines[k]
    logger.info(f"Admin: deleted session {session_id}")
    return {"status": "ok"}


@app.get("/admin/export/{session_id}")
async def admin_export_session(session_id: str):
    """Export session data as JSON."""
    db = get_db(DB_PATH)
    session = db.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
    actions = db.execute("SELECT * FROM action_logs WHERE session_id = ? ORDER BY ts", (session_id,)).fetchall()
    pm_trials = db.execute("SELECT * FROM pm_trials WHERE session_id = ?", (session_id,)).fetchall()
    db.close()
    return {
        "session": dict(session) if session else None,
        "actions": [dict(r) for r in actions],
        "pm_trials": [dict(r) for r in pm_trials],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)
