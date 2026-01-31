"""
Focality Bridge Agent - The core innovation of this system.

This agent determines the semantic alignment between:
- The current ongoing task (minigame the user is doing)
- The prospective memory task (what they need to remember)

High focality = strong semantic bridge = spontaneous retrieval (per PAM theory)
Low focality = weak/no semantic bridge = requires active monitoring
"""

import json
import os
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

from .base_agent import BaseAgent, RetrievedContext, PMTask


@dataclass
class FocalityAssessment:
    """Assessment of focality between ongoing task and PM task."""
    ongoing_task: str
    pm_task_id: str
    focality_score: float           # 0.0 (non-focal) to 1.0 (highly focal)
    focality_level: str             # 'high' or 'low'
    semantic_link_type: str         # e.g., 'direct_object', 'location_association'
    explanation: str
    bridge_cue: Optional[str]       # The focal cue text to use in reminder
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'ongoing_task': self.ongoing_task,
            'pm_task_id': self.pm_task_id,
            'focality_score': self.focality_score,
            'focality_level': self.focality_level,
            'semantic_link_type': self.semantic_link_type,
            'explanation': self.explanation,
            'bridge_cue': self.bridge_cue
        }


class FocalityBridgeAgent(BaseAgent):
    """
    Agent responsible for determining semantic alignment (focality)
    between ongoing tasks and PM tasks.
    
    This is the theoretical core of the context-aware reminder system,
    implementing insights from McDaniel & Einstein's Multi-Process Theory.
    """
    
    # Focality threshold
    HIGH_FOCAL_THRESHOLD = 0.7
    LOW_FOCAL_THRESHOLD = 0.3
    
    def __init__(self, data_path: str):
        super().__init__(data_path, "FocalityBridgeAgent")
        self.bridges = None
        self.task_definitions = None
        
    def load_data(self) -> None:
        """Load semantic bridges configuration."""
        bridges_data = self._load_json('semantic_bridges.json')
        self.bridges = bridges_data.get('bridges', [])
        self.task_definitions = bridges_data.get('ongoing_task_definitions', {})
        print(f"  ✓ Loaded {len(self.bridges)} semantic bridges")
    
    def retrieve(self, pm_task: PMTask, current_context: Dict[str, Any]) -> List[RetrievedContext]:
        """
        Retrieve focality-related context.
        
        Args:
            pm_task: The prospective memory task
            current_context: Must contain 'ongoing_task' key
            
        Returns:
            Context about the semantic bridge (if any)
        """
        self.ensure_loaded()
        
        ongoing_task = current_context.get('ongoing_task', '')
        assessment = self.assess_focality(pm_task.task_id, ongoing_task)
        
        if assessment.focality_score > 0:
            return [RetrievedContext(
                source='focality_bridge',
                content=assessment.bridge_cue or assessment.explanation,
                relevance_score=assessment.focality_score,
                semantic_type='focal_cue',
                metadata=assessment.to_dict()
            )]
        
        return []
    
    def assess_focality(self, pm_task_id: str, ongoing_task: str) -> FocalityAssessment:
        """
        Assess the focality between a PM task and current ongoing task.
        
        Args:
            pm_task_id: ID of the prospective memory task
            ongoing_task: Name of current minigame/activity
            
        Returns:
            FocalityAssessment with score and semantic link info
        """
        self.ensure_loaded()
        
        # Find the bridge definition for this PM task
        bridge = self._find_bridge(pm_task_id)
        
        if not bridge:
            return FocalityAssessment(
                ongoing_task=ongoing_task,
                pm_task_id=pm_task_id,
                focality_score=0.0,
                focality_level='low',
                semantic_link_type='none',
                explanation='No semantic bridge defined',
                bridge_cue=None
            )
        
        # Check if ongoing task is a high-focal trigger
        for trigger in bridge.get('high_focal_triggers', []):
            if self._matches_task(trigger.get('ongoing_task', ''), ongoing_task):
                cue_strength = trigger.get('cue_strength', 0.8)
                return FocalityAssessment(
                    ongoing_task=ongoing_task,
                    pm_task_id=pm_task_id,
                    focality_score=cue_strength,
                    focality_level='high' if cue_strength >= self.HIGH_FOCAL_THRESHOLD else 'low',
                    semantic_link_type=trigger.get('semantic_link', 'unknown'),
                    explanation=trigger.get('explanation', ''),
                    bridge_cue=self._generate_bridge_cue(ongoing_task, bridge)
                )
        
        # Check low-focal triggers (time-based)
        for trigger in bridge.get('low_focal_triggers', []):
            if trigger.get('trigger_type') == 'time_based':
                return FocalityAssessment(
                    ongoing_task=ongoing_task,
                    pm_task_id=pm_task_id,
                    focality_score=trigger.get('cue_strength', 0.2),
                    focality_level='low',
                    semantic_link_type='time_based',
                    explanation='Time-based trigger with no semantic link to ongoing task',
                    bridge_cue=None
                )
        
        # Default: no match
        return FocalityAssessment(
            ongoing_task=ongoing_task,
            pm_task_id=pm_task_id,
            focality_score=0.1,
            focality_level='low',
            semantic_link_type='none',
            explanation='No semantic relationship found',
            bridge_cue=None
        )
    
    def get_focal_cue_text(self, ongoing_task: str, language: str = 'zh') -> Optional[str]:
        """
        Generate a focal cue text based on ongoing task.
        
        Args:
            ongoing_task: Current minigame/activity
            language: Language code ('zh', 'en', 'nl')
            
        Returns:
            Localized focal cue text
        """
        focal_cues = {
            'PillBox': {
                'zh': '你正在查看药盒',
                'en': 'You are looking at the pill box',
                'nl': 'Je kijkt naar de pillendoos'
            },
            'Shopping': {
                'zh': '你正在购物',
                'en': 'You are shopping',
                'nl': 'Je bent aan het winkelen'
            },
            'Schedule': {
                'zh': '你正在查看日程',
                'en': 'You are checking your schedule',
                'nl': 'Je bekijkt je agenda'
            },
            'RouteChoice': {
                'zh': '你正在规划路线',
                'en': 'You are planning your route',
                'nl': 'Je plant je route'
            },
            'Priority': {
                'zh': '你正在决定优先级',
                'en': 'You are deciding priorities',
                'nl': 'Je bepaalt prioriteiten'
            },
            'PhotoSpot': {
                'zh': '你正在观察周围环境',
                'en': 'You are observing your surroundings',
                'nl': 'Je observeert je omgeving'
            },
            'Social': {
                'zh': '你正在与人交谈',
                'en': 'You are having a conversation',
                'nl': 'Je bent in gesprek'
            }
        }
        
        task_cues = focal_cues.get(ongoing_task, {})
        return task_cues.get(language)
    
    def get_all_bridges_for_task(self, ongoing_task: str) -> List[Dict[str, Any]]:
        """
        Get all PM tasks that have a high-focal relationship with an ongoing task.
        
        Args:
            ongoing_task: Name of current minigame/activity
            
        Returns:
            List of bridge definitions that match
        """
        self.ensure_loaded()
        
        matching = []
        for bridge in self.bridges:
            for trigger in bridge.get('high_focal_triggers', []):
                if self._matches_task(trigger.get('ongoing_task', ''), ongoing_task):
                    matching.append({
                        'bridge': bridge,
                        'trigger': trigger,
                        'cue_strength': trigger.get('cue_strength', 0.8)
                    })
        
        return sorted(matching, key=lambda x: x['cue_strength'], reverse=True)
    
    def _find_bridge(self, pm_task_id: str) -> Optional[Dict[str, Any]]:
        """Find bridge definition by PM task ID."""
        for bridge in self.bridges:
            if bridge.get('pm_task', {}).get('id') == pm_task_id:
                return bridge
        return None
    
    def _matches_task(self, pattern: str, task: str) -> bool:
        """Check if task matches pattern (supports partial matching)."""
        pattern_lower = pattern.lower()
        task_lower = task.lower()
        
        # Exact match
        if pattern_lower == task_lower:
            return True
        
        # Pattern contains task or task contains pattern
        if pattern_lower in task_lower or task_lower in pattern_lower:
            return True
        
        # Handle underscore variants (e.g., 'Shopping_pharmacy' matches 'Shopping')
        if '_' in pattern_lower:
            base_pattern = pattern_lower.split('_')[0]
            if base_pattern == task_lower:
                return True
        
        return False
    
    def _generate_bridge_cue(self, ongoing_task: str, bridge: Dict[str, Any]) -> str:
        """Generate a contextual bridge cue."""
        task_def = self.task_definitions.get(ongoing_task, {})
        visual_elements = task_def.get('visual_elements', [])
        
        if visual_elements:
            return f"当前场景中有: {', '.join(visual_elements[:2])}"
        
        return f"在 {ongoing_task} 活动中"


# Convenience function for direct use
def assess_focality(pm_task_id: str, ongoing_task: str, data_path: str) -> FocalityAssessment:
    """Quick function to assess focality without managing agent lifecycle."""
    agent = FocalityBridgeAgent(data_path)
    return agent.assess_focality(pm_task_id, ongoing_task)
