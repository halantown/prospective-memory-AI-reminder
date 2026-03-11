# GAME DESIGN DOCUMENT
## Saturday At Home
### Experimental Game Platform — Interaction & Technical Specification

| | |
|---|---|
| **Version** | v1.0 |
| **Date** | 2026-03-11 |
| **Scope** | Game flow, interaction logic, use cases, scene switching, UI states, technical implementation |
| **Companion doc** | PRD v1.7 (experiment design, conditions, data schema) |

---

## 1  Game Overview

### 1.1  One-sentence description

A casual home-simulation game where the player manages cooking and household tasks on a Saturday, while a robot assistant occasionally speaks to them.

### 1.2  Player's mental model

> "I'm at home getting ready for a party tonight. I need to keep an eye on the food cooking on the stove, reply to a few messages, and take care of some things around the house. My robot assistant is somewhere in the room — it sometimes says useful things, sometimes just chats."

The player never sees this as an experiment. The robot's reminders and the PM tasks are embedded in the natural flow of home activities.

### 1.3  Session structure from the player's perspective

```
Welcome screen
    ↓
Consent + onboarding tutorial (learn the controls)
    ↓
Practice round (steak task only, ~5 min, no PM tasks)
    ↓
[Block 1]  Read today's tasks → Cook + manage home → Handle events
[Block 2]  Read today's tasks → Cook + manage home → Handle events
[Block 3]  Read today's tasks → Cook + manage home → Handle events
[Block 4]  Read today's tasks → Cook + manage home → Handle events
    ↓
Short questionnaire
    ↓
Score reveal + thank you screen
```

---

## 2  Screen Architecture

### 2.1  Screen inventory

| Screen ID | Name | Trigger | Duration |
|---|---|---|---|
| SCR-WELCOME | Welcome / consent | App load | Until confirmed |
| SCR-ONBOARD | Onboarding tutorial | Post-consent | ~3 min |
| SCR-PRACTICE | Practice round | Post-onboarding | ~5 min |
| SCR-ENCODE | Per-block task encoding | Block start | Until confirmed |
| SCR-OVERVIEW | Home overview (all rooms) | Post-encoding | Default view during block |
| SCR-ROOM | Single room expanded | Room click | Until navigated away |
| SCR-EXECUTE | PM task execution overlay | Trigger event | 30 s window |
| SCR-LIKERT | Post-block questionnaire | Block end | Until submitted |
| SCR-REST | Inter-block rest | Post-questionnaire | 30 s |
| SCR-FINAL | Final questionnaire | Session end | Until submitted |
| SCR-SCORE | Score reveal | Post-questionnaire | End state |

### 2.2  Screen transition map

```
SCR-WELCOME
    │ [Confirm consent]
    ▼
SCR-ONBOARD
    │ [Complete tutorial]
    ▼
SCR-PRACTICE
    │ [Practice timer ends]
    ▼
SCR-ENCODE ◄──────────────────────┐
    │ [Encoding confirmed]         │
    ▼                              │
SCR-OVERVIEW ◄──── SCR-ROOM       │
    │ [Click room]    │ [Click home/back]
    │                 │
    └────────────────►┘
    │
    │ [Trigger event fires]
    ▼
SCR-EXECUTE (overlay on top of SCR-OVERVIEW or SCR-ROOM)
    │ [Submit or timeout]
    ▼
Returns to underlying screen
    │
    │ [Block timer ends at 8:30]
    ▼
SCR-LIKERT
    │ [Submit]
    ▼
SCR-REST (30 s countdown)
    │ [If blocks remain] ──────────────────►  SCR-ENCODE
    │ [If all blocks done]
    ▼
SCR-FINAL
    │ [Submit]
    ▼
SCR-SCORE
```

---

## 3  Layout Specification

### 3.1  Global layout

```
┌─────────────────────────────────────────────────────────────┐
│  TOP BAR: Score display (left) │ Block timer (center) │ [?] │
├──────┬──────────────────────────────────────────────────────┤
│      │                                                       │
│  S   │                                                       │
│  I   │         MAIN CONTENT AREA                            │
│  D   │         (SCR-OVERVIEW or SCR-ROOM)                   │
│  E   │                                                       │
│  B   │                                                       │
│  A   │                                                       │
│  R   │                                          🤖 Robot     │
│      │                                          (fixed)      │
└──────┴──────────────────────────────────────────────────────┘
```

**Top bar** (always visible during blocks):
- Left: `Score: 284 pts` — live ongoing task score only
- Center: Block progress indicator (`Block 2 / 4`) — no countdown visible to participant
- Right: Help button (shows control reminder, no PM task content)

**Sidebar** (always visible during blocks):
- Width: 60px collapsed
- Contains: room icon buttons (全览, 阳台, 厨房, 客厅, 玄关, 消息)
- Each icon has a status indicator dot (see §3.3)
- Active room is highlighted

