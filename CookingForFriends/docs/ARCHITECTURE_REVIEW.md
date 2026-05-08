# Architecture Review — CookingForFriends

> Date: 2026-05-08
> Scope: Full-stack architecture review (backend, frontend, infrastructure)
> Stack: FastAPI + SQLAlchemy async / React 18 + Zustand + Vite / PostgreSQL 16 / WebSocket

---

## Issue #1 — No Database Migration Tool

**Severity**: Critical
**Category**: Infrastructure / Data integrity

### Problem

The backend creates all tables via `Base.metadata.create_all()` in `database.py` at startup. There is no Alembic or any other migration framework. With 20+ tables and a complex schema already in place, any model change (adding a column, renaming a field, changing a type) cannot be applied automatically to an existing database.

### Root Cause

The project started with auto-create for rapid prototyping and never transitioned to a managed migration workflow.

### Impact

- Changing any model after collecting real participant data requires manual SQL or data loss.
- No rollback mechanism if a schema change breaks something.
- No audit trail of schema evolution.

### Solution

Introduce Alembic with async support.

### Execution Plan

1. Install `alembic` and add to `requirements.txt`.
2. Run `alembic init -t async alembic` inside `backend/`.
3. Configure `alembic/env.py` to use the existing `DATABASE_URL` and import `Base.metadata`.
4. Generate the initial migration from current models: `alembic revision --autogenerate -m "initial schema"`.
5. Verify the generated migration matches the live database (use `--sql` to inspect).
6. Replace `Base.metadata.create_all()` in `database.py:init_db()` with `alembic upgrade head`.
7. Add a CI check that runs `alembic check` to detect un-generated migrations.
8. Document the workflow in `docs/CONFIGURATION.md`.

---

## Issue #2 — No Frontend Router Library

**Severity**: High
**Category**: Frontend architecture

### Problem

`App.tsx:27-45` uses raw `window.location.pathname` string matching instead of a routing library:

```typescript
if (path.startsWith('/dashboard') || path.startsWith('/admin')) {
    return <AdminDashboard />
}
```

### Root Cause

The participant flow is phase-based (driven by Zustand state, not URL), so a router was never introduced. Admin routes were bolted on as simple path checks.

### Impact

- No code splitting — all 14 page components and admin pages are bundled together.
- No URL parameter parsing, nested routes, or route guards.
- Cannot deep-link to a specific admin participant page reliably.
- Navigation between admin pages requires full page reload.

### Solution

Adopt React Router v6 with lazy-loaded route groups.

### Execution Plan

1. Install `react-router-dom`.
2. Define two route groups in `App.tsx`:
   - `/admin/*` — lazy-loaded admin routes (DashboardPage, ConfigPage, TimelineEditorPage, ParticipantControlPage).
   - `/*` — the `GameShell` component (phase-based, no URL changes needed).
3. Wrap each group in `React.lazy()` + `<Suspense>`.
4. Migrate admin inter-page navigation from `window.location.href` to `<Link>` / `useNavigate()`.
5. Keep the participant flow as-is (phase-driven via Zustand) — no need to URL-ify every phase.
6. Verify admin routes and participant flow both work after migration.

---

## Issue #3 — BlockRuntime Parallel Tasks Have No Joint Error Propagation

**Severity**: High
**Category**: Backend reliability

### Problem

`block_runtime.py:60-103` starts three independent async tasks (timeline, cooking engine, PM session). If one crashes, the others continue running in a broken state:

```python
self.timeline_task = await run_timeline(...)
self.cooking.start(...)
self.pm_task = asyncio.create_task(run_pm_session(...))
```

### Root Cause

Each subsystem was developed independently and composed via simple `create_task` calls without a shared supervision strategy.

### Impact

- If `pm_task` crashes, the game clock keeps running but no PM triggers fire — the experiment data for that participant is silently invalid.
- If `cooking` crashes, timeline and PM continue — participant sees a frozen kitchen with no steps.
- No alert to the admin monitor when a subsystem fails.

