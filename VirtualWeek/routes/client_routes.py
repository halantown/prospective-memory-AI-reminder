"""
Client API routes for game board synchronization.
"""
from flask import Blueprint, jsonify, request
from models import session_manager
from services.reminder_service import ReminderService

client_bp = Blueprint('client', __name__)

# Lazy initialization of reminder service
_reminder_service = None

def get_reminder_service():
    global _reminder_service
    if _reminder_service is None:
        _reminder_service = ReminderService(session_manager)
    return _reminder_service


@client_bp.route('/check', methods=['GET'])
def check_session_status():
    """Client polls this to know when to start."""
    cmd = session_manager.pop_admin_command()
    
    return jsonify({
        "status": session_manager.status,
        "config": session_manager.config,
        "game_state": session_manager.game_state,
        "admin_command": cmd
    })


@client_bp.route('/sync', methods=['POST'])
def sync_game_state():
    """Client sends its state here to persist it."""
    data = request.json
    
    if session_manager.is_running():
        old_state = session_manager.get_game_state()
        session_manager.update_game_state(data)
        
        # Check for reminders based on state changes
        reminder_service = get_reminder_service()
        reminder_service.process_reminders(old_state, data)
        
        return jsonify({"status": "synced"})
    
    return jsonify({"status": "ignored", "reason": "session_not_running"})
