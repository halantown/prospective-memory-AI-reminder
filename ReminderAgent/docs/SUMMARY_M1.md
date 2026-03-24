# Reminder Agent — System Summary

> **Version**: Post-Sprint 4 (3-group between-subjects redesign) | **Date**: 2026-03-12 | **Status**: S1–S4 complete, S5–S7 pending

---

## 1. Project Purpose

The Reminder Agent is an **offline batch generation pipeline** for a 3-group between-subjects prospective memory experiment. It produces **160 reminder text variants** (2 active conditions × 8 tasks × 10 variants per pair) that are pre-generated, quality-checked, human-reviewed, and loaded into the experiment platform (FastAPI + Pepper robot) before data collection. Group 1 (Control) receives no reminder and requires no text generation.

The three groups are:

| Group | Condition | Description |
|-------|-----------|-------------|
| **Group 1** | **Control** | No reminder (baseline) — no text generation |
| **Group 2** | **AF_only** | High AF, no CB — specific cues without activity context |
| **Group 3** | **AF_CB** | High AF + CB — specific cues with contextual bridging |

---

## 2. Architecture Overview

```
               ┌─────────────────────────────────┐
               │          CONFIG LAYER           │
               │    condition_field_map.yaml     │
               │    model_config.yaml            │
               │    generation_config.yaml       │
               │               ↓                 │
               │    config_loader.py             │
               │    (Pydantic validation)        │
               └───────────────┬─────────────────┘
                               │
            ┌──────────────────┼─────────────────┐
            ▼                  ▼                 ▼
   ┌──────────────────┐ ┌───────────────┐ ┌──────────────┐
   │ Context Extractor│ │ Prompt        │ │ LLM Backend  │
   │                  │ │ Constructor   │ │              │
   │ Task JSON →      │ │ pruned ctx →  │ │ prompt →     │
   │ pruned dict      │ │ system+user   │ │ text         │
   │                  │ │ prompts       │ │              │
   └────────┬─────────┘ └──────┬────────┘ └──────┬───────┘
            │                  │                 │
            └──────────────────┴─────────────────┘
                               │
       [S4–S6: Quality Gate → Batch Runner → Output Store]
                    (not yet implemented)
```

### Two-Stage Design

| Stage                          | Purpose                                               | Status                      |
| ------------------------------ | ----------------------------------------------------- | --------------------------- |
| **Stage 2** (production) | Condition-controlled batch text generation            | S1–S4 done; S5–S6 pending |
| **Stage 1** (demo)       | ReAct agent: extract Task JSON from unstructured text | S7 pending (independent)    |

---

## 3. File Organisation

```
ReminderAgent/
├── docs/
│   ├── DEV_PLAN_v0.2.md                  # Sprint plan with exit criteria
│   └── TECH_DOC_v0.3_ReminderAgent.md    # Authoritative architecture document
│
└── reminder_agent/                        # Python package root
    ├── __init__.py
    │
    ├── config/                            # YAML configuration (no code)
    │   ├── condition_field_map.yaml       # AF×CB field whitelist (single source of truth)
    │   ├── model_config.yaml              # LLM backend selection + parameters
    │   └── generation_config.yaml         # Variant count, quality thresholds
    │
    ├── data/
    │   ├── task_schemas/                  # One JSON per PM task
    │   │   └── medicine_a.json            # Doxycycline task (3-zone structure)
    │   ├── few_shot_examples/             # [empty — S3/S4]
    │   └── simulated_sources/             # [empty — S7]
    │
    ├── stage2/                            # Production pipeline modules
    │   ├── __init__.py
    │   ├── config_loader.py               # ✅ S1 — Pydantic config validation
    │   ├── context_extractor.py           # ✅ S2 — JSON pruner per condition
    │   ├── llm_backend.py                 # ✅ S3 — Model-agnostic generation
    │   ├── prompt_constructor.py          # ✅ S3 — System/user prompt assembly
    │   ├── quality_gate.py                # ✅ S4 — Automated compliance checks
    │   ├── batch_runner.py                # 📋 S5 — Full generation orchestrator
    │   └── output_store.py                # 📋 S5 — SQLite output storage
    │
    ├── stage1/                            # Demo pipeline
    │   ├── __init__.py
    │   ├── extractor.py                   # 📋 S7 — ReAct agent
    │   ├── prompts.py                     # 📋 S7
    │   └── demo_run.py                    # 📋 S7
    │
    ├── review/                            # [empty — S6]
    │   └── review_interface.py            # 📋 S6 — CLI review tool
    │
    ├── output/                            # [empty — S5]
    │   ├── reminders.db                   # 📋 S5 — SQLite final output
    │   └── generation_log.json            # 📋 S5 — Full generation log
    │
    └── tests/
        ├── __init__.py
        ├── test_config_loader.py          # ✅ 18 tests
        └── test_context_extractor.py      # ✅ 20 tests
```