### Solution

Use `asyncio.TaskGroup` (Python 3.11+) to supervise all runtime tasks. When any task raises, the group cancels the rest and surfaces the error.

### Execution Plan

1. Refactor `BlockRuntime.start()` to run all three subsystems inside a `TaskGroup`.
2. Wrap the TaskGroup in a top-level try/except that:
   - Logs the failure with participant_id and block_number.
   - Sends a `block_error` event to the participant WebSocket.
   - Broadcasts the error to the admin monitor.
   - Marks the block status as `ERROR` in the database.
3. Add a test that simulates a PM session crash and asserts the timeline and cooking are cancelled.
4. Add a corresponding frontend handler for `block_error` that shows a "contact experimenter" message.

---

## Issue #4 — gameStore Is Too Large (900+ Lines, 100+ Actions)

**Severity**: High
**Category**: Frontend architecture / Maintainability

### Problem

`stores/gameStore.ts` contains all application state in a single Zustand store: session data, room navigation, cooking state, dining state, phone messages, PM pipeline, robot NPC, and WebSocket connection.

### Root Cause

Started as a small store and grew organically as features were added. Zustand makes it easy to add fields without feeling friction.

### Impact

- Any state update (e.g., a phone message arriving) can trigger re-renders in unrelated components (e.g., cooking UI) if selectors are not perfectly scoped.
- Difficult to unit-test one domain (e.g., cooking logic) without mocking the entire store.
- High cognitive overhead — contributors must understand 900 lines of state to add a feature.

### Solution

Split into domain-specific stores.

### Execution Plan

1. Create separate store files:
   - `stores/sessionStore.ts` — sessionId, participantId, condition, phase.
   - `stores/cookingStore.ts` — dishes, activeCookingSteps, cookingScore, activeStation.
   - `stores/phoneStore.ts` — phoneMessages, contacts, activeContactId, phoneBanner.
   - `stores/pmStore.ts` — PM pipeline state, active trial, trigger modal.
   - `stores/roomStore.ts` — currentRoom, previousRoom, avatarMoving.
2. Move corresponding actions and selectors into each store.
3. Update component imports one domain at a time (start with cooking — most isolated).
4. Keep `gameStore.ts` as a thin facade if cross-store coordination is needed (e.g., phase transitions that reset multiple stores).
5. Verify no regressions by testing each phase of the experiment flow manually.

---

## Issue #5 — Session Endpoints Lack Ownership Verification

**Severity**: High
**Category**: Security / Data integrity

### Problem

Session endpoints in `session.py` accept `session_id` as a path parameter but do not verify that the requesting participant owns that session. For example, `/session/{session_id}/phase/advance` can be called by anyone who knows a valid UUID.

### Root Cause

The token-based login at `/session/start` returns a session_id, but subsequent requests have no mechanism to prove the caller is the same participant.

### Impact

- A participant could advance, reset, or submit data for another participant's session.
- In a lab setting where multiple participants share a network, session IDs may be observable.
- Undermines experiment data integrity.

### Solution

Introduce a lightweight session cookie or a per-request token validation.

### Execution Plan

1. After `/session/start` succeeds, return a `session_token` (a signed, short-lived JWT or a random secret stored in the Participant row).
2. Add a FastAPI dependency `verify_session(session_id, session_token)` that checks the token matches the participant.
3. Apply this dependency to all `/session/{session_id}/*` endpoints.
4. Update the frontend `api.ts` to store the session_token and include it as an `Authorization` header in all session-scoped requests.
5. Update the WebSocket handshake to also validate the session_token (either via query param or first message after connect).

---

## Issue #6 — Admin Auth Silently Disabled Without ADMIN_API_KEY

**Severity**: High
**Category**: Security

### Problem

`admin.py:35-39`:

```python
if not ADMIN_API_KEY:
    return  # No key configured — skip auth
```

