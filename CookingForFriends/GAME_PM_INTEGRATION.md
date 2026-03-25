# PM Task Integration — Game Development Guide

> **Version**: 1.0 | **Date**: 2026-03-23 | **Status**: Ready for implementation
> **Context**: Cooking for Friends experiment platform (React 18 + FastAPI + WebSocket)

---

## 1. Overview

This document specifies how to integrate 12 prospective memory (PM) tasks into the existing game platform. Each PM task follows a fixed cognitive pipeline:

```
Encoding (pre-block) → Ongoing task absorbs attention → Trigger fires →
  [Optional: Robot reminder] → Participant navigates → Target discrimination → Action → Scoring
```

All 12 tasks are **structurally identical** (isomorphic) — same cognitive chain, different surface content. This is critical for experimental validity.

---

## 2. Current System State (What Already Exists)

| Component | Status | Notes |
|-----------|--------|-------|
| Timeline Engine | ✅ Working | Backend pushes events via WebSocket on predefined timeline |
| Game Clock | ✅ Working | 10 real seconds = 1 game minute (17:00→18:00) |
| 5-Room Layout | ✅ Working | Kitchen, Living Room, Bedroom, Study, Bathroom; non-active rooms dimmed but visible |
| Steak Cooking | ✅ Working | 75s cycle, 3 pans staggered 20s, color gradient (pink→brown→black) |
| Table Setting | ✅ Working | Drag-drop, 4 seats × 4 items = 16, auto-reset on completion |
| Phone Messages | ✅ Working | 18-20 per block, mixed question/chat/ads, banner notifications |
| Virtual Robot | ✅ Working | 2D Pepper, moves between rooms, neutral utterances |
| PM Scoring (0-6) | ✅ Working | Backend auto-scores, frontend receives only `pm_received` |
| Execution Window | ✅ Working | 30s primary + 30s extended, silent monitoring |
| Room Navigation | ✅ Working | Click room → avatar walks (1s transition cost) |
| Encoding Phase | ⚠️ Partial | Task card UI exists, needs content population + confirmation quiz |
| Trigger System | ⚠️ Partial | Timeline can fire events, but specific trigger types not all implemented |
| Reminder Delivery | ⚠️ Partial | ReminderMessage table exists with agent interface placeholder |
| Target Discrimination | 📋 Not started | Two-choice selection UI in target room |
| Burned Steak Bug | 🐛 Known | State machine `burned` transition broken |

---

## 3. The 12 PM Tasks

### 3.1 Task Registry

Each task has a unique ID and fixed parameters:

```typescript
interface PMTask {
  task_id: string;           // e.g. "b1_book"
  block: 1 | 2 | 3;
  guest_name: string;        // "Mei" | "Lucas" | "Sophie"
  
  // Trigger
  trigger_type: "visitor" | "communication" | "appliance" | "activity";
  trigger_event: string;     // human-readable description
  trigger_signal: {
    audio: string;           // sound effect file or null
    visual: string;          // UI event type
  };
  
  // Target
  target_room: "study" | "bedroom" | "living_room" | "bathroom";
  target: {
    name: string;
    visual_description: string;
    image: string;           // encoding card image filename
  };
  distractor: {
    name: string;
    visual_description: string;
  };
  discriminating_cue: string;
  
  // Action
  action_verb: string;
  action_description: string;
  action_destination: string;  // where to bring/place the item
  
  // Encoding
  encoding_text: string;       // full encoding card paragraph
  confirmation_question: {
    question: string;
    options: string[];
    correct_index: number;
  };
  
  // Reminder texts (pre-generated, loaded from DB)
  reminders: {
    baseline: string;          // Layer 0 — always the same
    af_variants: string[];     // Layer 1 — 10 variants, one selected per participant
    af_cb_variants: string[];  // Layer 2 — 10 variants per detected_activity
  };
  
  // Timeline placement
  trigger_time_offset: number;   // seconds from block start when trigger fires
  reminder_time_offset: number;  // seconds from block start when reminder plays (before trigger)
}
```

### 3.2 Complete Task Definitions

#### Block 1 — Dinner for Mei