**Robot** (always visible, bottom-right corner):
- Fixed position, not part of room layout
- Avatar: idle state (subtle breathing animation) / speaking state (mouth animation + speech bubble)
- Speech bubble appears above avatar, auto-dismisses after utterance ends
- See §7 for full robot spec

### 3.2  SCR-OVERVIEW layout

```
┌──────────────────────────────────────────────────────┐
│  ┌────────────────────┐   ┌─────────────────────────┐│
│  │  🌿 阳台            │   │  🍳 厨房                 ││
│  │  [status content]  │   │  [3 hobs + progress]    ││
│  │                    │   │                         ││
│  └────────────────────┘   └─────────────────────────┘│
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ 🛋️ 客厅       │  │  🚪 玄关      │  │ 💬 消息     │ │
│  │ [TV + status]│  │ [door status]│  │ [msg badge] │ │
│  └──────────────┘  └──────────────┘  └─────────────┘ │
└──────────────────────────────────────────────────────┘
```

Room cards:
- Rounded corners (border-radius: 16px)
- Subtle drop shadow
- Each card has a distinct background tint (see §3.4)
- Hover: slight scale up (1.02) + shadow deepens
- Click: triggers room expand animation

**Kitchen card is always the largest** (~40% of content area width) because it contains the most real-time elements.

### 3.3  Sidebar status indicators

Each room icon in the sidebar shows a small status dot:

| Room | Dot colour | Meaning |
|---|---|---|
| 厨房 | 🔴 Red | Any steak in burning zone |
| 厨房 | 🟡 Yellow | Any steak in warning zone |
| 厨房 | 🟢 Green | All steaks safe |
| 阳台 | 🔵 Blue | Washing machine done (needs action) |
| 阳台 | ⚪ Grey | Inactive this block |
| 客厅 | 🔴 Red | (not used) |
| 玄关 | 🔔 Bell animation | Doorbell ringing |
| 消息 | 🔵 Number badge | Unread messages count |

**Critical rule:** The kitchen status dot is visible in ALL views including when the player is in another room. This is the primary peripheral awareness mechanism for the main ongoing task.

### 3.4  Room colour palette

| Room | Background tint | Rationale |
|---|---|---|
| 厨房 | Warm amber `#FFF3E0` | Heat / cooking association |
| 阳台 | Cool blue-grey `#E8F0F5` | Outdoor / laundry |
| 客厅 | Soft yellow `#FFFDE7` | Comfortable / living |
| 玄关 | Light green `#F1F8E9` | Entry / fresh |
| 消息 | Neutral white `#FAFAFA` | Focused / minimal |

---

## 4  Room Specifications

### 4.1  Kitchen (厨房)

**Always active. Primary ongoing task lives here.**

#### Expanded layout

```
┌──────────────────────────────────────────────────────┐
│  🍳 厨房                                    [🏠 home] │
│                                                       │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│   │  Hob 1   │  │  Hob 2   │  │  Hob 3   │           │
│   │  [steak] │  │  [steak] │  │  [empty] │           │
│   │ ████░░░  │  │ ██████░  │  │          │           │
│   │ 🟢 raw   │  │ 🟡 ready │  │          │           │
│   └──────────┘  └──────────┘  └──────────┘           │
│                                                       │
│   [Medicine cabinet — hidden until triggered]         │
│   [Slow cooker — hidden unless Pair 4 block]          │
│   [Coffee machine — hidden unless Pair 1 block]       │
│                                                       │
└──────────────────────────────────────────────────────┘
```

#### Steak state machine

```
EMPTY
  │ [new steak spawns]
  ▼
RAW (grey) ──── 20–30s ────►  COOKING (pink)
                                   │
                              15–20s window
                                   │
                                   ▼
                            READY (golden) ◄── Player must click here
                                   │            to flip/remove (+5 pts)
                              10s grace
                                   │
                                   ▼
                            BURNING (black) ──── −10 pts
                                   │
                              auto-clear after 3s
                                   │
                                   ▼
                               EMPTY
```

**Progress bar visual:**
```
Raw:     [░░░░░░░░░░]  grey
Cooking: [████░░░░░░]  pink, filling
Ready:   [██████████]  gold, pulsing border
Burning: [██████████]  black, shake animation
```

**Spawning rules:**
- At block start: 2 steaks spawn at staggered times (0s and 8s offset)
- After any steak is cleared: new steak spawns after 15–25s random delay
- Minimum 1 active steak at all times during block running phase
- At t=4:00 (after Task A closes): new batch guaranteed to spawn (fills gap)
- At t=7:00 (after Task B closes): final batch spawns, carries through to block end

**Difficulty settings (set during practice):**
| Level | Ready window | Grace period | Max concurrent |
|---|---|---|---|
| Slow | 25s | 15s | 2 steaks |
| Medium | 18s | 10s | 2–3 steaks |
| Fast | 12s | 6s | 3 steaks |

#### Medicine cabinet (PM execution UI — Task A & B)

