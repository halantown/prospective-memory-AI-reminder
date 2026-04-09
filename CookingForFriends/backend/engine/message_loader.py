"""Message pool loader — loads day-specific message JSON files for the phone system.

Message taxonomy (v2):
  - "question"     → True/False factual statement, frontend shows T/F buttons
  - "notification" → Informational one-liner, no interaction required
  - "pm_trigger"   → Visually identical to notification, backend-only tag for PM scoring
"""

import json
import logging
from pathlib import Path
from config import DATA_DIR

logger = logging.getLogger(__name__)

_message_pools: dict[int, dict[str, dict]] = {}


def load_message_pool(block_number: int) -> dict[str, dict]:
    """Load and cache the message pool for a given block (day).

    Returns a dict keyed by message_id → full message data.
    Falls back to day1 if specific day file doesn't exist.
    """
    if block_number in _message_pools:
        return _message_pools[block_number]

    messages_dir = DATA_DIR / "messages"
    path = messages_dir / f"messages_day{block_number}.json"
    if not path.exists():
        path = messages_dir / "messages_day1.json"
    if not path.exists():
        logger.warning(f"No message pool found for block {block_number}")
        return {}

    try:
        with open(path) as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        logger.error(f"Failed to load message pool from {path}: {e}")
        return {}

    pool = {}
    for msg in data.get("messages", []):
        msg_id = msg.get("id", "")
        if msg_id:
            pool[msg_id] = msg

    _message_pools[block_number] = pool
    logger.info(f"[MSG_LOADER] Loaded {len(pool)} messages for block {block_number}")
    return pool


def get_message(block_number: int, message_id: str) -> dict | None:
    """Get a single message by ID from the pool."""
    pool = load_message_pool(block_number)
    return pool.get(message_id)


def _msg_category(msg_type: str) -> str:
    """Map raw message type to frontend category.

    Frontend only sees 'question' or 'notification'.
    PM triggers are rendered identically to notifications.
    """
    if msg_type == "question":
        return "question"
    return "notification"


def build_ws_payload(message: dict) -> dict:
    """Build the WebSocket payload for a phone message.

    Sends 'category' (question | notification) — frontend never sees
    the raw type field. PM trigger messages appear as notifications.
    For questions, includes choices and correct_index for answer buttons.
    Also includes contact_id and feedback texts for chat UI.
    """
    msg_type = message.get("type", "notification")
    category = _msg_category(msg_type)

    payload = {
        "id": message["id"],
        "sender": message["sender"],
        "avatar": message.get("avatar", "?"),
        "text": message["text"],
        "category": category,
        "contact_id": message.get("contact_id", "_system"),
    }

    # Questions need the choices for answer buttons
    if msg_type == "question":
        payload["choices"] = message.get("choices", [])
        payload["correct_index"] = message.get("correct_index", 0)
        payload["feedback_correct"] = message.get("feedback_correct", "Thanks! 👍")
        payload["feedback_incorrect"] = message.get("feedback_incorrect", "Hmm, I think that's not quite right 🤔")

    return payload


def get_contacts(block_number: int) -> list[dict]:
    """Get the contacts list for a block. Falls back to default contacts."""
    pool_path = DATA_DIR / "messages" / f"messages_day{block_number}.json"
    if not pool_path.exists():
        pool_path = DATA_DIR / "messages" / "messages_day1.json"
    if not pool_path.exists():
        return _default_contacts()

    try:
        with open(pool_path) as f:
            data = json.load(f)
        contacts = data.get("contacts")
        if contacts:
            return contacts
    except (json.JSONDecodeError, OSError):
        pass

    return _default_contacts()


def _default_contacts() -> list[dict]:
    return [
        {"id": "alice", "name": "Alice", "avatar": "👩"},
        {"id": "tom", "name": "Tom", "avatar": "👦"},
        {"id": "emma", "name": "Emma", "avatar": "👧"},
        {"id": "jake", "name": "Jake", "avatar": "🧑"},
        {"id": "sophie", "name": "Sophie", "avatar": "👱‍♀️"},
        {"id": "liam", "name": "Liam", "avatar": "🧔"},
    ]


def check_answer(message: dict, choice_index: int) -> bool | None:
    """Check if a choice index matches the correct answer. Returns None for non-questions."""
    correct = message.get("correct_index")
    if correct is None:
        return None
    return choice_index == correct


def clear_cache():
    """Clear cached message pools (for testing)."""
    _message_pools.clear()
