"""
WebSocket connection tracking.
"""


class ConnectionManager:
    """Manages WebSocket connection tracking."""
    
    def __init__(self):
        self.dashboard_sid = None
        self.game_sid = None
        self.participant_id = None
    
    def set_dashboard(self, sid):
        """Register dashboard connection."""
        self.dashboard_sid = sid
    
    def set_game(self, sid, participant_id=None):
        """Register game board connection."""
        self.game_sid = sid
        if participant_id:
            self.participant_id = participant_id
    
    def clear_dashboard(self):
        """Clear dashboard connection."""
        self.dashboard_sid = None
    
    def clear_game(self):
        """Clear game board connection."""
        self.game_sid = None
    
    def handle_disconnect(self, sid):
        """Handle a client disconnection, returns the type of client."""
        if self.dashboard_sid == sid:
            self.dashboard_sid = None
            return 'dashboard'
        elif self.game_sid == sid:
            self.game_sid = None
            return 'game'
        return None
    
    def has_dashboard(self):
        """Check if dashboard is connected."""
        return self.dashboard_sid is not None
    
    def has_game(self):
        """Check if game board is connected."""
        return self.game_sid is not None
