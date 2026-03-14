"""
Admin control API routes.
"""
from flask import Blueprint, jsonify, request
from models import session_manager
from services.map_service import map_service
from services.reminder_service import ReminderService

admin_bp = Blueprint('admin', __name__)

# Lazy initialization of reminder service
_reminder_service = None

def get_reminder_service():
    global _reminder_service
    if _reminder_service is None:
        _reminder_service = ReminderService(session_manager)
    return _reminder_service


@admin_bp.route('/status', methods=['GET'])
def get_admin_status():
    """Dashboard polls this to see status and get logs."""
    game_state = session_manager.get_game_state()
    config = session_manager.config or {}
    
    # Calculate next dice value
    next_dice = None
    dice_remaining = None
    map_id = config.get('map_id')
    dice_index = game_state.get('diceSequenceIndex', 0)
    
    if map_id:
        dice_seq = map_service.get_dice_sequence(map_id)
        if dice_seq and dice_index < len(dice_seq):
            next_dice = dice_seq[dice_index]
            dice_remaining = len(dice_seq) - dice_index
    
    # Calculate next position
    current_pos = game_state.get('playerPos', 0)
    next_pos = current_pos + next_dice if next_dice else None
    if next_pos is not None:
        next_pos = min(next_pos, 119)
    
    return jsonify({
        "status": session_manager.status,
        "config": config,
        "game_state": game_state,
        "recent_logs": session_manager.logs_buffer,
        "reminders": session_manager.reminders_list,
        "monitor": {
            "current_position": current_pos,
            "current_phase": game_state.get('phase', 'unknown'),
            "next_dice": next_dice,
            "next_position": next_pos,
            "dice_remaining": dice_remaining,
            "real_time_seconds": game_state.get('realTimeSeconds', 0),
            "status_message": game_state.get('statusMessage', ''),
            "show_start_card": game_state.get('showStartCard', False),
            "show_event_card": game_state.get('showEventCard', False),
            "show_minigame": game_state.get('showMinigame', False)
        }
    })


@admin_bp.route('/start', methods=['POST'])
def start_session():
    """Dashboard commands to start a session."""
    data = request.json
    
    map_id = data.get('map_id')
    participant_id = data.get('participant_id')
    language = data.get('language', 'zh')
    group_number = data.get('group_number', 1)
    
    session_id = session_manager.start_session(
        map_id, participant_id, language, group_number
    )
    
    # Initialize reminders
    reminder_service = get_reminder_service()
    reminder_service.init_reminder_list(map_id, language)
    reminder_service.check_and_trigger("game_start", None)
    
    return jsonify({"status": "ok", "session_id": session_id})


@admin_bp.route('/update_language', methods=['POST'])
def update_language():
    """Update session language dynamically."""
    data = request.json
    new_lang = data.get('language', 'zh')
    
    if session_manager.update_language(new_lang):
        return jsonify({"status": "ok", "language": new_lang})
    
    return jsonify({"error": "No active session"}), 400


@admin_bp.route('/reset', methods=['POST'])
def reset_session():
    """Dashboard commands to reset session."""
    from websocket import get_socketio
    socketio = get_socketio()
    
    new_session_id = session_manager.reset_session()
    
    # Notify all game clients to reload
    if socketio:
        socketio.emit('game:session_reset', room='all_games')
        socketio.emit('game:session_reset', room='game')
    
    print(f"[Reset] Session reset, new session_id: {new_session_id}")
    
    return jsonify({"status": "reset", "session_id": new_session_id})


@admin_bp.route('/command', methods=['POST'])
def send_admin_command():
    """Send a command to the client."""
    data = request.json
    session_manager.set_admin_command(data)
    return jsonify({"status": "command_queued"})


@admin_bp.route('/trigger_reminder', methods=['POST'])
def manual_trigger_reminder():
    """Manually fire a specific reminder."""
    data = request.json
    reminder_id = data.get('reminder_id')
    
    reminder_service = get_reminder_service()
    if reminder_service.manual_trigger(reminder_id):
        return jsonify({"status": "ok"})
    
    return jsonify({"error": "Reminder not found"}), 404