If the production deployment omits the `ADMIN_API_KEY` environment variable, all admin endpoints (create/reset participants, export all data, monitor sessions) are fully open.

### Root Cause

Development convenience — skip auth when no key is set. No guard to prevent this in production.

### Impact

- Accidental production deployment without the key exposes all experiment data and admin controls.
- No warning or error at startup.

### Solution

Fail fast in production if the key is missing.

### Execution Plan

1. In `config.py`, add a startup check:
   ```python
   if ENVIRONMENT == "production" and not ADMIN_API_KEY:
       raise RuntimeError("ADMIN_API_KEY must be set in production")
   ```
2. Log a warning in development mode when auth is skipped:
   ```python
   logger.warning("ADMIN_API_KEY not set — admin auth disabled (dev mode)")
   ```
3. Add `ADMIN_API_KEY` to the deployment checklist in docs.
4. Consider adding a `/api/health` field that reports whether admin auth is enabled.

---

## Issue #7 — WebSocket Monitor Auth via Query Parameter

**Severity**: Medium
**Category**: Security

### Problem

`main.py:130`:

```python
key = ws.query_params.get("key", "")
```

The admin API key is passed as a URL query parameter for the WebSocket monitor endpoint.

### Root Cause

WebSocket connections cannot use custom HTTP headers in browser-initiated connections, so query params were the quick solution.

### Impact

- The key appears in browser history, server access logs, and potentially in Referer headers if the page links elsewhere.
- Proxy/CDN logs may also capture it.

### Solution

Authenticate via the first WebSocket message after connection, not the URL.

### Execution Plan