**Task 1.1 — Book for Mei**
```yaml
task_id: b1_book
trigger_type: visitor
trigger_event: "Doorbell — Mei arrives"
trigger_signal:
  audio: doorbell.mp3
  visual: visitor_arrival_animation
target_room: study
target:
  name: "Red book with mountain cover (Erta Ale)"
  visual_description: "Red paperback, mountain landscape illustration, title 'Erta Ale'"
distractor:
  name: "Red book with ocean cover (Blue Horizon)"
  visual_description: "Red paperback, ocean landscape illustration, title 'Blue Horizon'"
discriminating_cue: "mountain cover illustration + second shelf"
action_verb: "find and bring"
action_description: "Bring to living room and give to Mei"
encoding_text: >
  Your friend Mei asked to borrow a travel book. When Mei arrives,
  go to the study and find the book on the second shelf of the bookcase.
  It is a red paperback with a mountain illustration on the cover,
  titled Erta Ale. Bring it to the living room and give it to Mei.
confirmation_question:
  question: "What is on the cover of the book you need to find?"
  options: ["Ocean landscape", "Mountain landscape", "City skyline"]
  correct_index: 1
reminders:
  baseline: "Remember to find the book for Mei."
```

**Task 1.2 — Gift Bag**
```yaml
task_id: b1_giftbag
trigger_type: communication
trigger_event: "Phone message: delivery notification"
trigger_signal:
  audio: phone_notification.mp3
  visual: phone_message_banner
target_room: bedroom
target:
  name: "Small blue gift bag with bow"
  visual_description: "Small blue gift bag, bow decoration on handle"
distractor:
  name: "Medium blue gift bag with ribbon"
  visual_description: "Medium blue gift bag, ribbon decoration on handle"
discriminating_cue: "small size + bow (not ribbon)"
action_verb: "get and bring"
action_description: "Bring to entrance to bag the delivered gift"
encoding_text: >
  You ordered a birthday gift for Mei online. When the delivery notification
  arrives on your phone, go to the bedroom and get a gift bag from the dresser —
  the small blue bag with the bow. Bring it to the entrance to bag the gift.
confirmation_question:
  question: "Which gift bag do you need?"
  options: ["Medium bag with ribbon", "Small bag with bow", "Large bag with bow"]
  correct_index: 1
reminders:
  baseline: "Remember to get the gift bag."
```

**Task 1.3 — Baking Dish**
```yaml
task_id: b1_dish
trigger_type: appliance
trigger_event: "Oven preheat-complete chime"
trigger_signal:
  audio: oven_chime.mp3
  visual: oven_indicator_green
target_room: living_room
target:
  name: "Oval ceramic baking dish with blue handles"
  visual_description: "Oval white ceramic dish, two blue handles on sides"
distractor:
  name: "Oval ceramic baking dish with red handles"
  visual_description: "Oval white ceramic dish, two red handles on sides"
discriminating_cue: "blue handles (not red)"
action_verb: "get and bring"
action_description: "Bring to kitchen for baking"
encoding_text: >
  You are baking a dish for Mei tonight. When the oven finishes preheating,
  go to the living room and get the baking dish from the display cabinet,
  bottom shelf — it is the oval ceramic dish with blue handles. Bring it
  to the kitchen.
confirmation_question:
  question: "What color are the handles on the baking dish?"
  options: ["Red", "Blue", "Green"]
  correct_index: 1
reminders:
  baseline: "Remember to get the baking dish."
```

**Task 1.4 — Hand Soap**
```yaml
task_id: b1_soap
trigger_type: activity
trigger_event: "All three steaks plated (first steak cycle complete)"
trigger_signal:
  audio: task_complete_chime.mp3
  visual: steak_all_plated_animation
target_room: bathroom
target:
  name: "Pump soap bottle with lemon label"
  visual_description: "White pump bottle, yellow lemon label"
distractor:
  name: "Pump soap bottle with mint label"
  visual_description: "White pump bottle, green mint label"
discriminating_cue: "lemon label (not mint)"
action_verb: "get and place"
action_description: "Place by kitchen sink for guests"
encoding_text: >
  After you finish plating all three steaks, go to the bathroom and get the
  hand soap from the shelf above the sink — the pump bottle with the lemon
  label. Put it by the kitchen sink so your guests can wash their hands
  before dinner.
confirmation_question:
  question: "Which hand soap do you need to get?"
  options: ["Mint label", "Lemon label", "Lavender label"]
  correct_index: 1
reminders:
  baseline: "Remember to get the hand soap."
```

#### Block 2 — Dinner for Lucas

