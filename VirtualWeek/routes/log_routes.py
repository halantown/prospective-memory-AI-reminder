"""
Logging API routes.
"""
from flask import Blueprint, jsonify, request
from services.log_service import log_service
from models import session_manager

log_bp = Blueprint('log', __name__)


@log_bp.route('/init', methods=['POST'])
def init_session():
    """Initialize a new session log file."""
    data = request.json
    participant_id = data.get('participant_id', 'unknown')
    session_id = data.get('session_id', '1')
    
    filename = log_service.init_session_log(participant_id, session_id)
    
    return jsonify({
        "status": "created",
        "log_file": filename,
        "participant_id": participant_id
    })


@log_bp.route('', methods=['POST'])
def log_event():
    """Append an event to the participant's log file."""
    data = request.json
    log_file = data.get('log_file')
    
    if not log_file:
        return jsonify({"error": "log_file is required"}), 400
    
    if not log_service.validate_log_path(log_file):
        return jsonify({"error": "Invalid log file path"}), 403
    
    if not log_service.log_exists(log_file):
        return jsonify({"error": "Log file not found. Call /api/log/init first."}), 404
    
    client_time = data.get('client_timestamp', '')
    client_time_ms = data.get('client_time_ms', '')
    event_type = data.get('event_type', 'info')
    details = data.get('details', '')
    metadata = data.get('metadata', {})
    
    # Write to file
    success, result = log_service.write_log(
        log_file, client_time, client_time_ms,
        event_type, details, metadata
    )
    
    if not success:
        return jsonify({"error": result}), 500
    
    # Add to in-memory buffer
    log_entry = log_service.create_log_entry(client_time, event_type, details)
    session_manager.logs_buffer.append(log_entry)
    if len(session_manager.logs_buffer) > 100:
        session_manager.logs_buffer.pop(0)
    
    return jsonify({"status": "logged"})
