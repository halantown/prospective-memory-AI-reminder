# Reminder Agent — Development Plan
## Stage 2: Batch Generation Pipeline

| | |
|---|---|
| **Version** | v0.2 — S2 complete; S3 updated with Ollama config and dual format strategy |
| **Date** | 2026-03-11 |
| **Owner** | Claude (project tracking) |
| **Developer** | Thesis Candidate (local) |
| **Status** | 🟡 S2 complete — S3 in progress |

---

## Changelog

| Version | Date | Changes |
|---|---|---|
| v0.1 | 2026-03-11 | Initial plan |
| v0.2 | 2026-03-11 | S1 closed (commit f3ff85a); S2 closed (commit e420846, 38 tests); S3 updated: Ollama local setup, dual format_context strategy, generation_config additions |

---

## Guiding Principles

1. **Test before expand.** Each module is validated on one task (Medicine A) before running across all 8.
2. **Fail loudly.** Every module raises explicit errors on bad input rather than silently producing wrong output. Wrong output here = corrupted experimental stimuli.
3. **Config over code.** Condition rules, model selection, and generation parameters live in config files. Code changes should be rare.
4. **Log everything.** Every generation call, quality check result, and retry is logged. The log is evidence for the methods section.

---

## Sprint Overview

| Sprint | Focus | Status | Gate to next sprint |
|---|---|---|---|
| **S1** | Project skeleton + Config layer | ✅ `f3ff85a` | Directory created; configs load without error |
| **S2** | Context Extractor | ✅ `e420846` | Passes all unit tests on Medicine A |
| **S3** | LLM Backend + Prompt Constructor | 🔵 In progress | Generates plausible text for Medicine A, all 4 conditions |
| **S4** | Quality Gate | ⬜ | Auto-checks catch planted violations reliably |
| **S5** | Batch Runner + Output Store | ⬜ | Full run: 32 combinations × 3 variants logged to DB |
| **S6** | Scale to N=10 + Review Interface | ⬜ | 320 variants in DB; human review complete |
| **S7** | Stage 1 Demo | ⬜ | ReAct agent extracts Medicine A JSON from email.txt |

Stage 1 (S7) is intentionally last — it does not block experiment data collection.

---

## Sprint 1 — Project Skeleton + Config Layer ✅ `f3ff85a`

All exit criteria met. 18 tests passing.

---

## Sprint 2 — Context Extractor ✅ `e420846`

All exit criteria met. 20 new tests, 38 total passing.

Notable: `excluded_zones` implementation cleanly blocks `agent_reasoning_context` and `placeholder` at zone level rather than field level.

---

## Sprint 3 — LLM Backend + Prompt Constructor

**Goal:** For one (task, condition) pair, generate one reminder text that looks correct.

### Tasks

**LLM Backend (`stage2/llm_backend.py`)**
- [ ] Define abstract interface: `generate(prompt: str) -> str`
- [ ] Implement `OllamaBackend` — `POST localhost:11434/api/generate`, no API key
- [ ] Implement `TogetherBackend` (Together.ai API) — for 70B validation
- [ ] Backend + model selected from `model_config.yaml` at import time
- [ ] Retry logic: if API call fails, retry up to 3 times with exponential backoff

**Prompt Constructor (`stage2/prompt_constructor.py`)**
- [ ] `build_system_prompt(condition)` — role definition, condition rules in plain English, length constraint (8–30 words), tone instruction
- [ ] `build_user_prompt(pruned_context, prior_variants, context_format)` — task context + diversity instruction
- [ ] `format_context(pruned_dict, style)` — `prose` or `json` mode, selected from `generation_config.yaml`
- [ ] `_to_prose(pruned_dict)` — field-aware conversion (see TECH_DOC §4.2 for field mapping)
- [ ] For variant N > 1: append prior variants with structural-difference instruction

**Config update**
- [ ] Add `context_format: "prose"` to `generation_config.yaml`

### Local Ollama setup

```bash
ollama pull mistral:7b
ollama serve                    # runs on localhost:11434
```

`model_config.yaml` for local dev:
```yaml
backend: "ollama"
model_name: "mistral:7b"
temperature: 0.8
max_tokens: 150
base_url: "http://localhost:11434"
api_key_env: null
```

### Exit criteria

- Run manually: `python stage2/prompt_constructor.py` — prints assembled prompt for Medicine A × HighAF_HighCB
- Run manually: `python stage2/llm_backend.py` — returns one generated string without error
- Eyeball check: generated text looks like a plausible reminder, correct condition

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
