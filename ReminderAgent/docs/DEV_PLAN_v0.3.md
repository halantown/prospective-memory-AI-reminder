# Reminder Agent — Development Plan
## Stage 2: Batch Generation Pipeline

| | |
|---|---|
| **Version** | v0.3 — Theory review complete; S4 Quality Gate spec updated (CB consistency check + tone constant) |
| **Date** | 2026-03-12 |
| **Owner** | Claude (project tracking) |
| **Developer** | Thesis Candidate (local) |
| **Status** | 🔵 S3 complete — S4 ready to start |

---

## Changelog

| Version | Date | Changes |
|---|---|---|
| v0.1 | 2026-03-11 | Initial plan |
| v0.2 | 2026-03-11 | S1 closed (`f3ff85a`); S2 closed (`e420846`); S3 updated with Ollama + dual format |
| v0.3 | 2026-03-12 | S3 closed (`7c7caee`); theory review: S4 Quality Gate adds CB activity consistency check; prompt_constructor adds tone constant (Option C); open items C3–C6 logged |

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
| **S3** | LLM Backend + Prompt Constructor | ✅ `7c7caee` | Generates plausible text for Medicine A, all 4 conditions |
| **S4** | Quality Gate | 🔵 Ready | Auto-checks catch planted violations reliably |
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

## Sprint 3 — LLM Backend + Prompt Constructor ✅ `7c7caee`

All exit criteria met. End-to-end verified: all 4 conditions produce plausible reminders via local Ollama (`llama3:latest`). 38 tests passing.

**Post-sprint finding:** LowAF text occasionally includes entity name (e.g., "Doxycycline") — confirmed **not a violation** (entity_name is must_include for all conditions). Quality Gate should not flag this.

**Post-sprint action (before S4 starts):** Add tone constant to `prompt_constructor.py` system prompt — intention-reactivation framing required for all conditions (see §Tone Constant below).

---

## Tone Constant — Required Addition to S3 (before S4)

**Problem:** Reminder tone (instruction-like vs. intention-reactivation) is an uncontrolled variable that could confound AF and CB effects if not fixed.

**Solution:** Add the following hard constraint to `build_system_prompt()` in `prompt_constructor.py`:

```
Tone rule (applies to ALL conditions):
Use intention-reactivation framing ONLY:
  ✓ "Remember to...", "By the way, remember...", "Don't forget to..."
  ✗ "It's time to...", "You need to now...", "Make sure you..."
  ✗ Never imply the task should be executed immediately.
```

**Thesis framing:**
> "Reminder tone was held constant across conditions using standardised intention-reactivation framing, isolating AF and CB effects from linguistic register confounds."

---

## Sprint 4 — Quality Gate

**Goal:** Automatically flag generated texts that violate condition rules.

### Tasks

- [ ] Write `stage2/quality_gate.py`
- [ ] Write `data/forbidden_keywords.yaml` — per-task visual/domain keywords forbidden in Low AF

**Checks to implement:**

| Check | Method | Fail condition |
|---|---|---|
| **Forbidden keyword leak** | String match vs `forbidden_keywords[task_id]` | Visual/domain keyword in Low AF text |
| **Required entity present** | Check entity name appears in output | Entity name absent |
| **Length constraint** | Word count | < `min_words` or > `max_words` from config |
| **Duplicate detection** | Levenshtein ratio vs prior variants | Ratio > `similarity_threshold` |
| **Language check** | `langdetect` | Not `en` |
| **CB activity consistency** *(new — C1)* | Check High CB variants all reference the same activity | CB sentence describes different activity across variants in same batch |

**CB activity consistency check detail:**
- Extract the activity phrase from each High CB variant (heuristic: sentence containing "I can see" or "I notice")
- Compute semantic similarity between all activity phrases in the batch
- Flag if any variant's activity phrase diverges significantly from the majority
- This ensures the 10 variants for a given (task, HighCB) pair all bridge to the same detected activity

**`forbidden_keywords.yaml` structure:**
```yaml
medicine_a:
  visual_keywords: ["red", "round", "white label"]
  domain_keywords: ["100mg", "tablet"]
medicine_b:
  visual_keywords: ["orange", "square", "chewable"]
  domain_keywords: ["500mg"]
# ... all 8 tasks
```

*Note: `domain_keywords` forbidden in Low AF only. `visual_keywords` forbidden in all Low AF. Gate logic must encode this distinction.*

- [ ] Write `tests/test_quality_gate.py`
  - Plant deliberate visual keyword in Low AF → assert fails
  - Plant domain keyword in Low AF → assert fails
  - Valid High AF text → assert passes all checks
  - Duplicate text → assert fails similarity check
  - High CB batch with inconsistent activity → assert CB consistency check fails
  - High CB batch with consistent activity → assert passes

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

## Open Items (Non-Blocking)

These do not block S4–S6 development but must be resolved before data collection.

| ID | Priority | Item | Owner | Blocks |
|---|---|---|---|---|
| **C3** | 🔴 Pre-data | Encoding card content (domain_properties confirmed) — finalise exact wording shown to participants | Thesis candidate | Methods section |
| **C4** | 🔴 Pre-data | AF×CB interaction direction: predict null or positive? Choose one, write into Hypotheses section | Thesis candidate | Introduction/Hypotheses |
| **C5** | 🟡 Pre-submission | AF operationalization: write "encoded intention specificity" framing into Methods section | Thesis candidate | Reviewer defence |
| **C6** | 🟢 S6 | Human review: add semantic equivalence check dimension across variants in same batch | S6 Review interface | Review quality |

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
