# Data Dictionary

> Field definitions for all CSV files in the full experiment export (`/admin/export/full`).
>
> Timestamps are Unix epoch (seconds) unless noted. All files include `participant_id` and `session_id` as the first two columns.

---

## pm_events.csv

One row per PM trigger (real or fake). Core dependent variables for the prospective memory experiment.

| Column | Type | Description |
|--------|------|-------------|
| participant_id | string | Experimenter-assigned participant ID |
| session_id | string(36) | Internal session UUID |
| task_id | string | Task identifier (T1–T4); empty for fake triggers |
| position_in_order | int | 1–4 position in participant's Latin-square task order; empty for fakes |
| trigger_type | string | "doorbell" or "phone_call" |
| is_fake | bool | True = fake trigger (no PM task); False = real trigger |
| condition | string | "EE0" (no episodic context) or "EE1" (episodic context) |
| trigger_fired_at | float | Game-time (seconds) when trigger fired |
| trigger_responded_at | float | Wall timestamp when participant acknowledged greeting |
| trigger_timed_out | bool | True if participant did not respond within timeout |
| reminder_shown_at | float | Wall timestamp when reminder text appeared |
| reminder_dismissed_at | float | Wall timestamp when participant dismissed reminder |
| item_options_order | JSON array | Ordered list of item option IDs as shown (shuffled); e.g. `["intra2","target","intra1"]` |
| item_selected | string | ID of the option the participant chose ("target", "intra1", or "intra2") |
| item_correct | bool | True if selected option was the target item |
| item_response_time_s | float | Seconds from item options display to selection |
| confidence_rating | int | 1–7 Likert scale confidence rating |
| confidence_response_time_s | float | Seconds from confidence prompt to rating click |
| auto_execute_started_at | float | Wall timestamp when auto-execute animation began |
| auto_execute_finished_at | float | Wall timestamp when auto-execute animation completed |
| pm_trigger_fired_timestamp | float | Wall timestamp: trigger WS event sent to client |
| pm_freeze_started_timestamp | float | Wall timestamp: game clock frozen for PM pipeline |
| pm_navigation_started_timestamp | float | Wall timestamp: participant navigated to trigger location |
| pm_reminder_shown_timestamp | float | Wall timestamp: reminder step mounted in UI |
| pm_reminder_ack_timestamp | float | Wall timestamp: reminder acknowledged by participant |
| pm_item_options_shown_timestamp | float | Wall timestamp: item selection step mounted in UI |
| pm_item_selected_timestamp | float | Wall timestamp: item option clicked |
| pm_confidence_rated_timestamp | float | Wall timestamp: confidence rating submitted |
| pm_auto_execute_done_timestamp | float | Wall timestamp: auto-execute animation finished |
| pm_resume_timestamp | float | Wall timestamp: game clock unfrozen, normal play resumed |
| post_pm_first_action_timestamp | float | Wall timestamp: first interaction after PM pipeline completed |

**Fake trigger rows:** `task_id`, `position_in_order`, `reminder_*`, `item_*`, `confidence_*`, `auto_execute_*` fields are empty. Only `trigger_fired_at`, `trigger_responded_at`, `trigger_timed_out`, and select `pm_*` timestamps are populated.

**Thesis variables:**
- PM hit rate = proportion of `item_correct == True` for real triggers, by condition
- PM response time = `item_response_time_s` for correct trials
- Confidence calibration = `confidence_rating` vs `item_correct`
- EE manipulation = compare EE0 vs EE1 on hit rate and RT

---

## cooking_steps.csv

One row per cooking step activation. Ongoing-task performance.

| Column | Type | Description |
|--------|------|-------------|
| participant_id | string | Experimenter-assigned participant ID |
| session_id | string(36) | Internal session UUID |
| step_id | string | Step identifier (e.g. "boil_water", "flip_steak") |
| dish_id | string | Dish identifier (e.g. "spaghetti", "steak", "tomato_soup", "roasted_vegetables") |
| step_index | int | 0-based index within dish's step sequence |
| step_type | string | Always "active" (only active steps produce records) |
| activated_at | float | Wall timestamp when step became active |
| completed_at | float | Wall timestamp when participant acted or step timed out; null if still active |
| status | string | "correct", "wrong", or "missed" (timeout) |
| response_time_ms | int | Milliseconds from activation to action (game time, excludes PM pauses) |
| station | string | Kitchen station identifier (e.g. "burner1", "cutting_board", "oven") |
| chosen_option | string | Text of the option the participant selected; null if missed |
| correct_option | string | Text of the correct option |

