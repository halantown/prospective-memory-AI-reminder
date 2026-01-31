"""
Reminder system service.
"""
from services.map_service import map_service
from services.robot_service import robot_service


class ReminderService:
    """Service for managing and triggering reminders."""
    
    def __init__(self, session_manager):
        self.session = session_manager
    
    def init_reminder_list(self, map_id, lang):
        """Parse map config and build a flat list of reminders."""
        self.session.reminders_list = []
        
        map_config = map_service.get_map(map_id)
        if not map_config:
            return
        
        reminders_raw = map_config.get('reminders', {})
        flat_list = []
        
        def get_text(node):
            """Extract text in preferred language."""
            return (node.get(lang) or node.get('zh') or 
                    node.get('en') or list(node.values())[0])
        
        # 1. Game Start
        if 'game_start' in reminders_raw:
            flat_list.append({
                "id": "game_start",
                "trigger": "game_start",
                "condition": "Start",
                "text": get_text(reminders_raw['game_start']),
                "status": "PENDING"
            })
        
        # 2. First Roll
        if 'first_roll' in reminders_raw:
            flat_list.append({
                "id": "first_roll",
                "trigger": "first_roll",
                "condition": "First Roll",
                "text": get_text(reminders_raw['first_roll']),
                "status": "PENDING"
            })
        
        # 3. Position based (sort by position index)
        pos_reminders = reminders_raw.get('position', {})
        for pos, node in sorted(pos_reminders.items(), key=lambda x: int(x[0])):
            flat_list.append({
                "id": f"position_{pos}",
                "trigger": "position",
                "sub_key": pos,
                "condition": f"Step {pos}",
                "text": get_text(node),
                "status": "PENDING"
            })
        
        # 4. Event Enter
        evt_reminders = reminders_raw.get('event_enter', {})
        for cat, node in evt_reminders.items():
            flat_list.append({
                "id": f"event_enter_{cat}",
                "trigger": "event_enter",
                "sub_key": cat,
                "condition": f"Enter {cat}",
                "text": get_text(node),
                "status": "PENDING"
            })
        
        # 5. Game End
        if 'game_end' in reminders_raw:
            flat_list.append({
                "id": "game_end",
                "trigger": "game_end",
                "condition": "End (119)",
                "text": get_text(reminders_raw['game_end']),
                "status": "PENDING"
            })
        
        self.session.reminders_list = flat_list
    
    def process_reminders(self, old_state, new_state):
        """Check if state changes trigger any reminders."""
        old_state = old_state or {}
        
        # 1. First Roll
        if not old_state and new_state.get('diceSequenceIndex', 0) == 0:
            self.check_and_trigger("first_roll", None)
        
        # 2. Position Change
        old_pos = old_state.get('playerPos', -1)
        new_pos = new_state.get('playerPos', 0)
        
        if new_pos != old_pos:
            self.check_and_trigger("position", str(new_pos))
            
            # Check Game End
            if new_pos >= 119:
                self.check_and_trigger("game_end", None)
        
        # 3. Event Enter (showing card)
        if not old_state.get('showEventCard') and new_state.get('showEventCard'):
            event_cat = new_state.get('currentEvent', {}).get('category')
            if event_cat:
                self.check_and_trigger("event_enter", event_cat)
        
        # 4. Event Complete (card closed)
        if old_state.get('showEventCard') and not new_state.get('showEventCard'):
            self.check_and_trigger("event_complete", "default")
    
    def check_and_trigger(self, trigger_type, sub_key=None):
        """Find and trigger a reminder by type."""
        # Construct target ID
        if sub_key:
            if trigger_type == 'position':
                target_id = f"position_{sub_key}"
            elif trigger_type == 'event_enter':
                target_id = f"event_enter_{sub_key}"
            else:
                target_id = f"{trigger_type}_{sub_key}"
        else:
            target_id = trigger_type
        
        # Find the item
        item = next(
            (r for r in self.session.reminders_list if r['id'] == target_id),
            None
        )
        
        if item and item['status'] == 'PENDING':
            item['status'] = 'SENT'
            robot_service.trigger_speech(item['text'], trigger_type, self.session)
    
    def manual_trigger(self, reminder_id):
        """Manually fire a specific reminder."""
        item = next(
            (r for r in self.session.reminders_list if r['id'] == reminder_id),
            None
        )
        
        if item:
            item['status'] = 'SENT_MANUAL'
            robot_service.trigger_speech(
                item['text'],
                f"MANUAL:{item['trigger']}",
                self.session
            )
            return True
        return False
