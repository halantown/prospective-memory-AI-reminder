# Runtime Plan and Timeline Engine

CookingForFriends now uses one editable runtime plan for gameplay schedule data:

`backend/data/runtime_plans/main_experiment.json`

The plan owns four schedule lanes:

| Lane | Purpose | Runtime owner |
|------|---------|---------------|
| `pm_schedule` | Real/fake PM trigger delays, measured in unfrozen game time after the previous PM pipeline | `engine/pm_session.py` |
| `cooking_schedule` | Absolute game-time cooking step activations | `engine/cooking_engine.py` |
| `robot_idle_comments` | Absolute game-time non-interactive robot comments | `engine/cooking_engine.py` |
| `phone_messages` | Absolute game-time phone message deliveries by message id | `engine/timeline.py` |

Content remains in the material files:

- PM task content: `backend/data/experiment_materials/pm_tasks.json`
- Counterbalancing/task orders: `backend/data/experiment_materials/counterbalancing.json`
- Phone message text/choices: `backend/data/messages/messages_day1.json`
- Cooking recipes/options: `backend/data/cooking_recipes.py`

## Runtime Flow

`BlockRuntime` loads the runtime plan once when gameplay starts, then passes the relevant lane to each runtime owner:

```text
runtime plan
  -> TimelineEngine: block_start, phone_message, block_end, time_tick
  -> CookingEngine: cooking_schedule, robot_idle_comments
  -> PMSession: pm_schedule, session_end_delay_after_last_trigger_s
```

All three runtime owners share the same `GameClock`, so PM pipeline freezes pause cooking, phone delivery, and game-clock ticks consistently.

## Admin Editing

The admin route `/timeline-editor` edits the active runtime plan. The backend endpoints are:

- `GET /api/admin/timelines/runtime-plan`
- `PUT /api/admin/timelines/runtime-plan`
- `POST /api/admin/timelines/preview`
- `GET /api/admin/timelines/schema`

Saves are validated before writing. Validation checks PM trigger shape, cooking dish/step indices, phone message ids, required robot comment fields, and schedule bounds.

## Removed Legacy Paths

The old generated/static timeline system has been removed:

- `engine/timeline_generator.py`
- `backend/data/timelines/block_default.json`
- legacy `CONTROL` / `AF` / `AFCB` timeline generation
- legacy PM task shim constants such as `BLOCK_TRIGGER_ORDER` and `BLOCK_TRIGGER_TIMES`

`engine/timeline.py` no longer schedules PM triggers or cooking steps. It only handles phone delivery, time ticks, and block lifecycle events from the runtime plan.