**Legend:** ✅ = implemented | 📋 = planned (not yet created)

---

## 4. Module Details

### 4.1 `config_loader.py` — Configuration Layer

**Purpose:** Load, validate, and expose all YAML configuration as typed Python objects. Fail-loud on invalid input.

| Pydantic Model        | Config File                  | Key Fields                                                                                                              |
| --------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `ModelConfig`       | `model_config.yaml`        | `backend`, `model_name`, `temperature`, `max_tokens`, `base_url`, `api_key_env`                             |
| `GenerationConfig`  | `generation_config.yaml`   | `n_variants`, `max_retries`, `min_words`, `max_words`, `similarity_threshold`, `context_format`             |
| `ConditionFieldMap` | `condition_field_map.yaml` | 2 × `ConditionEntry` (each with `required_fields`, `conditional_fields`, `excluded_fields`, `excluded_zones`) |

**Public functions:**

- `load_model_config(path?) → ModelConfig`
- `load_generation_config(path?) → GenerationConfig`
- `load_condition_field_map(path?) → ConditionFieldMap`
- `load_all_configs(config_dir?) → (ModelConfig, GenerationConfig, ConditionFieldMap)`

**Validation rules:**

- Backend must be one of `{together, ollama, openai, anthropic}`
- Temperature: 0.0–2.0 | max_tokens > 0 | max_words ≥ min_words
- Context format must be `prose` or `json`
- All 2 active conditions must be present in field map (AF_only, AF_CB)

---

### 4.2 `context_extractor.py` — JSON Pruner

**Purpose:** Prune a full Task JSON so the LLM only sees fields permitted by the condition. Implements Design Principle P1 (input truncation over output filtering).

**Public functions:**

- `load_field_map(condition, field_map?) → ConditionEntry`
- `extract(task_json, condition, field_map?) → dict` — the core pruning function

**Logic flow:**

```
extract(task_json, "AF_only")
  1. Load condition entry from field map
  2. For each required_field path:
     → resolve in task_json → copy to output (or raise MissingRequiredFieldError)
  3. For each conditional_field:
     → evaluate condition expression against task_json
     → if true: resolve and copy; if false: skip
  4. excluded_fields and excluded_zones: logged only (not present in output by construction)
  5. Return pruned dict
```

**Example:**

**Input**:

```json
{
  "task_id": "123",
  "zone1": {
    "field1": true,
    "field2": "value2"
  },
  "zone2": {
    "field3": false
  }
}
```

**Output:**

```json
{
  "zone1": {
    "field1": true
  }
}
```

**Condition expression evaluator:** Supports `"path.to.field == value"` syntax. Values: `true`/`false` (boolean) or string literals.

**Custom exception:** `MissingRequiredFieldError` — raised when a required field path doesn't exist in the input JSON.

---

### 4.3 `llm_backend.py` — Model-Agnostic Generation

**Purpose:** Provide a uniform `generate()` interface across 4 LLM backends. Backend selection is config-driven, not code-driven.

**Class hierarchy:**

```
LLMBackend (ABC)
  ├── OllamaBackend    — POST {base_url}/api/chat (local, no API key)
  ├── TogetherBackend   — POST api.together.xyz/v1/chat/completions
  ├── OpenAIBackend     — POST api.openai.com/v1/chat/completions
  └── AnthropicBackend  — POST api.anthropic.com/v1/messages
```

**Interface:**

