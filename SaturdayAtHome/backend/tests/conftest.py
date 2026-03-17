import json
from pathlib import Path

import pytest

from core.config_loader import load_config
from core.database import init_db


@pytest.fixture()
def tmp_config(tmp_path: Path):
    data = {
        "timeline": {
            "block_duration_s": 510,
            "events": {
                "reminder_a_s": 120,
                "trigger_a_appear_s": 210,
                "trigger_a_close_s": 240,
                "reminder_b_s": 300,
                "trigger_b_appear_s": 390,
                "trigger_b_close_s": 420,
                "neutral_comment_1_s": 30,
                "neutral_comment_2_s": 255,
                "neutral_comment_3_s": 450,
            },
            "block_room_schedule": {
                "1": [
                    {"t": 0, "room": "kitchen", "activity": "recipe_following", "narrative": "Start kitchen"},
                    {"t": 75, "room": "living_room", "activity": "message_processing", "narrative": "Go living"},
                    {"t": 270, "room": "kitchen", "activity": "cooking_monitor", "narrative": "Back kitchen"},
                ]
            },
            "neutral_comments": ["Hi", "Keep going", "Almost done"],
        },
        "experiment": {
            "latin_square": {
                "A": ["LowAF_LowCB", "LowAF_HighCB", "HighAF_LowCB", "HighAF_HighCB"],
            },
            "block_task_slots": {
                "1": {"A": "medicine", "B": "tea"},
                "2": {"A": "pot", "B": "umbrella"},
            },
            "execution_window_ms": 30000,
            "condition_rules": {
                "LowAF_LowCB": {
                    "af_level": "low",
                    "include_context_preamble": False,
                    "reminder_word_limit": 15,
                    "preamble_word_limit": 0,
                },
                "HighAF_HighCB": {
                    "af_level": "high",
                    "include_context_preamble": True,
                    "reminder_word_limit": 35,
                    "preamble_word_limit": 12,
                },
            },
        },
        "pm_tasks": {
            "medicine": {
                "target": {"id": "red_round"},
                "distractor": {"id": "red_square"},
                "steps": [
                    {"id": "prepare_water", "required": True},
                    {"id": "take_tablet", "required": True},
                ],
                "low_af_text": "Remember your medicine.",
                "high_af_text": "Find red round bottle and take one tablet.",
                "encoding_card": {"quiz": {"question": "q", "options": ["a", "b"], "correct_index": 0}},
                "correct": {"bottle": "red", "amount": "1"},
            },
            "tea": {
                "target": {"id": "longjing"},
                "distractor": {"id": "biluochun"},
                "steps": [
                    {"id": "boil_water", "required": True},
                    {"id": "steep_tea", "required": True},
                ],
                "low_af_text": "Remember tea.",
                "high_af_text": "Use Longjing, boil water then steep.",
                "encoding_card": {"quiz": {"question": "q", "options": ["a", "b"], "correct_index": 0}},
            },
            "pot": {
                "target": {"id": "silver_handle"},
                "distractor": {"id": "black_handle"},
                "steps": [
                    {"id": "release_valve", "required": True},
                    {"id": "open_lid", "required": True},
                ],
                "low_af_text": "Remember the pot.",
                "high_af_text": "Use silver-handle pot. Release valve then open lid.",
                "encoding_card": {"quiz": {"question": "q", "options": ["a", "b"], "correct_index": 0}},
            },
        },
        "audio": {"tts_lang": "en-US", "tts_rate": 0.9, "tts_pitch": 1.0},
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
