"""API Routes registration."""
from flask import Blueprint

from .static_routes import static_bp
from .map_routes import map_bp
from .log_routes import log_bp
from .admin_routes import admin_bp
from .client_routes import client_bp
from .robot_routes import robot_bp


def register_routes(app):
    """Register all route blueprints with the Flask app."""
    app.register_blueprint(static_bp)
    app.register_blueprint(map_bp, url_prefix='/api')
    app.register_blueprint(log_bp, url_prefix='/api/log')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(client_bp, url_prefix='/api/client')
    app.register_blueprint(robot_bp, url_prefix='/api/robot')
