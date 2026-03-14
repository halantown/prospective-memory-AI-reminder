import asyncio

from core import sse
from routes.session import block_stream


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


def test_block_stream_bootstraps_keepalive():
    async def run():
        sid = "session-bootstrap"
        resp = await block_stream(sid, 1, auto_start=False)
        msg = await resp.body_iterator.__anext__()
        assert "event: keepalive" in msg
        await resp.body_iterator.aclose()

    asyncio.run(run())
