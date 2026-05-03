# Experiment Materials Architecture (0503)

## Goal

Experiment-facing text and task materials must have one backend-authoritative
source. Frontend components render phase-scoped material returned by the backend;
they should not define PM task order, EC reminder variants, manipulation-check
answers, or questionnaire answer keys.

## Source Files

Materials live under:

```text
CookingForFriends/backend/data/experiment_materials/
  static_text.json
  questionnaires.json
  pm_tasks.json
  counterbalancing.json
  encoding_materials.json
  tutorial_materials.json
```

`CookingForFriends/backend/data/materials.py` is the loader and sanitization
layer. Runtime code should import through this module instead of reading the JSON
files directly.

## File Boundaries

- `static_text.json`: phase text that does not depend on EC condition or latin
  square order, including welcome, consent metadata, story intro, recap framing,
  evening transition, debrief, and connection-failure text.
- `questionnaires.json`: demographics, MSE placeholders, post-test questions,
  NASA-TLX placeholder, and retrospective-check schema. Correct answers must
  stay server-side.
- `pm_tasks.json`: PM task master definitions keyed by `task_id`: person,
  trigger type, target item, assign text, recap text, greeting lines,
  condition-specific reminders, and decoy items.
- `counterbalancing.json`: EC conditions, latin-square task orders, trigger
  schedule, and session-end delay.
- `encoding_materials.json`: encoding episode assets and manipulation-check
  questions keyed by `task_id`. This file may contain `correct_option_id`, but
  that field must never be returned to participant-facing frontend calls.
- `tutorial_materials.json`: tutorial phone, cooking, and trigger demo content.
  Correct option ids remain backend-side.

## Runtime API

Use:

```text
GET /api/session/{session_id}/experiment-config?phase=<PHASE>
```

If `phase` is omitted, the participant's current backend phase is used.

The endpoint returns only the material needed for that phase. It strips:

- `correct_option_id`
- `correct_index`
- `correct_answer`

It also returns only the current participant's EC reminder text, not both EC+
and EC- variants.

## Ordering Rules

Latin-square order is resolved server-side:

```text
task_id = counterbalancing.task_orders[participant.task_order][position - 1]
```

The same resolved `task_id` is used for:

- encoding video
- manipulation check
- assign popup
- recap line
- real PM trigger

Frontend code should not maintain a duplicate `TASK_ORDERS` constant.

## Consent PDF

The consent PDF is stored at:

```text
CookingForFriends/documents/Informed_Consent_no_HREC.pdf
```

The backend serves `CookingForFriends/documents/` at `/documents`, so the
participant-facing PDF URL is:

```text
/documents/Informed_Consent_no_HREC.pdf
```