Hidden element, appears only when PM trigger fires:
- Slides in from right side of kitchen view
- Shows 2 bottles side by side
- Player clicks one bottle → confirm button appears → clicks confirm
- 30s countdown bar visible at top of cabinet
- On timeout: cabinet slides out, score 0 logged

#### Slow cooker (PM trigger — Task G, Pair 4 block only)

- Not visible in Pair 1/2/3 blocks
- In Pair 4 block: visible in bottom-left of kitchen, shows countdown timer
- When countdown reaches 0: timer flashes, Report Task button appears
- Execution: click "Turn off" → select seasoning (2 options) → confirm

#### Coffee machine (PM trigger — Task B, Pair 1 block only)

- Not visible in other blocks
- In Pair 1 block: small icon top-right corner of kitchen
- When "done": icon glows green, chime plays, Report Task button appears

---

### 4.2  Balcony (阳台)

**Active only in Pair 2 block. Otherwise shows "quiet" state.**

#### States

| State | Visual | When |
|---|---|---|
| Quiet | Empty rack, blue sky outside | All non-Pair-2 blocks |
| Active (daytime) | Clothes on rack (shirt + towel), bright window | Pair 2 block, before trigger |
| Trigger fired | Window darkens to dusk, Report Task button appears | Task D trigger |
| Executed | Selected items move inside | After execution |

#### Execution UI (Task D)

Two items shown on drying rack:
- White cotton shirt (with "dry" indicator)
- Towel (with "slightly damp" indicator — subtle darker colour)

Player clicks items to select → selected items get a checkmark → "Bring inside" button → confirm

Scoring:
- 2: only shirt selected
- 1: both items selected (towel included)
- 0: nothing selected within 30s

#### Washing machine (PM trigger — Task C, Pair 2 block only)

Located in bottom of balcony view:
- Idle: drum static, no progress bar
- Running: drum rotates (SVG animation), blue progress bar fills over ~3 min
- Done: drum stops, green indicator light, chime plays, Report Task button appears

Execution UI (Task C — appears in living room, not balcony):
- 2 garments shown: jeans + white shirt
- Player drags each to either "Dryer" or "Drying Rack" target
- Both must be placed to confirm
- Scoring: 2 = both correct / 1 = either wrong / 0 = no action in 30s

---

### 4.3  Living Room (客厅)

**Always accessible. Contains TV (idle filler) and laundry equipment (Pair 2 only).**

#### Layout

```
┌──────────────────────────────────────────────────┐
│  🛋️ 客厅                               [🏠 home]  │
│                                                   │
│   ┌────────────────┐    ┌──────┐  ┌──────────┐   │
│   │   Television   │    │Dryer │  │  Rack    │   │
│   │   [screen]     │    │ (P2) │  │  (P2)    │   │
│   │                │    └──────┘  └──────────┘   │
│   └────────────────┘                             │
│       [Watch TV]                                  │
│                                                   │
└──────────────────────────────────────────────────┘
```

#### Television (idle filler)

- Click "Watch TV" button → TV screen shows a short looping animation (party prep scene)
- No score, no timer, no obligation
- Player can navigate away at any time with no cost
- During playback: kitchen status dot still visible in sidebar
- Purpose: natural reason to "be in the living room" without creating cognitive load

#### Dryer + Drying Rack (Pair 2 only)

- Not rendered outside Pair 2 block
- In Pair 2: appear as drag targets for Task C execution
- Dryer shows "empty" or "contains jeans" state after execution
- Drying rack shows hanging items after execution

---

### 4.4  Entrance (玄关)

**Event-driven. Contains doorbell, visitor interaction, and rubbish bags.**

#### Layout

```
┌──────────────────────────────────────────────────┐
│  🚪 玄关                               [🏠 home]  │
│                                                   │
│   [Door area — visitor appears here]              │
│                                                   │
│   [Rubbish bag area — Pair 4 only]                │
│   ┌──────────┐   ┌──────────┐                    │
│   │  🔵 Blue │   │  🟢 Green│                    │
│   │Recyclable│   │Food Waste│                    │
│   └──────────┘   └──────────┘                    │
│                                                   │
└──────────────────────────────────────────────────┘
```

#### Doorbell + visitor flow

**Real PM trigger (Task F — Mrs Wang):**
```
Doorbell rings (audio + bell icon flashes in sidebar)
    ↓
Report Task button appears
    ↓
Player clicks Report Task
    ↓
Mrs Wang avatar appears at door
3 dialogue options shown:
  A) "Sunday's event is moved to 3 PM." ✓
  B) "Sunday's event is moved to 5 PM." ✗ (wrong time)
  C) "Come in!" (unrelated)
    ↓
Player selects option within 30s
    ↓
Mrs Wang nods / reacts → door closes
Score logged
```

