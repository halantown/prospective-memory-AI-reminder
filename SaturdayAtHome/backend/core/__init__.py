"""Core infrastructure — config, database, SSE, timeline."""

from core.config import (
    DB_PATH, DIFFICULTY_CONFIG, LATIN_SQUARE, TASK_PAIRS,
    REMINDER_TEXTS, assign_group,
)
from core.database import init_db, get_db
from core.sse import send_sse, register_client, event_generator, sse_queues, clear_session_queues
from core.timeline import BlockTimeline, build_timeline
