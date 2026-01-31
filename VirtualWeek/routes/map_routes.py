"""
Map configuration API routes.
"""
from flask import Blueprint, jsonify
from services.map_service import map_service

map_bp = Blueprint('maps', __name__)


@map_bp.route('/maps', methods=['GET'])
def list_maps():
    """List all available map configurations."""
    maps = map_service.list_maps()
    return jsonify({"maps": maps})


@map_bp.route('/map/<map_id>', methods=['GET'])
def get_map_config(map_id):
    """Get specific map configuration by ID."""
    map_data = map_service.get_map(map_id)
    
    if map_data is None:
        return jsonify({"error": "Map not found"}), 404
    
    return jsonify(map_data)
