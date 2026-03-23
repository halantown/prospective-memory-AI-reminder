# Reminder Agent — Sprint 5-7 Development Guide

> **Version**: 1.0 | **Date**: 2026-03-23 | **Prerequisite**: Read SUMMARY_M2.md first
> **Current state**: S1-S4 complete (76 tests passing), S5-S7 pending

---

## 1. What's Done vs What's Next

```
✅ S1: config_loader.py (Pydantic validation, 18 tests)
✅ S2: context_extractor.py (JSON pruner, 20 tests)
✅ S3: llm_backend.py + prompt_constructor.py (4 backends, dual format)
✅ S4: quality_gate.py (6 checks, 38 tests)

📋 S5: Task JSONs + Baseline Generator + Batch Runner + Output Store  ← THIS SPRINT
📋 S6: Scale to 10 variants + Human Review Interface
📋 S7: Stage 1 Demo (ReAct agent, lowest priority)
```

---

## 2. Sprint 5 — Detailed Specification

### 2.1 Deliverables

| File | Purpose | Depends On |
|------|---------|-----------|
| `data/task_schemas/b1_book.json` (+ 11 more) | 12 Task JSON files | PM task design (see §3) |
| `config/condition_field_map.yaml` (update) | Add Baseline condition entry | — |
| `stage2/baseline_generator.py` | Template-based Layer 0 text | context_extractor.py |
| `stage2/batch_runner.py` | Orchestrate full generation pipeline | all stage2 modules |
| `stage2/output_store.py` | SQLite storage for generated texts | — |
| `tests/test_baseline_generator.py` | Baseline output verification | baseline_generator.py |
| `tests/test_context_extractor.py` (update) | Add Baseline condition tests | context_extractor.py |

### 2.2 Exit Criteria

```
- [ ] 12 task JSON files, all passing schema validation
- [ ] condition_field_map.yaml has 3 entries (Baseline, AF, AF_CB)
- [ ] baseline_generator.py produces correct template output for all 12 tasks
- [ ] batch_runner.py can run: 12 tasks × 2 LLM conditions × 3 variants = 72 texts
- [ ] output_store.py writes all results to reminders.db with correct schema
- [ ] quality_gate passes on all generated texts (or retries logged)
- [ ] All existing tests still pass + new tests pass
- [ ] Total test count: 76 (existing) + ~25 (new) = ~100
```

---

## 3. Task JSON Files

### 3.1 Schema (3-Zone Design)

Every task JSON follows this exact structure. The schema is the **single source of truth** — the context_extractor reads from `reminder_context`, the game platform reads from `agent_reasoning_context`, and `placeholder` is untouched.

```json
{
  "task_id": "string — e.g. b1_book",
  "description": "string — one-line human-readable summary",

  "reminder_context": {
    "element1": {
      "action_verb": "string — e.g. find and bring",
      "target_entity": {
        "entity_name": "string — e.g. book",
        "object_type": "string — e.g. personal item",
        "cues": {
          "visual": "string — e.g. Red cover with mountain landscape illustration"
        },
        "domain_properties": {
          "key": "value pairs — task-specific details that aid discrimination"
        }
      },
      "location": {
        "room": "string — study | bedroom | living_room | bathroom",
        "spot": "string — e.g. second shelf of the bookcase"
      }
    },
    "element2": {
      "origin": {
        "task_creator": "string — e.g. friend Mei",
        "creator_is_authority": "boolean"
      },
      "creation_context": "string — one-line background"
    },
    "element3": {
      "detected_activity_raw": "string — e.g. User is flipping steak on pan #2"
    }
  },

  "agent_reasoning_context": {
    "encoding_info": {
      "encoding_text": "string — full encoding card paragraph",
      "encoding_image": "string — image filename",
      "confirmation_question": {
        "question": "string",
        "options": ["string", "string", "string"],
        "correct_index": "integer (0-indexed)"
      }
    },
    "distractor_info": {
      "distractor_description": "string — full description of wrong item",
      "discriminating_dimension": "string — what differs between target and distractor"
    },
    "trigger_info": {
      "trigger_type": "string — visitor | communication | appliance | activity",
      "trigger_event": "string — human-readable trigger description",
      "trigger_time_in_block": "string — approximate timing, e.g. ~360s"
    }
  },

  "placeholder": {
    "motivation": "string — why the task matters (not used in experiment)",
    "consequence_if_missed": "string",
    "status": "EXCLUDED — requires inferential reasoning"
  }
}
```

