"""
Detail Enrichment Agent - Adds meaningful context to reminders.

This agent retrieves and adds:
- Motivation (WHY the task matters)
- Social Entity (WHO is involved)
- Consequence (WHAT happens if forgotten)
- Location hints (WHERE to find things)

Based on research showing that meaningful details enhance PM performance.
"""

import json
import os
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from .base_agent import BaseAgent, RetrievedContext, PMTask


@dataclass
class DetailEnrichment:
    """Collection of detail elements for a reminder."""
    motivation: Optional[str] = None
    social_entity: Optional[str] = None
    social_entity_relationship: Optional[str] = None
    consequence: Optional[str] = None
    location_hint: Optional[str] = None
    temporal_context: Optional[str] = None
    source_references: List[str] = None
    
    def __post_init__(self):
        if self.source_references is None:
            self.source_references = []
    
    def has_details(self) -> bool:
        """Check if any detail is present."""
        return any([
            self.motivation,
            self.social_entity,
            self.consequence,
            self.location_hint
        ])
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'motivation': self.motivation,
            'social_entity': self.social_entity,
            'social_entity_relationship': self.social_entity_relationship,
            'consequence': self.consequence,
            'location_hint': self.location_hint,
            'temporal_context': self.temporal_context,
            'source_references': self.source_references
        }


