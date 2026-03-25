import asyncio

from core import ws
from models.entities import HobStatus
from services.hob_service import get_session_hobs, clear_session_hobs


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


def test_steak_spawn_reroutes_when_target_hob_busy():
    async def run():
        sid = "session-steak-reroute"
        queue = ws.register_ws_client(sid)
        hobs = get_session_hobs(sid)
        hobs[0].status = HobStatus.BURNING
        hobs[1].status = HobStatus.EMPTY
        hobs[2].status = HobStatus.EMPTY

        try:
            await ws.send_ws(sid, "steak_spawn", {"hob_id": 0, "duration": {"cooking": 9000, "ready": 3000}})
            payload = await asyncio.wait_for(queue.get(), timeout=0.2)
            assert payload["event"] == "steak_spawn"
            assert payload["data"]["hob_id"] == 1
            assert hobs[1].status == HobStatus.COOKING_SIDE1
            assert hobs[1].cooking_ms == 9000
            assert hobs[1].ready_ms == 3000
        finally:
            ws.unregister_ws_client(sid, queue)
            ws.clear_session_ws_queues(sid)
            clear_session_hobs(sid)

    asyncio.run(run())
