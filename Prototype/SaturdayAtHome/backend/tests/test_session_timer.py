import json
import time

from core.database import get_db
from core.session_lifecycle import (
    compute_session_timer_s,
    mark_session_offline,
    mark_session_online,
)


def _insert_session(db_path, session_id: str):
    db = get_db(db_path)
    db.execute(
        """INSERT INTO sessions
           (session_id, participant_id, latin_square_group, condition_order, phase, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (session_id, "P777", "A", json.dumps(["LowAF_LowCB"] * 4), "encoding", time.time()),
    )
    db.commit()
    db.close()


def test_mark_session_online_initializes_timer(tmp_db_path):
    sid = "timer-on-1"
    _insert_session(tmp_db_path, sid)

    mark_session_online(sid, db_path=tmp_db_path)

    db = get_db(tmp_db_path)
    row = db.execute(
        "SELECT is_online, timer_started_at, timer_running_since, timer_elapsed_s "
        "FROM sessions WHERE session_id = ?",
        (sid,),
    ).fetchone()
    db.close()

    assert row["is_online"] == 1
    assert row["timer_started_at"] is not None
    assert row["timer_running_since"] is not None
    assert float(row["timer_elapsed_s"] or 0.0) == 0.0


def test_mark_session_offline_accumulates_elapsed(tmp_db_path):
    sid = "timer-off-1"
    _insert_session(tmp_db_path, sid)

    db = get_db(tmp_db_path)
    now = time.time()
    db.execute(
        "UPDATE sessions SET timer_elapsed_s = ?, timer_running_since = ?, is_online = 1 WHERE session_id = ?",
        (7.0, now - 3.5, sid),
    )
    db.commit()
    db.close()

    mark_session_offline(sid, db_path=tmp_db_path)

    db = get_db(tmp_db_path)
    row = db.execute(
        "SELECT is_online, timer_running_since, timer_elapsed_s FROM sessions WHERE session_id = ?",
        (sid,),
    ).fetchone()
    db.close()

    assert row["is_online"] == 0
    assert row["timer_running_since"] is None
    assert float(row["timer_elapsed_s"]) >= 10.0


def test_compute_session_timer_s_with_running_row(tmp_db_path):
    sid = "timer-calc-1"
    _insert_session(tmp_db_path, sid)

    db = get_db(tmp_db_path)
    now = time.time()
    db.execute(
        "UPDATE sessions SET timer_elapsed_s = ?, timer_running_since = ? WHERE session_id = ?",
        (5.0, now - 2.0, sid),
    )
    db.commit()
    row = db.execute(
        "SELECT timer_elapsed_s, timer_running_since FROM sessions WHERE session_id = ?",
        (sid,),
    ).fetchone()
    db.close()

    value = compute_session_timer_s(row, now=now)
    assert value >= 7.0
