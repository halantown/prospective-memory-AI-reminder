#!/usr/bin/env python3
"""
Pre-Generation Script for Experiment Reminders

Generates all reminder variants for all experimental conditions.
Output is saved to data/generated/ for use during experiments.

This ensures:
1. Consistent reminders across participants
2. Controlled experimental conditions
3. No LLM variability during actual experiments
"""

import json
import os
import sys
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents import (
    create_orchestrator,
    PMTask,
    EXPERIMENT_CONDITIONS
)


# Define all PM tasks for the experiment
PM_TASKS = [
    PMTask(
        task_id='pm_medication',
        action='Take morning blood pressure medication',
        target_type='event_based',
        target_value='PillBox',
        importance='critical',
        detail_elements={
            'motivation': '王医生说早饭后吃可以减少头晕，对控制血压很重要',
            'social_entity': 'Dr. Wang'
        }
    ),
    PMTask(
        task_id='pm_bring_medical_book',
        action='Bring blue medical record book to doctor appointment',
        target_type='event_based', 
        target_value='Schedule',
        importance='high',
        detail_elements={
            'motivation': '王医生需要对比12月的血压数据来调整治疗方案',
            'social_entity': 'Dr. Wang'
        }
    ),
    PMTask(
        task_id='pm_return_book',
        action='Return borrowed book to Maria',
        target_type='event_based',
        target_value='Social',
        importance='medium',
        detail_elements={
            'motivation': 'Maria想在周末前读完这本书',
            'social_entity': 'Maria'
        }
    ),
    PMTask(
        task_id='pm_call_sarah',
        action='Call Sarah to confirm Wednesday dinner',
        target_type='time_based',
        target_value='17:00',
        importance='medium',
        detail_elements={
            'motivation': '确认Sarah是否带外卖来，还是需要自己准备',
            'social_entity': 'Sarah'
        }
    ),
    PMTask(
        task_id='pm_water_plants',
        action='Water the garden plants',
        target_type='time_based',
        target_value='09:00',
        importance='low',
        detail_elements={
            'motivation': '天气预报说今天很热，植物需要水分',
            'social_entity': None
        }
    ),
    PMTask(
        task_id='pm_pay_bill',
        action='Pay electricity bill before deadline',
        target_type='event_based',
        target_value='Priority',
        importance='high',
        detail_elements={
            'motivation': '账单截止日期是今天，逾期会有滞纳金',
            'social_entity': None
        }
    ),
]

# Define which ongoing task is "focal" for each PM task
FOCAL_ONGOING_TASKS = {
    'pm_medication': 'PillBox',
    'pm_bring_medical_book': 'Schedule',
    'pm_return_book': 'Social',
    'pm_call_sarah': 'Schedule',
    'pm_water_plants': 'PhotoSpot',
    'pm_pay_bill': 'Priority',
}

# Non-focal ongoing task (generic)
NON_FOCAL_ONGOING_TASK = 'Shopping'  # Low semantic relevance to most PM tasks

LANGUAGES = ['zh', 'en', 'nl']


