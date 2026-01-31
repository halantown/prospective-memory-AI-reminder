"""
WebSocket event emitters for broadcasting to clients.
"""
from . import get_socketio
from models import connection_manager


def emit_to_dashboard(event, data):
    """Emit an event to the dashboard."""
    socketio = get_socketio()
    if socketio and connection_manager.has_dashboard():
        socketio.emit(event, data, room=connection_manager.dashboard_sid)


def emit_to_game(event, data):
    """Emit an event to the game board."""
    socketio = get_socketio()
    if socketio and connection_manager.has_game():
        socketio.emit(event, data, room=connection_manager.game_sid)


def emit_to_all_games(event, data):
    """Emit an event to all game boards (waiting room)."""
    socketio = get_socketio()
    if socketio:
        socketio.emit(event, data, room='all_games')


def broadcast_session_reset():
    """Broadcast session reset to all game clients."""
    socketio = get_socketio()
    if socketio:
        socketio.emit('game:session_reset', room='all_games')
        socketio.emit('game:session_reset', room='game')


def broadcast_language_change(language):
    """Broadcast language change to all clients."""
    socketio = get_socketio()
    if socketio:
        socketio.emit('game:config_update', {'language': language}, room='all_games')
        socketio.emit('game:config_update', {'language': language}, room='game')
