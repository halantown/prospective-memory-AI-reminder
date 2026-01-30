import os
import random
import time
import requests
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

# 获取当前脚本的绝对路径
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 前端静态文件目录 (../VirtualWeek)
STATIC_FOLDER = os.path.join(BASE_DIR, '..', 'VirtualWeek')

app = Flask(__name__, static_folder=STATIC_FOLDER)
CORS(app)  # 允许跨域，虽然托管在一起后主要为了作为API开发方便

# --- Robot Bridge Config ---
ROBOT_BRIDGE_URL = "http://localhost:8001"
ROBOT_ENABLED = True

# --- Game Data & Config ---
# Map Configuration: 120 steps
TOTAL_STEPS = 120
STEPS_PER_HOUR = 8

# Define Events
EVENTS_DB = {
    "evt_breakfast": {
        "id": "evt_breakfast", 
        "name": "早餐时间", 
        "category": "Breakfast", 
        "js_component": "", 
        "description": "早餐时间到啦，请选择您的早餐。"
    },
    "evt_shopping": {
        "id": "evt_shopping", 
        "name": "超市购物", 
        "category": "Shopping", 
        "js_component": "SupermarketGame.js", 
        "description": "您需要去超市完成采购任务。"
    },
    "evt_lunch": {
        "id": "evt_lunch", 
        "name": "午餐时间", 
        "category": "Lunch", 
        "js_component": "", 
        "description": "午餐时间。"
    },
    "evt_social": {
        "id": "evt_social", 
        "name": "邻居来访", 
        "category": "Social", 
        "js_component": "", 
        "description": "邻居 Brian 来了，询问能否帮忙。"
    },
    "evt_dinner": {
        "id": "evt_dinner", 
        "name": "晚餐时间", 
        "category": "Dinner", 
        "js_component": "", 
        "description": "准备晚餐的时候到了。"
    },
    "evt_library": {
        "id": "evt_library", 
        "name": "图书馆", 
        "category": "Library", 
        "js_component": "", 
        "description": "在图书馆查阅资料。"
    }
}

def get_idx(hour_offset):
    return int(hour_offset * STEPS_PER_HOUR)

# Position -> Event ID map
EVENT_MAP = {
    str(get_idx(1)): "evt_breakfast",   # 8:00 (JSON keys are strings)
    str(get_idx(4)): "evt_shopping",    # 11:00
    str(get_idx(6)): "evt_social",      # 13:00
    str(get_idx(11)): "evt_dinner",     # 18:00
    str(get_idx(13)): "evt_library"     # 20:00
}

# --- Frontend Static Serving ---

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'main.html')

@app.route('/<path:path>')
def serve_static_files(path):
    return send_from_directory(app.static_folder, path)

# --- API Endpoints ---

@app.route('/api/config/init', methods=['GET'])
def get_game_init():
    return jsonify({
        "map_size": TOTAL_STEPS,
        "event_positions": EVENT_MAP,
        "events": EVENTS_DB
    })

@app.route('/api/game/roll', methods=['POST'])
def roll_dice():
    roll_result = random.randint(1, 6)
    return jsonify({
        "roll": roll_result,
        "timestamp": time.time()
    })

@app.route('/api/game/log_position', methods=['POST'])
def log_position():
    data = request.json
    player_pos = data.get('player_pos')
    cell_type = data.get('cell_type')
    timestamp = data.get('timestamp')

    print(f"[{timestamp}] Player at {player_pos} ({cell_type})")
    
    # Check for event
    # Ensure player_pos is looked up as string if JSON keys are strings
    event_id = EVENT_MAP.get(str(player_pos))
    
    triggered = False
    event_data = None
    robot_message = ""

    if event_id:
        triggered = True
        event_data = EVENTS_DB[event_id]
        robot_message = f"您到达了{event_data['name']}。"
        
        # Call Robot
        if ROBOT_ENABLED:
            call_robot_say(robot_message)

    return jsonify({
        "triggered": triggered,
        "event_id": event_id,
        "event_data": event_data,
        "robot_message": robot_message
    })

# --- Robot Communication ---
def call_robot_say(text):
    try:
        # 假设机器人服务器在 localhost:8001
        requests.post(
            f"{ROBOT_BRIDGE_URL}",
            json={"action": "say", "payload": {"text": text}},
            timeout=1
        )
    except Exception as e:
        print(f"Robot Bridge Warning: {e}")

if __name__ == '__main__':
    print(f"Server starting at http://localhost:5000")
    print(f"Serving frontend from {STATIC_FOLDER}")
    # 监听所有IP，5000端口
    app.run(host='0.0.0.0', port=5000, debug=True)
