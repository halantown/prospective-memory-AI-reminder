# GEMINI.md — Prospective Memory AI Reminder

This file provides comprehensive guidance for Gemini CLI when working within this repository. It documents the project's architecture, development workflows, and key technical specifications.

---

## 🚀 Project Overview

This repository hosts a **Master Thesis** research project investigating how context-aware robot reminders affect **Prospective Memory (PM)** in elderly users. The project implements a 2×2 within-subjects experiment (Associative Fidelity × Contextual Bridging).

### Core Components

1.  **SaturdayAtHome** (`/SaturdayAtHome`): The primary experimental platform. A web-based game where participants perform "ongoing tasks" (cooking, messaging) while managing "PM tasks" (medicine, laundry) triggered by external events.
2.  **ReminderAgent** (`/ReminderAgent`): An offline Python pipeline that uses LLMs (local or cloud) to batch-generate high-quality reminder text variants for the experiment.
3.  **RobotServer & Prototypes** (`/RobotServer`, `/Prototype`): Supporting tools and legacy prototypes for robot integration (Pepper robot) and earlier RAG-based reminder systems.

---

## 🛠️ Tech Stack & Architecture

### SaturdayAtHome (Experiment Platform)
*   **Backend:** Python 3.11+, FastAPI, SQLite.
    *   **Real-time:** Server-Sent Events (SSE) for timeline-driven gameplay events.
    *   **Data Persistence:** `experiment.db` for session logs and results.
*   **Frontend:** React 18, Vite, Tailwind CSS.
    *   **State Management:** Zustand.
    *   **Audio:** Howler.js (multi-track: neutral comments vs. PM reminders).
*   **Single Source of Truth:** `SaturdayAtHome/game_config.yaml` controls all game parameters, timings, and PM task definitions.

### ReminderAgent (Stimulus Generation)
*   **Architecture:** Two-stage pipeline (Schema Extraction → Batch Generation).
*   **LLM Backends:** Model-agnostic interface supporting Ollama (default local), Together.ai, OpenAI, and Anthropic.
*   **Quality Control:** Automated Quality Gate (word count, forbidden keywords, semantic consistency) + Human Review CLI.

---

## 🏃 Building and Running

### SaturdayAtHome

#### Backend (FastAPI)
```bash
cd SaturdayAtHome/backend
pip install -r requirements.txt
python main.py
```
*Port: 5000. API docs at `/docs`.*

#### Frontend (React)
```bash
cd SaturdayAtHome/frontend
npm install
npm run dev
```
*Port: 3000 (proxies `/api` to :5000).*

### ReminderAgent

#### Testing & Execution
```bash
cd ReminderAgent
# Run unit tests
pytest reminder_agent/tests
# Run generation pipeline
python -m reminder_agent.stage2.batch_runner
```

---

## 📏 Development Conventions

### Coding Style
*   **Python:** Follow PEP 8. Use 4-space indentation and `snake_case` for filenames and variables.
*   **Frontend:** Follow React idiomatic style. Use 2-space indentation in `.jsx` files. Use `PascalCase` for components and `camelCase` for utilities.
*   **Consistency:** Always match the style of the surrounding code.

### Configuration
*   **Never hardcode** values related to game logic or experiment parameters. Use `SaturdayAtHome/game_config.yaml`.
*   **Sensitive Data:** Never commit `.env` files or API keys.

### Git & Commits
*   **Convention:** Use Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`).
*   **Scope:** Keep changes scoped to the specific sub-project (e.g., `feat(agent): ...`).

---

## 🧪 Testing & Validation

*   **ReminderAgent:** Mandatory `pytest` for new logic in `stage2`.
*   **SaturdayAtHome:** Validate changes via local execution and manual UI checks. Ensure SSE events fire as expected in the `/dashboard`.
*   **UI Changes:** Verify layout on standard laptop resolutions (1280x800 target).

---

## 🗺️ Key File Map

| Path | Purpose |
| :--- | :--- |
| `SaturdayAtHome/game_config.yaml` | **Critical:** Source of truth for game behavior. |
| `SaturdayAtHome/backend/main.py` | Backend entry point. |
| `SaturdayAtHome/frontend/src/store/` | Global game state (Zustand). |
| `ReminderAgent/reminder_agent/config/` | LLM and condition whitelists. |
| `AGENTS.md` | General repository guidelines. |
| `docs/` | Deep-dive documentation (PRDs, Technical Docs). |

---

## ⚠️ Known Constraints & Safety

*   **Credential Protection:** Protect `.env` files and API keys for cloud LLM providers.
*   **Data Integrity:** Be cautious when modifying `experiment.db` schema; ensure migrations are handled if necessary.
*   **Robot Integration:** The Pepper robot client uses Python 2.7 (legacy SDK). Treat `robot_test/` as an isolated legacy environment.
