import json
import time

import core.timeline as timeline
from core.database import get_db
from core.event_schedule import EventType


def test_update_actual_t_backfills_first_pending_row(tmp_db_path, monkeypatch):
    monkeypatch.setattr(timeline, "DB_PATH", tmp_db_path)

    sid = "session-timeline"
    now = time.time()
    db = get_db(tmp_db_path)
    db.execute(
        """INSERT INTO sessions
           (session_id, participant_id, latin_square_group, condition_order, phase, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (sid, "P999", "A", json.dumps(["HighAF_HighCB"] * 4), "created", now),
    )
    db.execute(
        """INSERT INTO block_events
           (session_id, block_num, event_type, scheduled_t, is_fixed, payload, seed, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (sid, 1, EventType.BLOCK_START.value, 0.0, 1, "{}", 42, now),
    )
    db.execute(
        """INSERT INTO block_events
           (session_id, block_num, event_type, scheduled_t, is_fixed, payload, seed, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (sid, 1, EventType.BLOCK_START.value, 0.0, 1, "{}", 42, now + 1),
    )
    db.commit()
    db.close()

    timeline._update_actual_t(sid, 1, EventType.BLOCK_START, 1.23)

    db = get_db(tmp_db_path)
    rows = db.execute(
        """SELECT actual_t FROM block_events
           WHERE session_id = ? AND block_num = ? AND event_type = ?
           ORDER BY id""",
        (sid, 1, EventType.BLOCK_START.value),
    ).fetchall()
    db.close()

    assert rows[0]["actual_t"] == 1.23
    assert rows[1]["actual_t"] is None