**Fake trigger (Delivery person):**
```
Doorbell rings (identical audio + sidebar indicator)
    ↓
No Report Task button — instead "Answer door" button
    ↓
Delivery person avatar appears
"Package for you!" → [Sign] button
    ↓
Player clicks Sign → delivery person leaves
No PM score logged
```

**System response if player tries Report Task during delivery person visit:**
Text appears: "Nothing to report right now." — neutral, no penalty.

#### Rubbish bags (PM trigger — Task H, Pair 4 block only)

- Not rendered outside Pair 4 block
- In Pair 4: 2 bags visible near door (blue recyclable, green food waste)
- When rubbish truck appears outside window: bags are clickable, Report Task button appears
- Execution: click one bag → drag to door exterior area → confirm
- Scoring: 2 = blue bag / 1 = green bag / 0 = no action in 30s

---

### 4.5  Message Desk (消息区)

**Always accessible. Contains contact list (Pair 3 trigger) and message bubbles (ongoing task).**

#### Layout

```
┌──────────────────────────────────────────────────┐
│  💬 消息                               [🏠 home]  │
│                                                   │
│   CONTACTS (Pair 3 only)    MESSAGES              │
│   ┌──────────────────┐      ┌────────────────┐   │
│   │ 🟢 Li Wei        │      │ Alex: "Are you │   │
│   │ 🔴 Zhang Fang    │      │  still coming? │   │
│   │ ⚪ Chen Ming     │      │  [A] Yes  [B] No│  │
│   │ ⚪ Wang Li       │      └────────────────┘   │
│   └──────────────────┘                           │
│                                                   │
└──────────────────────────────────────────────────┘
```

#### Contact list (PM trigger — Task E, Pair 3 block only)

- Not rendered outside Pair 3 block
- In Pair 3: 4 contacts shown with online/offline status dots
- When Li Wei comes online: her dot turns green, badge appears on 消息 sidebar icon, Report Task button appears
- Execution: click contact (4-choice) → message options appear (3-choice: correct venue / wrong venue / wrong person message) → confirm
- Scoring: 2 = Li Wei + correct venue / 1 = Li Wei + wrong venue, or wrong person / 0 = no action in 30s

**Other contacts come online at random times** (fake triggers at the contact level) — player sees green dots for other contacts but no Report Task button.

#### Message bubbles (ongoing secondary task — all blocks)

- Backend pushes `message_bubble` SSE event 3–4 times per block
- Bubble appears in message area (and also as notification badge on sidebar icon if player is in another room)
- Content: short party-related chat, not involving PM contacts
- Player selects A or B reply within 15s: +2 pts
- Timeout: bubble fades, no penalty
- Timing rule: backend never sends message bubble within ±60s of a PM reminder or trigger

---

## 5  Ongoing Task System

### 5.1  Score calculation

```
Event                    Points
─────────────────────────────────
Steak flipped at ready   +5
Steak cleared at ready   +5
Message replied in time  +2
Steak burns              −10
─────────────────────────────────
PM execution result      NOT SHOWN (logged silently)
```

Score is displayed live in the top bar. Resets to 0 at the start of each block. Final score shown at SCR-SCORE is the sum across all 4 blocks.

### 5.2  Cognitive Switching Cost measurement

Every 5 seconds during a block, the frontend POSTs the current score increment to the backend:

```
POST /session/{id}/block/{n}/ongoing
{ "ts": 1234567890, "delta": 5, "cumulative": 284 }
```

Backend computes:
- `ongoing_baseline`: mean delta/5s in the 90s before the reminder fires
- `ongoing_window`: mean delta/5s in the ±30s window around the reminder

CSC = baseline − window. Positive value = performance dip around reminder.

### 5.3  Difficulty calibration

During practice, the last 60 seconds of steak activity are scored. Based on performance:

| Practice score/5s | Assigned difficulty | Steak parameters |
|---|---|---|
| > 8 pts | Fast | 12s ready window, 3 concurrent max |
| 4–8 pts | Medium | 18s ready window, 2–3 concurrent |
| < 4 pts | Slow | 25s ready window, 2 concurrent max |

Difficulty is fixed for all 4 blocks. Stored in `sessions.difficulty`.

### 5.4  Force yellow steak (CB mechanism)

10 seconds before each PM reminder fires, the backend sends:

```
SSE event: force_yellow_steak
{ "hob_index": 1 }  // which hob to force into yellow
```

Frontend: transitions hob 1's steak progress bar to the yellow (ready) zone, regardless of its natural progress state. The steak then continues its natural countdown from the yellow zone.

This ensures the player's attention is on the stove at the moment the CB reminder fires ("I can see you're keeping an eye on the stove").

---

## 6  PM Task Execution System

### 6.1  Execution window lifecycle

```
SSE: trigger_appear
    ↓
Frontend: Report Task button activates (glowing, animated)
    ↓
Player clicks Report Task (or ignores)
    ↓
If clicked:
    SCR-EXECUTE overlay appears
    30s countdown bar starts
    Player completes execution steps
    Player clicks Confirm
    → POST action to backend
    → Backend scores and logs
    → Overlay dismisses
    → Return to underlying screen
    
If not clicked within 30s:
    Button disappears
    Backend logs score 0 (miss)
    No feedback to player
```