### 3.2 All 12 Task JSONs

Below is the complete content for each file. Create one `.json` file per task in `data/task_schemas/`.

---

#### `b1_book.json`

```json
{
  "task_id": "b1_book",
  "description": "Find the travel book for Mei when she arrives",

  "reminder_context": {
    "element1": {
      "action_verb": "find and bring",
      "target_entity": {
        "entity_name": "book",
        "object_type": "personal item",
        "cues": {
          "visual": "Red cover with mountain landscape illustration"
        },
        "domain_properties": {
          "title": "Erta Ale",
          "format": "paperback"
        }
      },
      "location": {
        "room": "study",
        "spot": "second shelf of the bookcase"
      }
    },
    "element2": {
      "origin": {
        "task_creator": "friend Mei",
        "creator_is_authority": false
      },
      "creation_context": "Mei asked to borrow it during a phone call yesterday"
    },
    "element3": {
      "detected_activity_raw": "User is flipping steak on pan #2"
    }
  },

  "agent_reasoning_context": {
    "encoding_info": {
      "encoding_text": "Your friend Mei asked to borrow a travel book. When Mei arrives, go to the study and find the book on the second shelf of the bookcase. It is a red paperback with a mountain illustration on the cover, titled Erta Ale. Bring it to the living room and give it to Mei.",
      "encoding_image": "b1_book_target.png",
      "confirmation_question": {
        "question": "What is on the cover of the book you need to find?",
        "options": ["Ocean landscape", "Mountain landscape", "City skyline"],
        "correct_index": 1
      }
    },
    "distractor_info": {
      "distractor_description": "Red paperback with ocean landscape illustration, titled Blue Horizon, same shelf",
      "discriminating_dimension": "cover illustration (mountain vs ocean)"
    },
    "trigger_info": {
      "trigger_type": "visitor",
      "trigger_event": "Doorbell — Mei arrives",
      "trigger_time_in_block": "~360s"
    }
  },

  "placeholder": {
    "motivation": "Mei is going hiking and wants travel inspiration",
    "consequence_if_missed": "Mei leaves without the book",
    "status": "EXCLUDED — requires inferential reasoning"
  }
}
```

#### `b1_giftbag.json`

```json
{
  "task_id": "b1_giftbag",
  "description": "Get the gift bag when delivery notification arrives",

  "reminder_context": {
    "element1": {
      "action_verb": "get and bring",
      "target_entity": {
        "entity_name": "gift bag",
        "object_type": "packaging",
        "cues": {
          "visual": "Small blue bag with bow decoration on handle"
        },
        "domain_properties": {
          "size": "small",
          "decoration": "bow"
        }
      },
      "location": {
        "room": "bedroom",
        "spot": "on the dresser"
      }
    },
    "element2": {
      "origin": {
        "task_creator": "self",
        "creator_is_authority": false
      },
      "creation_context": "Ordered a birthday gift for Mei online"
    },
    "element3": {
      "detected_activity_raw": "User is arranging cutlery on the dining table"
    }
  },

  "agent_reasoning_context": {
    "encoding_info": {
      "encoding_text": "You ordered a birthday gift for Mei online. When the delivery notification arrives on your phone, go to the bedroom and get a gift bag from the dresser — the small blue bag with the bow. Bring it to the entrance to bag the gift.",
      "encoding_image": "b1_giftbag_target.png",
      "confirmation_question": {
        "question": "Which gift bag do you need?",
        "options": ["Medium bag with ribbon", "Small bag with bow", "Large bag with bow"],
        "correct_index": 1
      }
    },
    "distractor_info": {
      "distractor_description": "Medium blue gift bag with ribbon decoration, same dresser",
      "discriminating_dimension": "size (small vs medium) + decoration (bow vs ribbon)"
    },
    "trigger_info": {
      "trigger_type": "communication",
      "trigger_event": "Phone message: delivery notification",
      "trigger_time_in_block": "~420s"
    }
  },

  "placeholder": {
    "motivation": "Want to surprise Mei for her birthday",
    "consequence_if_missed": "Gift sits unbagged at entrance",
    "status": "EXCLUDED — requires inferential reasoning"
  }
}
```

