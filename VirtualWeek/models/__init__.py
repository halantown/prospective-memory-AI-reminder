"""Models and state management."""
from .session_state import SessionManager
from .connections import ConnectionManager

# Global instances
session_manager = SessionManager()
connection_manager = ConnectionManager()
