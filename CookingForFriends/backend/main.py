"""Cooking for Friends — Experiment Platform Backend.

Entry point for FastAPI application.
"""

import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import HOST, PORT, HEARTBEAT_TIMEOUT_S
from database import init_db
from engine.timeline import cancel_all

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def _heartbeat_monitor():
    """Periodically mark participants as offline if their heartbeat has expired."""
    from sqlalchemy import update
    from models.experiment import Participant
    from database import async_session

    while True:
        try:
            await asyncio.sleep(HEARTBEAT_TIMEOUT_S)
            cutoff = time.time() - HEARTBEAT_TIMEOUT_S
            async with async_session() as db:
                result = await db.execute(
                    update(Participant)
                    .where(
                        Participant.is_online.is_(True),
                        Participant.last_heartbeat < cutoff,
                    )
                    .values(is_online=False)
                )
                await db.commit()
                if result.rowcount > 0:
                    logger.info(f"Heartbeat monitor: marked {result.rowcount} stale participant(s) offline")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"Heartbeat monitor error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown."""
    logger.info("Starting Cooking for Friends backend...")
    await init_db()
    logger.info("Database initialized")

    # Set db factory for timeline execution window callbacks
    from engine.timeline import set_db_factory
    set_db_factory(async_session)

    # Background task: mark stale participants as offline
    heartbeat_task = asyncio.create_task(_heartbeat_monitor())

    yield
    logger.info("Shutting down...")
    heartbeat_task.cancel()
    try:
        await heartbeat_task
    except asyncio.CancelledError:
        pass
    cancel_all()


app = FastAPI(
    title="Cooking for Friends — Experiment Platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — restrict origins via config (default "*" for dev, set CORS_ORIGINS in production)
# allow_credentials is not needed: session tokens are passed in request bodies, not cookies.
from config import CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
from routers.session import router as session_router
from routers.admin import router as admin_router
from routers.timeline_editor import router as timeline_editor_router

app.include_router(session_router)
app.include_router(admin_router)
app.include_router(timeline_editor_router)

# Research documents (e.g. consent PDF) are referenced by experiment materials.
DOCUMENTS_DIR = Path(__file__).parent.parent / "documents"
if DOCUMENTS_DIR.exists():
    app.mount("/documents", StaticFiles(directory=str(DOCUMENTS_DIR)), name="documents")

# --- WebSocket endpoints (at /ws/*, no /api prefix) ---
from fastapi import WebSocket as _WebSocket
from database import async_session
from websocket.game_handler import handle_game_ws
from websocket.connection_manager import manager, ws_pump


@app.websocket("/ws/game/{session_id}")
async def websocket_game(ws: _WebSocket, session_id: str):
    """WebSocket endpoint for game communication."""
    await handle_game_ws(ws, session_id, async_session)


@app.websocket("/ws/monitor")
async def admin_monitor_ws(ws: _WebSocket):
    """Admin real-time monitoring WebSocket (requires admin API key as query param)."""
    from config import ADMIN_API_KEY
    if ADMIN_API_KEY:
        key = ws.query_params.get("key", "")
        if key != ADMIN_API_KEY:
            await ws.close(code=4003, reason="Unauthorized")
            return
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
    # SPA fallback: serve index.html for admin routes
    from fastapi.responses import FileResponse

    @app.get("/dashboard{rest:path}")
    @app.get("/config{rest:path}")
    @app.get("/admin/timeline-editor{rest:path}")
    @app.get("/admin{rest:path}")
    @app.get("/timeline-editor{rest:path}")
    async def spa_fallback(rest: str = ""):
        return FileResponse(str(FRONTEND_DIST / "index.html"))

    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    reload = os.getenv("ENVIRONMENT", "development") == "development"
    uvicorn.run("main:app", host=HOST, port=PORT, reload=reload)