#### `b1_dish.json`

```json
{
  "task_id": "b1_dish",
  "description": "Get baking dish when oven finishes preheating",

  "reminder_context": {
    "element1": {
      "action_verb": "get and bring",
      "target_entity": {
        "entity_name": "baking dish",
        "object_type": "kitchenware",
        "cues": {
          "visual": "Oval white ceramic dish with two blue handles"
        },
        "domain_properties": {
          "shape": "oval",
          "handle_color": "blue"
        }
      },
      "location": {
        "room": "living_room",
        "spot": "display cabinet, bottom shelf"
      }
    },
    "element2": {
      "origin": {
        "task_creator": "self",
        "creator_is_authority": false
      },
      "creation_context": "Baking a dish for Mei tonight"
    },
    "element3": {
      "detected_activity_raw": "User is replying to a phone message"
    }
  },

  "agent_reasoning_context": {
    "encoding_info": {
      "encoding_text": "You are baking a dish for Mei tonight. When the oven finishes preheating, go to the living room and get the baking dish from the display cabinet, bottom shelf — it is the oval ceramic dish with blue handles. Bring it to the kitchen.",
      "encoding_image": "b1_dish_target.png",
      "confirmation_question": {
        "question": "What color are the handles on the baking dish?",
        "options": ["Red", "Blue", "Green"],
        "correct_index": 1
      }
    },
    "distractor_info": {
      "distractor_description": "Oval white ceramic dish with two red handles, same shelf",
      "discriminating_dimension": "handle color (blue vs red)"
    },
    "trigger_info": {
      "trigger_type": "appliance",
      "trigger_event": "Oven preheat-complete chime",
      "trigger_time_in_block": "~195s"
    }
  },

  "placeholder": {
    "motivation": "Mei loves baked dishes",
    "consequence_if_missed": "Cannot start baking on time",
    "status": "EXCLUDED — requires inferential reasoning"
  }
}
```

#### `b1_soap.json`

```json
{
  "task_id": "b1_soap",
  "description": "Get hand soap after all steaks are plated",

  "reminder_context": {
    "element1": {
      "action_verb": "get and place",
      "target_entity": {
        "entity_name": "hand soap",
        "object_type": "toiletry",
        "cues": {
          "visual": "White pump bottle with yellow lemon label"
        },
        "domain_properties": {
          "scent": "lemon",
          "type": "pump bottle"
        }
      },
      "location": {
        "room": "bathroom",
        "spot": "shelf above the sink"
      }
    },
    "element2": {
      "origin": {
        "task_creator": "self",
        "creator_is_authority": false
      },
      "creation_context": "Guests should wash hands before dinner"
    },
    "element3": {
      "detected_activity_raw": "User just finished plating the last steak"
    }
  },

  "agent_reasoning_context": {
    "encoding_info": {
      "encoding_text": "After you finish plating all three steaks, go to the bathroom and get the hand soap from the shelf above the sink — the pump bottle with the lemon label. Put it by the kitchen sink so your guests can wash their hands before dinner.",
      "encoding_image": "b1_soap_target.png",
      "confirmation_question": {
        "question": "Which hand soap do you need to get?",
        "options": ["Mint label", "Lemon label", "Lavender label"],
        "correct_index": 1
      }
    },
    "distractor_info": {
      "distractor_description": "White pump bottle with green mint label, same shelf",
      "discriminating_dimension": "scent label (lemon vs mint)"
    },
    "trigger_info": {
      "trigger_type": "activity",
      "trigger_event": "All three steaks plated",
      "trigger_time_in_block": "~480s (state-dependent)"
    }
  },

  "placeholder": {
    "motivation": "Hygiene before dinner",
    "consequence_if_missed": "Guests eat with dirty hands",
    "status": "EXCLUDED — requires inferential reasoning"
  }
}
```