**Task 2.1 — Vinyl Record**
```yaml
task_id: b2_vinyl
trigger_type: communication
trigger_event: "Phone message from Lucas about music"
trigger_signal:
  audio: phone_notification.mp3
  visual: phone_message_banner
target_room: study
target:
  name: "Vinyl record Night Drive (car illustration)"
  visual_description: "Black vinyl sleeve, car illustration on cover, title 'Night Drive'"
distractor:
  name: "Vinyl record Dark Side (abstract art)"
  visual_description: "Black vinyl sleeve, abstract geometric art, title 'Dark Side'"
discriminating_cue: "car illustration + on the desk"
action_verb: "find and place"
action_description: "Place by record player in living room"
encoding_text: >
  Lucas might ask you to prepare a vinyl record. If he messages about it,
  go to the study and find the record on the desk — it has a car illustration
  on the cover, titled Night Drive. Put it by the record player in the
  living room.
confirmation_question:
  question: "What is on the cover of the vinyl record?"
  options: ["Abstract geometric art", "Car illustration", "Mountain landscape"]
  correct_index: 1
reminders:
  baseline: "Remember to find the vinyl record for Lucas."
```

**Task 2.2 — Napkin Rings**
```yaml
task_id: b2_napkinrings
trigger_type: activity
trigger_event: "Table fully set (16 items placed, reset triggered)"
trigger_signal:
  audio: task_complete_chime.mp3
  visual: table_complete_animation
target_room: bedroom
target:
  name: "Wooden napkin rings"
  visual_description: "Set of 4 natural wood napkin rings, light oak color"
distractor:
  name: "Metal napkin rings"
  visual_description: "Set of 4 silver metal napkin rings, polished"
discriminating_cue: "wooden (not metal)"
action_verb: "get and place"
action_description: "Place on napkins at each seat"
encoding_text: >
  After you finish setting the table for the first time, go to the bedroom
  and get the napkin rings from the wardrobe, top drawer — the set with
  wooden rings. Place them on the napkins at each seat.
confirmation_question:
  question: "What material are the napkin rings?"
  options: ["Metal", "Wooden", "Ceramic"]
  correct_index: 1
reminders:
  baseline: "Remember to get the napkin rings."
```

**Task 2.3 — Flower Pot**
```yaml
task_id: b2_pot
trigger_type: visitor
trigger_event: "Doorbell — neighbor returns herb plant"
trigger_signal:
  audio: doorbell.mp3
  visual: visitor_arrival_animation
target_room: living_room
target:
  name: "Terracotta pot with saucer"
  visual_description: "Brown terracotta pot sitting on matching saucer"
distractor:
  name: "Terracotta pot without saucer"
  visual_description: "Brown terracotta pot, no saucer, slightly smaller"
discriminating_cue: "with saucer (not without)"
action_verb: "get and use"
action_description: "Repot the herb plant at the entrance"
encoding_text: >
  Your neighbor has been looking after your herb plant. When they bring it
  back, go to the living room and get the pot from the window shelf — the
  terracotta pot with a saucer. Repot the herb into it.
confirmation_question:
  question: "Which pot do you need?"
  options: ["The one without a saucer", "The one with a saucer", "The blue glazed one"]
  correct_index: 1
reminders:
  baseline: "Remember to get the flower pot."
```

**Task 2.4 — Fabric Softener**
```yaml
task_id: b2_softener
trigger_type: appliance
trigger_event: "Washing machine done chime"
trigger_signal:
  audio: washer_chime.mp3
  visual: washer_indicator_done
target_room: bathroom
target:
  name: "Purple bottle with lavender label"
  visual_description: "Purple plastic bottle, lavender flower label"
distractor:
  name: "Purple bottle with eucalyptus label"
  visual_description: "Purple plastic bottle, eucalyptus leaf label"
discriminating_cue: "lavender label (not eucalyptus)"
action_verb: "get and add"
action_description: "Add to dryer cycle"
encoding_text: >
  The dinner napkins are in the washing machine. When it finishes, go to the
  bathroom and get the fabric softener from the shelf above the machine —
  the purple bottle with the lavender label. Add it to the dryer cycle.
confirmation_question:
  question: "Which label is on the correct fabric softener?"
  options: ["Eucalyptus", "Lavender", "Rose"]
  correct_index: 1
reminders:
  baseline: "Remember to get the fabric softener."
```

#### Block 3 — Dinner for Sophie

