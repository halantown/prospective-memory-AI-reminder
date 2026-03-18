"""WebSocket event hub — bidirectional WS: server push + client messages.

Server → Client: timeline events via send_ws()
Client → Server: trigger_click, mcq_answer, encoding_result, ongoing_batch,
                 questionnaire, heartbeat
"""

import asyncio
import json
import logging
import time
from typing import Any

from starlette.websockets import WebSocket, WebSocketDisconnect

from core.config_loader import get_pm_task, get_config
from services.scoring import score_mcq
from services.window_service import open_window, close_window, get_window, submit_to_window

logger = logging.getLogger("saturday.ws")

# Active WebSocket subscriber queues: session_id → list[asyncio.Queue]
ws_queues: dict[str, list[asyncio.Queue]] = {}
_PUMP_IDLE_TIMEOUT_S = 5

# Sentinel value — pushed to queues on shutdown to unblock websocket pumps
_WS_SHUTDOWN = object()
_shutting_down = False


# ── Server → Client push ───────────────────────────────────

async def send_ws(session_id: str, event: str, data: dict):
    """Push an event to all connected WebSocket clients for one session.

    Special handling:
    - trigger_fire: opens an execution window
    - window_close: closes the execution window, records miss if not submitted
    """
    if _shutting_down:
        return

    if event == "trigger_fire":
        task_id = data.get("task_id")
        window_ms = data.get("window_ms", 30000)
        if task_id:
            open_window(session_id, task_id, window_ms)

    elif event == "window_close":
        task_id = data.get("task_id")
        if task_id:
            close_window(session_id, task_id, reason="missed")
            _record_pm_miss(session_id, data)

    logger.info(f"WS [{session_id}] → {event}: {data}")

    if session_id not in ws_queues:
        return

    payload = {"event": event, "data": data, "ts": time.time()}
    for q in list(ws_queues.get(session_id, [])):
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            pass


def _record_pm_miss(session_id: str, data: dict):
    """Record a PM miss (score=0, prospective_failure) when window closes without action."""
    task_id = data.get("task_id")
    if not task_id:
        return
    w = get_window(session_id, task_id)
    if w and w.status == "missed":
        try:
            from core.config import DB_PATH
            from core.database import get_db
            db = get_db(DB_PATH)
            db.execute(
                """UPDATE pm_trials SET
                    pm_score = 0,
                    pm_error_type = 'prospective_failure'
                   WHERE session_id = ? AND task_id = ? AND pm_error_type IS NULL AND trigger_clicked_at IS NULL""",
                (session_id, task_id),
            )
            db.commit()
            db.close()
        except Exception as e:
            logger.error(f"Failed to record PM miss: {e}")


# ── Client → Server message handlers ──────────────────────

def handle_client_message(session_id: str, msg: dict, block_num: int) -> dict | None:
    """Dispatch a client WS message and return optional response payload."""
    msg_type = msg.get("type")
    data = msg.get("data", {})

    if msg_type == "trigger_click":
        return _handle_trigger_click(session_id, data)

    elif msg_type == "mcq_answer":
        return _handle_mcq_answer(session_id, data, block_num)

    elif msg_type == "encoding_result":
        return _handle_encoding_result(session_id, data, block_num)

    elif msg_type == "ongoing_batch":
        return _handle_ongoing_batch(session_id, data, block_num)

    elif msg_type == "questionnaire":
        return _handle_questionnaire(session_id, data)

    elif msg_type == "heartbeat":
        return _handle_heartbeat(session_id)

    else:
        logger.warning(f"WS [{session_id}] unknown message type: {msg_type}")
        return None


