"""
Configuration editor API routes.
Read and write game_registry.json and map config files.
"""
import os
import json
from flask import Blueprint, jsonify, request
from config import BASE_DIR, CONFIG_DIR

config_bp = Blueprint('config', __name__)

GAME_REGISTRY_PATH = os.path.join(BASE_DIR, 'config', 'game_registry.json')


def _read_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def _write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


# ── Game Registry ──────────────────────────────────────────────

@config_bp.route('/game_registry', methods=['GET'])
def get_game_registry():
    """Return the full game registry."""
    if not os.path.exists(GAME_REGISTRY_PATH):
        return jsonify({"error": "game_registry.json not found"}), 404
    return jsonify(_read_json(GAME_REGISTRY_PATH))


@config_bp.route('/game_registry', methods=['PUT'])
def save_game_registry():
    """Overwrite the entire game registry."""
    data = request.get_json(force=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Expected a JSON object"}), 400
    _write_json(GAME_REGISTRY_PATH, data)
    return jsonify({"status": "ok"})


@config_bp.route('/game_registry/<game_id>', methods=['PUT'])
def save_game_entry(game_id):
    """Update a single game entry in the registry."""
    registry = _read_json(GAME_REGISTRY_PATH) if os.path.exists(GAME_REGISTRY_PATH) else {}
    entry = request.get_json(force=True)
    if not isinstance(entry, dict):
        return jsonify({"error": "Expected a JSON object"}), 400
    registry[game_id] = entry
    _write_json(GAME_REGISTRY_PATH, registry)
    return jsonify({"status": "ok"})


# ── Map Configs ────────────────────────────────────────────────

@config_bp.route('/maps', methods=['GET'])
def list_maps():
    """List available map config files."""
    maps = []
    if os.path.exists(CONFIG_DIR):
        for f in sorted(os.listdir(CONFIG_DIR)):
            if f.endswith('.json'):
                maps.append(f.replace('.json', ''))
    return jsonify({"maps": maps})


@config_bp.route('/maps/<map_id>', methods=['GET'])
def get_map(map_id):
    """Return full map config."""
    path = os.path.join(CONFIG_DIR, f"{map_id}.json")
    if not os.path.exists(path):
        return jsonify({"error": "Map not found"}), 404
    return jsonify(_read_json(path))


@config_bp.route('/maps/<map_id>', methods=['PUT'])
def save_map(map_id):
    """Overwrite a map config."""
    data = request.get_json(force=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Expected a JSON object"}), 400
    path = os.path.join(CONFIG_DIR, f"{map_id}.json")
    _write_json(path, data)
    return jsonify({"status": "ok"})


@config_bp.route('/maps/<map_id>/field', methods=['PUT'])
def update_map_field(map_id):
    """Update specific top-level fields of a map config (partial update)."""
    path = os.path.join(CONFIG_DIR, f"{map_id}.json")
    if not os.path.exists(path):
        return jsonify({"error": "Map not found"}), 404
    map_data = _read_json(path)
    updates = request.get_json(force=True)
    if not isinstance(updates, dict):
        return jsonify({"error": "Expected a JSON object"}), 400
    map_data.update(updates)
    _write_json(path, map_data)
    return jsonify({"status": "ok"})