**Task 3.1 — Hanger**
```yaml
task_id: b3_hanger
trigger_type: appliance
trigger_event: "Dryer finished chime"
trigger_signal:
  audio: dryer_chime.mp3
  visual: dryer_indicator_done
target_room: study
target:
  name: "Wide-shoulder wooden hanger"
  visual_description: "Natural wood hanger, wide curved shoulders"
distractor:
  name: "Narrow-shoulder wooden hanger"
  visual_description: "Natural wood hanger, narrow straight shoulders"
discriminating_cue: "wide shoulders (not narrow)"
action_verb: "get and use"
action_description: "Hang Sophie's jacket on it in living room"
encoding_text: >
  Sophie's jacket has been in the dryer since it got wet last visit. When the
  dryer finishes, go to the study and get a hanger from the closet, left side —
  the wooden hanger with wide shoulders. Hang the jacket on it in the
  living room.
confirmation_question:
  question: "Which hanger do you need?"
  options: ["Narrow shoulders", "Wide shoulders", "Padded"]
  correct_index: 1
reminders:
  baseline: "Remember to get the hanger."
```

**Task 3.2 — Bluetooth Speaker**
```yaml
task_id: b3_speaker
trigger_type: activity
trigger_event: "Message batch ends (friend says 'OK talk later!')"
trigger_signal:
  audio: null  # no additional sound; the batch just stops arriving
  visual: phone_batch_end_indicator
target_room: living_room
target:
  name: "Round Bluetooth speaker with fabric cover"
  visual_description: "Small round speaker, gray fabric mesh cover"
distractor:
  name: "Round Bluetooth speaker with rubber cover"
  visual_description: "Small round speaker, black rubber cover"
discriminating_cue: "fabric cover (not rubber)"
action_verb: "get and set up"
action_description: "Set up in dining area for dinner music"
encoding_text: >
  After you finish the first batch of messages, go to the living room and
  get the Bluetooth speaker from the sideboard, bottom shelf — the round
  one with the fabric cover. Set it up in the dining area for dinner music.
confirmation_question:
  question: "What kind of cover does the correct speaker have?"
  options: ["Rubber", "Fabric", "Plastic"]
  correct_index: 1
reminders:
  baseline: "Remember to get the speaker."
```

**Task 3.3 — Vase**
```yaml
task_id: b3_vase
trigger_type: visitor
trigger_event: "Doorbell — Sophie arrives with flowers"
trigger_signal:
  audio: doorbell.mp3
  visual: visitor_arrival_animation
target_room: bedroom
target:
  name: "Small blue glazed ceramic vase"
  visual_description: "Small ceramic vase, smooth blue glaze"
distractor:
  name: "Small green glazed ceramic vase"
  visual_description: "Small ceramic vase, smooth green glaze"
discriminating_cue: "blue glaze (not green)"
action_verb: "get and prepare"
action_description: "Fill with water in kitchen and arrange the flowers"
encoding_text: >
  Sophie mentioned she would bring flowers. When she arrives with them, go to
  the bedroom and get the vase from the windowsill — the small ceramic vase
  with blue glaze. Fill it with water in the kitchen and arrange the flowers.
confirmation_question:
  question: "What color is the glaze on the vase?"
  options: ["Green", "Blue", "White"]
  correct_index: 1
reminders:
  baseline: "Remember to get the vase."
```

**Task 3.4 — Hand Cream**
```yaml
task_id: b3_handcream
trigger_type: communication
trigger_event: "Phone message from Sophie asking about hand cream"
trigger_signal:
  audio: phone_notification.mp3
  visual: phone_message_banner
target_room: bathroom
target:
  name: "Hand cream tube with lavender label"
  visual_description: "White tube, purple lavender flower label"
distractor:
  name: "Hand cream tube with mint label"
  visual_description: "White tube, green mint leaf label"
discriminating_cue: "lavender label (not mint)"
action_verb: "get and bring"
action_description: "Bring to Sophie in the living room"
encoding_text: >
  Sophie might ask about the hand cream she liked at your place. If she
  messages about it, go to the bathroom and find the tube on the shelf
  above the sink — the one with the lavender label. Bring it to Sophie.
confirmation_question:
  question: "Which label is on the correct hand cream?"
  options: ["Mint", "Lavender", "Rose"]
  correct_index: 1
reminders:
  baseline: "Remember to get the hand cream for Sophie."
```

---

## 4. Timeline Integration

### 4.1 Block Timeline Structure

