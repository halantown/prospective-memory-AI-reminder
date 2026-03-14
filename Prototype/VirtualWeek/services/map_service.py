"""
Map configuration loading and management.
"""
import os
import json
from config import CONFIG_DIR


class MapService:
    """Service for loading and managing map configurations."""
    
    def __init__(self, config_dir=None):
        self.config_dir = config_dir or CONFIG_DIR
    
    def list_maps(self):
        """List all available map configurations."""
        maps = []
        if os.path.exists(self.config_dir):
            for filename in sorted(os.listdir(self.config_dir)):
                if filename.endswith('.json'):
                    maps.append(filename.replace('.json', ''))
        return maps
    
    def get_map(self, map_id):
        """Get specific map configuration by ID."""
        file_path = os.path.join(self.config_dir, f"{map_id}.json")
        
        if not os.path.exists(file_path):
            return None
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return None
    
    def get_dice_sequence(self, map_id):
        """Get dice sequence from map configuration."""
        map_data = self.get_map(map_id)
        if map_data:
            return map_data.get('dice_sequence', [])
        return []
    
    def get_reminders_config(self, map_id):
        """Get reminders configuration from map."""
        map_data = self.get_map(map_id)
        if map_data:
            return map_data.get('reminders', {})
        return {}


# Global instance
map_service = MapService()
