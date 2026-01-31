import os
import csv
import json
import time
import requests
from datetime import datetime
from flask import Flask, jsonify, request, abort, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room

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

# Initialize SocketIO with CORS support
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading', logger=True, engineio_logger=False)

# --- Global Session State ---
SESSION_STATE = {
    "status": "IDLE", # IDLE, READY (waiting for client to pick up), RUNNING
    "config": {},     # Stores map_id, participant_id
    "logs_buffer": [], # In-memory logs for dashboard (last 100)
    "game_state": None, # Stores the latest frontend state for restoration
    "admin_command": None # Admin commands to be executed by client
}

# --- WebSocket Connection Tracking ---
CONNECTIONS = {
    'dashboard_sid': None,
    'game_sid': None,
    'participant_id': None
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
        writer.writerow(['server_timestamp', 'client_timestamp', 'client_time_ms', 'event_type', 'details', 'metadata'])
        
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
    client_time_ms = data.get('client_time_ms', '')  # High-precision performance.now()
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
            writer.writerow([server_time, client_time, client_time_ms, event_type, details, metadata])
        return jsonify({"status": "logged"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Dashboard Control API ---

@app.route('/api/admin/status', methods=['GET'])
def get_admin_status():
    """Dashboard polls this to see status and get logs."""
    game_state = SESSION_STATE.get('game_state') or {}
    config = SESSION_STATE.get('config') or {}
    
    # Calculate next dice value if we have a map and dice sequence
    next_dice = None
    dice_remaining = None
    map_id = config.get('map_id')
    dice_index = game_state.get('diceSequenceIndex', 0)
    
    if map_id:
        map_file = os.path.join(CONFIG_DIR, f"{map_id}.json")
        if os.path.exists(map_file):
            try:
                with open(map_file, 'r', encoding='utf-8') as f:
                    map_data = json.load(f)
                    dice_seq = map_data.get('dice_sequence', [])
                    if dice_seq and dice_index < len(dice_seq):
                        next_dice = dice_seq[dice_index]
                        dice_remaining = len(dice_seq) - dice_index
            except:
                pass
    
    # Calculate next position
    current_pos = game_state.get('playerPos', 0)
    next_pos = current_pos + next_dice if next_dice else None
    if next_pos is not None:
        next_pos = min(next_pos, 119)  # Cap at board end
    
    return jsonify({
        "status": SESSION_STATE['status'],
        "config": config,
        "game_state": game_state,
        "recent_logs": SESSION_STATE['logs_buffer'],
        "reminders": SESSION_STATE.get('reminders_list', []),
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

@app.route('/api/admin/start', methods=['POST'])
def start_session():
    """Dashboard commands to start a session."""
    data = request.json
    SESSION_STATE['config'] = {
        "map_id": data.get('map_id'),
        "participant_id": data.get('participant_id'),
        "language": data.get('language', 'zh')
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

    # Initialize Reminder List
    init_reminder_list(data.get('map_id'), data.get('language', 'zh'))

    # Trigger Game Start Reminder
    check_and_trigger_reminder("game_start", None)
    
    return jsonify({"status": "ok"})

@app.route('/api/admin/update_language', methods=['POST'])
def update_language():
    """Update session language dynamically."""
    data = request.json
    new_lang = data.get('language', 'zh')
    
    if SESSION_STATE.get('config'):
        SESSION_STATE['config']['language'] = new_lang
        
        # Log the change
        SESSION_STATE['logs_buffer'].append({
            "server_timestamp": datetime.now().isoformat(),
            "event_type": "SYSTEM",
            "details": f"Language changed to {new_lang}"
        })
        
        return jsonify({"status": "ok", "language": new_lang})
    
    return jsonify({"error": "No active session"}), 400

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
    # Pop the command so it's only executed once
    cmd = SESSION_STATE.get('admin_command')
    if cmd:
        SESSION_STATE['admin_command'] = None
    return jsonify({
        "status": SESSION_STATE['status'],
        "config": SESSION_STATE['config'],
        "game_state": SESSION_STATE.get('game_state'),
        "admin_command": cmd
    })

@app.route('/api/client/sync', methods=['POST'])
def sync_game_state():
    """Client sends its state here to persist it."""
    data = request.json
    if SESSION_STATE['status'] == 'RUNNING':
        old_state = SESSION_STATE.get('game_state') or {}
        SESSION_STATE['game_state'] = data
        
        # Check for reminders based on state changes
        process_reminders(old_state, data)
        
        return jsonify({"status": "synced"})
    return jsonify({"status": "ignored", "reason": "session_not_running"})

# --- Reminder Logic ---

def init_reminder_list(map_id, lang):
    """Parse map config and build a flat list of reminders."""
    SESSION_STATE['reminders_list'] = []
    
    map_config = get_current_map_config() # This gets it based on SESSION_STATE['config'] which is set just before
    if not map_config:
        # Fallback if map_id provided directly
        try:
             with open(os.path.join(CONFIG_DIR, f"{map_id}.json"), 'r', encoding='utf-8') as f:
                map_config = json.load(f)
        except:
            return

    reminders_raw = map_config.get('reminders', {})
    flat_list = []
    
    # Helper to extract text
    def get_text(node):
        return node.get(lang) or node.get('zh') or node.get('en') or list(node.values())[0]

    # 1. Game Start
    if 'game_start' in reminders_raw:
        flat_list.append({
            "id": "game_start",
            "trigger": "game_start",
            "condition": "Start",
            "text": get_text(reminders_raw['game_start']),
            "status": "PENDING"
        })
        
    # 2. First Roll
    if 'first_roll' in reminders_raw:
        flat_list.append({
            "id": "first_roll",
            "trigger": "first_roll",
            "condition": "First Roll",
            "text": get_text(reminders_raw['first_roll']),
            "status": "PENDING"
        })
        
    # 3. Position based (sort by position index)
    pos_reminders = reminders_raw.get('position', {})
    for pos, node in sorted(pos_reminders.items(), key=lambda x: int(x[0])):
        flat_list.append({
            "id": f"position_{pos}",
            "trigger": "position",
            "sub_key": pos,
            "condition": f"Step {pos}",
            "text": get_text(node),
            "status": "PENDING"
        })

    # 4. Event Enter
    evt_reminders = reminders_raw.get('event_enter', {})
    for cat, node in evt_reminders.items():
        flat_list.append({
            "id": f"event_enter_{cat}",
            "trigger": "event_enter",
            "sub_key": cat,
            "condition": f"Enter {cat}",
            "text": get_text(node),
            "status": "PENDING"
        })
        
    # 5. Event Complete
    # 6. Game End
    if 'game_end' in reminders_raw:
        flat_list.append({
            "id": "game_end",
            "trigger": "game_end",
            "condition": "End (119)",
            "text": get_text(reminders_raw['game_end']),
            "status": "PENDING"
        })
        
    SESSION_STATE['reminders_list'] = flat_list

def get_current_map_config():
    map_id = SESSION_STATE.get('config', {}).get('map_id')
    if not map_id:
        return None
    try:
        file_path = os.path.join(CONFIG_DIR, f"{map_id}.json")
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return None

def process_reminders(old_state, new_state):
    """Check if state changes trigger any reminders."""
    
    # 1. First Roll
    if not old_state and new_state.get('diceSequenceIndex', 0) == 0:
        check_and_trigger_reminder("first_roll", None)

    # 2. Position Change
    old_pos = old_state.get('playerPos', -1)
    new_pos = new_state.get('playerPos', 0)
    
    if new_pos != old_pos:
        # Check exact position match
        check_and_trigger_reminder(f"position", str(new_pos))
        
        # Check Game End
        if new_pos >= 119: # Assuming 120 steps (0-119)
             check_and_trigger_reminder("game_end", None)

    # 3. Event Enter (showing card)
    if not old_state.get('showEventCard') and new_state.get('showEventCard'):
        event_cat = new_state.get('currentEvent', {}).get('category')
        if event_cat:
            check_and_trigger_reminder("event_enter", event_cat)
            
    # 4. Event Complete (card closed)
    if old_state.get('showEventCard') and not new_state.get('showEventCard'):
         check_and_trigger_reminder("event_complete", "default")


def check_and_trigger_reminder(trigger_type, sub_key=None):
    # Find matching reminder in the list
    reminders = SESSION_STATE.get('reminders_list', [])
    
    target_id = None
    if sub_key:
        # Construct ID based on logic in init
        if trigger_type == 'position':
            target_id = f"position_{sub_key}"
        elif trigger_type == 'event_enter':
            target_id = f"event_enter_{sub_key}"
        else:
            target_id = f"{trigger_type}_{sub_key}"
    else:
        target_id = trigger_type
        
    # Find the item
    item = next((r for r in reminders if r['id'] == target_id), None)
    
    if item:
        if item['status'] == 'PENDING':
            item['status'] = 'SENT'
            trigger_robot_speech(item['text'], trigger_type)
    else:
        # Fallback for dynamic/unlisted ones (like event_complete default)
        # Or if init failed
        pass

@app.route('/api/admin/trigger_reminder', methods=['POST'])
def manual_trigger_reminder():
    """Manually fire a specific reminder."""
    data = request.json
    reminder_id = data.get('reminder_id')
    
    reminders = SESSION_STATE.get('reminders_list', [])
    item = next((r for r in reminders if r['id'] == reminder_id), None)
    
    if item:
        item['status'] = 'SENT_MANUAL'
        trigger_robot_speech(item['text'], f"MANUAL:{item['trigger']}")
        return jsonify({"status": "ok"})
    
    return jsonify({"error": "Reminder not found"}), 404


def trigger_robot_speech(text, reason):
    """Send speech command to robot bridge."""
    try:
        # Log it first
        SESSION_STATE['logs_buffer'].append({
            "server_timestamp": datetime.now().isoformat(),
            "event_type": "REMINDER",
            "details": f"Triggered [{reason}]: {text}"
        })
        
        requests.post(ROBOT_BRIDGE_URL, json={
            "action": "say",
            "payload": {"text": text}
        }, timeout=2)
    except:
        pass # Don't crash on robot failure

# --- Admin Control API ---

@app.route('/api/admin/command', methods=['POST'])
def send_admin_command():
    """Send a command to the client (e.g., set position)."""
    data = request.json
    SESSION_STATE['admin_command'] = data
    
    # Log the command
    SESSION_STATE['logs_buffer'].append({
        "server_timestamp": datetime.now().isoformat(),
        "event_type": "ADMIN_CMD",
        "details": f"Admin command: {data.get('type')} - {data}"
    })
    
    return jsonify({"status": "command_queued"})

# --- Robot Bridge API ---

ROBOT_BRIDGE_URL = os.environ.get('ROBOT_BRIDGE_URL', 'http://127.0.0.1:8001')

@app.route('/api/robot/say', methods=['POST'])
def robot_say():
    """Make the robot speak."""
    data = request.json
    text = data.get('text', '')
    
    try:
        resp = requests.post(ROBOT_BRIDGE_URL, json={
            "action": "say",
            "payload": {"text": text}
        }, timeout=5)
        
        SESSION_STATE['logs_buffer'].append({
            "server_timestamp": datetime.now().isoformat(),
            "event_type": "ROBOT",
            "details": f"Robot say: {text}"
        })
        
        try:
            return jsonify(resp.json())
        except:
            return jsonify({"status": "success", "message": "Command sent", "raw": resp.text})
    except requests.exceptions.RequestException as e:
        return jsonify({"status": "error", "message": f"Robot bridge unreachable: {str(e)}"}), 503

@app.route('/api/robot/show', methods=['POST'])
def robot_show_view():
    """Show a URL on the robot's tablet."""
    data = request.json
    url = data.get('url', '')
    
    try:
        resp = requests.post(ROBOT_BRIDGE_URL, json={
            "action": "show_view",
            "payload": {"url": url}
        }, timeout=5)
        
        SESSION_STATE['logs_buffer'].append({
            "server_timestamp": datetime.now().isoformat(),
            "event_type": "ROBOT",
            "details": f"Robot show: {url}"
        })
        
        try:
            return jsonify(resp.json())
        except:
            return jsonify({"status": "success", "message": "Command sent", "raw": resp.text})
    except requests.exceptions.RequestException as e:
        return jsonify({"status": "error", "message": f"Robot bridge unreachable: {str(e)}"}), 503

@app.route('/api/robot/hide', methods=['POST'])
def robot_hide_view():
    """Hide the robot's tablet webview."""
    try:
        resp = requests.post(ROBOT_BRIDGE_URL, json={
            "action": "hide_view",
            "payload": {}
        }, timeout=5)
        
        SESSION_STATE['logs_buffer'].append({
            "server_timestamp": datetime.now().isoformat(),
            "event_type": "ROBOT",
            "details": "Robot hide tablet"
        })
        
        try:
            return jsonify(resp.json())
        except:
            return jsonify({"status": "success", "message": "Command sent", "raw": resp.text})
    except requests.exceptions.RequestException as e:
        return jsonify({"status": "error", "message": f"Robot bridge unreachable: {str(e)}"}), 503

@app.route('/api/robot/status', methods=['GET'])
def robot_status():
    """Check if robot bridge is available."""
    try:
        resp = requests.get(ROBOT_BRIDGE_URL, timeout=2)
        return jsonify({"status": "connected", "bridge_url": ROBOT_BRIDGE_URL})
    except requests.exceptions.RequestException:
        return jsonify({"status": "disconnected", "bridge_url": ROBOT_BRIDGE_URL})

# ============================================================================
# WebSocket Event Handlers
# ============================================================================

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print(f"[WebSocket] Client connected: {request.sid}")
    emit('connected', {'sid': request.sid})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print(f"[WebSocket] Client disconnected: {request.sid}")
    
    # Clean up connection tracking
    if CONNECTIONS['dashboard_sid'] == request.sid:
        CONNECTIONS['dashboard_sid'] = None
        print("[WebSocket] Dashboard disconnected")
    elif CONNECTIONS['game_sid'] == request.sid:
        CONNECTIONS['game_sid'] = None
        print("[WebSocket] Game board disconnected")

@socketio.on('dashboard:join')
def handle_dashboard_join():
    """Dashboard joins to receive updates"""
    CONNECTIONS['dashboard_sid'] = request.sid
    join_room('dashboard')
    print(f"[WebSocket] Dashboard joined: {request.sid}")
    emit('dashboard:joined', {'status': 'ok'})
    
    # Send current session state
    emit('dashboard:session_state', {
        'status': SESSION_STATE['status'],
        'config': SESSION_STATE['config'],
        'game_state': SESSION_STATE.get('game_state')
    })

@socketio.on('game:join')
def handle_game_join(data):
    """Game board joins with participant ID"""
    participant_id = data.get('participant_id')
    CONNECTIONS['game_sid'] = request.sid
    CONNECTIONS['participant_id'] = participant_id
    join_room('game')
    print(f"[WebSocket] Game board joined: {request.sid}, participant: {participant_id}")
    emit('game:joined', {'status': 'ok'})

@socketio.on('admin:command')
def handle_admin_command(data):
    """Admin sends command to game board"""
    command = data.get('command')
    print(f"[WebSocket] Admin command received: {command}")
    
    # Send directly to game board
    if CONNECTIONS['game_sid']:
        socketio.emit('game:command', command, room=CONNECTIONS['game_sid'])
        print(f"[WebSocket] Command sent to game: {command}")
    else:
        print("[WebSocket] Warning: No game board connected")

@socketio.on('admin:language_change')
def handle_language_change(data):
    """Admin changes language"""
    language = data.get('language')
    print(f"[WebSocket] Language change: {language}")
    
    # Update session state
    if SESSION_STATE.get('config'):
        SESSION_STATE['config']['language'] = language
    
    # Notify game board
    if CONNECTIONS['game_sid']:
        socketio.emit('game:config_update', {'language': language}, room=CONNECTIONS['game_sid'])

@socketio.on('game:action')
def handle_game_action(data):
    """Game board sends action log"""
    log_file = data.get('log_file')
    if not log_file:
        return
    
    file_path = os.path.join(LOGS_DIR, log_file)
    
    # Validation
    if os.path.commonpath([os.path.abspath(file_path), os.path.abspath(LOGS_DIR)]) != os.path.abspath(LOGS_DIR):
        return
    
    if not os.path.exists(file_path):
        return
    
    server_time = datetime.now().isoformat()
    client_time = data.get('client_timestamp', '')
    client_time_ms = data.get('client_time_ms', '')
    event_type = data.get('event_type', 'info')
    details = data.get('details', '')
    metadata = json.dumps(data.get('metadata', {}), ensure_ascii=False)
    
    # Add to in-memory buffer
    log_entry = {
        "server_timestamp": server_time,
        "client_timestamp": client_time,
        "event_type": event_type,
        "details": details
    }
    SESSION_STATE['logs_buffer'].append(log_entry)
    if len(SESSION_STATE['logs_buffer']) > 100:
        SESSION_STATE['logs_buffer'].pop(0)
    
    # Write to CSV
    try:
        with open(file_path, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([server_time, client_time, client_time_ms, event_type, details, metadata])
        
        # Notify dashboard in real-time
        if CONNECTIONS['dashboard_sid']:
            socketio.emit('dashboard:log', log_entry, room=CONNECTIONS['dashboard_sid'])
    except Exception as e:
        print(f"[WebSocket] Log write error: {e}")

@socketio.on('game:state_sync')
def handle_state_sync(data):
    """Game board syncs current state"""
    SESSION_STATE['game_state'] = data
    
    # Forward to dashboard for real-time display
    if CONNECTIONS['dashboard_sid']:
        socketio.emit('dashboard:game_state', data, room=CONNECTIONS['dashboard_sid'])

# ============================================================================
# Run Server
# ============================================================================

if __name__ == '__main__':
    print(f"Experiment Server running on port 5001")
    socketio.run(app, host='0.0.0.0', port=5001, debug=True, allow_unsafe_werkzeug=True)
