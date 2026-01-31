"""
Multi-Agent Orchestrator - Coordinates all agents to generate context-aware reminders.

This is the main entry point for the reminder generation system.
It coordinates:
1. FocalityBridgeAgent - Determines semantic alignment
2. DetailEnrichmentAgent - Adds meaningful details
3. ContextRetrievalAgent - RAG-based context retrieval

The orchestrator can operate in two modes:
1. Generation mode - Generate new reminders using LLM
2. Experiment mode - Select from pre-generated reminders based on condition
"""

import json
import os
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

from .base_agent import (
    BaseAgent, AgentRegistry, RetrievedContext, PMTask, ReminderOutput
)
from .focality_bridge_agent import FocalityBridgeAgent, FocalityAssessment
from .detail_enrichment_agent import DetailEnrichmentAgent, DetailEnrichment
from .context_retrieval_agent import ContextRetrievalAgent


@dataclass
class ExperimentCondition:
    """Defines an experimental condition."""
    condition_id: str
    focality: str      # 'high' or 'low'
    detail: str        # 'high' or 'low'
    description: str
    
    @property
    def short_code(self) -> str:
        """Return short code like 'HF_HD' for high focal, high detail."""
        f = 'HF' if self.focality == 'high' else 'LF'
        d = 'HD' if self.detail == 'high' else 'LD'
        return f"{f}_{d}"


# Pre-defined experimental conditions (2x2 design)
EXPERIMENT_CONDITIONS = {
    'A': ExperimentCondition('A', 'low', 'low', 'Low Focality, Low Detail (Baseline)'),
    'B': ExperimentCondition('B', 'low', 'high', 'Low Focality, High Detail'),
    'C': ExperimentCondition('C', 'high', 'low', 'High Focality, Low Detail'),
    'D': ExperimentCondition('D', 'high', 'high', 'High Focality, High Detail'),
}


