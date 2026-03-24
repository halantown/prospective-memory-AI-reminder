"""
Logging service for experiment data.
"""
import os
import csv
import json
from datetime import datetime
from config import LOGS_DIR


class LogService:
    """Service for managing experiment logs."""
    
    def __init__(self, logs_dir=None):
        self.logs_dir = logs_dir or LOGS_DIR
    
    def init_session_log(self, participant_id, session_id='1'):
        """Initialize a new session log file."""
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{participant_id}_S{session_id}_{timestamp_str}.csv"
        file_path = os.path.join(self.logs_dir, filename)
        
        # Write header
        with open(file_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                'server_timestamp', 'client_timestamp', 'client_time_ms',
                'event_type', 'details', 'metadata'
            ])
        
        return filename
    
    def validate_log_path(self, log_file):
        """Validate log file path to prevent directory traversal."""
        file_path = os.path.join(self.logs_dir, log_file)
        
        # Security check
        if os.path.commonpath([
            os.path.abspath(file_path),
            os.path.abspath(self.logs_dir)
        ]) != os.path.abspath(self.logs_dir):
            return None
        
        return file_path
    
    def log_exists(self, log_file):
        """Check if log file exists."""
        file_path = self.validate_log_path(log_file)
        return file_path and os.path.exists(file_path)
    
    def write_log(self, log_file, client_timestamp, client_time_ms,
                  event_type, details, metadata=None):
        """Write a log entry to the CSV file."""
        file_path = self.validate_log_path(log_file)
        if not file_path:
            return False, "Invalid log file path"
        
        if not os.path.exists(file_path):
            return False, "Log file not found"
        
        server_time = datetime.now().isoformat()
        metadata_str = json.dumps(metadata or {}, ensure_ascii=False)
        
        try:
            with open(file_path, 'a', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow([
                    server_time, client_timestamp, client_time_ms,
                    event_type, details, metadata_str
                ])
            return True, server_time
        except Exception as e:
            return False, str(e)
    
    def create_log_entry(self, client_timestamp, event_type, details):
        """Create a log entry dict for in-memory buffer."""
        return {
            "server_timestamp": datetime.now().isoformat(),
            "client_timestamp": client_timestamp,
            "event_type": event_type,
            "details": details
        }


# Global instance
log_service = LogService()