- `generate(system_prompt, user_prompt) → str` — with retry (3× exponential backoff)
- `_call(system_prompt, user_prompt) → str` — single API call (subclass-specific)

**Factory:** `create_backend(config?) → LLMBackend` — instantiates the correct backend from config.

**Current config:** Ollama + `llama3:latest` (local, 8B model). Switch to Together.ai for production.

---

### 4.4 `prompt_constructor.py` — Prompt Assembly

**Purpose:** Assemble condition-specific system and user prompts for the LLM.

**Public functions:**

- `build_system_prompt(condition) → str` — role, rules, constraints, tone
- `build_user_prompt(pruned_context, prior_variants?, context_format?) → str` — task context + diversity instruction
- `format_context(pruned_dict, style) → str` — `"prose"` or `"json"` formatting
- `build_prompts(task_json, condition, ...) → (system_prompt, user_prompt)` — convenience wrapper

**Dual format strategy:**

| Format    | Use Case           | Behaviour                                                                         |
| --------- | ------------------ | --------------------------------------------------------------------------------- |
| `prose` | Small models (7B)  | Field-aware conversion:`action_verb + entity_name → "Task: Take Doxycycline."` |
| `json`  | Large models (70B) | Raw `json.dumps(pruned_dict, indent=2)`                                         |

**Prose field mapping (`_to_prose`):**

- `action_verb` + `entity_name` → `"Task: Take Doxycycline."`
- `cues.visual` → `"Target appearance: Red round bottle with white label."`
- `domain_properties` → `"Details: dosage: 100mg, form: Tablet."`
- `task_creator` → `"Prescribed by: Doctor."`
- `detected_activity_raw` → `"Current context: User just finished eating dinner."`

**Diversity mechanism:** For variant N > 1, prior variants are appended with instruction: *"Previously generated variants (generate something structurally different)"*.

---

## 5. Data Flow (End-to-End)

```
medicine_a.json                    condition_field_map.yaml
      │                                     │
      ▼                                     ▼
 ┌──────────────────────────────────────────────────┐
 │                context_extractor.extract()       │
 │  Full JSON + "AF_only" → pruned dict             │
 │  (only: action_verb, entity_name, visual,        │
 │   domain_properties, + task_creator if authority)│
 └───────────────────────┬──────────────────────────┘
                         │
                         ▼
 ┌──────────────────────────────────────────────────┐
 │          prompt_constructor.build_prompts()      │
 │  pruned dict → format_context(prose) →           │
 │  system_prompt (condition rules, constraints) +  │
 │  user_prompt (task context + diversity instr.)   │
 └───────────────────────┬──────────────────────────┘
                         │
                         ▼
 ┌──────────────────────────────────────────────────┐
 │            llm_backend.generate()                │
 │  system_prompt + user_prompt → LLM → text        │
 │  (retry up to 3× with exponential backoff)       │
 └───────────────────────┬──────────────────────────┘
                         │
                         ▼
              "Remember to take your Doxycycline —
               the 100mg tablet in the red round
               bottle. Your doctor prescribed it."
                         │
                    [S4: quality_gate.check()]
                    [S5: output_store.write()]
```

---

## 6. Task JSON Schema (3-Zone Design)

Each task schema is divided into three zones as an **engineering control** — different pipeline stages read from different zones:

```json
{
  "task_id": "medicine_a",
  "description": "...",

  "reminder_context": {        // ← Stage 2 reads from here only
    "element1": {              //   Action + target entity
      "action_verb": "Take",
      "target_entity": {
        "entity_name": "Doxycycline",
        "cues": { "visual": "Red round bottle with white label" },
        "domain_properties": { "dosage": "100mg", "form": "Tablet" }
      }
    },
    "element2": {              //   Origin / authority
      "origin": {
        "task_creator": "Doctor",
        "creator_is_authority": true
      }
    },
    "element3": {              //   Current context
      "detected_activity_raw": "User just finished eating dinner"
    }
  },

  "agent_reasoning_context": { // ← Stage 1 reads from here (excluded from Stage 2)
    "execution_protocol": { ... },
    "encoding_info": { ... }
  },

  "placeholder": {             // ← Nobody reads (future work)
    "motivation_hierarchy": { ... },
    "user_state_at_creation": { ... }
  }
}
```