#### Remaining 8 tasks: `b2_vinyl.json`, `b2_napkinrings.json`, `b2_pot.json`, `b2_softener.json`, `b3_hanger.json`, `b3_speaker.json`, `b3_vase.json`, `b3_handcream.json`

**These follow the exact same schema.** To avoid this document being 2000 lines, here is a compact reference. Use the PM task design table and the `b1_book.json` template to generate each file:

| task_id | action_verb | entity_name | visual cue | domain_properties | room.spot | element2.task_creator | element3.detected_activity_raw | trigger_type |
|---------|-------------|-------------|-----------|-------------------|-----------|----------------------|-------------------------------|-------------|
| b2_vinyl | find and place | vinyl record | Black sleeve with car illustration | title: Night Drive | study, on the desk | friend Lucas | User is monitoring steak on pan #1 | communication |
| b2_napkinrings | get and place | napkin rings | Set of natural wood rings, light oak | material: wooden | bedroom, wardrobe top drawer | self | User just finished setting the full table | activity |
| b2_pot | get and use | flower pot | Brown terracotta pot sitting on matching saucer | feature: with saucer | living_room, window shelf | self | User is replying to a phone message | visitor |
| b2_softener | get and add | fabric softener | Purple bottle with lavender flower label | scent: lavender | bathroom, shelf above machine | self | User is arranging cutlery on table | appliance |
| b3_hanger | get and use | hanger | Natural wood hanger with wide curved shoulders | shoulder_type: wide | study, closet left side | friend Sophie | User is flipping steak on pan #3 | appliance |
| b3_speaker | get and set up | Bluetooth speaker | Small round speaker with gray fabric mesh cover | cover_material: fabric | living_room, sideboard bottom shelf | self | User just finished reading the last message in batch | activity |
| b3_vase | get and prepare | vase | Small ceramic vase with smooth blue glaze | glaze_color: blue | bedroom, windowsill | friend Sophie | User is monitoring steak doneness | visitor |
| b3_handcream | get and bring | hand cream | White tube with purple lavender flower label | scent: lavender | bathroom, shelf above sink | friend Sophie | User is arranging cutlery on table | communication |

---

## 4. Config Updates

### 4.1 `condition_field_map.yaml` — Add Baseline

Current file has 2 entries (AF_only, AF_CB). Add Baseline:

```yaml
Baseline:
  required_fields:
    - "reminder_context.element1.action_verb"
    - "reminder_context.element1.target_entity.entity_name"
  conditional_fields: []
  excluded_fields:
    - "reminder_context.element1.target_entity.cues"
    - "reminder_context.element1.target_entity.domain_properties"
    - "reminder_context.element1.location"
    - "reminder_context.element2"
    - "reminder_context.element3"
  excluded_zones:
    - "agent_reasoning_context"
    - "placeholder"

AF_only:
  # (existing — no changes needed, but verify location fields are included)
  required_fields:
    - "reminder_context.element1.action_verb"
    - "reminder_context.element1.target_entity.entity_name"
    - "reminder_context.element1.target_entity.cues.visual"
    - "reminder_context.element1.target_entity.domain_properties"
    - "reminder_context.element1.location"
  conditional_fields:
    - field: "reminder_context.element2.origin.task_creator"
      condition: "reminder_context.element2.origin.creator_is_authority == true"
  excluded_fields:
    - "reminder_context.element3"
  excluded_zones:
    - "agent_reasoning_context"
    - "placeholder"

AF_CB:
  # (existing — no changes needed, but verify location + element3 included)
  required_fields:
    - "reminder_context.element1.action_verb"
    - "reminder_context.element1.target_entity.entity_name"
    - "reminder_context.element1.target_entity.cues.visual"
    - "reminder_context.element1.target_entity.domain_properties"
    - "reminder_context.element1.location"
    - "reminder_context.element3.detected_activity_raw"
  conditional_fields:
    - field: "reminder_context.element2.origin.task_creator"
      condition: "reminder_context.element2.origin.creator_is_authority == true"
  excluded_fields: []
  excluded_zones:
    - "agent_reasoning_context"
    - "placeholder"
```

