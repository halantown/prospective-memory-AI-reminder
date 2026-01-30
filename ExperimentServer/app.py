import os
import csv
import json
import time
from datetime import datetime
from flask import Flask, jsonify, request, abort
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Configuration Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_DIR = os.path.join(BASE_DIR, 'config', 'maps')
LOGS_DIR = os.path.join(BASE_DIR, 'logs')

# Ensure logs directory exists
os.makedirs(LOGS_DIR, exist_ok=True)

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
    if os.path.dirname(os.path.abspath(file_path)) != LOGS_DIR:
         return jsonify({"error": "Invalid log file path"}), 403

    if not os.path.exists(file_path):
        return jsonify({"error": "Log file not found. Call /api/log/init first."}), 404
    
    server_time = datetime.now().isoformat()
    client_time = data.get('client_timestamp', '')
    event_type = data.get('event_type', 'info')
    details = data.get('details', '')
    metadata = json.dumps(data.get('metadata', {}), ensure_ascii=False)
    
    try:
        with open(file_path, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([server_time, client_time, event_type, details, metadata])
        return jsonify({"status": "logged"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print(f"Experiment Server running on port 5001")
    app.run(host='0.0.0.0', port=5001, debug=True)
