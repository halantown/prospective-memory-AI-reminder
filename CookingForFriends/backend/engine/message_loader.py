"""Message pool loader — loads day-specific message JSON files for the phone system.

Message taxonomy (v3 — split structure):
  - "chats" array      → question messages routed to contacts, with correct/wrong choices
  - "notifications" array → system banners, no interaction required

PM triggers are handled separately (phone calls), not in message data.
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
    Loads from both 'chats' and 'notifications' arrays.
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

    # Load chat messages (questions)
    for msg in data.get("chats", []):
        msg_id = msg.get("id", "")
        if msg_id:
            pool[msg_id] = {**msg, "channel": "chat"}

    # Load notification messages
    for msg in data.get("notifications", []):
        msg_id = msg.get("id", "")
        if msg_id:
            pool[msg_id] = {**msg, "channel": "notification"}

    _message_pools[block_number] = pool
    logger.info(f"[MSG_LOADER] Loaded {len(pool)} messages for block {block_number}")
    return pool


def get_message(block_number: int, message_id: str) -> dict | None:
    """Get a single message by ID from the pool."""
    pool = load_message_pool(block_number)
    return pool.get(message_id)


def build_ws_payload(message: dict) -> dict:
    """Build the WebSocket payload for a phone message.

    For chat messages: includes correct_choice, wrong_choice, feedback texts, contact_id.
    For notifications: includes sender and text only.
    Both include a 'channel' field for frontend routing.
    """
    channel = message.get("channel", "notification")

    if channel == "chat":
        # Chat message — look up contact info
        payload = {
            "id": message["id"],
            "contact_id": message.get("contact_id", ""),
            "text": message["text"],
            "channel": "chat",
            "correct_choice": message.get("correct_choice", ""),
            "wrong_choice": message.get("wrong_choice", ""),
            "feedback_correct": message.get("feedback_correct", "Thanks! 👍"),
            "feedback_incorrect": message.get("feedback_incorrect", "Hmm, I think that's not quite right 🤔"),
            "feedback_missed": message.get("feedback_missed", "Guess you're busy, no worries 👍"),
        }
    else:
        # Notification — system banner
        payload = {
            "id": message["id"],
            "sender": message.get("sender", "System"),
            "text": message["text"],
            "channel": "notification",
        }

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
    ]


def check_answer(message: dict, chosen_text: str) -> bool | None:
    """Check if a chosen text matches the correct choice. Returns None for non-chats."""
    correct = message.get("correct_choice")
    if correct is None:
        return None
    return chosen_text == correct


def clear_cache():
    """Clear cached message pools (for testing)."""
    _message_pools.clear()