### 6.2  Report Task button behaviour

- Appears as a floating button, position: top-right of the active view
- Colour: warm orange (distinct from other UI elements)
- Animation: gentle pulse to attract attention
- Label: "Report Task" (same label for all PM tasks — does not hint at which task)
- If player is in sidebar navigation during trigger: button still visible
- Multiple triggers cannot overlap — Task B trigger cannot appear until Task A window closes

### 6.3  Execution overlay (SCR-EXECUTE)

Common structure for all PM tasks:

```
┌─────────────────────────────────────────────────────┐
│  [Task context icon]                                 │
│                                                      │
│  [Task-specific interaction area]                    │
│  (bottles / garments / dialogue options / bags)      │
│                                                      │
│  ████████████████████░░░░░  ← 30s countdown bar     │
│                                                      │
│                          [Confirm]  [Not sure]       │
└─────────────────────────────────────────────────────┘
```

"Not sure" button: records whatever partial selection exists as the action, scores accordingly. Allows player to exit without waiting for timeout. Does not give a "wrong" indicator.

**No feedback given after submission.** Overlay simply dismisses. Player does not know if they scored 0, 1, or 2.

### 6.4  Execution UI per task type

**Type A — Select container + confirm amount (Medicine tasks)**
```
[Round red bottle]     [Square red bottle]
     ↑ click                ↑ click
     
Selected: [Round red bottle ✓]
Amount: [−] 1 tablet [+]
                              [Confirm]
```

**Type B — Drag items to destinations (Laundry Task C)**
```
[👕 White shirt]  [👖 Dark jeans]
     drag ↓            drag ↓
[  Drying Rack  ]  [   Dryer    ]
                              [Confirm]
```

**Type C — Select from destination list (Laundry Task D)**
```
Items on balcony:
☐ White shirt (dry)
☐ Towel (slightly damp)
                              [Bring inside]
```

**Type D — Select contact + select message (Communication tasks)**
```
Who to contact:
○ Li Wei    ○ Zhang Fang
○ Chen Ming ○ Wang Li

What to say:
○ "Dinner moved to Restaurant B"
○ "Dinner moved to Restaurant C"  
○ "Never mind, see you tonight"
                              [Send]
```

**Type E — Select dialogue option (Visitor task)**
```
[Mrs Wang at door]

○ "Sunday's event is moved to 3 PM."
○ "Sunday's event is moved to 5 PM."
○ "Come in and sit down!"
                              [Say this]
```

**Type F — Turn off + select seasoning (Slow cooker task)**
```
[🍲 Slow cooker — done!]

Step 1: [Turn off heat]  ← must click first
Step 2: Add seasoning:
  [Black pepper grinder]  [White pepper grinder]
                              [Confirm]
```

**Type G — Select bag + drag to door (Rubbish task)**
```
[🔵 Blue bag — Recyclable]  [🟢 Green bag — Food waste]
        click to select
        drag to door →  [  DOOR  ]
                              [Confirm]
```

---

## 7  Robot System

### 7.1  Robot UI component

Fixed position: bottom-right corner, always visible during blocks.

```
              ┌──────────────────────────────────┐
              │ "Smells good in the kitchen!"    │
              │                           ▼      │
              └───────────────────────────       │
                                                 │
                        [🤖 Robot avatar]        │
                        idle: subtle bob         │
                        speaking: mouth moves    │
```

Speech bubble:
- Appears above avatar when robot speaks
- Text appears word by word (typewriter effect, ~80ms/word)
- Auto-dismisses 2s after text completes
- Max width: 280px
- Does not block any interactive elements

### 7.2  Utterance types and timing

| Type | Per block | Timing rule |
|---|---|---|
| Neutral comment | 2–3× | Random within non-reminder, non-trigger windows |
| Contextual observation | 1–2× | Random, observing room state |
| PM Reminder A | 1× | Fixed: t=2:00 |
| PM Reminder B | 1× | Fixed: t=5:00 |

**Non-overlap rules (enforced by backend):**
- No utterance within 30s before or after a PM reminder
- No utterance within 60s before a trigger event
- No two utterances within 45s of each other
- Fake trigger events do not pause or trigger robot utterances

All utterance types use **identical avatar animation** — player cannot predict a PM reminder from the robot's visual behaviour.

### 7.3  Reminder text structure (Option C phrasing)

All reminders follow this pattern:

```
[CB component — High CB only]:
"I can see you're keeping an eye on the stove."

[Intention re-encoding — all conditions]:
"By the way, remember — [when condition], [specific action]."
```

Low AF: `[specific action]` = general ("take your medicine")
High AF: `[specific action]` = precise ("take your Doxycycline from the red round bottle, the one your cardiologist prescribed")

