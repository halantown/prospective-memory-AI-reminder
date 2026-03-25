"""Message pool loader — loads day-specific message JSON files for the phone system."""

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

    with open(path) as f:
        data = json.load(f)

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


def build_ws_payload(message: dict) -> dict:
    """Build the WebSocket payload for a phone message.

    Strips internal fields (type for pm_trigger) so the frontend
    cannot distinguish PM triggers from regular chat messages.
    """
    msg_type = message.get("type", "chat")
    is_ad = msg_type == "ad"

    payload = {
        "id": message["id"],
        "sender": message["sender"],
        "avatar": message.get("avatar", "?"),
        "text": message["text"],
        "is_ad": is_ad,
    }

    # Include reply options for messages that have them
    replies = message.get("replies")
    if replies:
        # Strip the 'correct' field — frontend doesn't need to know answers
        payload["replies"] = [
            {"id": r["id"], "text": r["text"]}
            for r in replies
        ]

    # For pm_trigger messages, we intentionally do NOT include any
    # pm_trigger or trigger_id fields. The frontend sees it as a
    # normal chat message with no replies.

    return payload


def get_correct_reply(message: dict, reply_id: str) -> bool | None:
    """Check if a reply is correct. Returns None if message has no replies."""
    replies = message.get("replies")
    if not replies:
        return None
    for r in replies:
        if r["id"] == reply_id:
            return r.get("correct", False)
    return False


def clear_cache():
    """Clear cached message pools (for testing)."""
    _message_pools.clear()