class ReminderOrchestrator:
    """
    Main orchestrator that coordinates multiple agents to generate
    context-aware reminders.
    """
    
    def __init__(self, data_path: str, mode: str = 'experiment'):
        """
        Initialize the orchestrator.
        
        Args:
            data_path: Path to data/raw directory
            mode: 'generation' for live LLM generation, 'experiment' for pre-generated
        """
        self.data_path = data_path
        self.mode = mode
        
        # Initialize agents
        print("\n🤖 Initializing Multi-Agent Reminder System...")
        self.registry = AgentRegistry()
        
        self.focality_agent = FocalityBridgeAgent(data_path)
        self.detail_agent = DetailEnrichmentAgent(data_path)
        self.context_agent = ContextRetrievalAgent(data_path, use_vector_search=False)
        
        self.registry.register(self.focality_agent)
        self.registry.register(self.detail_agent)
        self.registry.register(self.context_agent)
        
        # Pre-generated reminders (for experiment mode)
        self.pre_generated = {}
        
        print(f"✓ Orchestrator initialized in '{mode}' mode")
    
    def load_pre_generated(self, generated_path: str) -> None:
        """Load pre-generated reminders for experiment mode."""
        if not os.path.exists(generated_path):
            print(f"⚠ Pre-generated path not found: {generated_path}")
            return
        
        for filename in os.listdir(generated_path):
            if filename.endswith('.json'):
                filepath = os.path.join(generated_path, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    condition_id = data.get('condition_id', filename.replace('.json', ''))
                    self.pre_generated[condition_id] = data
        
        print(f"✓ Loaded {len(self.pre_generated)} pre-generated reminder sets")
    
    def generate_reminder(
        self,
        pm_task: PMTask,
        ongoing_task: str,
        condition: ExperimentCondition,
        language: str = 'zh'
    ) -> ReminderOutput:
        """
        Generate a reminder based on experimental condition.
        
        Args:
            pm_task: The prospective memory task
            ongoing_task: Current minigame/activity name
            condition: Experimental condition (A/B/C/D)
            language: Output language
            
        Returns:
            ReminderOutput with generated/selected reminder
        """
        current_context = {
            'ongoing_task': ongoing_task,
            'timestamp': datetime.now().isoformat(),
            'language': language
        }
        
        # Step 1: Assess focality
        focality_assessment = self.focality_agent.assess_focality(
            pm_task.task_id, ongoing_task
        )
        
        # Step 2: Get detail enrichment
        detail_enrichment = self.detail_agent.get_details(pm_task.task_id)
        
        # Step 3: Retrieve additional context (for logging/analysis)
        retrieved_contexts = self.context_agent.retrieve(pm_task, current_context)
        
        # Step 4: Compose reminder based on condition
        reminder_text = self._compose_reminder(
            pm_task=pm_task,
            ongoing_task=ongoing_task,
            focality_assessment=focality_assessment,
            detail_enrichment=detail_enrichment,
            condition=condition,
            language=language
        )
        
        return ReminderOutput(
            pm_task=pm_task,
            reminder_text=reminder_text,
            focality_level=condition.focality,
            detail_level=condition.detail,
            trigger_context=ongoing_task,
            retrieved_contexts=retrieved_contexts,
            generation_metadata={
                'condition': condition.short_code,
                'actual_focality_score': focality_assessment.focality_score,
                'semantic_link_type': focality_assessment.semantic_link_type,
                'has_details': detail_enrichment.has_details(),
                'language': language,
                'timestamp': current_context['timestamp']
            }
        )
    
    def _compose_reminder(
        self,
        pm_task: PMTask,
        ongoing_task: str,
        focality_assessment: FocalityAssessment,
        detail_enrichment: DetailEnrichment,
        condition: ExperimentCondition,
        language: str
    ) -> str:
        """
        Compose the final reminder text based on condition.
        
        Condition logic:
        - Low Focality: Time-based cue only ("现在是吃药时间")
        - High Focality: Contextual cue ("你正在看药盒，记得吃药")
        - Low Detail: Action only
        - High Detail: Action + motivation + social entity
        """
        parts = []
        
        # === FOCALITY COMPONENT ===
        if condition.focality == 'high':
            # Add focal cue based on ongoing task
            focal_cue = self.focality_agent.get_focal_cue_text(ongoing_task, language)
            if focal_cue:
                parts.append(focal_cue)
        
        # === ACTION COMPONENT (always included) ===
        action_text = self._get_action_text(pm_task, language)
        parts.append(action_text)
        
        # === DETAIL COMPONENT ===
        if condition.detail == 'high' and detail_enrichment.has_details():
            detail_text = self._format_details(detail_enrichment, language)
            if detail_text:
                parts.append(detail_text)
        
        # Compose final text
        if language == 'zh':
            # Chinese: use commas and periods appropriately
            if len(parts) == 1:
                return parts[0] + '。'
            elif len(parts) == 2:
                return f"{parts[0]}，{parts[1]}。"
            else:
                return f"{parts[0]}，{parts[1]}。{parts[2]}"
        else:
            # English: use periods
            return '. '.join(parts) + '.'
    
    def _get_action_text(self, pm_task: PMTask, language: str) -> str:
        """Get localized action text."""
        # This could be expanded with a proper localization system
        action_templates = {
            'pm_medication': {
                'zh': '记得吃药',
                'en': 'Remember to take your medication',
                'nl': 'Vergeet niet je medicijnen te nemen'
            },
            'pm_bring_medical_book': {
                'zh': '记得带上蓝色病历本',
                'en': 'Remember to bring your blue medical record book',
                'nl': 'Vergeet niet je blauwe medische boek mee te nemen'
            },
            'pm_return_book': {
                'zh': '记得还书给Maria',
                'en': 'Remember to return the book to Maria',
                'nl': 'Vergeet niet het boek aan Maria terug te geven'
            },
            'pm_call_sarah': {
                'zh': '记得给Sarah打电话确认晚餐',
                'en': 'Remember to call Sarah about dinner',
                'nl': 'Vergeet niet Sarah te bellen over het diner'
            },
            'pm_water_plants': {
                'zh': '记得给植物浇水',
                'en': 'Remember to water the plants',
                'nl': 'Vergeet niet de planten water te geven'
            },
            'pm_pay_bill': {
                'zh': '记得付电费账单',
                'en': 'Remember to pay the electricity bill',
                'nl': 'Vergeet niet de elektriciteitsrekening te betalen'
            }
        }
        
        templates = action_templates.get(pm_task.task_id, {})
        return templates.get(language, pm_task.action)
    
    def _format_details(self, enrichment: DetailEnrichment, language: str) -> str:
        """Format detail elements into natural text."""
        parts = []
        
        if enrichment.motivation:
            parts.append(enrichment.motivation)
        
        # Social entity is usually embedded in motivation
        # Only add separately if motivation doesn't include it
        if enrichment.social_entity and enrichment.motivation:
            if enrichment.social_entity.lower() not in enrichment.motivation.lower():
                if language == 'zh':
                    parts.append(f"{enrichment.social_entity}说的")
        
        return '。'.join(parts) if parts else ''
    
    def get_reminder_for_experiment(
        self,
        pm_task_id: str,
        condition_id: str,
        language: str = 'zh'
    ) -> Optional[str]:
        """
        Get pre-generated reminder for experiment.
        
        Args:
            pm_task_id: PM task identifier
            condition_id: Condition identifier (A/B/C/D)
            language: Language code
            
        Returns:
            Pre-generated reminder text or None
        """
        condition_data = self.pre_generated.get(condition_id)
        if not condition_data:
            return None
        
        reminders = condition_data.get('reminders', {})
        task_reminders = reminders.get(pm_task_id, {})
        
        return task_reminders.get(language)
    
    def generate_all_conditions(
        self,
        pm_task: PMTask,
        ongoing_task: str,
        language: str = 'zh'
    ) -> Dict[str, ReminderOutput]:
        """
        Generate reminders for all experimental conditions.
        Useful for pre-generation.
        
        Returns:
            Dict mapping condition_id to ReminderOutput
        """
        results = {}
        
        for condition_id, condition in EXPERIMENT_CONDITIONS.items():
            results[condition_id] = self.generate_reminder(
                pm_task=pm_task,
                ongoing_task=ongoing_task,
                condition=condition,
                language=language
            )
        
        return results


def create_orchestrator(data_path: str = None, mode: str = 'experiment') -> ReminderOrchestrator:
    """Factory function to create orchestrator with default paths."""
    if data_path is None:
        # Assume running from Reminder/ directory
        data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'raw')
    
    return ReminderOrchestrator(data_path, mode)


# Quick test
if __name__ == "__main__":
    print("\n" + "="*60)
    print("Testing Multi-Agent Reminder Orchestrator")
    print("="*60)
    
    # Create orchestrator
    orchestrator = create_orchestrator()
    
    # Define a test PM task
    test_task = PMTask(
        task_id='pm_medication',
        action='Take morning blood pressure medication',
        target_type='event_based',
        target_value='PillBox',
        importance='critical'
    )
    
    # Test all conditions
    print("\n📋 Generating reminders for all conditions...")
    print("-" * 60)
    
    for cond_id, condition in EXPERIMENT_CONDITIONS.items():
        # Use PillBox as ongoing task (high focal for medication)
        output = orchestrator.generate_reminder(
            pm_task=test_task,
            ongoing_task='PillBox',
            condition=condition,
            language='zh'
        )
        
        print(f"\n[Condition {cond_id}] {condition.description}")
        print(f"   Reminder: {output.reminder_text}")
        print(f"   Focality Score: {output.generation_metadata['actual_focality_score']:.2f}")
    
    print("\n" + "="*60)
    print("Test completed!")
