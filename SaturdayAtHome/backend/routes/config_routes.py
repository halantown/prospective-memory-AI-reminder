"""Config API — read and update game_config.yaml via HTTP."""

import logging
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any

from core.config_loader import get_config, get_game_config, save_config, load_config, load_pm_tasks

logger = logging.getLogger("saturday.routes.config")

router = APIRouter(prefix="/config", tags=["config"])


@router.get("")
async def get_full_config():
    """Return the full config (including correct answers) for the admin /config page."""
    return get_config()


@router.get("/game")
async def get_frontend_config():
    """Return config stripped of correct answers — safe for the game frontend."""
    return get_game_config()


@router.get("/pm-tasks")
async def get_pm_tasks_list():
    """Return PM tasks (stripped of correct answers) for the encoding phase."""
    import copy
    tasks = copy.deepcopy(load_pm_tasks())
    for t in tasks:
        if "mcq" in t:
            t["mcq"].pop("correct", None)
        if "quiz" in t:
            t["quiz"].pop("correct", None)
    return {"tasks": tasks}


class ConfigUpdate(BaseModel):
    config: dict[str, Any]


@router.put("")
async def update_config(body: ConfigUpdate):
    """Save updated config to game_config.yaml and reload."""
    save_config(body.config)
    load_config()
    logger.info("Config updated via API")
    return {"status": "ok"}
