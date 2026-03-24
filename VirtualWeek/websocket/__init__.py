"""WebSocket module initialization."""

# SocketIO instance will be set by app.py
_socketio = None


def init_socketio(socketio):
    """Initialize the socketio instance and register handlers."""
    global _socketio
    _socketio = socketio
    
    # Import handlers to register them
    from . import handlers
    handlers.register_handlers(socketio)


def get_socketio():
    """Get the socketio instance."""
    return _socketio
