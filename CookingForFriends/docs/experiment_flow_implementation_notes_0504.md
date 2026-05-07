# Experiment Flow Implementation Notes (0504)

This note records the current implementation decisions for the 0503 full-flow
experiment work. It is intended as the maintenance reference for phase naming,
material loading, admin testing, and the training/encoding runtime.

## Phase Naming: Canonical vs Legacy

Use **canonical** phase names for backend state, database records, API payloads,
phase history, and frontend store state.

Canonical means the authoritative, standard representation owned by the current
experiment state machine. Examples:

```text
WELCOME
CONSENT
STORY_INTRO
ENCODING_VIDEO_1
MANIP_CHECK_1
ASSIGN_1
TUTORIAL_PHONE
TUTORIAL_COOKING
MAIN_EXPERIMENT
DEBRIEF
COMPLETED
```

Use **legacy** phase names only for backward compatibility with older frontend
routes or old stored sessions. Legacy means an older representation that may
still appear in historical code/data but should not be introduced in new code.
Examples:

```text
welcome
consent
encoding
playing
post_questionnaire
debrief
```

Current rule:

- Store and send canonical phases (`WELCOME`, `ENCODING_VIDEO_1`, etc.).
- Render pages by mapping canonical phases to render groups only at the React
  routing boundary.
- Do not send render aliases such as `encoding_flow`, `tutorial_flow`, or
  `post_test` back to the backend.

Relevant file:

```text
CookingForFriends/frontend/src/utils/phase.ts
```

`frontendPhaseForBackend()` preserves canonical backend phase values.  
`renderPhaseFor()` maps canonical/legacy values to React render groups.

## Centralized Experiment Materials

Experiment materials are backend-authoritative and live in:

```text
CookingForFriends/backend/data/experiment_materials/
```

Important boundaries:

- `static_text.json`: condition-independent text such as welcome, debrief,
  story intro, evening transition, and connection messages.
- `questionnaires.json`: demographics, MSE, post-test, NASA-TLX, and
  retrospective-check schemas.
- `pm_tasks.json`: PM task master definitions, including assign text, recap
  text, EE1 / EE0 reminder variants, trigger metadata, and decoy items.
- `encoding_materials.json`: video asset references and manipulation-check
  questions keyed by `task_id`.
- `tutorial_materials.json`: phone practice, fried egg practice, and trial
  visitor content.
- `counterbalancing.json`: EC condition values, latin-square orders, and timing
  configuration.

Participant-facing frontend calls must request phase-scoped materials:

```text
GET /api/session/{session_id}/experiment-config?phase=<CANONICAL_PHASE>
```

Correct answers such as manipulation-check `correct_option_id` stay backend-side
and are stripped from participant-facing responses.

## Welcome Page

The welcome copy is synchronously available in the frontend so the page does not
render an empty text area while waiting for the backend material request.

The same copy is still loaded from backend materials and can override the local
defaults after the request resolves. This avoids visible text flicker while
keeping the backend material file authoritative for production copy.

Relevant file:

```text
CookingForFriends/frontend/src/pages/game/WelcomePage.tsx
```

## Admin Test Mode

Admin Test Mode creates a backend test session with a selected condition, latin
square order, and start phase.

Current behavior:

- The admin button copies the generated token.
- It opens the bare participant page (`/`) without `?token=...`.
- The experimenter manually enters the copied token.

Reason: opening `/?token=...` auto-starts the participant flow before DevTools
can be opened. Manual token entry is the desired debugging workflow.

Relevant file:

```text
CookingForFriends/frontend/src/pages/admin/DashboardPage.tsx
```

## Encoding Runtime

Story intro and encoding phases now render inside the home/game interface rather
than a blank standalone page.

Current behavior:

- Scene starts in the bedroom.
- Avatar and robot are initialized in the bedroom.
- Navigation is disabled during story/encoding.
- Video assets may still be placeholders, but phase transitions continue through
  `ENCODING_VIDEO_n -> MANIP_CHECK_n -> ASSIGN_n -> RECAP`.

Relevant files:

```text
CookingForFriends/frontend/src/components/game/ExperimentHomeShell.tsx
CookingForFriends/frontend/src/components/game/FloorPlanView.tsx
CookingForFriends/frontend/src/pages/game/StoryIntroPage.tsx
CookingForFriends/frontend/src/pages/game/EncodingFlowPage.tsx
```

## Training / Trial Runtime

Training and trial phases are separate from the formal evening main experiment
runtime. They use the same visual components where useful, but their scripted
state is owned by `TrainingHomeShell`.

Current behavior:

- Training clock starts in the morning and advances by scripted phase.
- `TUTORIAL_PHONE`: participant remains in bedroom and answers the practice
  message inside the phone UI.
- `TUTORIAL_COOKING`: participant starts in bedroom, the kitchen navigation
  target is highlighted, phone recipe tab is available, and kitchen stations
  are used for fried egg practice.
- `TUTORIAL_TRIGGER`: participant sees a visitor sprite placeholder and bubble
  dialogue for the simplified trigger demo.
- `EVENING_TRANSITION`: black transition screen waits briefly, then shows a
  `Continue` button instead of auto-advancing immediately.
- Entering `MAIN_EXPERIMENT` resets the global clock/phone state to evening
  defaults so morning training state does not leak into the formal session.

Relevant files:

```text
CookingForFriends/frontend/src/components/game/TrainingHomeShell.tsx
CookingForFriends/frontend/src/pages/game/TutorialFlowPage.tsx
CookingForFriends/frontend/src/pages/game/EveningTransitionPage.tsx
CookingForFriends/frontend/src/pages/game/GamePage.tsx
```

## Response Storage and Export

Questionnaire and task responses are stored as normalized response records with:

```text
phase
question_id
response_type
value
timestamp
metadata
```

This keeps fixed demographics, scale values, open text, manipulation checks, and
trial responses exportable through one table. Phase history and responses are
included in admin export.

Manipulation checks are recorded and evaluated server-side. Wrong answers mark
the participant for exclusion but do not replay the encoding material and do not
show correctness feedback to the participant.

## Recent Meaningful Changes

Implemented during the 0503/0504 full-flow work:

- Centralized experiment materials under backend JSON files.
- Added phase-scoped experiment config API that strips answer keys.
- Added canonical backend phase state machine and phase history logging.
- Added participant response schema and response submission endpoints.
- Added consent PDF viewer path using
  `CookingForFriends/documents/Informed_Consent_no_HREC.pdf`.
- Implemented consent, demographics, MSE pre, story intro, encoding, tutorial,
  evening transition, post-test, debrief, and completed flow pages.
- Added reusable `BubbleDialogue` for galgame-style dialogue.
- Changed PM trigger flow from a full-screen popup to in-game bubble/dialogue
  panels.
- Added admin export of phase history and normalized responses.
- Fixed admin test-session start phase handling.
- Fixed admin test entry to copy token and open a manual login page.
- Fixed frontend phase aliasing so canonical backend phases are preserved.
- Added training shell for scripted morning room/time/phone state.
- Integrated phone practice with the phone UI.
- Integrated cooking practice with the recipe tab and kitchen station UI.
- Reset formal main experiment time/phone state on entry to prevent training
  state leakage.
- Rendered welcome copy immediately to avoid visible async loading delay.

## Known Remaining Work

- Replace encoding video placeholders with approved assets.
- Replace trial visitor placeholder sprite with the experimenter's drawn visitor
  asset.
- Add regression tests for phase preservation and admin test entry URL behavior.
- Decide whether training cooking should use a dedicated fried-egg dish id or
  continue mapping to the existing dish model for UI reuse.