### 7.4  Audio delivery

| Source | Delivery |
|---|---|
| Neutral utterances | Pepper native TTS (real-time) |
| PM reminders | Pre-generated audio file, played via Pepper audio player |

Backend triggers Pepper by sending:
```python
# Neutral
pepper.say_neutral("Smells good in the kitchen!")

# PM reminder — plays pre-generated file
pepper.play_reminder("reminder_medicine_a_HH.mp3")
```

Prototype mode: both methods log to console + trigger Web Speech API in browser.

---

## 8  Encoding Screen (SCR-ENCODE)

### 8.1  Layout

```
┌──────────────────────────────────────────────────────┐
│  Before you start this round...                      │
│                                                      │
│  ┌─────────────────────────┐  ┌──────────────────┐  │
│  │  TASK 1                 │  │  TASK 2          │  │
│  │  [icon]                 │  │  [icon]          │  │
│  │  [description]          │  │  [description]   │  │
│  │  [image of target]      │  │  [image of       │  │
│  │  [image of distractor]  │  │   target +       │  │
│  │                         │  │   distractor]    │  │
│  └─────────────────────────┘  └──────────────────┘  │
│                                                      │
│  [Read both tasks aloud to the experimenter]         │
│                                                      │
│  Verification: What colour is the correct bottle?    │
│  ○ Red    ○ Orange    ○ Yellow                       │
│                                 [I've read both →]   │
└──────────────────────────────────────────────────────┘
```

### 8.2  Flow

```
Cards appear
    ↓
Player reads (experimenter observes oral reading)
    ↓
Player answers verification question
    ↓
Correct: "I've read both →" button activates
Wrong: "Try again" — cards re-displayed, quiz resets
    ↓
Player clicks confirm
    ↓
Cards slide off screen (not accessible again this block)
    ↓
Block timer starts → SCR-OVERVIEW
```

After encoding, task cards are **permanently removed** from the interface for this block. No sticky note, no help button, no way to review.

### 8.3  Data logged

```
encoding_start_at: timestamp
encoding_confirmed_at: timestamp  
encoding_quiz_attempts: int (1 = first try, 2+ = needed retry)
```

---

## 9  Fake Trigger System

### 9.1  Purpose and placement

One fake trigger per block, fires at approximately t=0:30 — before Reminder A. This establishes early in each block that events can appear without PM tasks being required.

### 9.2  Fake trigger catalogue

| Block / Pair | Fake trigger | Visual | Player action |
|---|---|---|---|
| All blocks | Delivery person | Doorbell + delivery avatar | Click "Sign for package" |
| Pair 2 block | Dishwasher done | Dishwasher light in kitchen | Click "OK, thanks" |
| Pair 3 block | Friend comes online (not Li Wei) | Green dot on Zhang Fang | Ignore or close |

### 9.3  Fake trigger flow

```
SSE: fake_trigger_fire { type: "delivery", ts: ... }
    ↓
Frontend: doorbell audio plays + bell icon flashes in sidebar
    ↓
If player navigates to 玄关:
    Delivery person avatar appears
    "Answer door" button (NOT "Report Task")
    Player clicks → "Package for you!" → [Sign] → done
    
If player does NOT navigate to 玄关 within 20s:
    Doorbell animation stops
    Delivery person leaves silently
    No penalty
```

**If player clicks "Report Task" during a fake trigger:**
System shows: *"Nothing to report right now."* — no score change, no indication this was a test.

### 9.4  Fake trigger logging

```
fake_trigger_appeared_at: timestamp
fake_trigger_type: string
fake_trigger_responded: boolean
fake_trigger_response_action: string | null
false_alarm: boolean  // true if player clicked "Report Task"
```

---

## 10  Post-Block Questionnaire (SCR-LIKERT)

### 10.1  Layout

Appears immediately after block timer ends (8:30). No transition, direct replace of game view.

```
┌──────────────────────────────────────────────────────┐
│  Round 2 complete! Quick check-in:                   │
│                                                      │
│  The reminders disrupted my focus.                   │
│  Strongly disagree  1  2  3  4  5  6  7  Strongly agree │
│                        ○  ○  ○  ○  ○  ○  ○              │
│                                                      │
│  The reminders helped me remember what to do.        │
│  Strongly disagree  1  2  3  4  5  6  7  Strongly agree │
│                        ○  ○  ○  ○  ○  ○  ○              │
│                                                      │
│  Any comments? (optional)  [________________]        │
│                                                      │
│                                      [Continue →]   │
└──────────────────────────────────────────────────────┘
```

"Continue →" only activates after both Likert items are answered.

### 10.2  Rest screen (SCR-REST)

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│           Take a short break.                        │
│                                                      │
│           Next round starts in:  23s                 │
│                                                      │
│           [Start now →]  (available after 10s)       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Player can skip the rest after 10s. Experimenter uses this time to check dashboard.

---

