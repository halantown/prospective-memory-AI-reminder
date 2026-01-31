"""
Configuration and environment variables for the Experiment Server.
"""
import os

# Base directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Maps: Prefer external config, fallback to local 'config/maps' for dev
CONFIG_DIR = os.environ.get('VW_MAPS_DIR', os.path.join(BASE_DIR, 'config', 'maps'))

# Logs: Prefer external log dir, fallback to user home directory
DEFAULT_LOG_DIR = os.path.join(os.path.expanduser('~'), 'VirtualWeek_Logs')
LOGS_DIR = os.environ.get('VW_LOGS_DIR', DEFAULT_LOG_DIR)

# Static files
STATIC_DIR = os.path.join(BASE_DIR, 'static')
TEMPLATES_DIR = BASE_DIR  # HTML files in root

# Robot Bridge
ROBOT_BRIDGE_URL = os.environ.get('ROBOT_BRIDGE_URL', 'http://127.0.0.1:8001')

# Server settings
SERVER_HOST = os.environ.get('VW_HOST', '0.0.0.0')
SERVER_PORT = int(os.environ.get('VW_PORT', 5001))
DEBUG = os.environ.get('VW_DEBUG', 'true').lower() == 'true'

# Ensure logs directory exists
os.makedirs(LOGS_DIR, exist_ok=True)

def print_config():
    """Print configuration on startup."""
    print(f"Maps Directory: {CONFIG_DIR}")
    print(f"Logs Directory: {LOGS_DIR}")
    print(f"Robot Bridge: {ROBOT_BRIDGE_URL}")
