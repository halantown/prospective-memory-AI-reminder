"""Saturday At Home — Experiment Server (FastAPI entry point, PRD v2.1)."""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import DB_PATH
from core.config_loader import load_config, load_pm_tasks, load_neutral_comments
from core.database import init_db
from core.session_lifecycle import heartbeat_monitor, pause_all_online_sessions
from routes.session import router as session_router, active_timelines
from routes.experiment import router as experiment_router
from routes.admin import router as admin_router
from routes.config_routes import router as config_router


# ── Logging ────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("saturday")


# ── App lifecycle ──────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_config()
    load_pm_tasks()
    load_neutral_comments()
    init_db(DB_PATH)
    pause_all_online_sessions(DB_PATH)
    monitor_task = asyncio.create_task(heartbeat_monitor(DB_PATH, active_timelines))
    yield
    monitor_task.cancel()
    from core.ws import shutdown_all_ws_queues
    from core.session_lifecycle import shutdown_admin_queues
    for tl in active_timelines.values():
        tl.cancel()
    shutdown_all_ws_queues()
    shutdown_admin_queues()


# ── App factory ────────────────────────────────────────────

app = FastAPI(title="Saturday At Home — Experiment Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(session_router, prefix="/api")
app.include_router(experiment_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(config_router, prefix="/api")


# ── Entry point ────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5000,
        reload=True,
        timeout_graceful_shutdown=5,
    )
