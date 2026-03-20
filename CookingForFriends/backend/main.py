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

# Serve frontend static files if built
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "cooking-for-friends"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