## 11  Scene Switching — Technical Implementation

### 11.1  Room navigation state

```typescript
type Room = 'overview' | 'balcony' | 'kitchen' | 'living' | 'entrance' | 'messages'

interface UIState {
  activeRoom: Room
  previousRoom: Room | null
  isTransitioning: boolean
  executeOverlayOpen: boolean
  executeTaskId: string | null
}
```

### 11.2  Framer Motion room transition

```tsx
// RoomCard.tsx — simplified
const variants = {
  overview: { 
    width: '30%', height: '45%', 
    position: 'relative' 
  },
  expanded: { 
    width: '100%', height: '100%',
    position: 'absolute', top: 0, left: 0,
    zIndex: 10
  }
}

<motion.div
  layout
  variants={variants}
  animate={activeRoom === roomId ? 'expanded' : 'overview'}
  transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
  onClick={() => !isTransitioning && setActiveRoom(roomId)}
>
  {activeRoom === roomId ? <RoomExpanded /> : <RoomCard />}
</motion.div>
```

**Transition lock:** `isTransitioning` is set true for 280ms on any room switch. Prevents double-click glitches.

### 11.3  Execute overlay

The SCR-EXECUTE overlay renders on top of **whatever room is currently active** — it does not require the player to be in a specific room:

```tsx
// ExecuteOverlay.tsx
<AnimatePresence>
  {executeOverlayOpen && (
    <motion.div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-2xl p-6 w-[480px]"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
      >
        <ExecuteContent taskId={executeTaskId} />
        <CountdownBar duration={30} onTimeout={handleTimeout} />
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

### 11.4  SSE event → UI state mapping

| SSE Event | Zustand action | Visual result |
|---|---|---|
| `block_start` | `startBlock(blockData)` | SCR-OVERVIEW activates, steaks spawn |
| `force_yellow_steak {hob}` | `forceYellow(hob)` | Target hob bar jumps to yellow zone |
| `reminder_fire {text, audio}` | `triggerRobot(text)` | Robot speech bubble appears |
| `trigger_appear {taskId}` | `showReportTask(taskId)` | Report Task button pulses on |
| `window_close {taskId}` | `closeWindow(taskId)` | Report Task button disappears, score 0 logged if not acted |
| `fake_trigger_fire {type}` | `triggerFake(type)` | Doorbell / indicator activates |
| `message_bubble {content}` | `addMessage(content)` | Bubble in message area + sidebar badge |
| `steak_spawn {hob}` | `spawnSteak(hob)` | New steak appears in hob |
| `block_end` | `endBlock()` | Game freezes → SCR-LIKERT |

---

## 12  Backend State Machine

### 12.1  Session states

```python
class SessionPhase(Enum):
    WELCOME         = "welcome"
    ONBOARDING      = "onboarding"
    PRACTICE        = "practice"
    BLOCK_ENCODING  = "block_encoding"
    BLOCK_RUNNING   = "block_running"
    BLOCK_QUEST     = "block_questionnaire"
    BLOCK_REST      = "block_rest"
    FINAL_QUEST     = "final_questionnaire"
    COMPLETE        = "complete"
```

### 12.2  Block timeline engine

The block timeline is a list of scheduled events. When a block starts, the engine registers all events with their delays:

```python
BLOCK_TIMELINE = [
    (0,     "block_encoding_start"),
    (30,    "block_running_start"),        # encoding confirmed → timer starts
    (35,    "fake_trigger_fire"),          # ~t=0:30 relative to running start
    (80,    "robot_neutral_1"),            # random within 60–110s
    (110,   "force_yellow_steak"),         # t_reminder_A − 10s
    (120,   "reminder_fire_A"),
    (210,   "trigger_appear_A"),           # ~1.5 min after reminder
    (240,   "window_close_A"),             # 30s window
    (260,   "steak_batch_2"),              # fill gap after Task A
    (270,   "robot_neutral_2"),
    (290,   "force_yellow_steak"),         # t_reminder_B − 10s
    (300,   "reminder_fire_B"),
    (390,   "trigger_appear_B"),
    (420,   "window_close_B"),
    (420,   "steak_final_batch"),
    (510,   "block_end"),
]
```

The engine uses `asyncio.create_task` + `asyncio.sleep` for each event. On `block_end`, all pending tasks are cancelled.

### 12.3  Action validation

Every POST to `/action` is validated against current session phase:

```python
def validate_action(session: Session, task_id: str) -> bool:
    if session.phase != SessionPhase.BLOCK_RUNNING:
        return False
    if session.current_window != task_id:
        return False  # window not open for this task
    if session.window_expired(task_id):
        return False
    return True
