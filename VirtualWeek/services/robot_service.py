"""
Robot communication service.
"""
import requests
from datetime import datetime
from config import ROBOT_BRIDGE_URL


class RobotService:
    """Service for communicating with the robot bridge."""
    
    def __init__(self, bridge_url=None):
        self.bridge_url = bridge_url or ROBOT_BRIDGE_URL
    
    def say(self, text, timeout=5):
        """Make the robot speak."""
        return self._send_command("say", {"text": text}, timeout)
    
    def show_view(self, url, timeout=5):
        """Show a URL on the robot's tablet."""
        return self._send_command("show_view", {"url": url}, timeout)
    
    def hide_view(self, timeout=5):
        """Hide the robot's tablet webview."""
        return self._send_command("hide_view", {}, timeout)
    
    def check_status(self, timeout=2):
        """Check if robot bridge is available."""
        try:
            requests.get(self.bridge_url, timeout=timeout)
            return True, "connected"
        except requests.exceptions.RequestException:
            return False, "disconnected"
    
    def _send_command(self, action, payload, timeout):
        """Send a command to the robot bridge."""
        try:
            resp = requests.post(
                self.bridge_url,
                json={"action": action, "payload": payload},
                timeout=timeout
            )
            try:
                return True, resp.json()
            except:
                return True, {"status": "success", "message": "Command sent", "raw": resp.text}
        except requests.exceptions.RequestException as e:
            return False, f"Robot bridge unreachable: {str(e)}"
    
    def trigger_speech(self, text, reason, session_manager):
        """Trigger robot speech and log it."""
        session_manager.add_log("REMINDER", f"Triggered [{reason}]: {text}")
        
        try:
            self.say(text, timeout=2)
        except:
            pass  # Don't crash on robot failure


# Global instance
robot_service = RobotService()
