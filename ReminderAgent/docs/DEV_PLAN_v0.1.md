# Reminder Agent — Development Plan
## Stage 2: Batch Generation Pipeline

| | |
|---|---|
| **Version** | v0.1 |
| **Date** | 2026-03-11 |
| **Owner** | Claude (project tracking) |
| **Developer** | Thesis Candidate (local) |
| **Status** | 🟡 Planning phase — not started |

---

## Changelog

| Version | Date | Changes |
|---|---|---|
| v0.1 | 2026-03-11 | Initial plan |

---

## Guiding Principles

1. **Test before expand.** Each module is validated on one task (Medicine A) before running across all 8.
2. **Fail loudly.** Every module raises explicit errors on bad input rather than silently producing wrong output. Wrong output here = corrupted experimental stimuli.
3. **Config over code.** Condition rules, model selection, and generation parameters live in config files. Code changes should be rare.
4. **Log everything.** Every generation call, quality check result, and retry is logged. The log is evidence for the methods section.

---

## Sprint Overview

| Sprint | Focus | Gate to next sprint |
|---|---|---|
| **S1** | Project skeleton + Config layer | Directory created; configs load without error |
| **S2** | Context Extractor | Passes all unit tests on Medicine A |
| **S3** | LLM Backend + Prompt Constructor | Generates plausible text for Medicine A, all 4 conditions |
| **S4** | Quality Gate | Auto-checks catch planted violations reliably |
| **S5** | Batch Runner + Output Store | Full run: 32 combinations × 3 variants logged to DB |
| **S6** | Scale to N=10 + Review Interface | 320 variants in DB; human review complete |
| **S7** | Stage 1 Demo | ReAct agent extracts Medicine A JSON from email.txt |

Stage 1 (S7) is intentionally last — it does not block experiment data collection.

---

## Sprint 1 — Project Skeleton + Config Layer

**Goal:** Runnable project structure. No logic yet, just scaffolding and config loading.

### Tasks

- [ ] Create directory structure (as defined in TECH_DOC §4.1)
- [ ] Write `config/condition_field_map.yaml` — full whitelist for all 4 conditions
- [ ] Write `config/model_config.yaml` — backend selector + model name + temperature
- [ ] Write `config/generation_config.yaml` — N variants, max retries, length limits
- [ ] Write `stage2/config_loader.py` — loads and validates all three configs on startup; raises on missing required fields
- [ ] Write `tests/test_config_loader.py` — assert all configs load cleanly

### Deliverables

```
reminder_agent/
├── config/
│   ├── condition_field_map.yaml      ✓
│   ├── model_config.yaml             ✓
│   └── generation_config.yaml        ✓
├── stage2/
│   └── config_loader.py              ✓
└── tests/
    └── test_config_loader.py         ✓
```

### Config file specs

**`model_config.yaml`**
```yaml
backend: "together"          # options: together | ollama | openai | anthropic
model_name: "meta-llama/Meta-Llama-3-70B-Instruct"
temperature: 0.8
max_tokens: 150
api_key_env: "TOGETHER_API_KEY"   # reads from environment variable
```

**`generation_config.yaml`**
```yaml
n_variants: 3                # start with 3; scale to 10 in S6
max_retries: 3               # per variant before flagging as failed
min_words: 5
max_words: 35
similarity_threshold: 0.85   # max Levenshtein similarity between variants
```

**`condition_field_map.yaml`** — see TECH_DOC §4.2 for full spec.

### Exit criteria

```bash
python -m pytest tests/test_config_loader.py  # all pass
python stage2/config_loader.py                # prints loaded config summary, no errors
```

---

## Sprint 2 — Context Extractor

**Goal:** Given a full Task JSON and a condition string, return a pruned dict containing only whitelisted fields. LLM sees only this pruned dict.

### Tasks

- [ ] Write `data/task_schemas/medicine_a.json` — full Task JSON for Doxycycline (from meeting slides, cleaned)
- [ ] Write `stage2/context_extractor.py`
  - `load_field_map(condition)` — reads whitelist from config
  - `extract(task_json, condition)` → pruned dict
  - Handles conditional fields (`Creator_Is_Authority` check)
  - Raises `MissingRequiredFieldError` if a required field is absent from input JSON
  - Logs included/excluded fields for each call
- [ ] Write `tests/test_context_extractor.py`
  - Test: LowAF output contains no visual cue fields
  - Test: HighAF output contains visual cue + domain properties
  - Test: HighCB output contains Detected_Activity
  - Test: LowCB output does not contain Detected_Activity
  - Test: Task_Creator included in HighAF when authority=true, excluded when false
  - Test: Missing required field raises error

### Key logic — conditional field resolution

