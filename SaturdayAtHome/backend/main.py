"""Saturday At Home — Experiment Server (FastAPI entry point)."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import DB_PATH
from core.config_loader import load_config
from core.database import init_db
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
    init_db(DB_PATH)
    yield
    # Shutdown: cancel timelines first, then signal SSE queues to close
    from core.sse import shutdown_all_queues
    for tl in active_timelines.values():
        tl.cancel()
    shutdown_all_queues()


# ── App factory ────────────────────────────────────────────

app = FastAPI(title="Saturday At Home — Experiment Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(session_router)
app.include_router(experiment_router)
app.include_router(admin_router)
app.include_router(config_router)


# ── Entry point ────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)

