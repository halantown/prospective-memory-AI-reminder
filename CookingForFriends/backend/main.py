"""Cooking for Friends — Experiment Platform Backend.

Entry point for FastAPI application.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import HOST, PORT
from database import init_db
from engine.timeline import cancel_all

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown."""
    logger.info("Starting Cooking for Friends backend...")
    await init_db()
    logger.info("Database initialized")

    # Set db factory for timeline execution window callbacks
    from engine.timeline import set_db_factory
    set_db_factory(async_session)

    yield
    logger.info("Shutting down...")
    cancel_all()


app = FastAPI(
    title="Cooking for Friends — Experiment Platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
from routers.session import router as session_router
from routers.admin import router as admin_router

app.include_router(session_router)
app.include_router(admin_router)

# --- WebSocket endpoints (at /ws/*, no /api prefix) ---
from fastapi import WebSocket as _WebSocket
from database import async_session
from websocket.game_handler import handle_game_ws
from websocket.connection_manager import manager, ws_pump


@app.websocket("/ws/game/{session_id}/{block_num}")
async def websocket_game(ws: _WebSocket, session_id: str, block_num: int):
    """WebSocket endpoint for game communication."""
    await handle_game_ws(ws, session_id, block_num, async_session)


@app.websocket("/ws/monitor")
async def admin_monitor_ws(ws: _WebSocket):
    """Admin real-time monitoring WebSocket."""
    queue = await manager.connect_admin(ws)
    pump_task = asyncio.create_task(ws_pump(queue, ws))
    try:
        while True:
            await ws.receive_text()
    except Exception:
        pass
    finally:
        pump_task.cancel()
        manager.disconnect_admin(ws)

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "cooking-for-friends"}


# Serve frontend static files if built (MUST be last — catch-all route)
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
