"""
Session state management for the experiment server.
"""
import uuid
from datetime import datetime


class SessionManager:
    """Manages the global session state for the experiment."""
    
    def __init__(self):
        self.reset()
    
    def reset(self):
        """Reset all session state to initial values."""
        self.status = "IDLE"  # IDLE, READY, RUNNING
        self.config = {}
        self.logs_buffer = []
        self.game_state = None
        self.admin_command = None
        self.session_id = str(uuid.uuid4())
        self.reminders_list = []
    
    def start_session(self, map_id, participant_id, language='zh', group_number=1):
        """Initialize a new experiment session."""
        self.session_id = str(uuid.uuid4())
        self.config = {
            "map_id": map_id,
            "participant_id": participant_id,
            "language": language,
            "group_number": group_number,
            "session_id": self.session_id
        }
        self.status = "RUNNING"
        self.logs_buffer = []
        self.game_state = None
        
        self.add_log(
            "SYSTEM",
            f"Session initialized for {participant_id} on map {map_id} "
            f"(Group {group_number}, session_id: {self.session_id})"
        )
        
        return self.session_id
    
    def reset_session(self):
        """Reset session and generate new session_id to invalidate old sessions."""
        old_id = self.session_id
        self.reset()
        return self.session_id
    
    def update_game_state(self, state):
        """Update the current game state."""
        self.game_state = state
    
    def get_game_state(self):
        """Get current game state or empty dict."""
        return self.game_state or {}
    
    def add_log(self, event_type, details):
        """Add a log entry to the in-memory buffer."""
        log_entry = {
            "server_timestamp": datetime.now().isoformat(),
            "event_type": event_type,
            "details": details
        }
        self.logs_buffer.append(log_entry)
        
        # Keep only last 100 entries
        if len(self.logs_buffer) > 100:
            self.logs_buffer.pop(0)
        
        return log_entry
    
    def set_admin_command(self, command):
        """Set an admin command to be picked up by the client."""
        self.admin_command = command
        self.add_log("ADMIN_CMD", f"Admin command: {command.get('type')} - {command}")
    
    def pop_admin_command(self):
        """Get and clear the pending admin command."""
        cmd = self.admin_command
        self.admin_command = None
        return cmd
    
    def update_language(self, language):
        """Update the session language."""
        if self.config:
            self.config['language'] = language
            self.add_log("SYSTEM", f"Language changed to {language}")
            return True
        return False
    
    def is_running(self):
        """Check if session is currently running."""
        return self.status == "RUNNING"
    
    def validate_session_id(self, client_session_id):
        """Validate if the client's session_id matches current session."""
        return client_session_id == self.session_id
    
    def to_dict(self):
        """Export current state as dictionary."""
        return {
            "status": self.status,
            "config": self.config,
            "game_state": self.game_state,
            "recent_logs": self.logs_buffer,
            "reminders": self.reminders_list
        }