Each block runs ~10 minutes (600 real seconds = 60 game minutes, 17:00→18:00). The timeline JSON already controls all events. PM tasks need to be inserted into this timeline.

```
Block Timeline (600s):
├── 0s      : Block starts, ongoing tasks begin
├── 0-30s   : Encoding cards shown (pre-block, before timer starts)
├── ~60s    : First ongoing task cycle established
│
├── [R1]    : Reminder for PM Task A (if reminded condition)
├── [T1]    : Trigger for PM Task A fires
├── [T1+30] : Primary execution window closes
├── [T1+60] : Extended window closes, score finalized
│
├── [R2]    : Reminder for PM Task B
├── [T2]    : Trigger for PM Task B fires
├── ...
├── [R3]    : Reminder for PM Task C
├── [T3]    : Trigger for PM Task C fires
├── ...
├── [T4]    : Trigger for PM Task D (unreminded — no R4)
├── ...
├── ~580s   : Final scoring
├── 600s    : Block ends
└── Post-block questionnaire
```

### 4.2 Timing Rules

```
RULE 1: Minimum 90s between any two trigger events
  → Prevents overlap of execution windows (30s+30s = 60s, plus 30s buffer)

RULE 2: Reminder fires 90-120s BEFORE its trigger
  → This is the "reminder, not instruction" window (supported by literature:
    1min and 6min intervals show equivalent effects)
  → Reminder content aligns with encoding (not new information)

RULE 3: First trigger no earlier than 120s into block
  → Allow ongoing tasks to establish cognitive load

RULE 4: Last trigger no later than 520s
  → Leave 80s buffer for extended execution window + block wrap-up

RULE 5: Trigger order within block is FIXED per timeline JSON
  → But the mapping of which task_id goes to which slot varies per
    participant (counterbalancing)

RULE 6: Activity triggers fire based on game state, not fixed time
  → Timeline Engine sends a "watch_for" event to the state machine
  → When ongoing task completion is detected, the trigger fires
  → Fallback: if activity not completed by a deadline, trigger fires anyway
```

### 4.3 Example Block Timeline JSON

```json
{
  "block_id": "block_1",
  "guest": "Mei",
  "duration_seconds": 600,
  "events": [
    {
      "type": "encoding_phase",
      "time": -120,
      "tasks": ["b1_book", "b1_giftbag", "b1_dish", "b1_soap"],
      "note": "Show 4 encoding cards sequentially, each with confirmation quiz"
    },
    {
      "type": "block_start",
      "time": 0,
      "note": "Game clock starts at 17:00, ongoing tasks activate"
    },
    {
      "type": "robot_neutral",
      "time": 45,
      "utterance": "The kitchen smells wonderful already!"
    },
    {
      "type": "pm_reminder",
      "time": 100,
      "task_id": "b1_dish",
      "condition_dependent": true,
      "note": "Only plays if this block's condition is AF or AF+CB"
    },
    {
      "type": "fake_trigger",
      "time": 150,
      "event": "doorbell",
      "content": "Courier drops off a flyer, leaves immediately",
      "note": "Non-PM doorbell to prevent doorbell=PM expectation"
    },
    {
      "type": "pm_trigger",
      "time": 195,
      "task_id": "b1_dish",
      "trigger_type": "appliance",
      "signal": {"audio": "oven_chime.mp3", "visual": "oven_indicator_green"}
    },
    {
      "type": "robot_neutral",
      "time": 260,
      "utterance": "I think I hear something outside."
    },
    {
      "type": "pm_reminder",
      "time": 280,
      "task_id": "b1_book",
      "condition_dependent": true
    },
    {
      "type": "pm_trigger",
      "time": 360,
      "task_id": "b1_book",
      "trigger_type": "visitor",
      "signal": {"audio": "doorbell.mp3", "visual": "visitor_arrival_animation"}
    },
    {
      "type": "pm_reminder",
      "time": 380,
      "task_id": "b1_giftbag",
      "condition_dependent": true
    },
    {
      "type": "pm_trigger",
      "time": 420,
      "task_id": "b1_giftbag",
      "trigger_type": "communication",
      "signal": {"audio": "phone_notification.mp3", "visual": "phone_message_banner"},
      "message_content": "Your package has been delivered to the front door."
    },
    {
      "type": "pm_watch_activity",
      "time": 440,
      "task_id": "b1_soap",
      "watch_condition": "all_steaks_plated",
      "fallback_time": 530,
      "note": "Watch for steak plating completion; if not by 530s, force-trigger"
    },
    {
      "type": "robot_neutral",
      "time": 470,
      "utterance": "The table looks nice."
    },
    {
      "type": "block_end",
      "time": 600
    }
  ]
}
```