def _handle_trigger_click(session_id: str, data: dict) -> dict | None:
    """Check if task_id has an active window. If yes, return MCQ data."""
    task_id = data.get("task_id")
    if not task_id:
        return {"event": "error", "data": {"message": "missing task_id"}}

    w = get_window(session_id, task_id)
    if w is None or w.status != "open":
        logger.info(f"WS [{session_id}] trigger_click for {task_id}: no active window")
        return {"event": "trigger_ack", "data": {"task_id": task_id, "active": False}}

    # Record click time
    w_click_ts = time.time()

    task = get_pm_task(task_id)
    if not task:
        return {"event": "error", "data": {"message": f"unknown task_id: {task_id}"}}

    mcq = task.get("mcq", {})
    logger.info(f"WS [{session_id}] trigger_click for {task_id}: window active, sending MCQ")

    # Log trigger click
    from utils.helpers import log_action
    log_action(session_id, 0, "trigger_click", {
        "task_id": task_id, "click_ts": w_click_ts,
    })

    # Update pm_trials with trigger click time
    try:
        from core.config import DB_PATH
        from core.database import get_db
        db = get_db(DB_PATH)
        db.execute(
            "UPDATE pm_trials SET trigger_clicked_at = ?, trigger_response_time_ms = ? "
            "WHERE session_id = ? AND task_id = ? AND trigger_clicked_at IS NULL",
            (w_click_ts, int((w_click_ts - w.opened_at) * 1000), session_id, task_id),
        )
        db.commit()
        db.close()
    except Exception as e:
        logger.error(f"Failed to update trigger click time: {e}")

    return {
        "event": "mcq_data",
        "data": {
            "task_id": task_id,
            "question": mcq.get("question", "") or f"What should you do for the '{task_id}' task?",
            "options": mcq.get("options", []),
        },
    }


def _handle_mcq_answer(session_id: str, data: dict, block_num: int) -> dict:
    """Score MCQ, log to DB, return ack (no score revealed)."""
    task_id = data.get("task_id", "")
    selected = data.get("selected")
    client_ts = data.get("client_ts")

    if selected is None:
        return {"event": "mcq_result", "data": {"received": True}}

    score, error_type = score_mcq(task_id, selected)
    logger.info(f"WS [{session_id}] mcq_answer task={task_id} selected={selected} score={score}")

    # Submit to window
    submit_to_window(session_id, task_id, score)

    # Update pm_trials
    try:
        from core.config import DB_PATH
        from core.database import get_db
        db = get_db(DB_PATH)
        db.execute(
            """UPDATE pm_trials SET
                mcq_option_selected = ?,
                mcq_response_time_ms = ?,
                pm_score = ?,
                pm_error_type = ?
               WHERE session_id = ? AND task_id = ? AND mcq_option_selected IS NULL""",
            (selected, int(data.get("mcq_response_time_ms", data.get("response_time_ms", 0))),
             score, error_type, session_id, task_id),
        )
        db.commit()
        db.close()
    except Exception as e:
        logger.error(f"Failed to update MCQ answer: {e}")

    from utils.helpers import log_action
    log_action(session_id, block_num, "mcq_answer", {
        "task_id": task_id, "selected": selected, "client_ts": client_ts,
    })

    # Per rule: never return score to client
    return {"event": "mcq_result", "data": {"received": True}}


def _handle_encoding_result(session_id: str, data: dict, block_num: int) -> dict:
    """Record encoding quiz result."""
    task_id = data.get("task_id", "")
    quiz_attempts = data.get("quiz_attempts", 1)

    try:
        from core.config import DB_PATH
        from core.database import get_db
        db = get_db(DB_PATH)
        db.execute(
            """INSERT INTO encoding_logs (session_id, block_number, task_id, quiz_attempts, confirmed_at)
               VALUES (?, ?, ?, ?, ?)""",
            (session_id, block_num, task_id, quiz_attempts, time.time()),
        )
        db.commit()
        db.close()
    except Exception as e:
        logger.error(f"Failed to record encoding result: {e}")

    from utils.helpers import log_action
    log_action(session_id, block_num, "encoding_confirm", {
        "task_id": task_id, "quiz_attempts": quiz_attempts,
    })

    return {"event": "encoding_ack", "data": {"received": True}}


