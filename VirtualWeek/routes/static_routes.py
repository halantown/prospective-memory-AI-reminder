"""
Static file serving routes.
"""
import os
import time
from flask import Blueprint, send_from_directory, send_file, jsonify
from config import STATIC_DIR, BASE_DIR

static_bp = Blueprint('static', __name__)


@static_bp.route('/')
def serve_index():
    """Serve the main game page."""
    return send_from_directory(BASE_DIR, 'main.html')


@static_bp.route('/dashboard')
def serve_dashboard():
    """Serve the admin dashboard."""
    return send_from_directory(BASE_DIR, 'dashboard.html')


@static_bp.route('/<path:path>')
def serve_static(path):
    """Serve static files from /static directory."""
    return send_from_directory(STATIC_DIR, path)


@static_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "ok", "timestamp": time.time()})
