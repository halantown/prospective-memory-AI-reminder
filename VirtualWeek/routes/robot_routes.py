"""
Robot control API routes.
"""
from flask import Blueprint, jsonify, request
from models import session_manager
from services.robot_service import robot_service
from config import ROBOT_BRIDGE_URL

robot_bp = Blueprint('robot', __name__)


@robot_bp.route('/say', methods=['POST'])
def robot_say():
    """Make the robot speak."""
    data = request.json
    text = data.get('text', '')
    
    success, result = robot_service.say(text)
    
    if success:
        session_manager.add_log("ROBOT", f"Robot say: {text}")
        return jsonify(result)
    else:
        return jsonify({"status": "error", "message": result}), 503


@robot_bp.route('/show', methods=['POST'])
def robot_show_view():
    """Show a URL on the robot's tablet."""
    data = request.json
    url = data.get('url', '')
    
    success, result = robot_service.show_view(url)
    
    if success:
        session_manager.add_log("ROBOT", f"Robot show: {url}")
        return jsonify(result)
    else:
        return jsonify({"status": "error", "message": result}), 503


@robot_bp.route('/hide', methods=['POST'])
def robot_hide_view():
    """Hide the robot's tablet webview."""
    success, result = robot_service.hide_view()
    
    if success:
        session_manager.add_log("ROBOT", "Robot hide tablet")
        return jsonify(result)
    else:
        return jsonify({"status": "error", "message": result}), 503


@robot_bp.route('/status', methods=['GET'])
def robot_status():
    """Check if robot bridge is available."""
    connected, status = robot_service.check_status()
    return jsonify({"status": status, "bridge_url": ROBOT_BRIDGE_URL})
