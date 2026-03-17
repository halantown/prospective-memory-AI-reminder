"""Experiment data endpoints for PRD v2.0 state-driven flow."""

from __future__ import annotations

import csv
import io
import json
import logging
import time

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from core.config import DB_PATH
from core.config_loader import get_block_task_pair
from core.database import get_db
from core.session_lifecycle import SessionPhase, transition_phase
from models.schemas import (
    EncodingReport,
    FakeTriggerReport,
    OngoingScoreReport,
    PmActionReport,
    QuestionnaireReport,
)
from services.scoring import score_pm_action_with_error
from services.window_service import submit_to_window
from utils.helpers import log_action

logger = logging.getLogger("saturday.routes.experiment")

router = APIRouter()


def _session_row(db, session_id: str):
    row = db.execute(
        "SELECT participant_id, latin_square_group, condition_order, phase FROM sessions WHERE session_id = ?",
        (session_id,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Session not found")
    return row


def _condition_for_block(row, block_num: int) -> str:
    condition_order = json.loads(row["condition_order"])
    if block_num < 1 or block_num > len(condition_order):
        raise HTTPException(400, "Invalid block number")
    return condition_order[block_num - 1]


def _slot_for_task(block_num: int, task_id: str) -> str:
    task_a, task_b = get_block_task_pair(block_num)
    if task_id == task_a:
        return "A"
    if task_id == task_b:
        return "B"
    return "A"


@router.post("/session/{session_id}/block/{block_num}/encoding")
async def report_encoding(session_id: str, block_num: int, report: EncodingReport):
    logger.info("Encoding [%s] block=%s attempts=%s", session_id, block_num, report.quiz_attempts)

    db = get_db(DB_PATH)
    row = _session_row(db, session_id)
    condition = _condition_for_block(row, block_num)
    now = time.time()

    db.execute(
        """INSERT INTO encoding_logs (session_id, block_number, quiz_attempts, confirmed_at)
           VALUES (?, ?, ?, ?)""",
        (session_id, block_num, report.quiz_attempts, now),
    )

    task_a, task_b = get_block_task_pair(block_num)
    for slot, task_id in (("A", task_a), ("B", task_b)):
        db.execute(
            """INSERT INTO pm_trials
               (participant_id, session_id, block_number, task_slot, task_id, condition,
                participant_group, encoding_confirmed_at, encoding_quiz_attempts, pm_score)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
               ON CONFLICT(session_id, block_number, task_slot)
               DO UPDATE SET
                  task_id = excluded.task_id,
                  condition = excluded.condition,
                  participant_id = COALESCE(pm_trials.participant_id, excluded.participant_id),
                  participant_group = COALESCE(pm_trials.participant_group, excluded.participant_group),
                  encoding_confirmed_at = excluded.encoding_confirmed_at,
                  encoding_quiz_attempts = excluded.encoding_quiz_attempts""",
            (
                row["participant_id"],
                session_id,
                block_num,
                slot,
                task_id,
                condition,
                row["latin_square_group"],
                now,
                report.quiz_attempts,
            ),
        )

    try:
        transition_phase(db, session_id, SessionPhase.ENCODING, block_idx=block_num)
    except Exception:
        db.execute(
            "UPDATE sessions SET phase = ?, current_block = ? WHERE session_id = ?",
            (SessionPhase.ENCODING.value, block_num, session_id),
        )

    db.commit()
    db.close()

    log_action(session_id, block_num, "encoding_confirm", {"quiz_attempts": report.quiz_attempts})
    return {"status": "ok"}


@router.post("/session/{session_id}/block/{block_num}/action")
async def report_pm_action(session_id: str, block_num: int, report: PmActionReport):
    score, error_type = score_pm_action_with_error(report.task_id, report)

    window_result = submit_to_window(session_id, report.task_id, score)
    if "error" in window_result:
        logger.info("PM window check [%s] task=%s -> %s", session_id, report.task_id, window_result["error"])
        if window_result["error"] == "no_active_window":
            log_action(
                session_id,
                block_num,
                "pm_action_no_window",
                {"task_id": report.task_id, "action": report.action, "client_ts": report.client_ts},
            )
        return {"received": True}

    db = get_db(DB_PATH)
    row = _session_row(db, session_id)
    condition = _condition_for_block(row, block_num)

    slot = report.task_slot or _slot_for_task(block_num, report.task_id)

    existing = db.execute(
        """SELECT id, first_pm_interaction_at FROM pm_trials
           WHERE session_id = ? AND block_number = ? AND task_slot = ?""",
        (session_id, block_num, slot),
    ).fetchone()

    if existing and existing["first_pm_interaction_at"] is not None:
        logger.warning("Duplicate PM action [%s] block=%s slot=%s", session_id, block_num, slot)
        db.close()
        return {"received": True}

    action_payload = {
        "task_id": report.task_id,
        "task_slot": slot,
        "action": report.action,
        "selected_target": report.selected_target,
        "selected_detail": report.selected_detail,
        "choice": report.choice,
        "client_ts": report.client_ts,
    }

    now = time.time()
    db.execute(
        """INSERT INTO pm_trials
           (participant_id, session_id, block_number, task_slot, task_id, condition,
            participant_group, first_pm_interaction_at, pm_action_taken, pm_score, pm_error_type, acted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(session_id, block_number, task_slot)
           DO UPDATE SET
             task_id = excluded.task_id,
             condition = excluded.condition,
             participant_id = COALESCE(pm_trials.participant_id, excluded.participant_id),
             participant_group = COALESCE(pm_trials.participant_group, excluded.participant_group),
             first_pm_interaction_at = COALESCE(pm_trials.first_pm_interaction_at, excluded.first_pm_interaction_at),
             pm_action_taken = excluded.pm_action_taken,
             pm_score = excluded.pm_score,
             pm_error_type = excluded.pm_error_type,
             acted_at = excluded.acted_at""",
        (
            row["participant_id"],
            session_id,
            block_num,
            slot,
            report.task_id,
            condition,
            row["latin_square_group"],
            now,
            json.dumps(action_payload),
            score,
            error_type,
            now,
        ),
    )

    db.commit()
    db.close()

    log_action(
        session_id,
        block_num,
        "pm_action",
        {
            **action_payload,
            "score": score,
            "pm_error_type": error_type,
        },
    )

    # Blind scoring: participant-facing client never receives PM score.
    return {"received": True}


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


@router.post("/session/{session_id}/block/{block_num}/fake")
async def report_fake_trigger(session_id: str, block_num: int, report: FakeTriggerReport):
    db = get_db(DB_PATH)
    db.execute(
        """INSERT INTO fake_trigger_logs (session_id, block_number, trigger_type, response, false_alarm, ts)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (session_id, block_num, report.trigger_type, report.response, report.false_alarm, time.time()),
    )
    db.commit()
    db.close()

    log_action(
        session_id,
        block_num,
        "fake_trigger",
        {
            "trigger_type": report.trigger_type,
            "response": report.response,
            "false_alarm": report.false_alarm,
        },
    )
    return {"status": "ok"}


@router.post("/session/{session_id}/questionnaire")
async def report_questionnaire(session_id: str, report: QuestionnaireReport):
    db = get_db(DB_PATH)
    db.execute(
        """INSERT INTO questionnaire_logs
           (session_id, block_number, perceived_intrusiveness, perceived_helpfulness,
            ongoing_interaction_count, open_comment, ts)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            session_id,
            report.block_number,
            report.intrusiveness,
            report.helpfulness,
            report.ongoing_interaction_count,
            report.comment,
            time.time(),
        ),
    )
    db.commit()
    db.close()
    return {"status": "ok"}


@router.post("/session/{session_id}/block/{block_num}/reminder-room")
async def report_reminder_room(session_id: str, block_num: int, body: dict):
    slot = body.get("slot", "?")
    room = body.get("room", "unknown")
    activity = body.get("activity")
    client_ts = body.get("client_ts")

    db = get_db(DB_PATH)
    db.execute(
        """INSERT INTO reminder_room_logs
           (session_id, block_number, slot, room, activity, client_ts, server_ts)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (session_id, block_num, slot, room, activity, client_ts, time.time()),
    )
    db.commit()
    db.close()

    log_action(
        session_id,
        block_num,
        "reminder_room",
        {"slot": slot, "room": room, "activity": activity, "client_ts": client_ts},
    )

    return {"status": "ok"}


@router.get("/session/{session_id}/export")
async def export_session(session_id: str):
    db = get_db(DB_PATH)
    trials = db.execute(
        """
        SELECT *
        FROM pm_trials
        WHERE session_id = ?
        ORDER BY block_number, task_slot
        """,
        (session_id,),
    ).fetchall()
    db.close()

    output = io.StringIO()
    if trials:
        writer = csv.DictWriter(output, fieldnames=trials[0].keys())
        writer.writeheader()
        for row in trials:
            writer.writerow(dict(row))

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=session_{session_id}.csv"},
    )
