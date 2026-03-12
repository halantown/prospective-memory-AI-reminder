"""Core infrastructure — config, database, SSE, timeline."""

from core.config import DB_PATH, assign_group
from core.config_loader import get_config, get_difficulty, get_latin_square, get_task_pairs, get_reminder_texts
from core.database import init_db, get_db
from core.sse import send_sse, register_client, event_generator, sse_queues, clear_session_queues
from core.timeline import BlockTimeline, build_timeline