1. Accept the WebSocket connection unconditionally (but don't register it yet).
2. Wait for the first message with a 5-second timeout. Expect `{"type": "auth", "key": "..."}`.
3. Validate the key. If invalid or timeout, close with code 4003.
4. If valid, register the connection with `manager.connect_admin(ws)`.
5. Update the frontend admin monitor to send the auth message immediately after `ws.onopen`.

---

## Issue #8 — Cooking Step Events Silently Dropped on Queue Full

**Severity**: High
**Category**: Data integrity / Reliability

### Problem

`connection_manager.py:76-88` — only `pm_trigger`, `block_end`, `pm_received`, and `ongoing_task_event` are treated as critical. All other events (including `cooking_step_active`) use `put_nowait` and are silently dropped if the queue (maxsize=256) is full.

### #

The critical event list was defined for PM-related events and not updated when the cooking engine was added.

### Impact

- If the network is slow or the frontend is processing slowly, cooking steps may never reach the participant.
- Missed cooking steps directly corrupt experiment data (the participant didn't "miss" the step — they never saw it).
- No server-side logging distinguishes "participant missed step" from "event dropped by queue."

### Solution

Expand the critical event list and add drop-event logging.

### Execution Plan

1. Add `cooking_step_active`, `cooking_step_expired`, and `phone_message` to the critical event set in `connection_manager.py`.
2. Add a counter/metric for dropped events per participant, logged at WARN level.
3. Consider increasing `maxsize` from 256 to 1024 — the messages are small JSON payloads.
4. In the admin monitor, surface a warning when events are being dropped for a participant.

---

## Issue #9 — All Runtime State Is In-Memory

**Severity**: Medium
**Category**: Reliability

### Problem

- `game_handler.py:18` — `_block_runtimes` is a process-local dict. A server restart during an active experiment loses all running game sessions.
- `session.py:38` — `_token_attempts` rate limiter resets on restart.
- Timeline positions, cooking engine state, PM scheduler progress — all in memory.

### Root Cause

Single-instance deployment assumption. The experiment runs on one server with one process.

### Impact

- A backend crash or restart during data collection invalidates all active sessions.
- Cannot scale horizontally (not needed now, but limits future use).
- Rate limiter provides no protection across restarts.

### Solution

Accept the single-instance constraint but add safeguards.

### Execution Plan

1. Add a graceful shutdown handler that persists active BlockRuntime state to the database (game clock position, current cooking step, PM pipeline stage).
2. On WebSocket reconnect, restore BlockRuntime from the persisted snapshot instead of relying solely on block `started_at`.
3. Add a periodic `GameStateSnapshot` write (already partially implemented) that captures enough state to resume.
4. Document the "do not restart during active sessions" constraint in the deployment guide.
5. Add a pre-restart check endpoint that returns the count of active sessions so operators know the impact.

---

## Issue #10 — No React Error Boundary

**Severity**: High
**Category**: Frontend reliability

### Problem

There are no `ErrorBoundary` components anywhere in the frontend. Any unhandled rendering error (e.g., accessing a property of `undefined` from a malformed WebSocket message) crashes the entire React tree and shows a white screen.

### Root Cause

Error boundaries are class components in React and are often overlooked in hooks-based codebases.

### Impact

- During an active experiment, a rendering crash means the participant sees a blank page.
- The participant must refresh, which triggers session recovery — but the cooking engine may have advanced, causing data gaps.
- No error report is sent to the backend.

### Solution

Add error boundaries at strategic points and report errors.

### Execution Plan

1. Create a `components/ErrorBoundary.tsx` class component that:
   - Catches rendering errors.
   - Displays a "Something went wrong — please contact the experimenter" message with the participant ID.
   - Sends the error stack to a new `POST /api/session/{id}/client-error` endpoint.
2. Wrap `<GameShell>` in an error boundary (catches all game-phase errors).
3. Wrap `<GamePage>` in a second boundary so non-game phases (consent, debrief) are isolated from game rendering bugs.
4. Wrap each admin page in a boundary so admin crashes don't affect participant UX.
5. Test by temporarily throwing in a component and confirming the boundary catches it.

---

## Issue #11 — No Code Splitting / Lazy Loading

**Severity**: Medium
**Category**: Frontend performance

### Problem

`App.tsx:8-24` synchronously imports all 14 page components and 4 admin components. The entire application (game sprites, admin dashboard, timeline editor, all pages) is in a single JavaScript bundle.

### Root Cause

No `React.lazy()` usage. All imports are static.

### Impact

- Participants download admin code they never use.
- Admin users download all game assets they don't need.
- Larger initial bundle = slower first paint, especially on slower connections.

### Solution

Lazy-load route groups.

### Execution Plan

1. Split imports into three lazy groups:
   - **Admin group**: DashboardPage, ConfigPage, TimelineEditorPage, ParticipantControlPage.
   - **Game group**: GamePage, FloorPlanView (the heaviest components).
   - **Questionnaire group**: PostQuestionnairePage, PostTestFlowPage, DebriefPage.
2. Use `React.lazy(() => import('./pages/admin/DashboardPage'))` for each.
3. Wrap in `<Suspense fallback={<LoadingSpinner />}>`.
4. Verify with `vite build --report` that chunks are properly split.
5. Ensure the loading spinner matches the app's visual style.

---

## Issue #12 — No Frontend Tests

**Severity**: Medium
**Category**: Quality assurance

### Problem

The `frontend/` directory contains no test files. Phase routing logic, Zustand store actions, WebSocket message handlers, and API service functions have zero test coverage.

### Root Cause

Rapid prototyping without test infrastructure setup. The backend has pytest tests for engine logic, but the frontend was not given the same treatment.

### Impact

- Regressions in phase transitions or state management go undetected until manual testing.
- Refactoring (like splitting gameStore) is risky without tests as a safety net.

### Solution

Add targeted tests for the most critical logic.

### Execution Plan

1. Install `vitest` and `@testing-library/react` (Vite-native test runner).
2. Configure `vitest.config.ts` with jsdom environment.
3. Write tests for the highest-value targets first:
   - `utils/phase.ts` — `renderPhaseFor()` and `frontendPhaseForBackend()` mapping (pure functions, easy to test).
   - `stores/gameStore.ts` — key actions like `setSession`, `addPhoneMessage`, PM pipeline transitions.
   - `services/api.ts` — mock fetch and verify request/response handling.
   - `utils/waypointGraph.ts` — BFS pathfinding (pure function).
4. Add a `test` script to `package.json` and run in CI.

---

## Issue #13 — Pydantic Schemas Accept Free-Form Strings for Enums

**Severity**: Low
**Category**: Backend data validation

### Problem

In `models/schemas.py`, fields like `phase_name` are typed as `str` rather than `Literal` or `Enum`. Typos in phase names (e.g., `"MAIN_EXPERIEMNT"`) are silently accepted and stored.

### Root Cause

Schemas were written generically to accommodate evolving phase names during development.

### Impact

- Invalid phase names can be stored in the database, corrupting experiment data.
- No compile-time or runtime warning when a typo is introduced.

### Solution

Use `Literal` types or Enums in Pydantic schemas.

### Execution Plan

1. Define a `PhaseNameEnum` (or `Literal` union) that mirrors the backend `phase_state.py` phase list.
2. Update `PhaseAdvanceRequest`, `ExperimentResponsesSubmitRequest`, and other schemas that accept `phase_name` to use the enum.
3. Add the same enum to `PhaseEvent.phase_name` column as a check constraint.
4. Test that invalid phase names return 422 from the API.

---

## Issue #14 — Admin Export Endpoints Load All Data Into Memory

**Severity**: Medium
**Category**: Backend performance

### Problem

`admin.py` export endpoints (`/export/full`, `/export/per-participant`, `/export/aggregated`) query all rows into memory, build CSV/ZIP in memory, then return the response.

### Root Cause

Simple implementation for a small number of participants. No streaming was needed initially.

### Impact

- With many participants and dense event logs (mouse tracking, interaction logs), memory usage spikes.
- Large exports may timeout or OOM the server process.

### Solution

Stream the response and add optional filters.

### Execution Plan

1. Add optional query parameters: `participant_ids`, `from_date`, `to_date`.
2. For CSV exports, use `StreamingResponse` with a generator that yields rows.
3. For ZIP exports, use `zipfile` in streaming mode with `StreamingResponse`.
4. Add a memory estimate warning in the admin UI for large exports.

---

## Issue #15 — Docker Compose Only Has Database — No Backend/Frontend Containers

**Severity**: Low
**Category**: Infrastructure / Deployment

### Problem

`docker-compose.yml` only defines the PostgreSQL service. The backend and frontend must be started manually outside Docker.

### Root Cause

Development workflow uses direct `uvicorn` and `vite dev` for hot-reload convenience.

### Impact

- No reproducible one-command deployment.
- Production deployment requires manual setup (install Python, Node, configure services).
- New contributors must follow multiple manual steps to get running.

### Solution

Add backend and frontend services to docker-compose.

### Execution Plan

1. Create `backend/Dockerfile`:
   - Base: `python:3.12-slim`.
   - Install requirements, copy source.
   - CMD: `uvicorn main:app --host 0.0.0.0 --port 5000`.
2. Create `frontend/Dockerfile`:
   - Stage 1: `node:20-alpine`, `npm ci && npm run build`.
   - Stage 2: Copy `dist/` to nginx or serve via backend static mount.
3. Update `docker-compose.yml`:
   - Add `backend` service (depends_on: db, healthcheck).
   - Add `frontend` service (or serve from backend).
   - Add networking between services.
4. Add a `docker-compose.dev.yml` override for development (volume mounts, hot reload).
5. Update README with `docker compose up` as the single startup command.

---

## Issue #16 — No Dependency Lock File (Backend)

**Severity**: Low
**Category**: Reproducibility

### Problem

`backend/requirements.txt` specifies minimum versions (`>=`) but has no lock file (`requirements.lock` or `poetry.lock`). Different installs at different times get different dependency versions.

### Root Cause

Standard `pip install -r requirements.txt` workflow without pinning.

### Impact

- A new dependency release could break the build without any code change.
- Cannot reproduce the exact environment from a previous deployment.

### Solution

Pin exact versions.

### Execution Plan

1. Install `pip-tools`: `pip install pip-tools`.
2. Rename current `requirements.txt` to `requirements.in` (source of truth with `>=` constraints).
3. Run `pip-compile requirements.in -o requirements.txt` to generate pinned versions.
4. Commit both files. Use `pip-sync requirements.txt` for installs.
5. Document the update workflow: edit `.in`, run `pip-compile`, commit both.

---

## Issue #17 — Token Exposed in URL Query Parameter

**Severity**: Low
**Category**: Security

### Problem

`App.tsx:81`:

```typescript
const urlToken = new URLSearchParams(window.location.search).get('token')
```

The 6-character participant token is passed as a URL query parameter (`?token=ABC123`).

### Root Cause

Convenient for the experimenter to share links with participants.

### Impact

- Token appears in browser history, autocomplete suggestions, and potentially Referer headers.
- In a shared-computer lab setting, subsequent users could see previous tokens.

### Solution

Clear the token from the URL after reading it.

### Execution Plan

1. After reading the token from the URL in `App.tsx`, immediately replace the URL:
   ```typescript
   window.history.replaceState({}, '', window.location.pathname)
   ```
2. This preserves the current page but removes the query string from history.
3. The token is already stored in `sessionStorage`, so it remains available for session recovery.

---

## Issue #18 — No Global Request Timeout Middleware

**Severity**: Low
**Category**: Backend reliability

### Problem

There is no global timeout for HTTP request handling. A slow database query or a deadlocked async operation can hang a request indefinitely.

### Root Cause

FastAPI does not include a default request timeout. It was never explicitly added.

### Impact

- Hung requests consume server resources (connection pool slots, memory).
- Graceful shutdown may wait indefinitely for hung requests.

### Solution

Add a timeout middleware.

### Execution Plan

1. Create a simple ASGI middleware that wraps each request in `asyncio.wait_for(timeout=30)`.
2. On timeout, return HTTP 504 Gateway Timeout.
3. Exclude WebSocket endpoints from the middleware (they are long-lived by design).
4. Add the middleware in `main.py` before CORS middleware.

---

## Priority Matrix

| Priority                               | Issues                                                                                                  | Timing            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------- |
| **P0 — Before data collection** | #1 (Alembic), #5 (session auth), #6 (admin auth guard), #8 (cooking events critical)                    | This week         |
| **P1 — Before pilot study**     | #3 (TaskGroup), #10 (Error Boundary), #9 (state persistence), #17 (clear token from URL)                | Next week         |
| **P2 — Before scaling**         | ~~#2 (React Router)~~, ~~#11 (code splitting)~~, ~~#14 (export filter)~~, #4 (split gameStore — deferred) | Before full study |
| **P3 — Nice to have**           | #7 (WS auth), #12 (frontend tests), #13 (enum validation), #15 (Docker), #16 (lock file), #18 (timeout) | Ongoing           |

---

## Changelog

### 2026-05-08 — P0 fixes completed

**Issue #6 — Admin auth guard** `DONE`

- `config.py:99-103` already had the production guard (raises RuntimeError). Pre-existing.
- Added: warning log in `admin.py:verify_admin()` when auth is skipped in dev mode.
- Commit: `126b419`

**Issue #8 — Cooking step events critical** `DONE`

- Cooking steps already go through `ongoing_task_event` which was already in the critical set.
- Added `phone_message` and `phone_contacts` to the critical event set — these were the actually missing ones.
- Commit: `fbaada3`

**Issue #5 — Session ownership verification** `DONE`

- Backend: added `verify_session_owner` dependency in `session.py` — checks `X-Session-Token` header matches the session's participant token. Applied to all 14 `/session/{session_id}/*` endpoints.
- Frontend: `api.ts` stores the token and sends it as `X-Session-Token` header on every request. Set on login (`WelcomePage.tsx`) and restored on session recovery (`App.tsx`).
- Commit: `a992d64`

**Issue #1 — Alembic**: Deferred. Current `create_all` + `_patch_pm_schema` approach is adequate if schema is frozen before data collection. See discussion in review conversation.

### 2026-05-08 — P1 fixes completed

**Issue #17 — Clear token from URL** `DONE`

- `App.tsx`: after reading `?token=XXX`, immediately call `window.history.replaceState` to remove it from URL/history.
- Commit: `49b5feb`

**Issue #10 — React Error Boundary** `DONE`

- Created `components/ErrorBoundary.tsx` — class component that catches render errors, shows participant ID, error message, and reload button.
- Wrapped all admin pages and `GameShell` in `ErrorBoundary`.
- Commit: `fcbd31b`

**Issue #3 — BlockRuntime supervisor** `DONE`

- Backend: added `_supervise()` coroutine to `BlockRuntime` — uses `asyncio.wait(FIRST_EXCEPTION)` to monitor timeline, cooking, and PM tasks. On crash: logs error, sends `block_error` WS event, stops remaining subsystems.
- Frontend: added `blockError` state to gameStore, `block_error` handler in useWebSocket, error screen in GamePage.
- Commit: `b249898`

**Issue #9 — State persistence**: Deferred. Single-instance constraint documented; GameStateSnapshot periodic writes already partially cover this.

### 2026-05-08 — P2 fixes completed

**Issue #11 — Code splitting (React.lazy)** `DONE`

- Converted all admin pages (`DashboardPage`, `ConfigPage`, `TimelineEditorPage`, `ParticipantControlPage`) and heavy game pages (`EncodingFlowPage`, `TutorialFlowPage`, `EveningTransitionPage`, `GamePage`, `PostQuestionnairePage`, `PostTestFlowPage`, `DebriefPage`) to `React.lazy` imports with `Suspense` fallback.
- Early-phase pages remain statically imported (lightweight, needed immediately).
- Commit: `8e202ae`

**Issue #14 — Export participant filter** `DONE`

- Added `participant_ids` query parameter to all three export endpoints (`/export/full`, `/export/per-participant`, `/export/aggregated`).
- Extracted `_apply_participant_filters` helper to deduplicate filtering logic.
- Commit: `e623fb8`

**Issue #2 — React Router v6** `DONE`

- Installed `react-router-dom`. Rewrote `App.tsx` to use `BrowserRouter` / `Routes` / `Route` with dedicated admin routes and a catch-all `GameShell` for the experiment flow.
- Replaced all `window.location.href` and raw `<a href>` in admin pages with `useNavigate()` / `<Link>` for client-side SPA navigation.
- Commit: `3e080ce`

**Issue #4 — Split gameStore**: Deferred. Too large/risky for thesis timeline; current monolithic store works correctly.

---

## TODO: Edge Case Testing (Pre-Pilot)

The BlockRuntime supervisor (#3) now catches subsystem crashes, but the underlying edge cases that could cause crashes have not been stress-tested. Priority scenarios to test before pilot:

1. **DB connection pool exhaustion** — Multiple participants online simultaneously; `db.execute()` may fail if the pool (size=20, overflow=30) is full.
2. **WebSocket disconnect during PM pipeline** — Participant disconnects mid-trigger; `send_fn` writes to a closed connection.
3. **Reconnect timing** — Participant disconnects and reconnects at the exact moment a PM trigger fires or a cooking step expires.
4. **Runtime plan edge cases** — Missing or malformed fields in runtime plan JSON causing mid-session `KeyError`/`None` access.
5. **Game clock pause/resume race** — `CancelledError` not propagated correctly when freezing/unfreezing game time during PM pipeline.

These are low-probability but data-destroying scenarios. The supervisor ensures they are surfaced rather than silently corrupting experiment data.