def _handle_ongoing_batch(session_id: str, data: dict, block_num: int) -> dict:
    """Record a batch of ongoing task responses."""
    game_type = data.get("game_type", "")
    game_skin = data.get("skin", data.get("game_skin", ""))
    responses = data.get("responses", [])

    if responses:
        try:
            from core.config import DB_PATH
            from core.database import get_db
            db = get_db(DB_PATH)
            now = time.time()
            rows = [
                (session_id, block_num, game_type, game_skin,
                 r.get("item_id"), r.get("response"), r.get("correct"),
                 r.get("response_time_ms"), r.get("ts", now))
                for r in responses
            ]
            db.executemany(
                """INSERT INTO ongoing_responses
                   (session_id, block_number, game_type, game_skin,
                    item_id, response, correct, response_time_ms, ts)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                rows,
            )
            db.commit()
            db.close()
        except Exception as e:
            logger.error(f"Failed to record ongoing batch: {e}")

    return {"event": "ongoing_ack", "data": {"received": True, "count": len(responses)}}


def _handle_questionnaire(session_id: str, data: dict) -> dict:
    """Record post-block or final questionnaire."""
    try:
        from core.config import DB_PATH
        from core.database import get_db
        db = get_db(DB_PATH)
        db.execute(
            """INSERT INTO questionnaire_logs
               (session_id, block_number, intrusiveness, helpfulness, comment, ts)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (session_id, str(data.get("block")), data.get("intrusiveness"),
             data.get("helpfulness"),
             data.get("comment") or data.get("open_feedback"),
             time.time()),
        )
        # Store extra final questionnaire fields if present
        if data.get("mse_score") is not None:
            db.execute(
                """INSERT INTO questionnaire_logs
                   (session_id, block_number, intrusiveness, helpfulness, comment, ts)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (session_id, "final_mse", data.get("mse_score"),
                 data.get("strategy_use"),
                 data.get("open_feedback"),
                 time.time()),
            )
        db.commit()
        db.close()
    except Exception as e:
        logger.error(f"Failed to record questionnaire: {e}")

    return {"event": "questionnaire_ack", "data": {"received": True}}


def _handle_heartbeat(session_id: str) -> dict | None:
    """Update last_heartbeat in DB."""
    try:
        from core.config import DB_PATH
        from core.database import get_db
        db = get_db(DB_PATH)
        db.execute(
            "UPDATE sessions SET last_heartbeat = ?, is_interrupted = 0 WHERE session_id = ?",
            (time.time(), session_id),
        )
        db.commit()
        db.close()
    except Exception as e:
        logger.error(f"Failed to update heartbeat: {e}")
    return None  # No response needed for heartbeat


# ── WebSocket registration and pump ───────────────────────

def register_ws_client(session_id: str) -> asyncio.Queue:
    """Register a new WS subscriber queue for this session."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=256)
    if session_id not in ws_queues:
        ws_queues[session_id] = []
    ws_queues[session_id].append(queue)
    return queue


def unregister_ws_client(session_id: str, queue: asyncio.Queue):
    """Remove a WS subscriber queue."""
    if session_id in ws_queues and queue in ws_queues[session_id]:
        ws_queues[session_id].remove(queue)
    logger.info(f"WS disconnect [{session_id}]")


async def websocket_pump(session_id: str, queue: asyncio.Queue, websocket: WebSocket):
    """Forward queued events to an accepted websocket connection.

    Sends a keepalive event every few seconds when idle.
    """
    try:
        while not _shutting_down:
            try:
                payload: Any = await asyncio.wait_for(queue.get(), timeout=_PUMP_IDLE_TIMEOUT_S)
                if payload is _WS_SHUTDOWN:
                    break
            except asyncio.TimeoutError:
                payload = {"event": "keepalive", "data": {}, "ts": time.time()}
            await websocket.send_json(payload)
    except (WebSocketDisconnect, RuntimeError):
        pass
    except asyncio.CancelledError:
        pass
    finally:
        unregister_ws_client(session_id, queue)


async def websocket_receiver(session_id: str, block_num: int, websocket: WebSocket):
    """Listen for client→server WS messages and dispatch to handlers.

    Returns response payloads directly to the sending client.
    """
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning(f"WS [{session_id}] invalid JSON: {raw[:100]}")
                continue

            logger.debug(f"WS [{session_id}] ← {msg.get('type', '?')}")
            response = handle_client_message(session_id, msg, block_num)
            if response is not None:
                await websocket.send_json({**response, "ts": time.time()})
    except (WebSocketDisconnect, RuntimeError):
        pass
    except asyncio.CancelledError:
        pass


def shutdown_all_ws_queues():
    """Signal every connected WS client pump to stop. Called during shutdown."""
    global _shutting_down
    _shutting_down = True
    for queues in ws_queues.values():
        for q in queues:
            try:
                q.put_nowait(_WS_SHUTDOWN)
            except asyncio.QueueFull:
                pass
    logger.info("WS: shutdown sentinel pushed to all queues")


def clear_session_ws_queues(session_id: str):
    """Remove all WS queues for a session (on delete)."""
    ws_queues.pop(session_id, None)
