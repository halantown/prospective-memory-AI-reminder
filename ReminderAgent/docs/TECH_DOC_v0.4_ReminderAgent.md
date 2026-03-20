# Reminder Agent System — Technical Documentation

## Context-Aware Robot Reminder: Prospective Memory Experiment Platform

|                      |                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| **Version**    | v0.5 — 3-group between-subjects redesign; conditions reduced from 4 to 2 active + 1 control |
| **Date**       | 2026-03-12                                                                                          |
| **Author**     | Thesis Candidate                                                                                    |
| **Status**     | 🟡 Architecture defined; implementation not started                                                 |
| **Depends on** | PRD v1.7 (experiment platform); Task JSON schema                                                    |

---

## Changelog

| Version | Date       | Changes                                                                                                                              |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| v0.1    | 2026-03-11 | Initial document                                                                                                                     |
| v0.2    | 2026-03-11 | Task JSON 3-zone structure; snake_case field paths                                                                                   |
| v0.3    | 2026-03-11 | S2 complete; S3 design: Ollama config, dual format_context                                                                           |
| v0.4    | 2026-03-12 | Theory review: tone constant (§2.4 new); Quality Gate adds CB activity consistency check; AF operationalization note added to §3.1 |
| v0.5    | 2026-03-12 | 3-group between-subjects redesign: 4 conditions → 2 active (AF_only, AF_CB) + 1 control (no generation); 320 → 160 variants; forbidden keyword check dormant (no Low AF conditions) |

---

## 1. System Overview

### 1.1 Purpose

The Reminder Agent is an **offline batch generation pipeline** that produces all reminder texts required for the 3-group between-subjects experiment. Its outputs — 160 reminder text variants (2 active conditions × 8 tasks × 10 variants) — are pre-generated, human-reviewed, and loaded into the experiment platform before data collection begins. Group 1 (Control) receives no reminder and requires no text generation.

This pre-generation approach serves two experimental goals:

1. **Decoupling LLM variance from condition effects.** If only one text per condition were generated, observed differences between conditions could reflect idiosyncratic phrasing quality rather than the manipulation itself. With N=10 semantically equivalent but linguistically varied variants per condition-task pair, text quality effects are averaged out across participants.
2. **Manipulation fidelity control.** Reminder texts are the primary experimental stimulus. Their correctness — whether AF_only texts provide specific cues without activity context, whether AF_CB texts sound natural with bridging — directly determines whether the AF and CB manipulations are valid. Pre-generation allows human review before the stimuli are deployed.

### 1.2 Relationship to Experiment Platform

