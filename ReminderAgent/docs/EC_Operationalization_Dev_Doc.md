# EC Operationalization — Development Document

> Describes the architecture for generating EC+ and EC- reminder variants using a theory-grounded content selection pipeline. This document is intended for local development — adapting the existing ReminderAgent Stage 2 pipeline.

---

## 1. Design overview

### Experimental design (current)

| Condition | Description |
|-----------|-------------|
| **EC+** | Reminder includes encoding context + target + action |
| **EC-** | Reminder includes target + action only (baseline) |

- EC is **between-subject**.
- AF is pending removal. The pipeline should be designed so that AF-related logic can be cleanly stripped later without affecting EC generation.

### Reminder structure examples

| Condition | Example |
|-----------|---------|
| EC- | "Remember to give Mei the baking book." |
| EC+ | "Last week you baked together and Mei liked your baking book. Remember to give Mei the baking book." |

Key constraint: **EC+ and EC- share the same baseline** (target + action). The only difference is whether encoding context is prepended.

---

## 2. Pipeline architecture

```
┌─────────────────────────────────────────────────┐
│  Input: Encoding Episode Description + PM Task  │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │  Step 1: Episode            │
        │  Decomposition              │
        │                             │
        │  Situation Model            │
        │  (Zwaan & Radvansky, 1998)  │
        │                             │
        │  → Time                     │
        │  → Space                    │
        │  → Entity                   │
        │  → Causality                │
        │  → Intentionality           │
        └─────────────┬───────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │  Step 2: Source Filtering   │
        │                             │
        │  ESP                        │
        │  (Tulving & Thomson, 1973)  │
        │                             │
        │  Keep only features that    │
        │  were present during the    │
        │  original encoding episode  │
        └─────────────┬───────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │  Step 3: Dimension          │
        │  Prioritization             │
        │                             │
        │  Priority:                  │
        │  Entity + Causality         │
        │  (most stable dimensions)   │
        │                             │
        │  Optional: ESK supplement   │
        │  (Conway, 2009)             │
        └─────────────┬───────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │  Step 4: Reminder Assembly  │
        │                             │
        │  EC-: baseline only         │
        │  EC+: context + baseline    │
        └─────────────┬───────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │  Output: Reminder variants  │
        │  → SQLite (reminders.db)    │
        └─────────────────────────────┘
```

---

## 3. Task schema changes (v2 → v3)

### New field: `episode_dimensions`

Each task JSON in `data/task_schemas/` gains a structured decomposition of its encoding episode. This replaces the old `ec_cue` field as the source of truth for EC+ content.

```json
{
  "task_id": "book1_mei",
  "reminder_context": {
    "baseline": {
      "action_verb": "give",
      "target": "the baking book",
      "recipient": "Mei"
    },
    "episode_dimensions": {
      "time": "last week",
      "space": "kitchen (baking together)",
      "entity": ["Mei", "baking book", "red cover", "cake illustration"],
      "causality": "Mei liked the book → expressed wish to borrow it",
      "intentionality": "Mei wants to borrow; implicit agreement to lend"
    },
    "ec_priority_dimensions": ["entity", "causality"],
    "ec_selected_features": {
      "entity": ["Mei", "baking book"],
      "causality": "Mei liked the book and wanted to borrow it"
    }
  }
}
```

### Field descriptions

| Field | Purpose | Source |
|-------|---------|--------|
| `baseline` | Target + action, shared by EC+ and EC- | PM task definition |
| `episode_dimensions` | Full 5-dimension decomposition of encoding episode | Step 1 output (Situation Model) |
| `ec_priority_dimensions` | Which dimensions were selected | Step 3 (Entity + Causality priority) |
| `ec_selected_features` | Specific features passed to LLM for reminder generation | Step 2 + Step 3 output |

### Migration from v2

| v2 field | v3 equivalent | Notes |
|----------|---------------|-------|
| `ec_cue` | `ec_selected_features` | No longer a single string; structured by dimension |
| `element2_ec.creation_context` | `episode_dimensions` (full) | Decomposed into 5 dimensions |
| `element1_af.*` | Retain for now | Strip when AF is formally removed |

---

## 4. LLM generation logic

### EC- generation

No episode context. LLM receives only `baseline` fields.

**Prompt template (EC-):**

```
You are generating a short reminder message for a participant in a memory experiment.

The reminder should contain ONLY the action and target. No context, no backstory.

Task:
- Action: {action_verb}
- Target: {target}
- Recipient: {recipient}

Generate a natural, single-sentence reminder. Stay under 12 words.

Example: "Remember to give Mei the baking book."

Generate {n_variants} different wordings.
```

### EC+ generation

LLM receives `baseline` + `ec_selected_features`.

**Prompt template (EC+):**

```
You are generating a reminder message for a participant in a memory experiment.

The reminder should have two parts:
1. A context sentence that naturally paraphrases the encoding episode features below.
2. The action instruction.

Encoding context features:
- Entity: {entity_features}
- Causality: {causality_features}

Task:
- Action: {action_verb}
- Target: {target}
- Recipient: {recipient}

Rules:
- The context sentence must paraphrase the features above — do not copy verbatim.
- Each variant should use a different paraphrase.
- Do not invent details not present in the features.
- Do not compress phrases into hyphenated words.
- Total length: under 25 words.
- Format: [context paraphrase] + [action instruction]

Example: "Last week you baked together and Mei liked your baking book. Remember to give Mei the baking book."

Generate {n_variants} different wordings.
```

