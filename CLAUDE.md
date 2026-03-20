# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Master Thesis** research project on Prospective Memory support for elderly users. It consists of three semi-independent sub-projects:

1. **SaturdayAtHome** — Browser-based psychology experiment game (the active experiment platform)
2. **ReminderAgent** — Offline LLM pipeline that batch-generates reminder text stimuli for the experiment
3. **Reminder** / legacy `server/` — Earlier prototype using Multi-Agent RAG + Ollama (largely superseded)

---

## SaturdayAtHome

### Running

```bash
# Backend (FastAPI + SQLite, port 5000)
conda activate thesis_server
cd SaturdayAtHome/backend
pip install -r requirements.txt
python main.py

# Frontend dev server (React/Vite, port 3000, proxies /api → :5000)
cd SaturdayAtHome/frontend
npm install
npm run dev

# Frontend production build (served by FastAPI at /)
cd SaturdayAtHome/frontend
npm run build
```

### Architecture

- **`game_config.yaml`** (project root of SaturdayAtHome) is the single source of truth for all game parameters — timings, scoring, events, PM tasks, reminder texts. Never hardcode values that belong here.
- **Backend** (`backend/`): FastAPI + SQLite. Entry point is `main.py`. Modules: `core/` (config loader, DB, SSE, timeline engine), `models/`, `routes/`, `services/`, `utils/`.
- **Frontend** (`frontend/src/`): React 18 + Vite + Tailwind + Zustand. Main view is a top-down home floor plan (`HomeScene.jsx`) with floating game panels. Global state is in `src/store/`. WS communication in `src/hooks/useWebSocket.js` maps backend events to store actions.
- **SSE communication**: Backend pushes timeline events to the frontend via `GET /session/{id}/block/{n}/stream`. Key events: `steak_spawn`, `message_bubble`, `trigger_appear`, `reminder_fire`, `block_end`.
- **Security**: `GET /config/game` strips PM correct answers before sending to frontend. Only `/config` admin page receives the full config.

### Web Routes

| Route | Purpose |
|-------|---------|
| `/` | Game (participant-facing) |
| `/dashboard` | Experimenter live monitoring |
| `/manage` | Database management |
| `/config` | YAML config editor |

### Experiment Design

- 2×2 within-subjects: **Aftereffects (AF)** × **Cue Busyness (CB)** conditions
- 4 blocks per participant, Latin Square counterbalancing (4 groups)
- PM scoring: 0/1/2 — never shown to participant
- All data in `backend/core/experiment.db` (SQLite)

---

## ReminderAgent

An **offline batch pipeline** — run before data collection to generate all reminder text variants.

### Running

```bash
conda activate thesis_server
cd ReminderAgent
pip install -r reminder_agent/stage2/requirements.txt  # if exists, else pip install httpx pyyaml

# Test LLM backend
python -m reminder_agent.stage2.llm_backend

# Run batch generation (when batch_runner.py is implemented)
python -m reminder_agent.stage2.batch_runner
```

### Architecture

Two stages:
- **Stage 1** (`stage1/`): ReAct agent that reads simulated data sources (calendar/email/notes `.txt` files) and extracts structured Task JSON schemas. Demo-level only (not fully automated).
- **Stage 2** (`stage2/`): Batch generation of reminder texts. Modules:
  - `config_loader.py` — loads `config/model_config.yaml` and `config/generation_config.yaml`
  - `context_extractor.py` — prunes Task JSON to fields allowed per condition (`config/condition_field_map.yaml`)
  - `prompt_constructor.py` — builds system + user prompts
  - `llm_backend.py` — model-agnostic LLM interface (Ollama / Together / OpenAI / Anthropic)
  - `quality_gate.py` — automated compliance checks (word count, forbidden keywords, CB consistency)

### Config files

- `config/model_config.yaml` — switch LLM backend/model; no code changes needed
- `config/generation_config.yaml` — n_variants (default 3, scale to 10 for production), word limits, similarity threshold
- `config/condition_field_map.yaml` — whitelist of Task JSON fields visible to LLM per condition (AF×CB)
- `config/forbidden_keywords.yaml` — words that must not appear in Low-AF reminders

### LLM Backends

| Backend | Notes |
|---------|-------|
| `ollama` | Local, default. Requires `ollama serve` + model pulled |
| `together` | Cloud. Set `TOGETHER_API_KEY` env var |
| `openai` | Cloud. Set `OPENAI_API_KEY` env var |
| `anthropic` | Cloud. Set `ANTHROPIC_API_KEY` env var |

---

## Key Conda Environments

| Environment | Python | Used for |
|-------------|--------|---------|
| `thesis_server` | 3.11+ | SaturdayAtHome backend, ReminderAgent pipeline |
| `papper_thesis` | 2.7 | Pepper robot client (NAO SDK) — `robot_test/` only |

---

## Cross-Project Data Flow

```
ReminderAgent (offline)
  Task JSONs → Stage2 pipeline → reminders.db
                                      ↓
SaturdayAtHome (live)
  game_config.yaml + reminders.db → FastAPI → SSE → React frontend → Pepper TTS
```

The experiment platform queries reminders by `(task_id, condition)` at runtime and picks a random variant.