**Thesis variables:**
- Ongoing-task accuracy = proportion of `status == "correct"`
- Ongoing-task RT = `response_time_ms` for correct/wrong trials
- Cost of PM on ongoing task = compare cooking accuracy during PM-active blocks vs baseline

---

## cooking_dish_scores.csv

One row per dish per block. Aggregate cooking performance.

| Column | Type | Description |
|--------|------|-------------|
| participant_id | string | Experimenter-assigned participant ID |
| session_id | string(36) | Internal session UUID |
| dish_id | string | Dish identifier |
| total_steps | int | Total number of active steps in this dish |
| steps_correct | int | Count of correctly answered steps |
| steps_wrong | int | Count of incorrectly answered steps |
| steps_missed | int | Count of timed-out steps |
| started_at | float | Wall timestamp of first step activation |
| completed_at | float | Wall timestamp of last step completion |
| total_response_time_ms | int | Sum of all step response times (ms) |

---

## phone_messages.csv

One row per phone message delivered. Chat-task (secondary ongoing task) performance.

| Column | Type | Description |
|--------|------|-------------|
| participant_id | string | Experimenter-assigned participant ID |
| session_id | string(36) | Internal session UUID |
| message_id | string | Message identifier from message pool (e.g. "q_001") |
| sender | string | Contact who sent the message |
| category | string | "chat" (requires response) or "notification" (informational) |
| arrived_at | float | Wall timestamp when message was delivered |
| read_at | float | Wall timestamp when participant opened/read the message |
| responded_at | float | Wall timestamp when participant submitted a response, or when message expired (status="missed") |
| response_time_ms | int | Milliseconds from delivery to response |
| user_choice | string | Text of the answer option the participant selected |
| correct_answer | string | Text of the correct answer option |
| is_correct | bool | True if participant selected the correct answer |
| status | string | "delivered", "read", "answered_correct", "answered_incorrect", or "missed" (reply window expired) |
| correct_position_shown | int | 0 or 1 — position index where the correct answer was displayed (randomized) |

---

## cutscene_events.csv

One row per encoding-episode cutscene segment. Records viewing behavior during PM task encoding.

| Column | Type | Description |
|--------|------|-------------|
| participant_id | string | Experimenter-assigned participant ID |
| session_id | string(36) | Internal session UUID |
| task_id | string | PM task being encoded (T1–T4) |
| segment_number | int | 1-based cutscene segment index (typically 1–4) |
| display_time | float | Wall timestamp when segment appeared |
| dismiss_time | float | Wall timestamp when participant dismissed segment |
| detailcheck_question | string | Comprehension check question text (if present for this segment) |
| detailcheck_answer | string | Participant's answer to the detail check |
| detailcheck_correct | bool | True if detail-check answer was correct |

---

## intention_checks.csv

One row per post-encoding intention check. Verifies participant understood the PM task.

| Column | Type | Description |
|--------|------|-------------|
| participant_id | string | Experimenter-assigned participant ID |
| session_id | string(36) | Internal session UUID |
| task_id | string | PM task checked (T1–T4) |
| position | int | 1–4 position in Latin-square task order |
| selected_option_index | int | Index of the option the participant selected |
| correct_option_index | int | Index of the correct option |
| response_time_ms | int | Milliseconds from question display to answer |

---

## robot_idle_comments.csv

One row per robot idle comment shown. Non-interactive ambient dialogue.

| Column | Type | Description |
|--------|------|-------------|
| participant_id | string | Experimenter-assigned participant ID |
| session_id | string(36) | Internal session UUID |
| comment_id | string | Comment identifier |
| text | string | Comment text displayed |
| shown_at | float | Wall timestamp when comment appeared |

---

## robot_proactive_prompts.csv

One row per robot proactive prompt triggered by consecutive cooking errors. The robot speaks a supportive comment pointing the participant to the recipe.

