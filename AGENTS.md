# Repository Guidelines

## Project Structure
- `SaturdayAtHome/` is the primary game project (FastAPI backend + React frontend).
- `SaturdayAtHome/backend/` contains API, config loading, timeline logic, and SQLite persistence.
- `SaturdayAtHome/frontend/` contains the Vite React client and assets.
- `SaturdayAtHome/docs/` holds design and experiment documentation.
- `ReminderAgent/` contains a separate Python reminder generation pipeline with tests.
- `Prototype/`, `RobotServer/`, `sdk/`, and `robot_test/` are supporting prototypes/tools; treat them as isolated subprojects.

## Build, Test, and Development Commands
Backend (FastAPI):
```bash
cd SaturdayAtHome/backend
pip install -r requirements.txt
python main.py
```
Frontend (Vite):
```bash
cd SaturdayAtHome/frontend
npm install
npm run dev
```
Production build and preview:
```bash
cd SaturdayAtHome/frontend
npm run build
npm run preview
```
ReminderAgent tests:
```bash
pytest ReminderAgent/reminder_agent/tests
```

## Coding Style and Naming
- Python: follow PEP 8 with 4-space indentation and explicit naming.
- Frontend: follow the existing React style (2-space indentation in `.jsx` files).
- No repo-wide formatter or linter is configured; keep edits consistent with nearby code.
- Naming: `snake_case.py` for Python, `PascalCase.jsx` for components, `camelCase.js` for utilities.

## Testing Guidelines
- `ReminderAgent` uses `pytest` in `ReminderAgent/reminder_agent/tests/`.
- New ReminderAgent features should include or update tests near the affected module.
- `SaturdayAtHome` has no automated test suite; validate via local run and manual UI checks.

## Commit and Pull Request Guidelines
- Commit messages follow a Conventional Commits style in practice: `feat:`, `fix:`, `refactor:`, `docs(scope):`.
- Use concise, imperative summaries (example: `feat: add session lifecycle state machine`).
- PRs should include a short description, local test steps, and screenshots for UI changes.
- Call out any config changes explicitly, especially `SaturdayAtHome/game_config.yaml`.

## Configuration and Data Notes
- `SaturdayAtHome/game_config.yaml` is the single source of truth for game parameters.
- Correct PM answers live in the YAML but are intentionally stripped from the public config API.
- SQLite data lives at `SaturdayAtHome/backend/core/experiment.db`; treat it as local-only test data.

## Agent-Specific Instructions
- Keep changes scoped to the subproject you are touching.
- Update `SaturdayAtHome/README.md` when behavior changes.