```python
# Pseudocode
for field in conditional_fields[condition]:
    if evaluate(field.condition, task_json):  # e.g., Creator_Is_Authority == true
        include field.path in output
    else:
        skip
```

### Exit criteria

```bash
python -m pytest tests/test_context_extractor.py   # all pass
```

Manual check: print pruned output for Medicine A × LowAF_LowCB — should contain only entity name and action verb.

---

## Sprint 3 — LLM Backend + Prompt Constructor

**Goal:** For one (task, condition) pair, generate one reminder text that looks correct.

### Tasks

**LLM Backend (`stage2/llm_backend.py`)**
- [ ] Define abstract interface: `generate(prompt: str) -> str`
- [ ] Implement `TogetherBackend` (Together.ai API)
- [ ] Implement `OllamaBackend` (local, for Phase 2 validation)
- [ ] Backend selected from `model_config.yaml` at import time
- [ ] Retry logic: if API call fails, retry up to 3 times with exponential backoff

**Prompt Constructor (`stage2/prompt_constructor.py`)**
- [ ] `build_system_prompt(condition)` — role definition, condition rules in plain English, length constraint, tone instruction
- [ ] `build_user_prompt(pruned_context, prior_variants)` — task context + diversity instruction
- [ ] `format_context(pruned_dict) -> str` — converts pruned JSON dict to natural language description (not raw JSON — LLM performs better with prose)
- [ ] For variant N > 1: append prior variants with instruction to differ structurally

### Prompt structure (target)

```
[SYSTEM]
You are generating reminder messages for a robot assistant in a cognitive psychology experiment.
The reminder is spoken aloud by the robot (max 12 seconds).

Condition: {condition_name}
This condition requires you to include: {included_fields_plain_english}
Do NOT include: {excluded_fields_plain_english}

Tone: natural spoken English, warm and brief. Not clinical. Not robotic.
Length: 8–30 words.
Output: one reminder sentence or two short sentences. No bullet points. No explanation.

[USER]
Task context:
{formatted_pruned_context}

{if prior_variants:}
Previously generated variants (generate something structurally different):
{prior_variants_numbered}

Generate one new reminder variant.
```

### Exit criteria

- Run manually: `python stage2/prompt_constructor.py` prints the assembled prompt for Medicine A × HighAF_HighCB
- Run manually: `python stage2/llm_backend.py` returns one generated string without error
- Eyeball check: generated text looks like a plausible reminder

---

## Sprint 4 — Quality Gate

**Goal:** Automatically flag generated texts that violate condition rules.

### Tasks

- [ ] Write `stage2/quality_gate.py`
- [ ] Build `forbidden_keywords.yaml` — per-task list of visual cue keywords that must not appear in Low AF texts

**Checks to implement:**

| Check | Implementation |
|---|---|
| Forbidden keyword leak | String match against `forbidden_keywords[task_id]` — fails if any keyword found in Low AF text |
| Required entity present | Check entity name appears in output |
| Length constraint | Word count between `min_words` and `max_words` from config |
| Duplicate detection | Levenshtein ratio against all prior variants in batch; fail if > threshold |
| Language check | `langdetect` — must be `en` |

- [ ] Write `tests/test_quality_gate.py`
  - Plant a deliberate violation (red bottle mention in Low AF text) → assert fails
  - Valid High AF text → assert passes all checks
  - Duplicate text → assert fails similarity check

**`forbidden_keywords.yaml` structure:**
```yaml
medicine_a:
  visual_cue_keywords: ["red", "round", "doxycycline", "white label"]
  domain_keywords: ["100mg", "tablet"]
medicine_b:
  visual_cue_keywords: ["orange", "square", "vitamin c", "chewable"]
  domain_keywords: ["500mg"]
# ... etc for all 8 tasks
```

*Note: domain_keywords only forbidden in Low AF. Visual_cue_keywords forbidden in all Low AF. This distinction needs encoding in the gate logic.*

### Exit criteria

```bash
python -m pytest tests/test_quality_gate.py   # all pass
```

---

## Sprint 5 — Batch Runner + Output Store

**Goal:** End-to-end run for all 32 combinations × N=3 variants. Results written to SQLite.

### Tasks

- [ ] Write `stage2/output_store.py`
  - `init_db()` — creates `output/reminders.db` with schema from TECH_DOC §5.1
  - `write_variant(task_id, condition, idx, text, model_used)`
  - `get_variants(task_id, condition)` — for review interface
  - `export_json()` — dumps full DB to `output/reminders.json`

- [ ] Write `stage2/batch_runner.py`
  - Loops over all `(task_id, condition)` combinations
  - For each: extract context → build prompt → generate → quality check → retry or store
  - Logs every attempt (including failures) to `output/generation_log.json`
  - Prints progress summary on completion