### 4.2 `generation_config.yaml` — No changes yet

Keep `n_variants: 3` for S5 development. Scale to 10 in S6.

---

## 5. New Modules

### 5.1 `baseline_generator.py`

Simple template-based generator. No LLM needed.

```python
"""Generate Layer 0 (Baseline) reminder texts from Task JSON."""

from .context_extractor import extract
from .config_loader import load_condition_field_map


def generate_baseline(task_json: dict, field_map=None) -> str:
    """
    Generate a single baseline reminder text.
    
    Template: "Remember to {action_verb} the/your {entity_name}."
    
    For tasks involving a person: "Remember to {action_verb} the {entity_name} for {guest}."
    """
    pruned = extract(task_json, "Baseline", field_map)
    
    action_verb = pruned["reminder_context"]["element1"]["action_verb"]
    entity_name = pruned["reminder_context"]["element1"]["target_entity"]["entity_name"]
    
    # Check if task has a recipient (from encoding text, not from pruned context)
    # This is a fixed template decision, not LLM-generated
    text = f"Remember to {action_verb} the {entity_name}."
    
    return text


def generate_all_baselines(task_jsons: list[dict], field_map=None) -> dict[str, str]:
    """Generate baseline text for all tasks. Returns {task_id: text}."""
    return {
        tj["task_id"]: generate_baseline(tj, field_map)
        for tj in task_jsons
    }
```

**Expected outputs for all 12 tasks:**

| task_id | Baseline text |
|---------|--------------|
| b1_book | "Remember to find and bring the book." |
| b1_giftbag | "Remember to get and bring the gift bag." |
| b1_dish | "Remember to get and bring the baking dish." |
| b1_soap | "Remember to get and place the hand soap." |
| b2_vinyl | "Remember to find and place the vinyl record." |
| b2_napkinrings | "Remember to get and place the napkin rings." |
| b2_pot | "Remember to get and use the flower pot." |
| b2_softener | "Remember to get and add the fabric softener." |
| b3_hanger | "Remember to get and use the hanger." |
| b3_speaker | "Remember to get and set up the Bluetooth speaker." |
| b3_vase | "Remember to get and prepare the vase." |
| b3_handcream | "Remember to get and bring the hand cream." |

### 5.2 `output_store.py`

SQLite-based storage for all generated reminder texts.

