"""Session lifecycle — phase state machine, token generation, admin broadcast."""

import asyncio
import json
import logging
import random
import string
import time
from enum import Enum

logger = logging.getLogger("saturday.lifecycle")

# ── Admin broadcast ─────────────────────────────────────────

admin_queues: list[asyncio.Queue] = []
_admin_shutdown = False
_ADMIN_SHUTDOWN = object()


def broadcast_admin(event: dict):
    for q in list(admin_queues):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass


def register_admin_client() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=256)
    admin_queues.append(q)
    return q


def unregister_admin_client(q: asyncio.Queue):
    if q in admin_queues:
        admin_queues.remove(q)


def shutdown_admin_queues():
    global _admin_shutdown
    _admin_shutdown = True
    for q in admin_queues:
        try:
            q.put_nowait(_ADMIN_SHUTDOWN)
        except asyncio.QueueFull:
            pass


# ── SessionPhase ────────────────────────────────────────────

class SessionPhase(str, Enum):
    CREATED     = "created"
    ENCODING    = "encoding"
    BLOCK       = "block"
    INTER_BLOCK = "inter_block"
    FINISHED    = "finished"


TRANSITIONS: dict[SessionPhase, set[SessionPhase]] = {
    SessionPhase.CREATED:      {SessionPhase.ENCODING},
    SessionPhase.ENCODING:     {SessionPhase.BLOCK},
    SessionPhase.BLOCK:        {SessionPhase.INTER_BLOCK, SessionPhase.FINISHED},
    SessionPhase.INTER_BLOCK:  {SessionPhase.ENCODING, SessionPhase.BLOCK},
    SessionPhase.FINISHED:     set(),
}


def transition_phase(db, session_id: str, to_phase: SessionPhase,
                     block_idx: int | None = None, **broadcast_extra):
    """Apply a phase transition in the DB and broadcast to admin channel."""
    row = db.execute(
        "SELECT phase, current_block, participant_id, latin_square_group FROM sessions WHERE session_id = ?",
        (session_id,),
    ).fetchone()
    if not row:
        raise ValueError(f"Session {session_id} not found")

    from_phase = SessionPhase(row["phase"])
    if to_phase not in TRANSITIONS[from_phase]:
        raise ValueError(f"Invalid transition {from_phase} → {to_phase}")

    updates: dict = {"phase": to_phase.value}
    if block_idx is not None:
        updates["current_block"] = block_idx

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    db.execute(
        f"UPDATE sessions SET {set_clause} WHERE session_id = ?",
        (*updates.values(), session_id),
    )
    db.execute(
        """INSERT INTO session_events
           (session_id, event_type, from_phase, to_phase, block_idx, payload, ts)
           VALUES (?, 'phase_transition', ?, ?, ?, '{}', ?)""",
        (session_id, from_phase.value, to_phase.value, block_idx, time.time()),
    )
    db.commit()

    broadcast_admin({
        "session_id": session_id,
        "participant_id": row["participant_id"],
        "group": row["latin_square_group"],
        "event_type": "phase_transition",
        "from": from_phase.value,
        "to": to_phase.value,
        "block_idx": block_idx,
        "timestamp": time.time(),
        **broadcast_extra,
    })
    logger.info(f"Session {session_id}: {from_phase.value} → {to_phase.value} (block={block_idx})")


# ── Token & participant ID generation ───────────────────────

_CHARSET = string.ascii_uppercase + string.digits


def generate_token(db) -> str:
    for _ in range(20):
        token = "".join(random.choices(_CHARSET, k=6))
        if not db.execute("SELECT 1 FROM sessions WHERE token = ?", (token,)).fetchone():
            return token
    raise RuntimeError("Could not generate unique token")


def next_participant_id(db) -> str:
    row = db.execute(
        "SELECT participant_id FROM sessions WHERE participant_id LIKE 'P%' "
        "ORDER BY participant_id DESC LIMIT 1"
    ).fetchone()
    if not row:
        return "P001"
    try:
        n = int(row["participant_id"][1:]) + 1
    except ValueError:
        n = 1
    return f"P{n:03d}"


# ── Background heartbeat monitor ────────────────────────────

async def heartbeat_monitor(db_path, active_timelines: dict):
    """Background task: marks sessions as interrupted if heartbeat lost > 30s."""
    import sqlite3
    from pathlib import Path

    while True:
        await asyncio.sleep(15)
        try:
            conn = sqlite3.connect(str(db_path))
            conn.row_factory = sqlite3.Row
            now = time.time()
            rows = conn.execute(
                "SELECT session_id, participant_id, latin_square_group, last_heartbeat "
                "FROM sessions WHERE phase = 'block' AND is_interrupted = 0"
            ).fetchall()
            for row in rows:
                last = row["last_heartbeat"]
                if last and (now - last) > 30:
                    conn.execute(
                        "UPDATE sessions SET is_interrupted = 1 WHERE session_id = ?",
                        (row["session_id"],),
                    )
                    conn.execute(
                        """INSERT INTO session_events
                           (session_id, event_type, from_phase, to_phase, block_idx, payload, ts)
                           VALUES (?, 'heartbeat_lost', 'block', NULL, NULL, '{}', ?)""",
                        (row["session_id"], now),
                    )
                    conn.commit()
                    broadcast_admin({
                        "session_id": row["session_id"],
                        "participant_id": row["participant_id"],
                        "group": row["latin_square_group"],
                        "event_type": "heartbeat_lost",
                        "timestamp": now,
                    })
                    logger.warning(f"Session {row['session_id']}: heartbeat lost, marking interrupted")
            conn.close()
        except Exception as e:
            logger.error(f"heartbeat_monitor error: {e}")
