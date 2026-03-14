"""
Base Agent class for the Context-Aware Reminder System.
All specialized agents inherit from this class.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime
import json


@dataclass
class RetrievedContext:
    """Structured context information retrieved by agents."""
    source: str                          # e.g., 'email', 'medical_record', 'social_contact'
    content: str                         # The actual content
    relevance_score: float               # 0.0 to 1.0
    semantic_type: str                   # e.g., 'motivation', 'social_entity', 'instruction'
    timestamp: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'source': self.source,
            'content': self.content,
            'relevance_score': self.relevance_score,
            'semantic_type': self.semantic_type,
            'timestamp': self.timestamp,
            'metadata': self.metadata
        }


@dataclass 
class PMTask:
    """Prospective Memory Task definition."""
    task_id: str
    action: str                          # What to do
    target_type: str                     # 'time_based' or 'event_based'
    target_value: str                    # Time (e.g., '08:00') or Event (e.g., 'PillBox')
    importance: str = 'medium'           # 'critical', 'high', 'medium', 'low'
    detail_elements: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'task_id': self.task_id,
            'action': self.action,
            'target_type': self.target_type,
            'target_value': self.target_value,
            'importance': self.importance,
            'detail_elements': self.detail_elements
        }


@dataclass
class ReminderOutput:
    """Generated reminder with all metadata."""
    pm_task: PMTask
    reminder_text: str
    focality_level: str                  # 'high' or 'low'
    detail_level: str                    # 'high' or 'low'
    trigger_context: str                 # What triggered this reminder
    retrieved_contexts: List[RetrievedContext] = field(default_factory=list)
    generation_metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'pm_task': self.pm_task.to_dict(),
            'reminder_text': self.reminder_text,
            'focality_level': self.focality_level,
            'detail_level': self.detail_level,
            'trigger_context': self.trigger_context,
            'retrieved_contexts': [c.to_dict() for c in self.retrieved_contexts],
            'generation_metadata': self.generation_metadata
        }


class BaseAgent(ABC):
    """
    Abstract base class for specialized agents.
    Each agent is responsible for retrieving specific types of context.
    """
    
    def __init__(self, data_path: str, agent_name: str):
        self.data_path = data_path
        self.agent_name = agent_name
        self.data = None
        self._loaded = False
    
    @abstractmethod
    def load_data(self) -> None:
        """Load data from source files. Must be implemented by subclasses."""
        pass
    
    @abstractmethod
    def retrieve(self, pm_task: PMTask, current_context: Dict[str, Any]) -> List[RetrievedContext]:
        """
        Retrieve relevant context for a PM task.
        
        Args:
            pm_task: The prospective memory task
            current_context: Current game/activity context (ongoing task, time, etc.)
            
        Returns:
            List of relevant context items
        """
        pass
    
    def ensure_loaded(self) -> None:
        """Ensure data is loaded before querying."""
        if not self._loaded:
            self.load_data()
            self._loaded = True
    
    def _load_json(self, filename: str) -> Any:
        """Helper to load JSON file from data path."""
        import os
        filepath = os.path.join(self.data_path, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _calculate_keyword_relevance(self, text: str, keywords: List[str]) -> float:
        """Simple keyword-based relevance scoring."""
        if not keywords:
            return 0.0
        text_lower = text.lower()
        matches = sum(1 for kw in keywords if kw.lower() in text_lower)
        return min(matches / len(keywords), 1.0)


class AgentRegistry:
    """Registry for managing multiple agents."""
    
    def __init__(self):
        self._agents: Dict[str, BaseAgent] = {}
    
    def register(self, agent: BaseAgent) -> None:
        """Register an agent."""
        self._agents[agent.agent_name] = agent
        print(f"  ✓ Registered agent: {agent.agent_name}")
    
    def get(self, name: str) -> Optional[BaseAgent]:
        """Get agent by name."""
        return self._agents.get(name)
    
    def all_agents(self) -> List[BaseAgent]:
        """Get all registered agents."""
        return list(self._agents.values())
    
    def agent_names(self) -> List[str]:
        """Get all agent names."""
        return list(self._agents.keys())