### 4.4 Activity Trigger State Machine

Activity triggers differ from others — they depend on game state, not clock:

```
Backend receives "pm_watch_activity" event from timeline:
  → Register a watcher on the specified game state condition
  → e.g. watch_condition: "all_steaks_plated"

Game state update loop (already exists):
  → Every state change, check registered watchers
  → If "all_steaks_plated" becomes true:
      1. Fire the trigger signal (audio + visual)
      2. Start execution window (30s primary + 30s extended)
      3. Deregister the watcher

Fallback:
  → If fallback_time reached and condition still not met:
      1. Force-trigger anyway
      2. Log "activity_trigger_forced" in InteractionLog
      3. This data point may need special handling in analysis
```

---

## 5. Encoding Phase

### 5.1 UI Flow

```
For each PM task in the block (4 tasks shown sequentially):

1. TASK CARD SCREEN
   ┌─────────────────────────────────────┐
   │  📋 Task 1 of 4                     │
   │                                     │
   │  [Encoding text paragraph]          │
   │                                     │
   │  ┌───────────────────────────┐      │
   │  │   [Target image]          │      │
   │  │   (photo of red book      │      │
   │  │    with mountain cover)   │      │
   │  └───────────────────────────┘      │
   │                                     │
   │  ⏱️ Read for at least 10 seconds    │
   │          [Continue →]               │
   └─────────────────────────────────────┘

2. CONFIRMATION QUIZ
   ┌─────────────────────────────────────┐
   │  ❓ Quick check                      │
   │                                     │
   │  What is on the cover of the book   │
   │  you need to find?                  │
   │                                     │
   │  ○ Ocean landscape                  │
   │  ○ Mountain landscape               │
   │  ○ City skyline                     │
   │                                     │
   │          [Submit]                   │
   └─────────────────────────────────────┘

   If wrong → show correct answer, force re-read, re-quiz
   If right → proceed to next task card

After all 4 cards: "Ready to start your day? [Begin]"
```

### 5.2 Backend Encoding Records

```sql
-- Log encoding phase data for analysis
INSERT INTO encoding_log (
  participant_id, block_id, task_id,
  card_read_time_ms,        -- how long they spent on the card
  quiz_attempts,            -- how many tries to get it right
  quiz_first_answer,        -- what they picked first (even if wrong)
  timestamp
)
```

---

## 6. Trigger Execution

### 6.1 Trigger Type Implementations

**Visitor (doorbell)**
```
Backend fires: { type: "pm_trigger", trigger_type: "visitor" }
Frontend:
  1. Play doorbell.mp3
  2. Show visitor arrival animation at entrance area
  3. If PM task: visitor stays at entrance waiting
  4. If fake trigger: visitor drops item and leaves after 5s
  5. Start execution window timer
```

**Communication (phone message)**
```
Backend fires: { type: "pm_trigger", trigger_type: "communication" }
Frontend:
  1. Play phone_notification.mp3
  2. Show message banner (same as regular messages — NO visual distinction)
  3. Message appears in phone message list with specific content
  4. Start execution window timer
PM trigger messages are injected into the phone message flow.
They look identical to regular messages from the outside.
```

**Appliance (device chime)**
```
Backend fires: { type: "pm_trigger", trigger_type: "appliance" }
Frontend:
  1. Play device-specific chime (oven_chime / washer_chime / dryer_chime)
  2. Update device visual state (indicator light changes)
  3. Device stays in "done" state until interacted with or timeout
  4. Start execution window timer
```

**Activity (ongoing task completion)**
```
Backend fires: { type: "pm_watch_activity", watch_condition: "..." }
Frontend state machine detects completion:
  1. Play task_complete_chime.mp3
  2. Show completion animation (e.g. "All steaks plated! ✓")
  3. Start execution window timer
  4. Notify backend: { type: "activity_trigger_fired", task_id: "..." }
```

### 6.2 Execution Window & Scoring