- [ ] Write remaining 7 task JSON files (`medicine_b.json` through `chores_h.json`)

- [ ] Add `data/task_schemas/` to `tests/test_context_extractor.py` — run extractor on all 8 tasks, assert no MissingRequiredFieldError

### Exit criteria

```bash
python stage2/batch_runner.py
# Expected output:
# Processing 32 combinations × 3 variants = 96 total
# Generated: 96 | Failed: 0 | Retried: N
# Output written to output/reminders.db
```

Manual check: open `reminders.json`, verify Low AF entries contain no forbidden keywords.

---

## Sprint 6 — Scale to N=10 + Review Interface

**Goal:** Full 320-variant run. Human review complete. `reminders.db` ready for experiment platform.

### Tasks

- [ ] Update `generation_config.yaml`: `n_variants: 10`
- [ ] Re-run `batch_runner.py` — expect some quality gate retries; log and address
- [ ] Write `review/review_interface.py` — CLI tool
  - Groups variants by `(task_id, condition)`
  - For each group: display all variants, prompt reviewer for `keep / reject / flag` per variant
  - Writes decisions to `review/review_log.json`
  - Updates `review_status` in `reminders.db`

**Review priority order:**
1. All Low AF conditions first (leak check)
2. All High CB conditions (naturalness check)
3. Remaining conditions spot-check (3 per group)

### Exit criteria

- `reminders.db` contains ≥ 10 `approved` variants per `(task_id, condition)` combination (32 combinations)
- `review_log.json` documents all decisions
- Rejection rate < 20% (if higher, prompt needs revision — return to S3)

---

## Sprint 7 — Stage 1 Demo

**Goal:** Runnable ReAct agent that extracts Medicine A Task JSON from `email.txt`.

### Tasks

- [ ] Write `data/simulated_sources/email.txt` — simulated doctor's letter (see TECH_DOC §6.2)
- [ ] Write `stage1/prompts.py` — ReAct loop prompt templates
- [ ] Write `stage1/extractor.py` — agent loop: read source → reason → extract fields → iterate until complete
- [ ] Write `stage1/demo_run.py` — entry point; prints extracted JSON and diff against hand-authored `medicine_a.json`
- [ ] Document: list of fields successfully extracted vs. fields requiring manual completion

### Exit criteria

```bash
python stage1/demo_run.py
# Prints extracted JSON
# Prints: "Fields auto-extracted: X/Y | Fields requiring manual input: Z"
```

The demo does not need to be perfect — partial extraction with transparent gap reporting is the expected and acceptable outcome.

---

## Dependency Graph

```
S1 (skeleton)
    │
    ▼
S2 (context extractor) ──────────────────────────┐
    │                                             │
    ▼                                             │
S3 (LLM backend + prompt constructor)            │
    │                                             │
    ▼                                             ▼
S4 (quality gate) ◄──────────────────── S2 tests must pass
    │
    ▼
S5 (batch runner + output store)
    │
    ▼
S6 (scale + review) ◄── human availability required
    │
    ▼
[reminders.db ready for experiment platform]

S7 (Stage 1 demo) ── independent, can run in parallel with S4–S6
```

---

## Sync Protocol

Developer syncs progress at each sprint boundary with:

1. **What was built** — files created / modified
2. **Exit criteria status** — which passed, which failed
3. **Blockers or unexpected findings** — anything that changes the plan
4. **Next sprint confirmation** — go / hold / adjust

Mid-sprint syncs welcome for: design questions, unexpected LLM behaviour, config decisions.

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| LLM repeatedly fails Low AF compliance | Medium | High | Tighten system prompt; add explicit negative examples in few-shot; last resort: template-based Low AF generation |
| Quality gate rejects > 20% of variants | Medium | Medium | Review forbidden keyword list for over-triggering; adjust threshold |
| Together.ai API latency slows iteration | Low | Low | Cache responses during prompt development; switch to Ollama for dev cycles |
| Task JSON schema changes mid-development | Medium | Medium | All field paths in `condition_field_map.yaml`; code change-free if only config updated |
| Stage 1 demo takes longer than expected | Low | Low | S7 is last and independent; does not block experiment |

---

## Definition of Done (full project)

- [ ] `reminders.db` contains ≥ 10 approved variants for all 32 `(task_id, condition)` combinations
- [ ] `generation_log.json` documents all generation attempts
- [ ] `review_log.json` documents all human review decisions
- [ ] All unit tests pass (`pytest tests/`)
- [ ] Stage 1 demo runs and produces partial Task JSON with gap report
- [ ] `reminders.db` successfully queried by experiment platform (FastAPI integration test)