The Reminder Agent is a **separate offline system** from the experiment platform (FastAPI + React). It produces a structured output file (`reminders.db` or `reminders.json`) that the experiment platform consumes at runtime.

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│   REMINDER AGENT (offline)  │        │  EXPERIMENT PLATFORM (live)  │
│                             │        │                              │
│  Task JSONs                 │        │  FastAPI backend             │
│       ↓                     │ ──────►│  SQLite                      │
│  Generation Pipeline        │  loads │  React frontend              │
│       ↓                     │        │  Pepper robot / TTS          │
│  Quality Gate               │        │                              │
│       ↓                     │        │  At runtime:                 │
│  reminders.db               │        │  query(task_id, condition)   │
│                             │        │  → random variant → audio    │
└─────────────────────────────┘        └──────────────────────────────┘
```

### 1.3 Scope

**In scope (this document):**

- Stage 2: Condition-controlled reminder text generation
- Stage 1: Demo-level task schema extraction pipeline (architecture + 1-2 runnable examples)
- Quality gate: automated compliance checking + human review interface
- Output format: structured storage consumed by experiment platform

**Out of scope:**

- Real-time generation during experiment sessions
- Multimodal perception (no camera, no sensors)
- Full automation of Stage 1 for all 8 tasks (deferred to future work)

---

## 2. Architecture

### 2.1 Two-Stage Design

The system follows the architecture established in the meeting slides (0309), consisting of two conceptually distinct stages:

```
┌──────────────────────────────────────────────────────────────────────┐
│  STAGE 1 — Intention Synthesis & Schema Extraction  (demo-level)     │
│                                                                      │
│  Input: simulated data sources (.txt files)                          │
│         [calendar entries, medical instructions, user notes]         │
│                                                                      │
│  ┌──────────────┐   iterate   ┌─────────────┐   ┌────────────────┐   │
│  │ Information  │ ◄─────────► │ Event       │──►│ Structured     │   │
│  │ Fetch        │             │ Define      │   │ Task JSON      │   │
│  └──────────────┘             └─────────────┘   └───────┬────────┘   │
│         ↑                                               │            │
│  [calendar.txt]                                         │            │
│  [email.txt]            LLM ReAct reasoning loop        │            │
│  [user_notes.txt]                                       │            │
└─────────────────────────────────────────────────────────┼────────────┘
                                                          │
                                            External Planning Storage
                                            (task_schemas/*.json)
                                                          │
┌─────────────────────────────────────────────────────────▼───────────┐
│  STAGE 2 — Contextual Delivery: Batch Generation  (production)      │
│                                                                     │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────┐  │
│  │ Condition Schema │  │ Context Extractor │  │ Few-shot         │  │
│  │ (field map)      │  │ (JSON pruner)     │  │ Example Store    │  │
│  └────────┬─────────┘  └────────┬──────────┘  └────────┬─────────┘  │
│           └──────────────┬──────┘                      │            │
│                          ▼                             │            │
│                  ┌───────────────┐◄────────────────────┘            │
│                  │ Prompt        │                                  │
│                  │ Constructor   │                                  │
│                  └───────┬───────┘                                  │
│                          ▼                                          │
│                  ┌───────────────┐                                  │
│                  │ LLM Engine    │  × N variants                    │
│                  │ (model-       │  iterative generation            │
│                  │  agnostic)    │                                  │
│                  └───────┬───────┘                                  │
│                          ▼                                          │
│                  ┌───────────────┐                                  │
│                  │ Quality Gate  │                                  │
│                  │ auto + human  │                                  │
│                  └───────┬───────┘                                  │
│                          ▼                                          │
│                  ┌───────────────┐                                  │
│                  │ Output Store  │                                  │
│                  │ reminders.db  │                                  │
│                  └───────────────┘                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Design Principles

### 2.3  Task JSON Zone Design

Each task schema is divided into three top-level zones. This is an **engineering control** — Context Extractor and Stage 1 agent read from different zones by design, with no cross-zone access.

| Zone                        | Reader                    | Purpose                                                                                                                      |
| --------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `reminder_context`        | Stage 2 Context Extractor | Fields eligible for reminder text generation. Condition schema whitelists apply within this zone only.                       |
| `agent_reasoning_context` | Stage 1 agent             | Task execution rules and encoding background. Used for reasoning about when/whether to remind — never enters reminder text. |
| `placeholder`             | Nobody                    | Intentional defer. Each field annotated with `_future` note explaining anticipated future use.                             |

**Rationale for `agent_reasoning_context.encoding_info.creation_background`:**
The robot may only reference information the user encoded at task creation time. `creation_background` gives the Stage 1 agent ground truth of what the user actually knows — so the agent can verify that a candidate reminder does not reference information the user never received. Direct application of Encoding Specificity Principle (Tulving, 1973).

**`reminder_context` canonical template (all 8 tasks follow this structure):**

```json

### 2.4  Tone Constant

Reminder tone (instruction-like vs. intention-reactivation) is an uncontrolled variable that would confound AF and CB effects if left free. All generated texts across all conditions must use **intention-reactivation framing** — this is a **constant, not a variable**.

**Enforced in:** `prompt_constructor.build_system_prompt()` — hard constraint in system prompt for both active conditions:

```

Tone rule (applies to ALL conditions):
✓ Use: "Remember to...", "By the way, remember...", "Don't forget to..."
✗ Avoid: "It's time to...", "You need to now...", "Make sure you..."
✗ Never imply the task should be executed immediately.

```

**Why this matters:** Fixing tone to intention-reactivation framing across both active conditions removes potential confounds from linguistic register.

**Thesis framing:**
> "Reminder tone was held constant across conditions using standardised intention-reactivation framing (Option C), isolating the effects of AF and CB from potential confounds introduced by linguistic register."

**`reminder_context` canonical template (all 8 tasks follow this structure):**
```json
{
  "reminder_context": {
    "element1": {
      "action_verb": "...",
      "target_entity": {
        "entity_name": "...",
        "cues": { "visual": "..." },
        "domain_properties": { "key": "value" }
      }
    },
    "element2": {
      "origin": {
        "task_creator": "...",
        "creator_is_authority": true
      }
    },
    "element3": {
      "detected_activity_raw": "..."
    }
  }
}
```

---

**P1 — Input truncation over output filtering.**
The LLM must not see fields it is not allowed to use. For AF_only conditions, the JSON is pruned to exclude `detected_activity_raw` before being passed to the LLM. This is more reliable than instructing the LLM to ignore information it has already seen.

**P2 — Condition schema as the single source of truth.**
The mapping between conditions and JSON fields is defined in one configuration file (`condition_field_map.yaml`). Generation code, quality checks, and documentation all derive from this single source. When the schema changes, only the config file changes.

**P3 — Model-agnostic architecture.**
The LLM backend is abstracted behind a common interface. Switching between a local Ollama model and a cloud API (e.g., Llama-3-70B via Together.ai) requires changing one configuration value, not the pipeline logic.

**P4 — Iterative variant generation.**
To maximise linguistic diversity while maintaining semantic equivalence, variants are generated sequentially. Each LLM call receives the previously generated variants as context, with an explicit instruction to produce a structurally distinct formulation.

**P5 — Human review as a hard gate.**
Automated quality checks filter obvious violations. Human review (spot-checking or full review) is a required step before any text is committed to the output store. The review interface surfaces texts grouped by condition and task pair to make comparison easy.

---

## 3. Condition Schema

### 3.1 Theoretical Grounding

The condition schema operationalises the 3-group between-subjects manipulation:

| Group | Condition | Description |
|-------|-----------|-------------|
| **Group 1** | **Control** | No reminder (baseline) — no text generation needed |
| **Group 2** | **AF_only** | High AF reminder, no CB — specific cues without activity context (equivalent to old `HighAF_LowCB`) |
| **Group 3** | **AF_CB** | High AF + high CB — specific cues with contextual bridging (equivalent to old `HighAF_HighCB`) |

- **Associative Fidelity (AF):** specificity of the **encoded intention context** in the reminder, operationalising the associative link described by McDaniel & Einstein's Multiprocess Framework. High AF provides information that allows the participant to identify the correct target (not the distractor) and execute the correct action. AF is defined broadly as encoded intention specificity — encompassing target perceptual features (visual cue), action-relevant properties (domain properties), and encoding episode context (task_creator when authority). This broader definition is grounded in Encoding Specificity (Tulving, 1973): reinstatement of encoding context facilitates retrieval, not only reinstatement of the target-action link per se.
- **Contextual Bridging (CB):** whether the reminder references the participant's currently detected activity, operationalising the interruption-softening mechanism described by Altmann & Trafton's Goal Activation Model. Present only in Group 3 (AF_CB).

AF and CB act on **different stages of the PM lifecycle** (encoding/retention vs. noticing/switching cost) and are operationalised using **different JSON elements**, making them theoretically and empirically orthogonal.

### 3.2 Field Whitelist per Condition

This table is the authoritative definition of what information each active condition may contain. It maps directly to `condition_field_map.yaml`. Group 1 (Control) receives no reminder and is omitted.

| JSON Field                | Path                                                          | AF_only            | AF_CB              |
| ------------------------- | ------------------------------------------------------------- | ----------------- | ------------------ |
| `action_verb`           | `reminder_context.element1.action_verb`                     | ✅                | ✅                 |
| `entity_name`           | `reminder_context.element1.target_entity.entity_name`       | ✅                | ✅                 |
| `cues.visual`           | `reminder_context.element1.target_entity.cues.visual`       | ✅                | ✅                 |
| `domain_properties`     | `reminder_context.element1.target_entity.domain_properties` | ✅                | ✅                 |
| `task_creator`          | `reminder_context.element2.origin.task_creator`             | ✅ (if authority) | ✅ (if authority)  |
| `detected_activity_raw` | `reminder_context.element3.detected_activity_raw`           | ❌                | ✅                 |
| `execution_protocol.*`  | `agent_reasoning_context.execution_protocol.*`              | ❌                | ❌                 |
| `encoding_info.*`       | `agent_reasoning_context.encoding_info.*`                   | ❌                | ❌                 |
| `placeholder.*`         | `placeholder.*`                                             | ❌                | ❌                 |

**Notes on excluded fields:**

- `Temporal_Window`: Timing information ("once daily, after dinner") does not help participants distinguish the correct target from a distractor. It is available to the Stage 1 agent for reasoning about when to fire a reminder, but does not belong in the reminder text itself.
- `Action_Rules`: Prerequisites and incompatible contexts are used in Stage 1 for LLM-based reasoning (e.g., inferring that a reminder should be delayed because the user just drank milk). They do not enter reminder texts as they do not increase target-action link specificity and would make texts unacceptably long.
- `Task_Creator` conditional rule: included in High AF only when `Creator_Is_Authority = true` in the JSON (e.g., "Doctor", "Pharmacist"). When the creator is the user themselves, this field is excluded as it provides no discriminating information.

### 3.3 Canonical Examples — Medicine Task

The following examples illustrate the two active conditions for Task A (Doxycycline). Group 1 (Control) receives no reminder text. These serve as seed few-shot examples in the generation pipeline.

**AF_only (Group 2):**

> "Remember to take your Doxycycline — the 100mg tablet in the red round bottle. Your doctor prescribed it."

**AF_CB (Group 3):**

> "I can see you just finished dinner. Remember to take your Doxycycline — the 100mg tablet in the red round bottle. Your doctor prescribed it."

### 3.4 CB Text per Task Pair

CB text is a fixed string per task pair (PRD §2.5 fixed-state method). The detected activity string injected into AF_CB reminders is:

| Task Pair              | Primary Activity               | Fixed Detected_Activity String                      |
| ---------------------- | ------------------------------ | --------------------------------------------------- |
| Pair 1 (Medicine)      | Cooking / just finished dinner | `"I can see you just finished dinner."`           |
| Pair 2 (Laundry)       | Washing machine running        | `"I can see the laundry is almost done."`         |
| Pair 3 (Communication) | Checking messages              | `"I can see you're going through your messages."` |
| Pair 4 (Chores)        | Slow cooker running            | `"I can see the soup is almost ready."`           |

---

## 4. Module Design

### 4.1 Directory Structure

```
reminder_agent/
│
├── config/
│   ├── condition_field_map.yaml      # Authoritative field whitelist per condition
│   ├── model_config.yaml             # LLM backend selection + parameters
│   └── generation_config.yaml        # N variants, quality thresholds, timeouts
│
├── data/
│   ├── task_schemas/                 # Input: one JSON file per PM task
│   │   ├── medicine_a.json
│   │   ├── medicine_b.json
│   │   ├── laundry_c.json
│   │   └── ...
│   ├── few_shot_examples/            # Seed examples per condition
│   │   ├── AF_only.json
│   │   └── AF_CB.json
│   └── simulated_sources/            # Stage 1 demo inputs (.txt)
│       ├── calendar.txt
│       ├── email.txt
│       └── user_notes.txt
│
├── stage1/                           # Demo-level extraction pipeline
│   ├── extractor.py                  # ReAct agent: .txt → Task JSON
│   ├── prompts.py                    # Stage 1 prompt templates
│   └── demo_run.py                   # Runnable demo for 1-2 tasks
│
├── stage2/                           # Production generation pipeline
│   ├── context_extractor.py          # JSON pruner: full JSON → condition subset
│   ├── prompt_constructor.py         # Assembles final prompt from parts
│   ├── llm_backend.py               # Model-agnostic LLM interface
│   ├── generator.py                  # Orchestrates N-variant generation loop
│   ├── quality_gate.py              # Automated compliance checks
│   └── batch_runner.py              # Entry point: runs all 16 combinations
│
├── review/
│   ├── review_interface.py           # CLI review tool for human spot-check
│   └── review_log.json              # Human review decisions (keep/reject/flag)
│
├── output/
│   ├── reminders.db                  # SQLite: final approved variants
│   ├── reminders.json               # JSON export (human-readable)
│   └── generation_log.json          # Full log: all generated + filtered texts
│
└── tests/
    ├── test_context_extractor.py
    ├── test_quality_gate.py
    └── test_field_map_coverage.py
```

### 4.2 Module Responsibilities

#### `config/condition_field_map.yaml`

Single source of truth for the AF × CB operationalisation. With the 3-group between-subjects redesign, only 2 active conditions remain (Control group needs no generation). Example structure:

```yaml
AF_only:
  required_fields:
    - "reminder_context.element1.action_verb"
    - "reminder_context.element1.target_entity.entity_name"
    - "reminder_context.element1.target_entity.cues.visual"
    - "reminder_context.element1.target_entity.domain_properties"
  conditional_fields:
    - field: "reminder_context.element2.origin.task_creator"
      condition: "reminder_context.element2.origin.creator_is_authority == true"
  excluded_fields:
    - "reminder_context.element3.detected_activity_raw"
  excluded_zones:
    - "agent_reasoning_context"
    - "placeholder"

AF_CB:
  required_fields:
    - "reminder_context.element1.action_verb"
    - "reminder_context.element1.target_entity.entity_name"
    - "reminder_context.element1.target_entity.cues.visual"
    - "reminder_context.element1.target_entity.domain_properties"
    - "reminder_context.element3.detected_activity_raw"
  conditional_fields:
    - field: "reminder_context.element2.origin.task_creator"
      condition: "reminder_context.element2.origin.creator_is_authority == true"
  excluded_zones:
    - "agent_reasoning_context"
    - "placeholder"
```

#### `stage2/context_extractor.py`

Prunes the full Task JSON to contain only the fields permitted by the condition. The LLM receives only the pruned version — it cannot leak information it never sees.

```
Input:  full Task JSON (dict) + condition (string)
Output: pruned context dict containing only whitelisted fields
```

Key logic:

- Reads field map from `condition_field_map.yaml`
- Resolves conditional fields (e.g., checks `Creator_Is_Authority`)
- Raises an error if any required field is missing from the input JSON
- Logs which fields were included / excluded for auditability

#### `stage2/prompt_constructor.py`

Assembles the final prompt from three components:

1. **System instructions:** role definition, condition description, length constraints (target 8–30 words for delivery within 12 seconds), tone (natural spoken language, not clinical)
2. **Task context:** pruned JSON from `context_extractor`, formatted via `format_context()`
3. **Few-shot examples:** retrieved from `data/few_shot_examples/` by condition

For variant N > 1, the prompt additionally includes all previously generated variants with instruction: *"Generate a new variant that differs in sentence structure from the examples above."*

**Dual context format strategy:**

Context format is selected via `generation_config.yaml: context_format: prose | json`.

| Format    | Best for                        | Rationale                                                                      |
| --------- | ------------------------------- | ------------------------------------------------------------------------------ |
| `prose` | Small models (7B, local Ollama) | Reduces JSON parsing overhead; more natural input leads to more natural output |
| `json`  | Large models (70B, cloud API)   | Large models handle structured input well; preserves field semantics exactly   |

```python
def format_context(pruned_dict: dict, style: str) -> str:
    if style == "json":
        return json.dumps(pruned_dict, indent=2)
    elif style == "prose":
        return _to_prose(pruned_dict)  # field-aware prose conversion
```

`_to_prose()` converts fields by semantic role, not generic flattening:

- `action_verb` + `entity_name` → `"Task: Take Doxycycline."`
- `visual` → `"Target appearance: Red round bottle with white label."`
- `dosage` / `form` → `"Details: dosage: 100mg, form: Tablet."`
- `task_creator` → `"Prescribed by: Doctor."`
- `detected_activity_raw` → `"Current context: User just finished eating dinner."`

**`generation_config.yaml` additions for S3:**

```yaml
context_format: "prose"    # prose | json
```

#### `stage2/llm_backend.py`

Model-agnostic interface. Implements a common `generate(prompt: str) -> str` method.

Supported backends (selected via `model_config.yaml`):

- `ollama`: local Ollama instance — calls `POST http://localhost:11434/api/generate`; no API key required; recommended for development and 7B model validation
- `together`: Together.ai API (e.g., `meta-llama/Meta-Llama-3-70B-Instruct`)
- `openai`: OpenAI API (e.g., `gpt-4o`)
- `anthropic`: Anthropic API (e.g., `claude-sonnet-4-20250514`)

**Ollama configuration (`model_config.yaml`):**

```yaml
backend: "ollama"
model_name: "mistral:7b"      # or llama3.2:3b for lower VRAM
temperature: 0.8
max_tokens: 150
base_url: "http://localhost:11434"
api_key_env: null              # not required for local
```

**Recommended local models by VRAM:**

| VRAM                  | Model                             | Notes           |
| --------------------- | --------------------------------- | --------------- |
| 6GB (RTX 2060 mobile) | `mistral:7b` or `llama3.2:3b` | 4-bit quantised |
| 24GB                  | `llama3:13b`                    | Full precision  |
| 80GB (A100)           | `llama3:70b`                    | Full precision  |

Switching backends requires only changing `model_config.yaml`. No code changes needed.

#### `stage2/quality_gate.py`

Automated compliance checks applied to each generated variant before it is written to the output store. A variant must pass all checks; failure triggers re-generation (up to `max_retries` from config).

| Check                                      | Method                                                                                 | Fail condition                                                                                                         |
| ------------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Forbidden field leak**             | Keyword matching against `forbidden_keywords.yaml`                                   | Visual/domain keyword appears in text (currently **dormant** — no Low AF conditions in 3-group design) |
| **Required field presence**          | Check that whitelisted entity names / action verbs appear                              | Entity name absent from text                                                                                           |
| **Length constraint**                | Word count                                                                             | <`min_words` or > `max_words` from config                                                                          |
| **Duplicate detection**              | Levenshtein similarity against existing variants                                       | Similarity >`similarity_threshold` with any prior variant in same batch                                              |
| **Language check**                   | `langdetect`                                                                         | Not English                                                                                                            |
| **CB activity consistency** *(C1)* | Semantic similarity between activity phrases across all AF_CB variants in same batch   | Any variant's activity phrase diverges from majority (heuristic: extract sentence containing "I can see" / "I notice") |

Note: the forbidden field leak check is implemented but currently **dormant** — the 3-group between-subjects design has no Low AF conditions, so the check will not trigger in practice. It is retained for potential future use or if the design reverts. CB consistency check runs at batch level (after all N variants are generated for an AF_CB task pair), not per-variant.

#### `review/review_interface.py`

CLI tool that presents generated texts grouped by `(task_id, condition)`. Reviewer actions per variant: `keep`, `reject`, `flag` (keep but note concern). Decisions written to `review_log.json`.

Suggested review workflow:

- Full review of all 16 × first variants (one per condition-task pair) before expanding to 10 variants
- Spot-check 3 random variants per condition-task pair for subsequent variants
- Special attention: AF_CB conditions (check naturalness of bridging)

#### `stage2/batch_runner.py`

Entry point that orchestrates the full generation run.

```
for task_id in all_8_tasks:
    for condition in [AF_only, AF_CB]:
        pruned_context = context_extractor(task_json[task_id], condition)
        variants = []
        for n in range(N_VARIANTS):
            prompt = prompt_constructor(pruned_context, condition, variants)
            candidate = llm_backend.generate(prompt)
            if quality_gate.check(candidate, condition, variants):
                variants.append(candidate)
            else:
                retry...
        output_store.write(task_id, condition, variants)
```

---

## 5. Output Schema

### 5.1 SQLite Table: `reminders`

| Field             | Type      | Description                                                                   |
| ----------------- | --------- | ----------------------------------------------------------------------------- |
| `task_id`       | TEXT      | e.g.,`medicine_a`                                                           |
| `condition`     | TEXT      | `AF_only` / `AF_CB` (Control group has no entries)                       |
| `variant_idx`   | INTEGER   | 0–9                                                                          |
| `text`          | TEXT      | Final approved reminder text                                                  |
| `audio_file`    | TEXT      | `reminder_{task_id}_{condition}_{idx}.mp3` (populated after TTS generation) |
| `duration_s`    | REAL      | Audio duration in seconds (populated after TTS generation)                    |
| `review_status` | TEXT      | `approved` / `flagged` / `rejected`                                     |
| `generated_at`  | TIMESTAMP |                                                                               |
| `model_used`    | TEXT      | LLM backend identifier                                                        |

### 5.2 Query Interface for Experiment Platform

The experiment platform (FastAPI) queries the reminder store at runtime:

```sql
SELECT text, audio_file
FROM reminders
WHERE task_id = ? AND condition = ? AND review_status = 'approved'
ORDER BY RANDOM()
LIMIT 1;
```

This returns one random approved variant for each `(task_id, condition)` trial.

---

## 6. Stage 1 — Demo Pipeline

### 6.1 Purpose

Stage 1 demonstrates that the system can automatically extract a structured Task JSON from unstructured text sources, justifying the full architecture as a generalizable pipeline rather than a hardcoded experiment setup.

For the thesis, Stage 1 will be implemented as a runnable demo covering **one task** (Medicine / Doxycycline) sourced from a simulated doctor's letter (`email.txt`). Full automation of all 8 tasks is deferred to future work; all 8 task schemas are authored manually for the experiment.

### 6.2 Simulated Data Sources

```
data/simulated_sources/email.txt
────────────────────────────────
Subject: Follow-up from today's appointment
From: Dr. A. van der Berg

Dear [Patient],

Following your appointment today, I am prescribing Doxycycline 100mg 
for your throat infection. Please take one tablet daily for 7 days, 
after dinner. Take with a full glass of water. Do not take with dairy 
products (milk, cheese, yogurt). Remain upright for at least 30 minutes 
after taking the tablet.

The medication (red bottle) has been sent to your home address.

Best regards,
Dr. A. van der Berg, GP
```

### 6.3 ReAct Agent Design

The Stage 1 agent follows a Reasoning + Acting loop to iteratively extract task information:

```
Thought: What information do I need to build a complete Task JSON?
Action: read_source(email.txt)
Observation: [email content]
Thought: I have the medication name, dosage, timing, constraints. 
          I still need the visual cue (bottle description) and spatial info.
Action: read_source(user_notes.txt)
Observation: [user notes: "red bottle on kitchen counter"]
Thought: I now have enough to fill all required fields.
Action: create_task_json(...)
Output: medicine_a.json
```

The loop continues until all required fields of the Task JSON schema are populated, or until a maximum iteration count is reached (with a partial JSON and a list of missing fields flagged for manual completion).

### 6.4 Stage 1 Output

The Stage 1 agent produces a Task JSON conforming to the three-element schema:

- **Element 1 (Task Ontology):** what to do, with what target, following what protocol
- **Element 2 (Encoding Context):** who created the task, under what circumstances
- **Element 3 (Triggering Context):** current user state and detected activity (fixed strings for the experiment; dynamically inferred in the full system)

---

## 7. LLM Strategy

### 7.1 Development Workflow

```
Phase 1 — Prompt development
  Backend: qwen3-max via Aliyun Bailian API
  Goal: Stabilise prompts until condition compliance is consistent
  Cost estimate: ~$1–2 for full 160-variant run at $0.9/1M tokens

Phase 2 — Local model validation
  Backend: Gemma3-4B or Llama-3.1 or Qwen-3 via Ollama (local, RTX 2060 mobile)
  Goal: Determine quality gap between 70B and 7B for this specific task
  Accept threshold: automated quality gate pass rate ≥ 85%

Phase 3A — If 7B acceptable
  Use local Ollama for final generation
  Thesis narrative: local deployment validated for this task type

Phase 3B — If 7B not acceptable
  Use 70B API for final generation
  Thesis narrative: "pipeline validated against 70B; 
  local deployment remains a deployment option for 
  non-experimental use cases where strict manipulation 
  fidelity is not required"
```

Remote API Example

```python
client = OpenAI(
    api_key=os.getenv("THESIS_API_KEY"),
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)
```

### 7.2 Thesis Framing

Regardless of which LLM is used for final generation, the system is documented and cited as a **model-agnostic pipeline**. The LLM backend selection is treated as a configuration decision driven by empirical quality assessment, not a fundamental architectural constraint. This framing:

- Preserves the "local LLM" narrative from the original thesis proposal
- Honestly reports the actual model used for stimulus generation
- Positions local deployment as a viable path for the full system (Stage 1 + real-time delivery) in future work

---

## 8. Open Questions

| ID             | Priority | Topic                                   | Status                                                                                                                                                            |
| -------------- | -------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TQ-1** | 🔴 P0    | Few-shot examples                       | Need to author 2–3 seed examples per condition (8 total) before generation can begin. These are the ground truth for quality assessment.                         |
| **TQ-2** | 🟢 P2    | Forbidden keyword list for Low AF check | Dormant under 3-group design (no Low AF conditions). Retained for potential revert. Keywords enumerated but check will not trigger.                                |
| **TQ-3** | 🟡 P1    | Stage 1 demo scope                      | Confirm: one task (Medicine) from one source (email.txt) is sufficient for thesis demonstration.                                                                  |
| **TQ-4** | 🟡 P1    | N variants per condition                | Currently set to 10. Confirm with supervisor whether this is sufficient for statistical purposes.                                                                 |
| **TQ-5** | 🟢 P2    | TTS pipeline                            | Audio generation (ElevenLabs or equivalent) is a downstream step after text approval. Document the naming convention and loading procedure for Pepper separately. |
| **TQ-6** | 🟢 P2    | review_interface UX                     | CLI is sufficient for now; web-based review tool is a nice-to-have if time permits.                                                                               |

---

## 9. Thesis Contribution Summary

| Component                       | Contribution type                             | Location in thesis                  |
| ------------------------------- | --------------------------------------------- | ----------------------------------- |
| Condition schema (field map)    | Formal operationalisation of AF × CB         | Methods: Operationalisation section |
| Context extractor (JSON pruner) | Engineering: input-level manipulation control | System Design chapter               |
| Stage 2 generation pipeline     | System implementation                         | System Design chapter               |
| Stage 1 ReAct demo              | Architecture demonstration                    | System Design chapter               |
| Quality gate + review log       | Stimulus validation methodology               | Methods: Stimulus preparation       |
| Model-agnostic backend          | Design principle, future work enabler         | Discussion                          |
| 160 approved reminder texts     | Experimental stimuli                          | Appendix                            |