```
Trigger fires at T=0:

T=0 to T=30s: PRIMARY WINDOW
  Monitor:
    - room_entered: which room did participant navigate to?
    - target_selected: which of the two items did they click?
    - action_performed: did they complete the action?
  
  Score 6: correct room + correct target + correct action, all within 15s
  Score 5: correct room + correct target + correct action, 15-30s
  Score 4: correct room + correct target + WRONG action
  Score 3: correct room + WRONG target
  Score 2: left ongoing task + went to WRONG room

T=30s to T=60s: EXTENDED WINDOW
  Score 1: any PM-related behavior in this window

T=60s+: CLOSED
  Score 0: no PM-related behavior detected

Backend auto-scores. Frontend receives ONLY:
  { type: "pm_received" }  // generic acknowledgment, no score leaked
```

---

## 7. Robot Reminder Delivery

### 7.1 Reminder Selection Logic

```python
def select_reminder(task_id: str, condition: str, participant_id: str,
                    current_game_state: dict) -> Optional[str]:
    """Select the appropriate reminder text for this trial."""
    
    if condition == "control":
        # This is an unreminded trial — no reminder
        return None
    
    task = load_task(task_id)
    
    if condition == "baseline":
        return task.reminders.baseline
    
    elif condition == "af":
        # Select from AF variants using participant's assigned variant index
        variant_idx = get_variant_assignment(participant_id, task_id, "af")
        return task.reminders.af_variants[variant_idx]
    
    elif condition == "af_cb":
        # Select AF+CB variant matching current detected activity
        detected_activity = current_game_state["current_activity"]
        variant_idx = get_variant_assignment(participant_id, task_id, "af_cb")
        # AF+CB variants are keyed by detected_activity
        return task.reminders.af_cb_variants[detected_activity][variant_idx]
```

### 7.2 Delivery Behavior

```
When reminder_time arrives in timeline:
  1. Robot moves toward participant's current room (if not already there)
  2. Robot starts speaking (TTS or pre-recorded audio)
  3. Speech bubble appears above robot with text
  4. Duration: Baseline ~4s, AF ~10s, AF+CB ~15s
  5. Speech bubble fades after delivery
  6. Robot resumes random movement

CRITICAL: Robot neutral utterances and PM reminders must be
visually and behaviorally INDISTINGUISHABLE from the outside.
Same speech bubble style, same movement pattern, same audio delivery.
The only difference is the CONTENT of what is said.
```

---

## 8. Target Discrimination UI

### 8.1 Room Interaction

When participant navigates to the target room during an active execution window:

```
┌─────────────────────────────────────────────┐
│  BEDROOM                                     │
│                                              │
│  ┌───────────┐         ┌───────────┐         │
│  │           │         │           │         │
│  │  [Item A] │         │  [Item B] │         │
│  │  (target) │         │(distract) │         │
│  │           │         │           │         │
│  └───────────┘         └───────────┘         │
│                                              │
│  Items appear at their described location    │
│  (e.g. "dresser", "windowsill", "wardrobe") │
│  Both items are clickable                    │
└─────────────────────────────────────────────┘
```

**Important design rules:**
- Both items are ALWAYS visible in the room (not just during PM windows)
- They are part of the room's permanent furniture/decoration
- During non-PM times, clicking them does nothing
- During active execution window, clicking triggers selection
- Left/right position randomized per participant
- No highlight, glow, or any visual cue that an item is "active"

### 8.2 Action Confirmation

After selecting a target:
```
Brief action animation plays (1-2s):
  - Book: avatar picks up and carries
  - Gift bag: avatar picks up
  - Dish: avatar picks up and carries
  - etc.

Then participant is auto-navigated to action destination:
  - "Bring to living room" → auto-walk to living room
  - "Place by kitchen sink" → auto-walk to kitchen

Backend records: { target_selected, action_performed, timestamp }
Frontend shows: nothing (no feedback on correctness)
```

---

## 9. Fake Triggers & Neutral Events

To prevent trigger-PM association learning:

```yaml
fake_events_per_block:
  - type: fake_doorbell
    count: 1-2
    content: "Courier drops flyer / neighbor waves hello"
    behavior: visitor appears briefly, leaves, no PM action needed
    
  - type: fake_phone_message
    count: 2-3  # already mixed into the 18-20 message stream
    content: "Ads, spam, group chat noise"
    behavior: regular messages, no PM relevance
    
  - type: fake_appliance
    count: 1
    content: "Microwave beeps (not associated with any PM task)"
    behavior: sound plays, nothing to do

  - type: robot_neutral_utterance
    count: 3-5
    content: "Weather comments, compliments on cooking, random observations"
    behavior: same visual as PM reminder but content is idle chatter
```