class DetailEnrichmentAgent(BaseAgent):
    """
    Agent responsible for enriching reminders with meaningful details.
    
    Retrieves context from:
    - Medical records (doctor instructions, health reasons)
    - Social contacts (who said what, relationships)
    - Daily routines (location hints, timing)
    - Semantic bridges (pre-defined detail elements)
    """
    
    def __init__(self, data_path: str):
        super().__init__(data_path, "DetailEnrichmentAgent")
        self.medical_records = None
        self.social_contacts = None
        self.daily_routines = None
        self.semantic_bridges = None
        
    def load_data(self) -> None:
        """Load all data sources for detail enrichment."""
        self.medical_records = self._load_json('medical_records.json')
        self.social_contacts = self._load_json('social_contacts.json')
        self.daily_routines = self._load_json('daily_routines.json')
        self.semantic_bridges = self._load_json('semantic_bridges.json')
        print(f"  ✓ Loaded medical records, social contacts, daily routines")
    
    def retrieve(self, pm_task: PMTask, current_context: Dict[str, Any]) -> List[RetrievedContext]:
        """
        Retrieve detail-related contexts for a PM task.
        
        Args:
            pm_task: The prospective memory task
            current_context: Current game context
            
        Returns:
            List of context items containing details
        """
        self.ensure_loaded()
        
        enrichment = self.get_details(pm_task.task_id)
        contexts = []
        
        if enrichment.motivation:
            contexts.append(RetrievedContext(
                source='detail_enrichment',
                content=enrichment.motivation,
                relevance_score=0.9,
                semantic_type='motivation',
                metadata={'detail_type': 'motivation'}
            ))
        
        if enrichment.social_entity:
            contexts.append(RetrievedContext(
                source='detail_enrichment',
                content=f"{enrichment.social_entity} ({enrichment.social_entity_relationship})",
                relevance_score=0.85,
                semantic_type='social_entity',
                metadata={
                    'detail_type': 'social_entity',
                    'entity_name': enrichment.social_entity,
                    'relationship': enrichment.social_entity_relationship
                }
            ))
        
        if enrichment.consequence:
            contexts.append(RetrievedContext(
                source='detail_enrichment',
                content=enrichment.consequence,
                relevance_score=0.8,
                semantic_type='consequence',
                metadata={'detail_type': 'consequence'}
            ))
        
        if enrichment.location_hint:
            contexts.append(RetrievedContext(
                source='detail_enrichment',
                content=enrichment.location_hint,
                relevance_score=0.7,
                semantic_type='location_hint',
                metadata={'detail_type': 'location_hint'}
            ))
        
        return contexts
    
    def get_details(self, pm_task_id: str) -> DetailEnrichment:
        """
        Get all detail elements for a PM task.
        
        Args:
            pm_task_id: ID of the prospective memory task
            
        Returns:
            DetailEnrichment object with all available details
        """
        self.ensure_loaded()
        
        enrichment = DetailEnrichment()
        sources = []
        
        # 1. Check semantic bridges for pre-defined details
        bridge = self._find_bridge(pm_task_id)
        if bridge:
            detail_elements = bridge.get('detail_elements', {})
            if detail_elements.get('motivation'):
                enrichment.motivation = detail_elements['motivation']
                sources.append('semantic_bridge')
            
            social = detail_elements.get('social_entity')
            if social:
                enrichment.social_entity = social
                enrichment.social_entity_relationship = self._get_relationship(social)
                sources.append('semantic_bridge')
            
            if detail_elements.get('consequence'):
                enrichment.consequence = detail_elements['consequence']
                sources.append('semantic_bridge')
            
            if detail_elements.get('location_hint'):
                enrichment.location_hint = detail_elements['location_hint']
                sources.append('semantic_bridge')
        
        # 2. Enrich with medical records if medication-related
        if 'medication' in pm_task_id.lower() or 'medicine' in pm_task_id.lower():
            med_details = self._get_medication_details()
            if med_details and not enrichment.motivation:
                enrichment.motivation = med_details.get('motivation')
                sources.append('medical_records')
            if med_details and not enrichment.social_entity:
                enrichment.social_entity = med_details.get('prescriber')
                enrichment.social_entity_relationship = 'doctor'
                sources.append('medical_records')
        
        # 3. Enrich with doctor instructions if appointment-related
        if 'doctor' in pm_task_id.lower() or 'appointment' in pm_task_id.lower() or 'medical' in pm_task_id.lower():
            appt_details = self._get_appointment_details()
            if appt_details:
                if not enrichment.motivation:
                    enrichment.motivation = appt_details.get('purpose')
                    sources.append('medical_records')
        
        # 4. Get location hints from daily routines
        if not enrichment.location_hint:
            location = self._get_location_from_routines(pm_task_id)
            if location:
                enrichment.location_hint = location
                sources.append('daily_routines')
        
        enrichment.source_references = list(set(sources))
        return enrichment
    
    def format_details_for_reminder(self, enrichment: DetailEnrichment, 
                                    language: str = 'zh',
                                    include_all: bool = True) -> str:
        """
        Format detail elements into natural language for reminder.
        
        Args:
            enrichment: DetailEnrichment object
            language: Language code
            include_all: If True, include all details; if False, pick most relevant
            
        Returns:
            Formatted detail string
        """
        parts = []
        
        if enrichment.motivation:
            parts.append(enrichment.motivation)
        
        if enrichment.consequence and include_all:
            if language == 'zh':
                parts.append(enrichment.consequence)
            elif language == 'en':
                parts.append(enrichment.consequence)
        
        if enrichment.location_hint and include_all:
            if language == 'zh':
                parts.append(f"（{enrichment.location_hint}）")
            elif language == 'en':
                parts.append(f"({enrichment.location_hint})")
        
        if language == 'zh':
            return '。'.join(parts) if parts else ''
        else:
            return '. '.join(parts) if parts else ''
    
    def _find_bridge(self, pm_task_id: str) -> Optional[Dict[str, Any]]:
        """Find semantic bridge by PM task ID."""
        for bridge in self.semantic_bridges.get('bridges', []):
            if bridge.get('pm_task', {}).get('id') == pm_task_id:
                return bridge
        return None
    
    def _get_relationship(self, name: str) -> Optional[str]:
        """Get relationship type for a social entity."""
        if not self.social_contacts:
            return None
        
        # Search all contact categories
        for category in ['family', 'medical', 'friends']:
            for contact in self.social_contacts.get(category, []):
                if name.lower() in contact.get('name', '').lower():
                    return contact.get('relationship')
        
        return None
    
    def _get_medication_details(self) -> Optional[Dict[str, Any]]:
        """Get details about primary medication."""
        if not self.medical_records:
            return None
        
        medications = self.medical_records.get('medications', [])
        # Get critical medication first
        for med in medications:
            if med.get('importance') == 'critical':
                return {
                    'motivation': med.get('instructions'),
                    'prescriber': med.get('prescriber'),
                    'purpose': med.get('purpose')
                }
        
        return medications[0] if medications else None
    
    def _get_appointment_details(self) -> Optional[Dict[str, Any]]:
        """Get details about upcoming appointment."""
        if not self.medical_records:
            return None
        
        appointments = self.medical_records.get('appointments', [])
        if appointments:
            appt = appointments[0]
            return {
                'purpose': appt.get('purpose'),
                'preparation': appt.get('preparation', []),
                'doctor': appt.get('doctor')
            }
        
        return None
    
    def _get_location_from_routines(self, pm_task_id: str) -> Optional[str]:
        """Get location hint from daily routines or memory aids."""
        if not self.daily_routines:
            return None
        
        # Check memory aids
        for aid in self.daily_routines.get('memory_aids_in_use', []):
            aid_name = aid.get('aid', '').lower()
            if any(keyword in pm_task_id.lower() for keyword in ['pill', 'medication', 'medicine']):
                if 'pill' in aid_name:
                    return f"{aid.get('description')} - {aid.get('location')}"
            if 'medical' in pm_task_id.lower() or 'book' in pm_task_id.lower():
                if 'medical' in aid_name or 'book' in aid_name:
                    return f"{aid.get('description')} - {aid.get('location')}"
        
        return None
