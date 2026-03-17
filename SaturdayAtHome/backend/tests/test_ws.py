import asyncio

from core import ws
from services import window_service


class DummyWebSocket:
    def __init__(self):
        self.messages = []

    async def send_json(self, payload):
        self.messages.append(payload)


def test_send_ws_and_pump():
    async def run():
        sid = "session-x"
        queue = ws.register_ws_client(sid)
        await ws.send_ws(sid, "test_event", {"ok": True})

        dummy = DummyWebSocket()
        task = asyncio.create_task(ws.websocket_pump(sid, queue, dummy))
        try:
            for _ in range(20):
                if dummy.messages:
                    break
                await asyncio.sleep(0.01)
            assert dummy.messages
            assert dummy.messages[0]["event"] == "test_event"
            assert dummy.messages[0]["data"]["ok"] is True
        finally:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            ws.clear_session_ws_queues(sid)

    asyncio.run(run())


def test_register_unregister_and_clear_ws_clients():
    sid = "session-y"
    q1 = ws.register_ws_client(sid)
    q2 = ws.register_ws_client(sid)
    assert sid in ws.ws_queues
    assert len(ws.ws_queues[sid]) == 2

    ws.unregister_ws_client(sid, q1)
    assert len(ws.ws_queues[sid]) == 1

    ws.unregister_ws_client(sid, q2)
    ws.clear_session_ws_queues(sid)
    assert sid not in ws.ws_queues


def test_room_transition_updates_runtime_state():
    async def run():
        sid = "session-room-state"
        queue = ws.register_ws_client(sid)
        try:
            await ws.send_ws(
                sid,
                "room_transition",
                {"room": "living_room", "activity": "message_processing", "narrative": "Move"},
            )
            payload = await asyncio.wait_for(queue.get(), timeout=0.2)
            assert payload["event"] == "room_transition"
            state = ws.get_runtime_state(sid)
            assert state["current_room"] == "living_room"
            assert state["current_activity"] == "message_processing"
        finally:
            ws.unregister_ws_client(sid, queue)
            ws.clear_session_ws_queues(sid)

    asyncio.run(run())


def test_trigger_open_and_close_updates_window_service():
    async def run():
        sid = "session-window"
        task_id = "medicine"
        window_service.reset_session_windows(sid)
        await ws.send_ws(sid, "trigger_appear", {"task_id": task_id, "window_ms": 30000})
        w = window_service.get_window(sid, task_id)
        assert w is not None
        assert w.status == "open"

        await ws.send_ws(sid, "window_close", {"task_id": task_id})
        w2 = window_service.get_window(sid, task_id)
        assert w2 is not None
        assert w2.status == "missed"

    asyncio.run(run())