### Key difference from v2

In v2, `ec_cue` was a single pre-written string that the LLM paraphrased. In v3, the LLM receives **structured features by dimension**, giving it:

- Clear boundaries on what content is allowed (only entity + causality)
- Flexibility to paraphrase while staying within the selected dimensions
- No risk of pulling in unselected dimensions (time, space, intentionality)

---

## 5. Quality gate updates

### Checks to retain from v2

| Check | Description |
|-------|-------------|
| `check_word_count` | Total word count within range |
| `check_hyphen_compression` | No 3+ word hyphenated compounds |
| `check_single_sentence` (EC-) | EC- must be single sentence |

### New checks for v3

| Check | Description | Condition |
|-------|-------------|-----------|
| `check_baseline_present` | Reminder contains target + action + recipient | Both EC+ and EC- |
| `check_ec_features_present` | At least one entity feature AND causality feature appear (paraphrased) in the context portion | EC+ only |
| `check_no_extra_dimensions` | Context portion does not introduce time/space/intentionality details not in `ec_selected_features` | EC+ only |
| `check_no_fabrication` | No details appear that are absent from `episode_dimensions` entirely | EC+ only |

### Checks to remove (AF-related, defer removal)

| Check | Notes |
|-------|-------|
| `check_forbidden_keywords` | AF-specific; keep in code but skip when AF is disabled |
| `check_af_features` | AF-specific; same |

---

## 6. Config changes

### `generation_config.yaml`

```yaml
# EC conditions
ec_conditions:
  - EC_off
  - EC_on

# Variant count per condition per task
n_variants: 3          # dev; set to 10 for production

# Word count limits
word_limits:
  EC_off:
    min: 5
    max: 12
  EC_on:
    min: 12
    max: 25

# Retry on quality gate failure
max_retries: 3
```

### `condition_field_map.yaml`

```yaml
EC_off:
  visible_fields:
    - baseline.action_verb
    - baseline.target
    - baseline.recipient

EC_on:
  visible_fields:
    - baseline.action_verb
    - baseline.target
    - baseline.recipient
    - ec_selected_features.entity
    - ec_selected_features.causality
```

---

## 7. Output schema

### SQLite table: `reminders`

```sql
CREATE TABLE reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,           -- e.g. 'book1_mei'
    condition TEXT NOT NULL,         -- 'EC_off' or 'EC_on'
    variant_idx INTEGER NOT NULL,
    text TEXT NOT NULL,              -- generated reminder text
    ec_dimensions_used TEXT,         -- JSON: ["entity", "causality"] or null
    quality_passed BOOLEAN DEFAULT 0,
    human_approved BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Changes from v2

- `condition` values change from 4 (`AF_low_EC_off`, etc.) to 2 (`EC_off`, `EC_on`)
- New column `ec_dimensions_used` tracks which dimensions were included
- AF-related columns can be dropped when AF is formally removed

---

## 8. Task schema for all 4 tasks

Populate `episode_dimensions` and `ec_selected_features` for each task. Below are the current tasks requiring decomposition:

| task_id | target | recipient | Status |
|---------|--------|-----------|--------|
| `book1_mei` | baking book | Mei | Decomposed (see Section 3 example) |
| `ticket_jack` | ticket | Jack | Needs decomposition |
| `tea_benjamin` | tea | Benjamin | Needs decomposition |
| `dessert_sophia` | egg tart | Sophia | Needs decomposition |

For each task, apply the three-step pipeline:

1. Write full `episode_dimensions` (5 dimensions)
2. Filter: all features come from encoding episode (trivially satisfied for authored narratives)
3. Select: pick Entity + Causality features → write to `ec_selected_features`

---

## 9. CLI interface

Minimal changes from v2. New flags:

```bash
# Generate EC conditions only (skip AF if still in codebase)
python -m reminder_agent.stage2.batch_runner --ec-only

# Generate for a specific EC condition
python -m reminder_agent.stage2.batch_runner --condition EC_on

# Dry run (unchanged)
python -m reminder_agent.stage2.batch_runner --dry-run
```

---

## 10. Migration checklist

- [ ] Add `episode_dimensions` and `ec_selected_features` to all 4 task JSONs
- [ ] Update `baseline` field structure in task JSONs
- [ ] Update prompt templates for EC+ and EC- in `stage2/`
- [ ] Update `condition_field_map.yaml` (4 conditions → 2)
- [ ] Update `generation_config.yaml` (word limits, condition list)
- [ ] Add new quality gate checks (`check_ec_features_present`, `check_no_extra_dimensions`, `check_no_fabrication`)
- [ ] Mark AF-related quality gates as skippable (do not delete yet)
- [ ] Update `reminders` table schema (new column, new condition values)
- [ ] Run `--dry-run` to validate
- [ ] Generate and review sample output
- [ ] Update tests

---

## References

- Zwaan, R. A., & Radvansky, G. A. (1998). Situation models in language comprehension and memory. *Psychological Bulletin, 123*(2), 162–185.
- Tulving, E., & Thomson, D. M. (1973). Encoding specificity and retrieval processes in episodic memory. *Psychological Review, 80*(5), 352–373.
- Conway, M. A. (2009). Episodic memories. *Neuropsychologia, 47*(11), 2305–2313.