---

## 10. Counterbalancing

### 10.1 Condition × Block Assignment

3×3 Latin Square, 6 sequences:

```
Sequence A: Block1=Baseline,  Block2=AF,       Block3=AF+CB
Sequence B: Block1=Baseline,  Block2=AF+CB,    Block3=AF
Sequence C: Block1=AF,        Block2=Baseline,  Block3=AF+CB
Sequence D: Block1=AF,        Block2=AF+CB,    Block3=Baseline
Sequence E: Block1=AF+CB,     Block2=Baseline,  Block3=AF
Sequence F: Block1=AF+CB,     Block2=AF,       Block3=Baseline
```

Target: 5 participants per sequence = 30 total.

### 10.2 Unreminded Trial Assignment

Each block: 3 reminded + 1 unreminded. Which task is unreminded rotates across participants. Combined with 6 condition sequences × 4 unreminded positions = 24 unique assignments, cycled across 30 participants.

### 10.3 Backend Assignment Table

```sql
CREATE TABLE participant_assignment (
  participant_id TEXT PRIMARY KEY,
  sequence_id TEXT,           -- "A" through "F"
  block1_condition TEXT,      -- "baseline" | "af" | "af_cb"
  block2_condition TEXT,
  block3_condition TEXT,
  block1_unreminded_task TEXT, -- task_id of the unreminded trial
  block2_unreminded_task TEXT,
  block3_unreminded_task TEXT,
  af_variant_index INT,       -- which of the 10 variants this participant gets
  target_position_seed INT    -- seed for left/right randomization
);
```

---

## 11. Data Collection

### 11.1 PM-Specific Tables (additions to existing schema)

```sql
-- Per-trial PM data
CREATE TABLE pm_trial (
  id SERIAL PRIMARY KEY,
  participant_id TEXT,
  block_id TEXT,
  task_id TEXT,
  condition TEXT,             -- "baseline" | "af" | "af_cb"
  is_reminded BOOLEAN,        -- false for unreminded trials
  reminder_text TEXT,          -- actual text delivered (null if unreminded)
  
  -- Trigger
  trigger_fired_at FLOAT,     -- seconds from block start
  trigger_type TEXT,
  trigger_was_forced BOOLEAN,  -- true if activity fallback fired
  
  -- Execution
  first_room_change_at FLOAT, -- seconds after trigger
  room_entered TEXT,
  target_selected TEXT,        -- "target" | "distractor" | null
  action_performed TEXT,       -- "correct" | "wrong" | null
  
  -- Scoring
  score INT,                  -- 0-6
  score_breakdown JSONB,      -- detailed scoring components
  
  -- Timing
  response_time_ms INT,       -- trigger → first relevant action
  resumption_lag_ms INT,      -- after PM action → back to ongoing task
  
  created_at TIMESTAMP
);

-- Encoding phase data
CREATE TABLE encoding_log (
  id SERIAL PRIMARY KEY,
  participant_id TEXT,
  block_id TEXT,
  task_id TEXT,
  card_read_time_ms INT,
  quiz_attempts INT,
  quiz_first_answer INT,
  created_at TIMESTAMP
);
```

---

## 12. Implementation Priority

```
Phase 1 — Core PM Pipeline (must have for pilot):
  [ ] Encoding card UI (task card + image + confirmation quiz)
  [ ] Target discrimination UI (two items per room, clickable during window)
  [ ] Trigger type implementations (visitor/communication/appliance/activity)
  [ ] Activity trigger state machine (watch + fallback)
  [ ] Reminder delivery through robot (text selection + TTS/audio)
  [ ] pm_trial data table + scoring integration
  [ ] encoding_log data table

Phase 2 — Counterbalancing & Assignment:
  [ ] participant_assignment table + admin UI for assignment
  [ ] Condition-dependent reminder selection
  [ ] Unreminded trial logic
  [ ] Variant index assignment

Phase 3 — Polish:
  [ ] Fake triggers (doorbell, phone, appliance)
  [ ] Room item placement (both items always visible, styled as decor)
  [ ] Sound effects for all trigger types
  [ ] Target images for encoding cards (12 images)

Phase 4 — Bug Fixes:
  [ ] Fix burned steak state machine
  [ ] Phone reply buttons → vertical, full-width
  [ ] Lock screen: stack unread message previews
  [ ] Message ordering: time-descending only
```
