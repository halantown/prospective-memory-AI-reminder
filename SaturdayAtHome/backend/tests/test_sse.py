import asyncio

from core import sse


def test_send_sse_and_generator():
    async def run():
        sid = "session-x"
        q = sse.register_client(sid)

        await sse.send_sse(sid, "test_event", {"ok": True})
        gen = sse.event_generator(sid, q)
        msg = await gen.__anext__()
        assert "event: test_event" in msg
        assert "\"ok\": true" in msg

        await gen.aclose()

    asyncio.run(run())
