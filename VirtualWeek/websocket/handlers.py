"""
WebSocket event handlers.
"""
import json
from datetime import datetime
from flask import request
from flask_socketio import emit, join_room, leave_room

from models import session_manager, connection_manager
from services.log_service import log_service
from config import LOGS_DIR
import os


def register_handlers(socketio):
    """Register all WebSocket event handlers."""
    
    @socketio.on('connect')
    def handle_connect():
        """Handle client connection."""
        print(f"[WebSocket] Client connected: {request.sid}")
        emit('connected', {'sid': request.sid})
    
    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection."""
        print(f"[WebSocket] Client disconnected: {request.sid}")
        
        client_type = connection_manager.handle_disconnect(request.sid)
        if client_type:
            print(f"[WebSocket] {client_type.capitalize()} disconnected")
    
    @socketio.on('dashboard:join')
    def handle_dashboard_join():
        """Dashboard joins to receive updates."""
        connection_manager.set_dashboard(request.sid)
        join_room('dashboard')
        print(f"[WebSocket] Dashboard joined: {request.sid}")
        emit('dashboard:joined', {'status': 'ok'})
        
        # Send current session state
        emit('dashboard:session_state', {
            'status': session_manager.status,
            'config': session_manager.config,
            'game_state': session_manager.game_state
        })
    
    @socketio.on('game:join_waiting')
    def handle_game_join_waiting():
        """Game board joins waiting room."""
        join_room('all_games')
        print(f"[WebSocket] Game board joined waiting room: {request.sid}")
        emit('game:waiting_joined', {'status': 'ok'})
    
    @socketio.on('game:join')
    def handle_game_join(data):
        """Game board joins active game room."""
        participant_id = data.get('participant_id')
        connection_manager.set_game(request.sid, participant_id)
        join_room('game')
        print(f"[WebSocket] Game board joined: {request.sid}, participant: {participant_id}")
        emit('game:joined', {'status': 'ok'})
    
    @socketio.on('admin:command')
    def handle_admin_command(data):
        """Admin sends command to game board."""
        # Support both formats: direct command or wrapped in 'command' key
        command = data.get('command', data)
        print(f"[WebSocket] Admin command received: {command}")
        
        if connection_manager.has_game():
            socketio.emit('game:command', command, room=connection_manager.game_sid)
            print(f"[WebSocket] Command sent to game: {command}")
        else:
            print("[WebSocket] Warning: No game board connected")
    
    @socketio.on('admin:language_change')
    def handle_language_change(data):
        """Admin changes language."""
        language = data.get('language')
        print(f"[WebSocket] Language change request: {language}")
        
        session_manager.update_language(language)
        
        # Send to both waiting room and game room
        socketio.emit('game:config_update', {'language': language}, room='all_games')
        socketio.emit('game:config_update', {'language': language}, room='game')
        print(f"[WebSocket] Language change sent to all rooms")
    
    @socketio.on('admin:trigger_minigame')
    def handle_trigger_minigame(data):
        """Admin triggers a minigame on the game client for testing."""
        category = data.get('category')
        print(f"[WebSocket] Admin triggered minigame: {category}")
        
        # Emit to game room to trigger minigame
        socketio.emit('game:trigger_event', {
            'category': category,
            'title': f'测试: {category}',
            'description': '',
            'scenario': None  # 使用小游戏默认场景
        }, room='game')
        print(f"[WebSocket] Minigame trigger sent to game room")
    
    @socketio.on('admin:stop_minigame')
    def handle_stop_minigame():
        """Admin stops the current minigame on the game client."""
        print("[WebSocket] Admin stopped minigame")
        socketio.emit('game:stop_minigame', room='game')
    
    @socketio.on('game:action')
    def handle_game_action(data):
        """Game board sends action log."""
        # Validate session
        client_session_id = data.get('session_id')
        if not session_manager.validate_session_id(client_session_id):
            print(f"[WebSocket] Invalid session_id: {client_session_id}")
            emit('game:session_invalid', {'reason': 'Session has been reset'})
            return
        
        log_file = data.get('log_file')
        if not log_file:
            return
        
        # Validate and write log
        if not log_service.validate_log_path(log_file):
            return
        
        if not log_service.log_exists(log_file):
            return
        
        client_time = data.get('client_timestamp', '')
        client_time_ms = data.get('client_time_ms', '')
        event_type = data.get('event_type', 'info')
        details = data.get('details', '')
        metadata = data.get('metadata', {})
        
        # Write to file
        success, server_time = log_service.write_log(
            log_file, client_time, client_time_ms,
            event_type, details, metadata
        )
        
        if success:
            # Add to in-memory buffer
            log_entry = {
                "server_timestamp": server_time,
                "client_timestamp": client_time,
                "event_type": event_type,
                "details": details
            }
            session_manager.logs_buffer.append(log_entry)
            if len(session_manager.logs_buffer) > 100:
                session_manager.logs_buffer.pop(0)
            
            # Notify dashboard in real-time
            if connection_manager.has_dashboard():
                socketio.emit('dashboard:log', log_entry, room=connection_manager.dashboard_sid)
    
    @socketio.on('game:state_sync')
    def handle_state_sync(data):
        """Game board syncs current state."""
        # Validate session
        client_session_id = data.get('session_id')
        if not session_manager.validate_session_id(client_session_id):
            print(f"[WebSocket] Invalid session_id in state_sync")
            emit('game:session_invalid', {'reason': 'Session has been reset'})
            return
        
        session_manager.update_game_state(data)
        
        # Forward to dashboard
        if connection_manager.has_dashboard():
            socketio.emit('dashboard:game_state', data, room=connection_manager.dashboard_sid)
