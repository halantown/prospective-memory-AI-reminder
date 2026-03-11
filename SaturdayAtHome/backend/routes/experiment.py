"""Experiment data endpoints — encoding, PM action, steak, ongoing, fake trigger, questionnaire, export."""

import asyncio
import csv
import io
import logging
import time

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from core.config import DB_PATH
from core.database import get_db
from utils.helpers import log_action
from models.entities import HobStatus
from services.hob_service import get_session_hobs, reconcile_hob, schedule_respawn
from models.schemas import (
    EncodingReport, PmActionReport, SteakActionReport,
    OngoingScoreReport, FakeTriggerReport, QuestionnaireReport,
)
from services.scoring import score_pm_action
from core.sse import send_sse

logger = logging.getLogger("saturday.routes.experiment")

router = APIRouter()


# ── Encoding ───────────────────────────────────────────────

@router.post("/session/{session_id}/block/{block_num}/encoding")
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


# ── PM Action ──────────────────────────────────────────────

@router.post("/session/{session_id}/block/{block_num}/action")
async def report_pm_action(session_id: str, block_num: int, report: PmActionReport):
    score = score_pm_action(report.task_id, report)
    logger.info(
        f"PM action [{session_id}] block={block_num} task={report.task_id} "
        f"action={report.action} target={report.selected_target} detail={report.selected_detail} → score={score}"
    )

    db = get_db(DB_PATH)
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


# ── Steak Action ───────────────────────────────────────────

@router.post("/session/{session_id}/block/{block_num}/steak-action")
async def report_steak_action(session_id: str, block_num: int, report: SteakActionReport):
    """Validate and apply a steak action (flip/serve/clean)."""
    hobs = get_session_hobs(session_id)
    if report.hob_id < 0 or report.hob_id >= len(hobs):
        raise HTTPException(400, "Invalid hob_id")

    hob = hobs[report.hob_id]
    reconcile_hob(hob)
    prev_status = hob.status.value
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

    logger.info(
        f"Steak [{session_id}] hob={report.hob_id} {report.action}: "
        f"{prev_status} → {hob.status.value} (score={score})"
    )
    log_action(session_id, block_num, f"steak_{report.action}", {
        "hob_id": report.hob_id, "prev_status": prev_status,
        "new_status": hob.status.value, "score": score,
    })

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
        asyncio.create_task(schedule_respawn(session_id, block_num, report.hob_id, send_sse))

    return {"status": "ok", "score": score, "hob_status": hob.status.value}


# ── Ongoing Score ──────────────────────────────────────────

@router.post("/session/{session_id}/block/{block_num}/ongoing")
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


# ── Fake Trigger ───────────────────────────────────────────

@router.post("/session/{session_id}/block/{block_num}/fake")
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


# ── Questionnaire ──────────────────────────────────────────

@router.post("/session/{session_id}/questionnaire")
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


# ── Data Export ────────────────────────────────────────────

@router.get("/session/{session_id}/export")
async def export_session(session_id: str):
    db = get_db(DB_PATH)
    trials = db.execute("SELECT * FROM pm_trials WHERE session_id = ?", (session_id,)).fetchall()
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