| Column | Type | Description |
|--------|------|-------------|
| participant_id | string | Experimenter-assigned participant ID |
| session_id | string(36) | Internal session UUID |
| trigger_reason | string | Reason for trigger (currently always "consecutive_errors") |
| error_count | int | Number of consecutive errors when triggered (threshold: 3) |
| comment_text | string | The supportive comment displayed in the robot speech bubble |
| game_time | float | Game-time (seconds) when the prompt was shown |
| shown_at | float | Wall timestamp when prompt appeared |

---

## phase_history.csv

One row per experiment phase transition. Tracks progression through the experiment.

| Column | Type | Description |
|--------|------|-------------|
| participant_id | string | Experimenter-assigned participant ID |
| session_id | string(36) | Internal session UUID |
| phase | string | Phase name (e.g. "TOKEN_INPUT", "WELCOME", "ASSIGN_1", "MAIN_EXPERIMENT", "POST_MANIP_CHECK", "COMPLETED") |
| entered_at | float | Wall timestamp when phase was entered |
| exited_at | float | Wall timestamp when phase was exited; null if current phase |

---

## experiment_responses.csv

One row per questionnaire/survey response. Covers all non-game response data.

| Column | Type | Description |
|--------|------|-------------|
| participant_id | string | Experimenter-assigned participant ID |
| session_id | string(36) | Internal session UUID |
| phase | string | Experiment phase when response was collected |
| question_id | string | Question identifier |
| response_type | string | Response format (e.g. "likert", "text", "multiple_choice") |
| value_json | JSON | Response value (structure depends on response_type) |
| timestamp | float | Wall timestamp of response submission |
| metadata_json | JSON | Additional metadata (e.g. display order, page number) |

---

## room_navigation.csv

One row per room switch. Derived from interaction logs.

| Column | Type | Description |
|--------|------|-------------|
| participant_id | string | Experimenter-assigned participant ID |
| session_id | string(36) | Internal session UUID |
| from_room | string | Room the participant left |
| to_room | string | Room the participant entered |
| navigated_at | float | Wall timestamp of room switch |

---

## recipe_views.csv

One row per recipe viewer open/close. Derived from interaction logs.

| Column | Type | Description |
|--------|------|-------------|
| participant_id | string | Experimenter-assigned participant ID |
| session_id | string(36) | Internal session UUID |
| opened_at | float | Wall timestamp when recipe viewer was opened |
| closed_at | float | Wall timestamp when recipe viewer was closed |
| duration_ms | int | Milliseconds the recipe viewer was open |

---

## interaction_logs.csv

One row per raw interaction event. Contains all frontend-reported interactions as JSON.

| Column | Type | Description |
|--------|------|-------------|
| participant_id | string | Experimenter-assigned participant ID |
| session_id | string(36) | Internal session UUID |
| event_type | string | Event type (e.g. "room_switch", "phone_unlock", "cooking_action", "recipe_view", "phone_tab_switch") |
| timestamp | float | Wall timestamp of event |
| room | string | Room context (if applicable) |
| event_data_json | JSON | Full event payload as JSON |

---

## event_log.csv

Unified chronological event log. Combines PM, cooking, phone, and interaction events into a single timeline.

| Column | Type | Description |
|--------|------|-------------|
| participant_id | string | Experimenter-assigned participant ID |
| session_id | string(36) | Internal session UUID |
| timestamp | float | Wall timestamp |
| source | string | Event source: "pm", "cooking", "phone", "interaction" |
| event_type | string | Specific event within source (e.g. "pm_trigger_fired", "step_completed", "message_arrived") |
| event_data_json | JSON | Event-specific payload as JSON |

---

## mouse_tracking/{participant}_{session}.json

One JSON file per participant. Raw mouse/touch tracking data.

```json
{
  "participant_id": "string",
  "session_id": "string",
  "records": [
    {
      "x": 0,
      "y": 0,
      "t": 1234567890.123
    }
  ]
}
```

---

## Common field notes

- **participant_id vs session_id:** `participant_id` is the human-readable ID assigned by the experimenter. `session_id` is the internal UUID used as the database primary key.
- **Wall timestamps** are Unix epoch seconds (e.g. `1716800000.123`). They reflect real clock time.
- **Game-time values** (e.g. `trigger_fired_at` in pm_events) are seconds elapsed since the game block started, excluding any PM-pause intervals.
- **response_time_ms** in cooking steps uses game time (excludes PM pauses). Phone message `response_time_ms` uses wall time (from delivery to reply).
