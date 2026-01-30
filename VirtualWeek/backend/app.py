import os
import csv
import json
import time
from datetime import datetime
from flask import Flask, jsonify, request, abort, send_from_directory
from flask_cors import CORS

# Configuration Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Maps: Prefer external config, fallback to local 'config/maps' for dev
CONFIG_DIR = os.environ.get('VW_MAPS_DIR', os.path.join(BASE_DIR, 'config', 'maps'))

# Logs: Prefer external log dir, fallback to user home directory
default_log_dir = os.path.join(os.path.expanduser('~'), 'VirtualWeek_Logs')
LOGS_DIR = os.environ.get('VW_LOGS_DIR', default_log_dir)

STATIC_DIR = os.path.join(BASE_DIR, '..', 'frontend') # Point to sibling directory

# Ensure logs directory exists
os.makedirs(LOGS_DIR, exist_ok=True)
print(f"Maps Directory: {CONFIG_DIR}")
print(f"Logs Directory: {LOGS_DIR}")

app = Flask(__name__, static_folder=STATIC_DIR)
CORS(app)

# --- Global Session State ---
SESSION_STATE = {
    "status": "IDLE", # IDLE, READY (waiting for client to pick up), RUNNING
    "config": {},     # Stores map_id, participant_id
    "logs_buffer": [], # In-memory logs for dashboard (last 100)
    "game_state": None # Stores the latest frontend state for restoration
}

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'main.html')

@app.route('/dashboard')
def serve_dashboard():
    return send_from_directory(app.static_folder, 'dashboard.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "timestamp": time.time()})

# --- Map Configuration API ---

@app.route('/api/maps', methods=['GET'])
def list_maps():
    """List all available map configurations."""
    maps = []
    if os.path.exists(CONFIG_DIR):
        for filename in sorted(os.listdir(CONFIG_DIR)):
            if filename.endswith('.json'):
                maps.append(filename.replace('.json', ''))
    return jsonify({"maps": maps})

@app.route('/api/map/<map_id>', methods=['GET'])
def get_map_config(map_id):
    """Get specific map configuration by ID (filename without extension)."""
    file_path = os.path.join(CONFIG_DIR, f"{map_id}.json")
    
    if not os.path.exists(file_path):
        return jsonify({"error": "Map not found"}), 404
        
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Experiment Logging API ---

@app.route('/api/log/init', methods=['POST'])
def init_session():
    """Initialize a new session log file for a participant."""
    data = request.json
    participant_id = data.get('participant_id', 'unknown')
    session_id = data.get('session_id', '1')
    
    # Create a unique filename: participant_session_timestamp.csv
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{participant_id}_S{session_id}_{timestamp_str}.csv"
    file_path = os.path.join(LOGS_DIR, filename)
    
    # Write header
    with open(file_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['server_timestamp', 'client_timestamp', 'event_type', 'details', 'metadata'])
        
    return jsonify({
        "status": "created", 
        "log_file": filename,
        "participant_id": participant_id
    })

@app.route('/api/log', methods=['POST'])
def log_event():
    """Append an event to the participant's log file."""
    data = request.json
    log_file = data.get('log_file')
    
    if not log_file:
        return jsonify({"error": "log_file is required"}), 400
        
    file_path = os.path.join(LOGS_DIR, log_file)
    
    # Validation: prevent directory traversal
    if os.path.commonpath([os.path.abspath(file_path), os.path.abspath(LOGS_DIR)]) != os.path.abspath(LOGS_DIR):
         return jsonify({"error": "Invalid log file path"}), 403

    if not os.path.exists(file_path):
        return jsonify({"error": "Log file not found. Call /api/log/init first."}), 404
    
    server_time = datetime.now().isoformat()
    client_time = data.get('client_timestamp', '')
    event_type = data.get('event_type', 'info')
    details = data.get('details', '')
    metadata = json.dumps(data.get('metadata', {}), ensure_ascii=False)
    
    # Add to in-memory buffer for dashboard
    log_entry = {
        "server_timestamp": server_time,
        "client_timestamp": client_time,
        "event_type": event_type,
        "details": details
    }
    SESSION_STATE['logs_buffer'].append(log_entry)
    if len(SESSION_STATE['logs_buffer']) > 100:
        SESSION_STATE['logs_buffer'].pop(0)

    try:
        with open(file_path, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([server_time, client_time, event_type, details, metadata])
        return jsonify({"status": "logged"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Dashboard Control API ---

@app.route('/api/admin/status', methods=['GET'])
def get_admin_status():
    """Dashboard polls this to see status and get logs."""
    return jsonify({
        "status": SESSION_STATE['status'],
        "config": SESSION_STATE['config'],
        "recent_logs": SESSION_STATE['logs_buffer']
    })

@app.route('/api/admin/start', methods=['POST'])
def start_session():
    """Dashboard commands to start a session."""
    data = request.json
    SESSION_STATE['config'] = {
        "map_id": data.get('map_id'),
        "participant_id": data.get('participant_id')
    }
    SESSION_STATE['status'] = "RUNNING"
    SESSION_STATE['logs_buffer'] = [] # Clear logs for new session
    SESSION_STATE['game_state'] = None # Clear previous game state
    
    # Log the start internally
    SESSION_STATE['logs_buffer'].append({
        "server_timestamp": datetime.now().isoformat(),
        "event_type": "SYSTEM",
        "details": f"Session initialized for {data.get('participant_id')} on map {data.get('map_id')}"
    })
    
    return jsonify({"status": "ok"})

@app.route('/api/admin/reset', methods=['POST'])
def reset_session():
    """Dashboard commands to reset."""
    SESSION_STATE['status'] = "IDLE"
    SESSION_STATE['config'] = {}
    SESSION_STATE['game_state'] = None
    return jsonify({"status": "reset"})

@app.route('/api/client/check', methods=['GET'])
def check_session_status():
    """Client polls this to know when to start."""
    return jsonify({
        "status": SESSION_STATE['status'],
        "config": SESSION_STATE['config'],
        "game_state": SESSION_STATE.get('game_state')
    })

@app.route('/api/client/sync', methods=['POST'])
def sync_game_state():
    """Client sends its state here to persist it."""
    data = request.json
    if SESSION_STATE['status'] == 'RUNNING':
        SESSION_STATE['game_state'] = data
        return jsonify({"status": "synced"})
    return jsonify({"status": "ignored", "reason": "session_not_running"})

if __name__ == '__main__':
    print(f"Experiment Server running on port 5001")
    app.run(host='0.0.0.0', port=5001, debug=True)