```python
"""SQLite storage for generated reminder texts."""

import sqlite3
from pathlib import Path
from datetime import datetime


DB_PATH = Path(__file__).parent.parent / "output" / "reminders.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    condition TEXT NOT NULL,          -- 'Baseline' | 'AF_only' | 'AF_CB'
    variant_idx INTEGER NOT NULL,     -- 0 for Baseline (single text), 0-9 for LLM variants
    text TEXT NOT NULL,
    
    -- Quality gate results
    passed_quality_gate BOOLEAN,
    quality_gate_failures TEXT,       -- JSON list of failed check names, or null
    
    -- Review status
    review_status TEXT DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected' | 'flagged'
    reviewer_notes TEXT,
    
    -- Metadata
    model_used TEXT,                  -- null for Baseline (template), model name for LLM
    generation_attempt INTEGER,       -- which retry attempt succeeded
    generated_at TIMESTAMP,
    reviewed_at TIMESTAMP,
    
    UNIQUE(task_id, condition, variant_idx)
);

CREATE TABLE IF NOT EXISTS generation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    condition TEXT NOT NULL,
    variant_idx INTEGER NOT NULL,
    attempt INTEGER NOT NULL,
    
    raw_output TEXT,                  -- raw LLM output before any processing
    quality_gate_passed BOOLEAN,
    quality_gate_details TEXT,        -- JSON of all check results
    
    model_used TEXT,
    prompt_system TEXT,
    prompt_user TEXT,
    
    created_at TIMESTAMP
);
"""


class OutputStore:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
    
    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript(SCHEMA)
    
    def write_reminder(self, task_id, condition, variant_idx, text,
                       passed_qg, qg_failures, model_used, attempt):
        ...
    
    def write_generation_log(self, task_id, condition, variant_idx, attempt,
                             raw_output, qg_passed, qg_details,
                             model_used, prompt_system, prompt_user):
        ...
    
    def get_approved_reminders(self, task_id=None, condition=None):
        ...
    
    def get_pending_review(self):
        ...
    
    def update_review_status(self, reminder_id, status, notes=None):
        ...
```

### 5.3 `batch_runner.py`

Orchestrates the full generation pipeline.

```python
"""Batch generation orchestrator."""

from pathlib import Path
from .config_loader import load_all_configs
from .context_extractor import extract
from .prompt_constructor import build_prompts
from .llm_backend import create_backend
from .quality_gate import check
from .baseline_generator import generate_baseline
from .output_store import OutputStore


TASK_DIR = Path(__file__).parent.parent / "data" / "task_schemas"
LLM_CONDITIONS = ["AF_only", "AF_CB"]


def load_all_tasks() -> list[dict]:
    """Load all task JSON files from data/task_schemas/."""
    ...


def run_batch(n_variants: int = 3, dry_run: bool = False):
    """
    Full batch generation:
      1. Generate baselines (template, no LLM)
      2. For each task × LLM condition × variant:
         a. Extract context
         b. Build prompts
         c. Generate text
         d. Run quality gate
         e. If pass: store. If fail: retry (up to max_retries)
      3. Report summary
    """
    model_config, gen_config, field_map = load_all_configs()
    backend = create_backend(model_config)
    store = OutputStore()
    
    tasks = load_all_tasks()
    n_variants = n_variants or gen_config.n_variants
    
    # Phase 1: Baselines
    print(f"=== Generating baselines for {len(tasks)} tasks ===")
    for task in tasks:
        text = generate_baseline(task, field_map)
        store.write_reminder(
            task_id=task["task_id"],
            condition="Baseline",
            variant_idx=0,
            text=text,
            passed_qg=True,  # template always passes
            qg_failures=None,
            model_used=None,
            attempt=1
        )
        print(f"  ✅ {task['task_id']}: {text}")
    
    # Phase 2: LLM-generated conditions
    total = len(tasks) * len(LLM_CONDITIONS) * n_variants
    done = 0
    failed = 0
    
    for task in tasks:
        for condition in LLM_CONDITIONS:
            prior_variants = []
            
            for v_idx in range(n_variants):
                success = False
                
                for attempt in range(1, gen_config.max_retries + 1):
                    # Extract
                    pruned = extract(task, condition, field_map)
                    
                    # Build prompts
                    sys_prompt, usr_prompt = build_prompts(
                        task, condition,
                        prior_variants=prior_variants,
                        context_format=gen_config.context_format,
                        field_map=field_map
                    )
                    
                    # Generate
                    if dry_run:
                        raw_output = f"[DRY RUN] {task['task_id']} / {condition} / v{v_idx}"
                    else:
                        raw_output = backend.generate(sys_prompt, usr_prompt)
                    
                    # Quality gate
                    qg_result = check(raw_output, task, condition, prior_variants)
                    
                    # Log
                    store.write_generation_log(
                        task_id=task["task_id"],
                        condition=condition,
                        variant_idx=v_idx,
                        attempt=attempt,
                        raw_output=raw_output,
                        qg_passed=qg_result.passed,
                        qg_details=qg_result.to_json(),
                        model_used=model_config.model_name,
                        prompt_system=sys_prompt,
                        prompt_user=usr_prompt
                    )
                    
                    if qg_result.passed:
                        store.write_reminder(
                            task_id=task["task_id"],
                            condition=condition,
                            variant_idx=v_idx,
                            text=raw_output,
                            passed_qg=True,
                            qg_failures=None,
                            model_used=model_config.model_name,
                            attempt=attempt
                        )
                        prior_variants.append(raw_output)
                        success = True
                        break
                
                done += 1
                if not success:
                    failed += 1
                    print(f"  ❌ {task['task_id']} / {condition} / v{v_idx}: "
                          f"FAILED after {gen_config.max_retries} attempts")
                else:
                    print(f"  ✅ {task['task_id']} / {condition} / v{v_idx} "
                          f"(attempt {attempt})")
    
    # Summary
    print(f"\n=== Batch complete ===")
    print(f"  Baselines: {len(tasks)}")
    print(f"  LLM texts: {done} attempted, {done - failed} succeeded, {failed} failed")
    print(f"  Database: {store.db_path}")
```

