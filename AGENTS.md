# Repository Guidelines

## Project Structure & Module Organization

This repository contains several related research prototypes, but active development is centered on `CookingForFriends/` and `ReminderAgent/`.

- `CookingForFriends/backend/`: FastAPI backend, WebSocket handlers, SQLAlchemy models, and backend tests in `backend/tests/`.
- `CookingForFriends/frontend/`: Vite + React + TypeScript client. UI code lives in `frontend/src/`; static assets live in `frontend/public/`.
- `CookingForFriends/db/`: PostgreSQL initialization SQL used by Docker Compose.
- `ReminderAgent/reminder_agent/`: offline reminder-generation pipeline; tests live in `reminder_agent/tests/`.
- `Prototype/`: older experimental apps. Treat as reference code unless a task explicitly targets it.

## Build, Test, and Development Commands

Run commands from the relevant subproject directory.

- `cd CookingForFriends/frontend && npm run dev`: start the Vite frontend locally.
- `cd CookingForFriends/frontend && npm run build`: type-check and produce a production bundle.
- `cd CookingForFriends/backend && python main.py`: run the FastAPI backend.
- `cd CookingForFriends && docker-compose up -d`: start the local PostgreSQL service.
- `cd CookingForFriends/backend && pytest tests -v`: run backend tests.
- `cd ReminderAgent && pytest reminder_agent/tests -v`: run ReminderAgent tests.
- `cd ReminderAgent && python -m reminder_agent.stage2.batch_runner --dry-run --clear`: verify the reminder pipeline without calling an LLM.

## Coding Style & Naming Conventions

Follow the existing style in each module.

- Python uses 4-space indentation, `snake_case` for functions/modules, and type hints where already present.
- Frontend code uses TypeScript/TSX with 2-space indentation, `PascalCase` for React components, and colocated feature files under `frontend/src/components/` and `frontend/src/pages/`.
- Use descriptive filenames such as `test_quality_gate.py` or `TimelineEditorPage.tsx`.
- No repo-wide formatter or linter config is checked in, so keep changes consistent with nearby code and run tests before submitting.

## Testing Guidelines

Pytest is the active test framework for Python modules. Add tests alongside the affected package using `test_*.py` naming. Prefer focused unit tests for logic changes and regression tests for bug fixes. Frontend automation is not currently configured, so verify UI changes with a local `npm run build`.

## Commit & Pull Request Guidelines

Recent history mixes concise fixes with Conventional Commit style, for example `feat(frontend): ...`, `chore: ...`, and short imperative fixes. Prefer:

- `<type>(<scope>): short summary` for feature work
- imperative, present-tense messages for one-off fixes

Pull requests should state which subproject is affected, summarize behavior changes, list test commands run, and include screenshots for frontend/admin UI changes.



# Copilot Instructions for Robot Reminder SysteCritical Warnings

* **Python Version**: Do not attempt to upgrade `RobotServer` to Python 3 unless the NaoQi SDK has been replaced.
* **Directory Structure**: The root `README.md` describes a "reorganized" structure (`server/`, `demos/`) which may not match the actual file system. Trust the file system (`ReminderServer`, `VirtualWeek`) over the README for path locations.
* Conda environment: `thesis_server` for server game and agent; `pepper_thesis` for robot (use the robot if necessary)
* Always update relevant document if you think necessary

When you fix any sever backend problems, record in the incident-document. If you cannot find, create one, and following the template (put the template at the beginning at first):

```
## INC-XXX — <One-line title>

| Field        | Detail |
|--------------|--------|
| Date         | YYYY-MM-DD |
| Severity     | P0 Critical / P1 High / P2 Medium / P3 Low |
| Status       | Resolved / Monitoring / Open |
| Reported by  | (who / how it was noticed) |
| Affected area| (component / endpoint / feature) |

### Background
> What was the system doing? What is the normal expected behaviour?

### Incident Description
> What went wrong? What did users / logs see?

### Timeline
| Time (local) | Event |
|--------------|-------|
| HH:MM | First symptom observed |
| HH:MM | Investigation started |
| HH:MM | Root cause identified |
| HH:MM | Fix deployed |
| HH:MM | Confirmed resolved |

### Root Cause
> Technical explanation of why this happened.

### Contributing Factors
> Anything that made this more likely or harder to catch (missing constraint,
> no test, edge-case in reconnect logic, etc.)

### Fix
> What exactly was changed and why.
> Reference files / line numbers where relevant.

### Verification
> How was the fix confirmed to work?

### Follow-up Actions
> Preventive measures, monitoring improvements, tests to add, etc.
> Use [ ] checkboxes.
```
