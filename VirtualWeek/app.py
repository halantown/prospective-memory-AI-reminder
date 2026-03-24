"""
Virtual Week Experiment Server
==============================
Main entry point for the Flask + SocketIO experiment server.

This file initializes the application and registers all modules.
For the actual logic, see:
- routes/     : REST API endpoints
- websocket/  : WebSocket event handlers
- services/   : Business logic
- models/     : State management
"""

from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO

from config import STATIC_DIR, SERVER_HOST, SERVER_PORT, DEBUG, print_config
from routes import register_routes
from websocket import init_socketio


def create_app():
    """Application factory for creating the Flask app."""
    app = Flask(__name__, static_folder=None)  # Disable default static handling
    CORS(app)
    return app


def create_socketio(app):
    """Create and configure SocketIO instance."""
    socketio = SocketIO(
        app,
        cors_allowed_origins="*",
        async_mode='eventlet',
        logger=True,
        engineio_logger=False
    )
    return socketio


# Create application instances
app = create_app()
socketio = create_socketio(app)

# Register all routes
register_routes(app)

# Initialize WebSocket handlers
init_socketio(socketio)


if __name__ == '__main__':
    print_config()
    print(f"Experiment Server running on port {SERVER_PORT}")
    socketio.run(
        app,
        host=SERVER_HOST,
        port=SERVER_PORT,
        debug=DEBUG,
        allow_unsafe_werkzeug=True
    )