---

## 6. Tests to Add

### 6.1 `test_baseline_generator.py` (~12 tests)

```python
"""Tests for baseline_generator.py"""

# Test: baseline output for each task contains action_verb and entity_name
# Test: baseline output does NOT contain visual cues
# Test: baseline output does NOT contain location
# Test: baseline output does NOT contain domain_properties
# Test: baseline output does NOT contain detected_activity
# Test: baseline output is a single sentence
# Test: baseline output starts with "Remember to"
# Test: generate_all_baselines returns dict with all 12 task_ids
# Test: baseline for task with authority creator still doesn't include creator
# Test: missing required field raises MissingRequiredFieldError
# Test: empty task_json raises appropriate error
# Test: all 12 baselines match expected outputs (parametrized)
```

### 6.2 `test_context_extractor.py` additions (~8 tests)

```python
# Test: Baseline condition extracts only action_verb + entity_name
# Test: Baseline condition excludes visual cues
# Test: Baseline condition excludes location
# Test: Baseline condition excludes element2
# Test: Baseline condition excludes element3
# Test: Baseline condition excludes agent_reasoning_context zone
# Test: Baseline condition excludes placeholder zone
# Test: Baseline extraction works for all 12 task JSONs (parametrized)
```

---

## 7. Sprint 6 — Scale & Review (Brief)

After S5 is complete:

1. Change `generation_config.yaml`: `n_variants: 3` → `n_variants: 10`
2. Run `batch_runner.py` for full scale: 12 × 2 × 10 = 240 LLM texts
3. Implement `review_interface.py`:
   ```
   CLI tool that:
   - Shows one reminder at a time
   - Displays: task context, condition, variant text
   - Prompts: [a]pprove / [r]eject / [f]lag / [s]kip
   - Updates review_status in reminders.db
   ```
4. Target: 240 approved texts + 12 baselines = **252 total in reminders.db**

---

## 8. Sprint 7 — Stage 1 Demo (Brief)

Lowest priority. Minimal scope per supervisor guidance.

**Goal:** Show that unstructured text → Task JSON is feasible.

**Implementation:**
```
Input: simulated_sources/doctor_email.txt
  "Dear patient, I am prescribing Doxycycline 100mg tablets
   for your throat infection. Take one tablet after dinner
   daily for 7 days. The tablets are in a red bottle..."

Pipeline: stage1/extractor.py (ReAct agent loop)
  Step 1: Read source → extract action, entity, properties
  Step 2: Identify gaps → "location not specified, visual details partial"
  Step 3: Output partial Task JSON + gap report

Output: partial task JSON + list of fields that need human/sensor input
```

