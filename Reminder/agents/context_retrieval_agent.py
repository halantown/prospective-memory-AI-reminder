"""
Context Retrieval Agent - RAG-based context retrieval.

Uses vector similarity search to find relevant information
from emails, messages, notes, and other data sources.
"""

import json
import os
from typing import List, Dict, Any, Optional

from .base_agent import BaseAgent, RetrievedContext, PMTask


class ContextRetrievalAgent(BaseAgent):
    """
    Agent that retrieves relevant context using RAG (Retrieval-Augmented Generation).
    
    Searches across:
    - Emails
    - Messages/SMS
    - Phone call transcripts
    - Notes
    - Calendar events
    
    Can use either:
    - Simple keyword matching (for lightweight deployment)
    - Vector similarity search (for production)
    """
    
    def __init__(self, data_path: str, use_vector_search: bool = False):
        super().__init__(data_path, "ContextRetrievalAgent")
        self.use_vector_search = use_vector_search
        
        # Data stores
        self.emails = None
        self.messages = None
        self.phone_calls = None
        self.notes = None
        self.calendar = None
        
        # Vector store (optional)
        self.vector_store = None
        
    def load_data(self) -> None:
        """Load all data sources."""
        self.emails = self._load_json('emails.json')
        self.messages = self._load_json('messages.json')
        self.phone_calls = self._load_json('phone_calls.json')
        self.notes = self._load_json('notes.json')
        self.calendar = self._load_json('calendar_events.json')
        
        source_counts = [
            f"{len(self.emails)} emails",
            f"{len(self.messages)} messages",
            f"{len(self.phone_calls)} calls",
            f"{len(self.notes)} notes",
            f"{len(self.calendar)} events"
        ]
        print(f"  ✓ Loaded: {', '.join(source_counts)}")
        
        if self.use_vector_search:
            self._init_vector_store()
    
    def _init_vector_store(self) -> None:
        """Initialize vector store for semantic search."""
        try:
            from ..vector_store.chroma_manager import ChromaManager
            self.vector_store = ChromaManager(
                persist_directory=os.path.join(self.data_path, '..', 'processed', 'chroma_db')
            )
            print("  ✓ Vector store initialized")
        except ImportError:
            print("  ⚠ Vector store not available, using keyword search")
            self.use_vector_search = False
    
    def retrieve(self, pm_task: PMTask, current_context: Dict[str, Any]) -> List[RetrievedContext]:
        """
        Retrieve relevant context for a PM task.
        
        Args:
            pm_task: The prospective memory task
            current_context: Current game context
            
        Returns:
            List of relevant context items
        """
        self.ensure_loaded()
        
        # Extract search keywords from PM task
        keywords = self._extract_keywords(pm_task)
        
        if self.use_vector_search and self.vector_store:
            return self._vector_search(pm_task.action, top_k=5)
        else:
            return self._keyword_search(keywords, top_k=5)
    
    def _extract_keywords(self, pm_task: PMTask) -> List[str]:
        """Extract search keywords from PM task."""
        keywords = []
        
        # From action
        action_words = pm_task.action.lower().split()
        keywords.extend([w for w in action_words if len(w) > 3])
        
        # From detail elements
        if pm_task.detail_elements:
            social = pm_task.detail_elements.get('social_entity')
            if social:
                keywords.append(social.lower())
        
        return list(set(keywords))
    
    def _keyword_search(self, keywords: List[str], top_k: int = 5) -> List[RetrievedContext]:
        """Simple keyword-based search across all sources."""
        results = []
        
        # Search emails
        for email in self.emails:
            text = f"{email.get('subject', '')} {email.get('body', '')} {email.get('sender', '')}"
            score = self._calculate_keyword_relevance(text, keywords)
            if score > 0.2:
                results.append(RetrievedContext(
                    source='email',
                    content=f"From {email['sender']}: {email['subject']}\n{email['body'][:200]}...",
                    relevance_score=score,
                    semantic_type='communication',
                    timestamp=email.get('timestamp'),
                    metadata={'email_id': email.get('email_id'), 'sender': email.get('sender')}
                ))
        
        # Search messages
        for msg in self.messages:
            text = f"{msg.get('sender', '')} {msg.get('content', '')}"
            score = self._calculate_keyword_relevance(text, keywords)
            if score > 0.2:
                results.append(RetrievedContext(
                    source='message',
                    content=f"Message from {msg['sender']}: {msg['content']}",
                    relevance_score=score,
                    semantic_type='communication',
                    timestamp=msg.get('timestamp'),
                    metadata={'msg_id': msg.get('msg_id'), 'sender': msg.get('sender')}
                ))
        
        # Search phone calls
        for call in self.phone_calls:
            text = f"{call.get('caller', '')} {call.get('transcript', '')}"
            score = self._calculate_keyword_relevance(text, keywords)
            if score > 0.2:
                results.append(RetrievedContext(
                    source='phone_call',
                    content=f"Call from {call['caller']}: {call['transcript'][:200]}...",
                    relevance_score=score,
                    semantic_type='communication',
                    timestamp=call.get('timestamp'),
                    metadata={'call_id': call.get('call_id'), 'caller': call.get('caller')}
                ))
        
        # Search notes
        for note in self.notes:
            text = f"{note.get('title', '')} {note.get('content', '')}"
            score = self._calculate_keyword_relevance(text, keywords)
            if score > 0.2:
                results.append(RetrievedContext(
                    source='note',
                    content=f"Note '{note['title']}': {note['content']}",
                    relevance_score=score,
                    semantic_type='personal_note',
                    timestamp=note.get('timestamp'),
                    metadata={'note_id': note.get('note_id')}
                ))
        
        # Sort by relevance and return top_k
        results.sort(key=lambda x: x.relevance_score, reverse=True)
        return results[:top_k]
    
    def _vector_search(self, query: str, top_k: int = 5) -> List[RetrievedContext]:
        """Vector similarity search using embeddings."""
        if not self.vector_store:
            return []
        
        results = self.vector_store.search(query, top_k=top_k)
        
        return [
            RetrievedContext(
                source=r.get('source', 'unknown'),
                content=r.get('content', ''),
                relevance_score=1.0 - r.get('distance', 0.5),  # Convert distance to score
                semantic_type='retrieved',
                metadata=r.get('metadata', {})
            )
            for r in results
        ]
    
    def search_by_person(self, person_name: str, top_k: int = 5) -> List[RetrievedContext]:
        """Search for all communications involving a specific person."""
        self.ensure_loaded()
        
        results = []
        name_lower = person_name.lower()
        
        # Search emails
        for email in self.emails:
            if name_lower in email.get('sender', '').lower():
                results.append(RetrievedContext(
                    source='email',
                    content=f"From {email['sender']}: {email['subject']}\n{email['body'][:200]}...",
                    relevance_score=1.0,
                    semantic_type='communication',
                    timestamp=email.get('timestamp'),
                    metadata={'email_id': email.get('email_id')}
                ))
        
        # Search messages
        for msg in self.messages:
            if name_lower in msg.get('sender', '').lower():
                results.append(RetrievedContext(
                    source='message',
                    content=f"Message from {msg['sender']}: {msg['content']}",
                    relevance_score=1.0,
                    semantic_type='communication',
                    timestamp=msg.get('timestamp'),
                    metadata={'msg_id': msg.get('msg_id')}
                ))
        
        # Sort by timestamp (most recent first)
        results.sort(key=lambda x: x.timestamp or '', reverse=True)
        return results[:top_k]
    
    def get_recent_communications(self, hours: int = 24, top_k: int = 10) -> List[RetrievedContext]:
        """Get recent communications from all sources."""
        self.ensure_loaded()
        
        all_items = []
        
        for email in self.emails:
            all_items.append({
                'type': 'email',
                'timestamp': email.get('timestamp'),
                'content': f"Email from {email['sender']}: {email['subject']}",
                'data': email
            })
        
        for msg in self.messages:
            all_items.append({
                'type': 'message',
                'timestamp': msg.get('timestamp'),
                'content': f"Message from {msg['sender']}: {msg['content'][:100]}",
                'data': msg
            })
        
        # Sort by timestamp
        all_items.sort(key=lambda x: x['timestamp'] or '', reverse=True)
        
        return [
            RetrievedContext(
                source=item['type'],
                content=item['content'],
                relevance_score=0.8,
                semantic_type='recent_communication',
                timestamp=item['timestamp'],
                metadata=item['data']
            )
            for item in all_items[:top_k]
        ]
