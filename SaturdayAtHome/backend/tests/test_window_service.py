import time

from services import window_service as ws


def test_window_open_submit_close():
    sid = "s1"
    task = "medicine_a"
    ws.reset_session_windows(sid)
    w = ws.open_window(sid, task, window_ms=1000)
    assert w.status == "open"

    res = ws.submit_to_window(sid, task, score=2)
    assert res == {"received": True}
    w2 = ws.get_window(sid, task)
    assert w2.status == "submitted"
    assert w2.score == 2

    w3 = ws.close_window(sid, task)
    assert w3.status == "submitted"


def test_window_too_late():
    sid = "s2"
    task = "medicine_b"
    ws.reset_session_windows(sid)
    w = ws.open_window(sid, task, window_ms=1)
    w.closes_at = time.time() - 1
    res = ws.submit_to_window(sid, task, score=1)
    assert res == {"error": "too_late"}
    assert ws.get_window(sid, task).status == "missed"