**Do not over-invest here.** One example, one source type, basic ReAct loop. The experiment does not depend on this.

---

## 9. Prompt Templates

### 9.1 AF System Prompt (for `prompt_constructor.py`)

```
You are a reminder generation system for a home robot assistant.

TASK: Generate a single spoken reminder sentence that the robot will say to the user.

RULES:
1. The reminder MUST include the action verb and the target entity name.
2. The reminder MUST include at least one visual cue from the provided context.
3. The reminder MUST include the specific location (room + spot).
4. The reminder MUST include any domain-specific discriminating properties.
5. The reminder MUST NOT include any information about the user's current activity.
6. The reminder MUST NOT include motivation, reasons, or consequences.
7. The reminder MUST be 1-2 sentences, natural spoken English.
8. The reminder MUST only reference information that was present during encoding
   (i.e., information the user was previously told about).
9. Start with "Remember to..." or a natural variation.

OUTPUT: A single reminder sentence. Nothing else — no quotes, no labels, no explanation.
```

### 9.2 AF+CB System Prompt

```
You are a reminder generation system for a home robot assistant.

TASK: Generate a spoken reminder that:
  (a) starts with a brief bridging phrase referencing the user's current activity
  (b) then delivers the core reminder with full associative details

RULES:
1-8: [same as AF rules above]
9. The FIRST part must reference the user's current activity (provided as context).
   Use natural bridging phrases like:
   - "Since you just finished [activity], ..."
   - "Before you go back to [activity], ..."
   - "While you're between tasks, ..."
10. The bridging phrase must NOT introduce any new task information.
11. The core reminder (second part) must contain the same information as an AF reminder.
12. Total length: 2-3 sentences.

OUTPUT: A single bridging + reminder passage. Nothing else.
```

### 9.3 Stage 1 ReAct Prompt (for `stage1/extractor.py`)

```
You are an information extraction agent. Your task is to read unstructured text
(emails, notes, messages) and extract structured task information.

You work in a THINK → ACT → OBSERVE loop:

THINK: Analyze what information you have and what is missing.
ACT: Extract specific fields from the source text.
OBSERVE: Check which required fields are filled and which have gaps.

REQUIRED FIELDS (the Task JSON schema):
- action_verb: what the user needs to do
- entity_name: the main object involved
- visual cues: what the object looks like
- domain_properties: specific properties (dosage, size, etc.)
- location: where the object is (room + spot)
- task_creator: who created this task
- creation_context: why this task exists

OUTPUT FORMAT:
```json
{
  "extracted": { ... partial Task JSON ... },
  "gaps": ["location.spot not specified", "visual cues incomplete"],
  "confidence": 0.7
}
```

For missing fields, leave them as null and list them in gaps.
Do NOT hallucinate information that is not in the source text.
```

---

## 10. Running the Pipeline

### Development (S5)

```bash
# Activate environment
conda activate thesis_server

# Ensure Ollama is running with llama3
ollama serve &
ollama pull llama3:latest

# Run tests first
cd ReminderAgent
python -m pytest tests/ -v

# Dry run (no LLM calls, just validate pipeline)
python -m reminder_agent.stage2.batch_runner --dry-run

# Real run with 3 variants
python -m reminder_agent.stage2.batch_runner --n-variants 3

# Check output
sqlite3 reminder_agent/output/reminders.db "SELECT task_id, condition, text FROM reminders LIMIT 20;"
```

### Production (S6)

```bash
# Switch to better model for quality
# Update model_config.yaml: backend: "together", model_name: "meta-llama/Llama-3-70b-chat-hf"

# Full generation
python -m reminder_agent.stage2.batch_runner --n-variants 10

# Review
python -m reminder_agent.review.review_interface

# Export approved reminders for game platform
sqlite3 reminder_agent/output/reminders.db \
  "SELECT task_id, condition, variant_idx, text FROM reminders WHERE review_status='approved';" \
  -json > approved_reminders.json
```
