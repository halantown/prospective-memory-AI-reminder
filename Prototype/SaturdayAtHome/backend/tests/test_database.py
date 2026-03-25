import sqlite3

from core.database import init_db


def test_init_db_creates_tables(tmp_path):
    db_path = tmp_path / "db.sqlite"
    init_db(db_path)
    conn = sqlite3.connect(str(db_path))
    cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = {row[0] for row in cur.fetchall()}
    conn.close()
    assert "sessions" in tables
    assert "pm_trials" in tables
    assert "block_events" in tables
