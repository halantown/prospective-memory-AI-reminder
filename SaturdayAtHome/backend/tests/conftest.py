import json
from pathlib import Path

import pytest

from core.config_loader import load_config
from core.database import init_db


@pytest.fixture()
def tmp_config(tmp_path: Path):
    data = {
        "difficulty": {
            "default": "medium",
            "medium": {"cooking_ms": 13000, "ready_ms": 4000},
        },
        "steak": {
            "hob_base_cooking_ms": [11000, 13000, 15000],
            "ready_ms": 4000,
            "cooking_jitter_ms": 1000,
            "ash_countdown_ms": 9000,
            "respawn_min_ms": 8000,
            "respawn_max_ms": 15000,
        },
        "laundry": {
            "rules": {},
            "garment_pool": [],
        },
        "scoring": {
            "steak_serve": 5,
            "message_correct": 3,
            "message_wrong": -2,
            "message_expire_penalty": -2,
        },
        "timers": {
            "block_duration_ms": 510000,
            "message_timeout_ms": 30000,
            "pm_window_ms": 30000,
            "plant_wilt_delay_ms": 30000,
            "steak_respawn_min_ms": 8000,
            "steak_respawn_max_ms": 15000,
        },
        "timeline": {
            "block_duration_s": 510,
            "events": {
                "reminder_a_s": 120,
                "reminder_b_s": 300,
                "trigger_a_appear_s": 210,
                "trigger_a_close_s": 240,
                "trigger_b_appear_s": 390,
                "trigger_b_close_s": 420,
                "fake_trigger_s": 120,
                "fake_trigger_jitter_s": 0,
                "robot_neutral_1_s": 75,
                "robot_neutral_1_jitter_s": 0,
                "robot_neutral_2_s": 270,
                "robot_neutral_2_jitter_s": 0,
                "force_yellow_1_s": 95,
                "force_yellow_1_jitter_s": 0,
                "force_yellow_2_s": 275,
                "force_yellow_2_jitter_s": 0,
                "force_yellow_1_hob": 0,
                "force_yellow_2_hob": 1,
            },
            "messages": [
                {"time_s": 60, "from": "A", "subject": "S1", "body": "B1", "options": ["A", "B", "C"], "correct": 1},
                {"time_s": 180, "from": "B", "subject": "S2", "body": "B2", "options": ["A", "B", "C"], "correct": 2},
            ],
            "neutral_comments": ["Hi", "Ok"],
            "steak_spawn": {"start_s": 3, "end_s": 490, "interval_min_s": 8, "interval_max_s": 15},
            "plant_water": {"start_s": 45, "start_jitter_s": 0, "interval_min_s": 40, "interval_max_s": 60},
        },
        "experiment": {
            "latin_square": {
                "A": ["LowAF_LowCB", "LowAF_HighCB", "HighAF_LowCB", "HighAF_HighCB"],
            },
            "task_pairs": {
                "1": ["medicine_a", "medicine_b"],
                "2": ["laundry_c", "laundry_d"],
            },
            "reminder_texts": {
                "LowAF_LowCB": {"A": "Remember A", "B": "Remember B"},
            },
        },
        "pm_tasks": {
            "medicine_a": {"correct": {"bottle": "red", "amount": "1"}},
            "medicine_b": {"correct": {"bottle": "orange", "amount": "1"}},
        },
    }
    path = tmp_path / "game_config.yaml"
    path.write_text(json.dumps(data), encoding="utf-8")
    load_config(path)
    return path


@pytest.fixture()
def tmp_db_path(tmp_path: Path):
    db_path = tmp_path / "test.db"
    init_db(db_path)
    return db_path