def generate_all_reminders(output_dir: str):
    """Generate reminders for all conditions and save to files."""
    
    print("\n" + "="*70)
    print("🔄 PRE-GENERATING EXPERIMENT REMINDERS")
    print("="*70)
    
    # Create orchestrator
    data_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'raw')
    orchestrator = create_orchestrator(data_path)
    
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate for each condition
    for cond_id, condition in EXPERIMENT_CONDITIONS.items():
        print(f"\n📦 Generating Condition {cond_id}: {condition.description}")
        print("-" * 50)
        
        condition_data = {
            'condition_id': cond_id,
            'condition_name': condition.description,
            'focality': condition.focality,
            'detail': condition.detail,
            'generated_at': datetime.now().isoformat(),
            'reminders': {}
        }
        
        for pm_task in PM_TASKS:
            # Determine ongoing task based on focality condition
            if condition.focality == 'high':
                ongoing_task = FOCAL_ONGOING_TASKS.get(pm_task.task_id, 'PillBox')
            else:
                ongoing_task = NON_FOCAL_ONGOING_TASK
            
            task_reminders = {}
            
            for lang in LANGUAGES:
                output = orchestrator.generate_reminder(
                    pm_task=pm_task,
                    ongoing_task=ongoing_task,
                    condition=condition,
                    language=lang
                )
                task_reminders[lang] = output.reminder_text
            
            condition_data['reminders'][pm_task.task_id] = {
                'action': pm_task.action,
                'ongoing_task_used': ongoing_task,
                'texts': task_reminders,
                'metadata': {
                    'importance': pm_task.importance,
                    'target_type': pm_task.target_type,
                    'target_value': pm_task.target_value
                }
            }
            
            print(f"   ✓ {pm_task.task_id}")
            print(f"      ZH: {task_reminders['zh']}")
        
        # Save condition file
        filename = f"condition_{cond_id}_{condition.short_code}.json"
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(condition_data, f, ensure_ascii=False, indent=2)
        
        print(f"\n   💾 Saved to {filename}")
    
    # Generate summary file
    summary = {
        'generated_at': datetime.now().isoformat(),
        'conditions': {
            cond_id: {
                'name': cond.description,
                'focality': cond.focality,
                'detail': cond.detail,
                'file': f"condition_{cond_id}_{cond.short_code}.json"
            }
            for cond_id, cond in EXPERIMENT_CONDITIONS.items()
        },
        'pm_tasks': [t.task_id for t in PM_TASKS],
        'languages': LANGUAGES
    }
    
    with open(os.path.join(output_dir, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    
    print("\n" + "="*70)
    print("✅ PRE-GENERATION COMPLETE")
    print(f"   Output directory: {output_dir}")
    print(f"   Conditions: {len(EXPERIMENT_CONDITIONS)}")
    print(f"   PM Tasks: {len(PM_TASKS)}")
    print(f"   Languages: {len(LANGUAGES)}")
    print(f"   Total reminders: {len(EXPERIMENT_CONDITIONS) * len(PM_TASKS) * len(LANGUAGES)}")
    print("="*70 + "\n")


def print_comparison_table():
    """Print a comparison table of all conditions for one PM task."""
    
    print("\n" + "="*70)
    print("📊 REMINDER COMPARISON TABLE (pm_medication)")
    print("="*70)
    
    data_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'raw')
    orchestrator = create_orchestrator(data_path)
    
    pm_task = PM_TASKS[0]  # medication task
    
    print(f"\nPM Task: {pm_task.action}")
    print("-" * 70)
    
    rows = []
    for cond_id, condition in EXPERIMENT_CONDITIONS.items():
        ongoing_task = FOCAL_ONGOING_TASKS.get(pm_task.task_id) if condition.focality == 'high' else NON_FOCAL_ONGOING_TASK
        
        output = orchestrator.generate_reminder(
            pm_task=pm_task,
            ongoing_task=ongoing_task,
            condition=condition,
            language='zh'
        )
        
        rows.append({
            'Condition': cond_id,
            'Focality': condition.focality.upper(),
            'Detail': condition.detail.upper(),
            'Ongoing Task': ongoing_task,
            'Reminder (ZH)': output.reminder_text
        })
    
    # Print table
    print(f"\n{'Cond':<6} {'Focal':<6} {'Detail':<6} {'Ongoing':<10} {'Reminder'}")
    print("-" * 70)
    for row in rows:
        print(f"{row['Condition']:<6} {row['Focality']:<6} {row['Detail']:<6} {row['Ongoing Task']:<10} {row['Reminder (ZH)']}")
    
    print("\n" + "="*70)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Pre-generate experiment reminders')
    parser.add_argument('--output', '-o', 
                        default=os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'generated'),
                        help='Output directory')
    parser.add_argument('--compare', '-c', action='store_true',
                        help='Print comparison table only')
    
    args = parser.parse_args()
    
    if args.compare:
        print_comparison_table()
    else:
        generate_all_reminders(args.output)
        print_comparison_table()