```

Frontend can send duplicate actions (e.g., network retry) — backend deduplicates by checking if a score already exists for this trial.

---

## 13  Complete Use Case Register

### Navigation
| UC | Trigger | Action | Result |
|---|---|---|---|
| UC-N1 | Click room card (overview) | setActiveRoom | Room expands, sidebar updates |
| UC-N2 | Click sidebar room icon | setActiveRoom | Room switches |
| UC-N3 | Click 🏠 home icon | setActiveRoom('overview') | All rooms visible |
| UC-N4 | Click room during transition | Blocked (isTransitioning=true) | No action |

### Steak (ongoing task)
| UC | Trigger | Action | Result |
|---|---|---|---|
| UC-K1 | Steak enters yellow zone | — | Progress bar pulses, kitchen dot turns yellow |
| UC-K2 | Click steak in yellow zone | flipSteak | +5 pts, steak resets to cooking |
| UC-K3 | Steak enters red zone | — | Progress bar shakes, audio alert, dot turns red |
| UC-K4 | Click steak in red zone | removeSteak | +5 pts, hob clears |
| UC-K5 | Steak reaches burn | — | −10 pts, black steak, dot pulses red |
| UC-K6 | force_yellow_steak SSE | — | Target hob jumps to yellow regardless of state |

### Messages (ongoing task)
| UC | Trigger | Action | Result |
|---|---|---|---|
| UC-M1 | message_bubble SSE | — | Bubble in message area, sidebar badge +1 |
| UC-M2 | Click reply A or B | postReply | +2 pts, bubble dismisses, badge clears |
| UC-M3 | 15s timeout | — | Bubble fades, no penalty, badge clears |

### PM task execution
| UC | Trigger | Action | Result |
|---|---|---|---|
| UC-P1 | trigger_appear SSE | — | Report Task button appears + pulses |
| UC-P2 | Click Report Task | openExecuteOverlay | SCR-EXECUTE overlay appears |
| UC-P3 | Complete execution + Confirm | postAction | Score logged, overlay closes |
| UC-P4 | Click "Not sure" | postAction (partial) | Partial score logged, overlay closes |
| UC-P5 | 30s countdown expires | handleTimeout | Score 0 logged, overlay closes |
| UC-P6 | window_close SSE (not acted) | hideReportTask | Button disappears, score 0 logged |

### Robot
| UC | Trigger | Action | Result |
|---|---|---|---|
| UC-R1 | reminder_fire SSE | — | Robot speaking animation, speech bubble, Pepper audio |
| UC-R2 | robot_neutral SSE | — | Same animation, neutral text |
| UC-R3 | Speech bubble auto-dismiss | — | Bubble fades after 2s, robot returns to idle |

### Fake triggers
| UC | Trigger | Action | Result |
|---|---|---|---|
| UC-F1 | fake_trigger_fire SSE | — | Doorbell audio + sidebar bell animation |
| UC-F2 | Navigate to 玄关 + click "Answer door" | handleFakeTrigger | Delivery avatar, sign button |
| UC-F3 | Click "Sign" | completeFakeTrigger | Delivery person leaves |
| UC-F4 | Click "Report Task" during fake | — | "Nothing to report" message, no penalty |
| UC-F5 | 20s no response | — | Fake trigger silently closes |

### Encoding
| UC | Trigger | Action | Result |
|---|---|---|---|
| UC-E1 | Block start | — | SCR-ENCODE appears with 2 task cards |
| UC-E2 | Answer verification quiz correctly | — | Confirm button activates |
| UC-E3 | Answer incorrectly | — | "Try again", quiz resets |
| UC-E4 | Click confirm | postEncoding | Cards removed, block timer starts |

### Block flow
| UC | Trigger | Action | Result |
|---|---|---|---|
| UC-B1 | block_end SSE | — | Game freezes, SCR-LIKERT appears |
| UC-B2 | Submit Likert | postQuestionnaire | SCR-REST (30s) |
| UC-B3 | Rest timer ends or "Start now" | — | SCR-ENCODE for next block (or SCR-FINAL) |

---

## 14  Prototype Scope (v0.1)

For the first runnable prototype, implement only:

| Component | Include | Exclude |
|---|---|---|
| Rooms | Kitchen (expanded only) + sidebar skeleton | All other rooms |
| Ongoing task | Steak (2 hobs, medium difficulty) | Messages, TV |
| PM task | Medicine pair (Task A only) | All other tasks |
| Robot | Avatar + speech bubble + mock audio | Pepper integration |
| Timing | 1 block, hardcoded HH condition | Latin Square, multi-block |
| Fake trigger | Delivery person (doorbell → sign) | Other fake trigger types |
| Encoding | Task card + quiz | Oral confirmation |
| Backend | Session start, SSE timeline, action endpoint, SQLite | Full API, admin dashboard |
| Dashboard | None | Full dashboard deferred |

**Prototype success criteria:**
1. SSE timeline fires all events within ±5s of scheduled time
2. Steak task creates genuine time pressure — cannot be ignored
3. Report Task button appears at correct time, 30s window enforces
4. Medicine task distractor logic works (round vs square bottle selectable)
5. Score updates live in top bar
6. All events logged to SQLite with correct timestamps