---

## 7. Condition Field Whitelist Summary

| Field                         | AF_only            | AF_CB              |
| ----------------------------- | ----------------- | ------------------ |
| `action_verb`               | ✅                | ✅                 |
| `entity_name`               | ✅                | ✅                 |
| `cues.visual`               | ✅                | ✅                 |
| `domain_properties`         | ✅                | ✅                 |
| `task_creator`              | ✅ (if authority) | ✅ (if authority)  |
| `detected_activity_raw`     | ❌                | ✅                 |
| `agent_reasoning_context.*` | ❌ zone           | ❌ zone            |
| `placeholder.*`             | ❌ zone           | ❌ zone            |

---

## 8. Internal Dependency Graph

```
config_loader.py          ← no internal deps (foundation)
       ↑
       ├── context_extractor.py
       ├── llm_backend.py
       └── prompt_constructor.py ── also depends on → context_extractor.py
```

External dependencies: `pydantic`, `pyyaml`, `httpx`, `pytest`

---

## 9. Test Coverage

| Test Module                   | Tests        | Covers                                                                                                                                    |
| ----------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `test_config_loader.py`     | 18           | All 3 config files: happy path loading, field semantics, validation errors (bad backend, missing fields, out-of-range values), round-trip |
| `test_context_extractor.py` | 20           | Both active conditions × medicine_a: field inclusion/exclusion, zone stripping, conditional authority logic, error handling               |
| `test_quality_gate.py`      | 38           | Forbidden keyword (dormant path), entity presence, length, duplicates, language, CB consistency                                           |
| **Total**               | **76** | **All pass**                                                                                                                        |

*Note: llm_backend and prompt_constructor are tested via CLI entry points (manual verification), not automated tests. Their outputs depend on an LLM and are inherently non-deterministic.*

---

## 10. Completed Work (Sprints 1–4)

| Sprint       | Commit      | What was built                                                                                                                                                           |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **S1** | `f3ff85a` | Directory structure, 3 YAML configs,`config_loader.py` with Pydantic validation, 18 tests                                                                              |
| **S2** | `e420846` | `context_extractor.py` (JSON pruner), `medicine_a.json`, v0.2 schema migration (snake_case + `excluded_zones`), 20 tests                                           |
| **S3** | `7c7caee` | `llm_backend.py` (4 backends + retry), `prompt_constructor.py` (dual format + diversity), config updates (`base_url`, `context_format`), end-to-end verification |
| **S4** | — | `quality_gate.py` (6 checks incl. CB consistency), `forbidden_keywords.yaml`, `test_quality_gate.py` (38 tests), 3-group redesign applied |

---

## 11. Pending Work (Sprints 5–7)

### S5 — Batch Runner + Output Store

- `output_store.py`: SQLite `reminders.db` (schema: task_id, condition, variant_idx, text, review_status, model_used, ...)
- `batch_runner.py`: loop over 8 tasks × 2 conditions × N variants, with quality gate retry
- Remaining 7 task JSON files (medicine_b through chores_h)
- `generation_log.json`: full log of all generation attempts

### S6 — Scale + Review Interface

- Scale `n_variants` from 3 to 10
- `review_interface.py`: CLI tool for human keep/reject/flag review
- Target: 160 approved variants in `reminders.db`

### S7 — Stage 1 Demo (independent, can run in parallel)

- `stage1/extractor.py`: ReAct agent loop (read source → reason → extract)
- `data/simulated_sources/email.txt`: simulated doctor's letter
- Output: partial Task JSON with gap report

---

## 12. Configuration Summary (Current State)

**model_config.yaml:**

```yaml
backend: "ollama"
model_name: "llama3:latest"
temperature: 0.8
max_tokens: 150
base_url: "http://localhost:11434"
api_key_env: null
```

**generation_config.yaml:**

```yaml
n_variants: 3
max_retries: 3
min_words: 5
max_words: 35
similarity_threshold: 0.85
context_format: "prose"
```

**Environment:** `thesis_server` conda env (Python 3.12), Ollama running locally with `llama3:latest` (8B Q4).
