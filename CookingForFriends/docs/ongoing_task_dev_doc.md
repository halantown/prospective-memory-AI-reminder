# CookingForFriends — Ongoing Task Redesign: Development Document

> **Date:** 2026-04-08
> **Status:** Design finalized, ready for implementation
> **Context:** This document captures all design decisions from the ongoing task brainstorming session. It serves as both a development spec and a prompt for AI-assisted coding.

---

## 1. Design Philosophy

The experiment simulates **one hour (17:00–18:00) before a dinner party**. The participant is preparing food, tidying the house, and managing phone messages — all while maintaining PM intentions encoded before the session.

### Core Principles

- **"Living a day, not playing a game."** No scores, no levels, no completion badges, no optimal strategies. The interface is functional, not entertaining.
- **No forced completion.** Participants can skip chores, ignore messages, or let food burn. Everything is recorded as behavioral data, nothing is punished.
- **Narrative-driven triggers.** Events happen because of story reasons (cat knocks things over, friend asks to wash hands), not because a task list says so.
- **Controlled variability.** The experience *feels* free but the timeline is fully scripted. All participants encounter the same events at the same times.

### Literature Grounding

- **Cooking as ongoing task:** Craik & Bialystok (2006) Breakfast Task — multi-dish time management as PM-relevant ongoing activity
- **Recipe viewing as behavioral measure:** Kourtesis et al. (2020) VR-EAL — active checking of PM notes recorded as monitoring indicator
- **Chores as filler/distractor:** Brooks et al. (2004) Virtual Bungalow — item sorting across rooms; EPELI (Jylkkä et al., 2023) — household chores with embedded PM
- **Phone messages as cognitive load:** Barnett & Coldiron (2023) VKP-PM — True/False judgments occupying verbal working memory; CAMPROMPT (Wilson et al., 2005) — general knowledge quizzes as distractor

---

## 2. Layout Overhaul: Fixed Floor Plan

### Current State

- 5 room cards, active room expands to 64%, inactive rooms stack in sidebar
- No spatial relationship between rooms
- Feels like "clicking slides in a presentation"

### New Design

- **Fixed top-down floor plan** filling the full screen (participants required to use fullscreen)
- **All rooms always visible** at fixed positions and sizes
- **Hallway** connects all rooms, providing visual paths for character movement
- **Kitchen is the largest room** (primary activity space)
- **Front door** at bottom-right of hallway, where visitors arrive
- No responsive/scaling concerns — fixed resolution, fullscreen only

### Floor Plan Layout

```
┌──────────────────┬─────────────────────┐
│                  │                     │
│     Kitchen      │    Living Room      │
│  (largest room)  │  (sofa, TV, shelf)  │
│                  │                     │
│  3 burners, oven ├──────────┬──────────┤
│  fridge, cutting │  Study   │ Bathroom │
│  board, spices,  │  (desk,  │ (washer, │
│  plating area    │  shelf)  │  rack)   │
├──────────────────┼──────────┴──────────┤
│                  │                     │
│   Dining Room    │     Hallway         │
│  (table for 6)   │  (connects rooms)   │
│                  │              [DOOR]  │
└──────────────────┴─────────────────────┘
```

### Room Navigation

- Click any room → character walks along hallway path to destination
- Movement uses **pre-drawn path waypoints** (not free movement)
- Brief transit delay simulates physical movement cost
- Character position visible at all times (emoji or simple sprite)
- Current room highlighted with border glow

### Implementation Notes

- Replace `WorldView.tsx` dynamic layout with fixed CSS Grid or absolute positioning
- Each room is a fixed-size `<div>` with SVG furniture layer + HTML interaction overlay
- `preserveAspectRatio="xMidYMid meet"` on all SVG furniture layers (already changed)
- Room interaction: click room to navigate there, then click objects within active room
- Inactive rooms are slightly dimmed but content remains visible (monitor stove from other rooms)

### Asset Audit And Preparation Plan

Current frontend implementation no longer depends on the old per-room SVG furniture as the main world representation. The active path is:

- `frontend/src/components/game/FloorPlanView.tsx`: renders a single `/assets/floorplan.png` as the base map
- `frontend/src/components/game/rooms/KitchenFurniture.tsx`: supports per-object PNG furniture overlays for the kitchen
- `frontend/src/components/game/rooms/KitchenRoom.tsx`: all cooking interaction is already separated into clickable hotspots
- Other rooms currently rely mostly on background art + lightweight HTML overlays for PM task buttons, visitors, and dining interactions

This means the art task should be treated as a **front-end asset replacement task**, not a gameplay-system rewrite.

#### FloorPlanView Zoom Design

The floorplan image is rendered with `objectFit: fill` and `imageRendering: pixelated`. All room positions (`ROOM_DEFS`) are stored as **percentages** of the image dimensions, so changing the image resolution never breaks hotspot alignment.

**Zoom behaviour:**
- All rooms zoom at `ZOOM_SCALE = 1.6×` using a CSS `scale()` + `translate()` transform anchored at the image top-left (`transform-origin: 0 0`).
- Translations are clamped so the image always fills the container with no empty borders (`tx ∈ [(1−S)×100%, 0%]`).

**Kitchen special case — top-left corner problem:**
The kitchen occupies the top-left corner of the floorplan. At 1.6–1.7× zoom the standard clamp forces `translate(0%, 0%)`, pinning the kitchen to the top-left of the view with no room to centre it. Solution:
- `ZOOM_SCALE_KITCHEN = 1.7` (slightly higher than global scale).
- `KITCHEN_MAX_OFFSET_X = 10`, `KITCHEN_MAX_OFFSET_Y = 15` — separate X/Y offsets applied after the initial X=8%,Y=8% baseline, allowing the image to shift right/down to show more of the room. These produce a visible dark gap on each axis so the kitchen does not feel flush against the phone/game edge.
- `ROOM_DEFS.kitchen.cy = 18` is kept low so `rawTy` naturally exceeds the Y clamp.
- `ROOM_DEFS.kitchen.w = 49.5` — extended from 44 to include the fridge (right edge was clipping at w=44). All STATION_POSITIONS left/width values are scaled by factor 44/49.5 (≈ 8/9) to preserve absolute pixel alignment.

#### Target Style Decision

- Base tile size: **48×48**
- Rendering goal: keep the readability of tiled assets, but avoid a harsh retro pixel-game feeling
- Preferred treatment:
  - build the layout from 48×48 pieces
  - export the final room/background compositions at a larger display resolution
  - keep object silhouettes clean and slightly roomy instead of over-dense tile packing
  - avoid mixing too many different shadow systems in one room

#### Purchased Pack: What Is Usable

Asset pack inspected: `~/Downloads/moderninteriors-win/`

Most useful folders:

- `1_Interiors/48x48/Room_Builder_48x48.png`
  - Best source for walls, borders, floors, baseboards, entryways, and room connectors
  - This should be the primary source for rebuilding the apartment background
- `1_Interiors/48x48/Room_Builder_subfiles_48x48/`
  - Useful when you want floors, walls, shadows, or connectors separated instead of packed in one sheet
- `1_Interiors/48x48/Theme_Sorter_48x48/`
  - Good overview sheets for browsing categories quickly
- `1_Interiors/48x48/Theme_Sorter_Singles_48x48/`
  - Best source for extracting individual furniture pieces as standalone PNG files
- `1_Interiors/48x48/Theme_Sorter_Shadowless_Singles_48x48/`
  - Best source when you want to place furniture onto a custom-composed room without inheriting baked black shadows
- `3_Animated_objects/48x48/spritesheets/`
  - Selectively useful for lightweight environmental animation

Most relevant categories for this project:

- `12_Kitchen`
- `2_Living_Room`
- `3_Bathroom`
- `4_Bedroom`
- `5_Classroom_and_Library`
- `26_Condominium`
- `1_Generic`

Useful animated objects already present in the pack:

- `animated_kitchen_oven_48x48.png`
- `animated_kitchen_oven_1cooker_48x48.png`
- `animated_kitchen_oven_2cookers_48x48.png`
- `animated_kitchen_oven_3cookers_48x48.png`
- `animated_kitchen_oven_4cookers_48x48.png`
- `animated_fridge_white_48x48.png`
- `animated_fridge_grey_48x48.png`
- `animated_sink_48x48.png`
- `animated_kitchen_sink_1_48x48.png`
- `animated_cat_48x48.png`
- several `animated_door_*_48x48.png`

#### What Should Be Reused Directly

The following can likely be used with minimal or no repainting:

- floor materials for kitchen, dining, hallway, bathroom
- wall modules and room borders
- kitchen counters and cabinet runs
- stove / oven / fridge / sink
- dining table and chairs
- sofa, TV stand, coffee table
- bookshelf / storage cabinet / sideboards
- bed, desk, office chair
- bathroom sink, cabinet, toilet, washer-like utility props
- doors and archways

#### What Should Be Custom-Composed Or Redrawn

The following areas should not simply be copy-pasted from random theme sheets:

- the **full apartment floor plan**
  - build from room-builder pieces so the layout matches the experiment exactly
- the **kitchen work triangle**
  - fridge, board, spice area, burners, oven, plating area must visually match hotspot positions
- any furniture used as a **PM target anchor**
  - bookshelf, cabinet, shelf, supply shelf should have a stable silhouette and empty visual space around the hotspot/button
- the **dining table interaction area**
  - leave enough clean surface space for table-setting overlays
- any object needing multiple visible states
  - burners off/on
  - oven idle/active
  - food prep / cooked / plated states if shown on top of counters

#### Recommended Shadow Rule

Use **shadowless singles** as the default source for furniture composition, then add room-level shadows manually in the final background or via CSS overlays.

Reason:

- easier to keep the whole house lighting consistent
- avoids mismatched baked shadows from different sheets
- easier to place interactive UI highlights over furniture cleanly

Use the regular shadowed singles only if a piece looks significantly better and is visually isolated enough not to clash.

#### Required Deliverables Before Frontend Integration

Prepare the following asset outputs first:

1. One final full-apartment background export
   - suggested output: `frontend/public/assets/floorplan_v2.png`
2. One room layout source file
   - layered PSD/Aseprite/Krita file for future edits
3. Individual transparent furniture PNGs for the kitchen interaction layer
   - fridge
   - cutting board area
   - spice rack / shelf
   - stove burners
   - oven
   - plating counter
4. Optional transparent furniture PNGs for other rooms if separate overlays are preferred
   - dining table set
   - living room furniture cluster
   - study shelf/desk cluster
   - bathroom shelf/washer cluster
5. Optional small animated spritesheets
   - oven light or cooker glow
   - fridge door blink/open cue
   - cat idle tail flick
   - door open cue

#### Room-By-Room Art Checklist

- Kitchen
  - Must-have: stove/oven, fridge, cutting board, spice shelf, sink, long lower counter, plating area
  - Nice-to-have: jars, bottles, trays, wall shelf details
- Dining room
  - Must-have: dining table, 6 chairs, cabinet or sideboard
  - Nice-to-have: rug, centerpiece, serving cart
- Living room
  - Must-have: sofa, coffee table, TV/media unit, shelf
  - Nice-to-have: cat bed, lamp, side table
- Study / bedroom area
  - Must-have: desk, chair, shelf/bookcase, bed
  - Nice-to-have: monitor, speakers, drawer unit
- Bathroom / utility area
  - Must-have: sink, toilet, storage shelf, washer/utility object
  - Nice-to-have: basket, towels, mirror
- Hallway / entrance
  - Must-have: front door, transitional flooring, visual connectors between rooms
  - Nice-to-have: shoe rack, coat storage, mat

#### Technical Constraints For Art Export

- Keep the final game background as a single flat image if schedule is tight
- Keep interactive objects aligned to current hotspot percentages unless the hotspot map is intentionally recalibrated
- Preserve enough negative space around hotspot regions for hover/selection states
- Export transparent PNGs only; avoid SVG for the room furniture replacement path
- If upscaling is needed, use integer scaling during composition first, then do final smoothing/export intentionally
- Do not rely on runtime tilemap frameworks for this build; all placement can remain hard-coded in React/CSS

---

## 3. Ongoing Task Line 1: Cooking (Primary)

### Overview

4 dishes prepared across the 15-minute block. Each dish has multi-step procedures with qualitatively different operations. Backend timeline controls major phase transitions; frontend handles step-level state machines.

### The Four Dishes

**1. Roasted Vegetables (longest wait, first to start)**

- Steps: fridge (select veggies) → cutting board (chop) → spice rack (season) → place on baking tray → oven → [long wait ~9 min] → remove from oven → plate → carry to dining room
- Character: Low active time, long passive wait. Creates the main window for chores.

**2. Tomato Soup (medium duration)**

- Steps: fridge (select ingredients) → cutting board (chop onion, tomato) → burner 2 (sauté base) → add water → [simmer ~5 min, occasional stir prompt] → add seasoning → ladle into bowl → carry to dining room
- Character: Periodic check-ins needed (stir), moderate cognitive load.

**3. Spaghetti (medium duration, sequential)**

- Steps: burner 1 (pot of water) → [wait for boil ~2 min] → add pasta → [cook ~2.5 min] → drain → add sauce from spice rack → toss → plate → carry to dining room
- Character: Clear sequential steps with defined wait periods.

**4. Steak (last to start, most time-pressure)**

- Steps: fridge (select steak) → cutting board (season/marinate) → burner 3 (heat pan) → place steak → [cook side 1 ~1.5 min] → flip → [cook side 2 ~1.5 min] → plate → carry to dining room
- Character: Dense operations, time-sensitive, requires attention.

### Approximate Timeline (in minutes within 15-min block)

```
0:00  ─── Roast veg: start prep (fridge → chop → season → oven)
0:40  ─── Roast veg IN OVEN ═══════════════════════════════════ 10:00 remove
2:00  ─── Soup: start prep (fridge → chop → sauté)
3:10  ─── Soup SIMMERING ════════════════ 8:00 season + serve
5:00  ─── Pasta: start (boil water)
5:20  ─── Pasta WATER HEATING ═══ 7:00 add pasta
7:00  ─── Pasta COOKING ═════════ 9:30 drain + sauce + plate
9:00  ─── Steak: start prep (fridge → season)
9:30  ─── Steak COOKING SIDE 1 ══ 11:00 flip
11:00 ─── Steak COOKING SIDE 2 ══ 12:30 plate
13:00-15:00 ─── Final plating, carry remaining dishes to dining room
```

### Kitchen Interaction Points

Each kitchen object is a **clickable area** in the SVG furniture layer. Clicking opens a **popup** showing available actions for that object in its current state.

| Object        | Location in viewBox   | Function                 | Popup Actions (vary by state)                        |
| ------------- | --------------------- | ------------------------ | ---------------------------------------------------- |
| Fridge        | Top-right             | Select ingredients       | List of ingredients needed for current dish          |
| Cutting Board | Upper-left of counter | Prepare/chop ingredients | "Chop [ingredient]", "Season [ingredient]"           |
| Spice Rack    | Lower-left shelf      | Add seasonings           | "Add salt", "Add pepper", "Add herbs", "Add oil"     |
| Burner 1      | Center-left           | Pasta pot                | "Place pot", "Add pasta", "Drain", "Add sauce"       |
| Burner 2      | Center                | Soup pot                 | "Place pot", "Sauté", "Add water", "Stir", "Season" |
| Burner 3      | Center-right          | Steak pan                | "Heat pan", "Place steak", "Flip", "Remove"          |
| Oven          | Lower-right           | Roast vegetables         | "Place tray", "Set temperature", "Remove tray"       |
| Plating Area  | Counter area          | Assemble finished dishes | "Plate [dish name]"                                  |

### Cooking State Machine (per dish)

Each dish progresses through a linear state chain. The popup only shows the **currently valid action(s)** for that dish's state. Backend pushes phase transitions at fixed times; frontend manages the step-by-step progression within each phase.

```
IDLE → PREP (at fridge/cutting board) → COOKING (on burner/oven) → READY → PLATED → SERVED (in dining room)
```

- If participant misses a Kitchen Timer prompt, the dish state still advances (food might "overcook" — visual change but no punishment)
- Popup actions are **not trick questions** — they show real operations, participant just needs to remember which one is next from the recipe

### Visual Feedback

- Burners: color change indicates heat state (gray=off, orange=active, red=high)
- Pots/pans: content changes appearance as cooking progresses (raw→cooking→done→overcooked)
- Oven: indicator light shows on/off/ready
- Use emoji or simple colored shapes as placeholder assets initially

---

## 4. Recipe System (Press-and-Hold)

### Design

- Recipe lives in a **dedicated Tab** on the phone sidebar
- Participant **presses and holds** a button to view the recipe; **releasing hides it**
- This forces a resource trade-off: while viewing recipe, participant cannot interact with kitchen or respond to messages

### Recipe Content

- Shows all 4 dishes in a vertical scrollable list
- Each dish shows its **full step list**
- **Current step is highlighted** (system tracks progress)
- Participant uses recipe to remind themselves what to do next

### Behavioral Data Captured

- `recipe_view_start` timestamp (mousedown/touchstart)
- `recipe_view_end` timestamp (mouseup/touchend)
- Duration of each view
- Count of views per dish
- Time between recipe view and subsequent kitchen action

### Implementation

```
Phone component:
- Tab bar: [Messages] [Recipe]
- Recipe tab content: press-hold overlay
- onMouseDown → show recipe panel, record timestamp, send WS event
- onMouseUp → hide recipe panel, record timestamp, send WS event
- Recipe panel renders 4 dish cards with step lists
- Current step per dish tracked in gameStore (updated by backend events)
```

---

## 5. Kitchen Timer Notifications

### Design

- Cooking reminders are delivered as **phone notifications** from "Kitchen Timer 🍳"
- They appear in the same message stream as friend messages
- They are `notification` type (no reply needed)
- Participant set up these timers "before the experiment started" (narrative justification)

### Examples

- 🍳 Kitchen Timer: "Water is boiling — time to add the pasta!"
- 🍳 Kitchen Timer: "Give the soup a stir"
- 🍳 Kitchen Timer: "Steak ready to flip!"
- 🍳 Kitchen Timer: "Vegetables are done — take them out of the oven!"

### Implementation

- Backend timeline pushes `phone_message` events with `sender: "Kitchen Timer"`, `category: "notification"`, `avatar: "🍳"`
- Frontend renders them identically to other notifications
- Locked phone shows banner preview (participant must unlock to read full message if it's long)

---

## 6. Ongoing Task Line 2: Chores (Narrative-Driven Filler)

### Design Philosophy

Chores fill cooking wait periods. Each is triggered by a **narrative event**, not a task list. Participants are never told "go do this now" — they experience events that make doing something feel natural.

### Chore 1: Set the Table (Dining Room)

**Trigger:** Robot says "Friends arriving at 6, maybe set the table first?" at experiment start.

**Operation:**

- Enter dining room → table is empty
- Bottom bar shows utensils: plate, knife, fork, glass
- Drag utensils to 6 seat positions (or click-select + click-target)
- 6 seats × 4 utensils = 24 placements
- One-time task, no repeat

**Later:** Each completed dish gets carried here. Click plated dish in kitchen → "Carry to dining room" → switch to dining room → click table to place. Table visually fills up over the session.

**State:** Persists across room switches. If participant leaves mid-setup and returns, progress is kept.

### Chore 2: Tidy the Living Room

**Trigger:** ~4 min into session, notification: "Your cat knocked things over in the living room 😾" or robot mentions it.

**Operation:**

- Enter living room → 6-8 objects scattered on floor/sofa/coffee table
- Click object to select (highlights) → click correct destination to place
- Objects: cup→coffee table, book→bookshelf, remote→TV stand, blanket→sofa arm, magazine→shelf, toy→basket
- Wrong placement: object bounces back (gentle feedback, no penalty)

**Possible second wave:** Later in session, a few more items appear ("cat did it again" or items from a delivered package).

**State:** Persists. Each placed object stays placed.

### Chore 3: Tidy the Bathroom

**Trigger:** ~7 min, friend message: "I'm almost there, can I wash my hands when I arrive?" — participant realizes bathroom is messy.

**Operation:**

- Enter bathroom → washing machine door open with 3-4 clothes inside, some items on floor
- Drag/click clothes from washer to drying rack positions
- Click floor items (towel, bottles) to put them in correct spots
- ~6-8 total interactions

**State:** One-time task. Persists.

### Chore 4: Fetch Speaker from Study

**Trigger:** ~8 min, friend message or robot: "Should we have music? The Bluetooth speaker is on the study bookshelf"

**Operation:**

- Enter study → click speaker on bookshelf → item enters "carrying" state
- Navigate to living room → click destination to place speaker
- Single cross-room transport task

**State:** One-time. Once placed, done.

### Interaction Pattern (Shared)

All chores use **click-select + click-target**:

1. Click an out-of-place object → it highlights/lifts
2. Click the correct destination → object animates to position
3. If wrong destination → object returns to original spot with brief shake

No drag-and-drop required (avoids small-target issues in fixed floor plan). Reuse the visual language of PM item selection (highlight + confirm) but with **different visual styling** (warm colors for chores vs cool colors for PM) to avoid confound.

---

## 7. Ongoing Task Line 3: Phone Messages

### Message Types

| Type                         | Count per block | Reply needed          | Purpose                            |
| ---------------------------- | --------------- | --------------------- | ---------------------------------- |
| Question (friend chat)       | 12              | Yes (2 options)       | Cognitive load — occupy verbal WM  |
| Notification (system/social) | 6               | No                    | Information noise, realism         |
| Kitchen Timer                | ~8-10           | No (modal dismiss)    | Cooking phase transition cues      |

> **Note**: PM Trigger messages have been removed from the phone system. PM triggers now arrive via phone call UI (separate system).

### JSON Data Structure

Chat messages and notifications are stored in **separate arrays** in the timeline config file (e.g., `block_default.json`):

```json
{
  "contacts": [
    { "id": "alice", "name": "Alice", "avatar": "👩" },
    ...
  ],
  "chats": [
    {
      "id": "q_001",
      "t": 30,
      "contact_id": "alice",
      "text": "Hey, I'm bringing cakes! ...",
      "correct_choice": "Yep, €48!",
      "wrong_choice": "Hmm no, should be €46",
      "feedback_correct": "Great, ordering now! 🎂",
      "feedback_incorrect": "Wait, 12 × 4 = 48 actually! Thanks anyway 😄"
    }
  ],
  "notifications": [
    {
      "id": "n_001",
      "t": 100,
      "sender": "Laundry 🧺",
      "text": "Your laundry is halfway done"
    }
  ]
}
```

The WebSocket `phone_message` event includes a `channel` field (`"chat"` or `"notification"`) so the frontend routes them correctly:
- `chat` → stored in `phoneMessages`, displayed in `ChatView` under the relevant contact
- `notification` → displayed as auto-dismiss banner only; accumulated in `lockSystemNotifications` for lock screen

### Question Message Data Model

Old structure (deprecated):
```json
{ "choices": ["...", "..."], "correct_index": 0 }
```

New structure:
```json
{
  "correct_choice": "Yep, €48!",
  "wrong_choice": "Hmm no, should be €46",
  "feedback_correct": "...",
  "feedback_incorrect": "...",
  "correct_position": null
}
```

`correct_position: null` means frontend randomly assigns correct choice to left (0) or right (1) button on first render and fixes it — this naturally counterbalances answer position across participants.

### Phone UI Architecture

```
PhoneSidebar.tsx          (iPhone shell + Dynamic Island + status bar + lock screen logic)
├── LockScreen.tsx         (three sections: Kitchen (orange, top) > Messages > System; Kitchen derives timers from activeCookingSteps)
├── NotificationBanner.tsx (floating pill at top, 5s auto-dismiss, countdown bar)
├── KitchenTimerBanner.tsx (legacy non-blocking helper; derives from activeCookingSteps if rendered)
├── KitchenTimerModal.tsx  (legacy no-op; do not reintroduce blocking timer queue)
├── PhoneTabBar.tsx        (bottom tabs: Chats / Recipe)
├── ContactStrip.tsx       (left 48px vertical avatar list — hidden until contact sends first msg)
├── ChatView.tsx           (right panel: chat header + message scroll)
│   ├── ChatBubble.tsx     (friend: left-aligned; participant reply: right-aligned blue)
│   └── ChoiceButtons.tsx  (vertical stacked, full-width buttons)
└── RecipeTab.tsx          (recipe viewer placeholder)
```

### Contact Badge System (3-state)

| Badge | Meaning |
|-------|---------|
| **Red number (e.g. "2")** | N messages from this contact not yet seen (contact not visited) |
| **Small red dot** (no number) | All messages seen but ≥1 question not yet answered |
| **No badge** | All questions answered |

State flow per message: `unread` → (switch to contact) → `read` → (tap choice) → `answered`

`ContactStrip` filters to `visibleContacts` — contacts with ≥1 message in the store. Contacts are hidden until their first message arrives.

### Friend Reply Persistence

Friend reply bubbles are shown with a 2.5-second delay after the participant answers. The `feedbackVisible` flag is stored on the `PhoneMessage` object in Zustand (not in component local state). This ensures feedback survives phone lock/unlock cycles which unmount/remount `ChatView`.

### Question Message Design

- Packaged as **contextual friend conversations**, not quiz questions
- Two reply options, both natural responses, one correct based on scenario logic
- Correct rate serves as ongoing engagement measure
- Example: Tom: "I'm driving from Leiden, 25 min away. I leave at 5:35, will I make it by 6?" → "You'll make it" / "Might be late" (correct: "You'll make it")

### Message Sources

- ~40% party-related (friends attending asking practical questions)
- ~40% general friend chat / light arithmetic
- ~20% system notifications (weather, delivery, battery, storage)

### Nudge Mechanism

- If **5+ question messages** go unanswered, backend sends a notification: `"You have several unread messages"`
- This is dynamically generated — not pre-scheduled in the JSON
- Nudge does not repeat within 60 seconds

### Phone Lock Screen

- Auto-locks after 15s of no phone interaction
- **Two sections** (Messages above System), separated by a plain divider line
- Messages section: shows per-contact summary (contact name + unread count + truncated latest text)
- System section: shows accumulated system notifications (persist until session reset)
- Sections only visible when they have content
- Fixed-height layout — inner scroll if too many notifications; "Tap to unlock" always pinned at bottom
- Lock screen does **not** show the status bar clock

---

## 8. Trial Session (3 minutes)

### Purpose

Familiarize participants with all interaction types so experimental performance reflects memory, not interface learning.

### Structure

```
0:00-0:30  — Welcome text overlay explaining basic controls
             "Click rooms to move. Click objects to interact.
              Press and hold Recipe to view cooking steps.
              Reply to phone messages from friends."

0:30-1:30  — Kitchen practice
             - Simple recipe: "Fry an egg"
             - Open fridge → select egg → cutting board (crack) → burner (cook) → plate
             - Practice press-hold recipe viewing
             - One Kitchen Timer notification fires

1:30-2:00  — Phone practice
             - One friend message arrives, practice unlock + reply
             - One notification arrives (no reply needed)

2:00-2:40  — PM practice
             - One dummy PM trigger fires (doorbell)
             - Navigate to target room → open furniture popup → select item → confirm
             - NOT a real PM task, just operation practice

2:40-3:00  — "Ready?" confirmation screen
             - Brief summary of what to expect
             - Confirm understanding of all interaction types
```

### Implementation

- Separate timeline config file (`trial_session.json`)
- Simplified kitchen with 1 burner, 1 dish
- No scoring, no data analysis — pure familiarization
- Can be replayed if participant requests

---

## 9. Technical Implementation Plan

### Architecture (unchanged)

- **Frontend:** React 18 + Vite + TypeScript + Tailwind + Zustand
- **Backend:** FastAPI + PostgreSQL + WebSocket
- **Communication:** Timeline engine pushes events via WS; frontend manages local state machines and reports actions back

### What Changes

#### Frontend — Layout (`WorldView.tsx` rewrite)

- Replace dynamic card layout with **fixed CSS Grid floor plan**
- All rooms rendered simultaneously at fixed positions
- Active room has highlight border, inactive rooms slightly dimmed
- Character sprite moves along predefined waypoints between rooms
- Phone sidebar remains on the right (25% width)

#### Frontend — Kitchen (`KitchenRoom.tsx` rewrite)

- Replace steak-flipping mechanic with multi-dish state machine
- Each kitchen object (fridge, burners, oven, cutting board, spice rack, plating) is a clickable area
- Clicking opens a popup with context-sensitive action list
- Dish state tracked in Zustand store, updated by backend events + participant actions

#### Frontend — Recipe Tab (new component)

- New tab in `PhoneSidebar.tsx`
- Press-and-hold interaction for viewing
- Renders 4 dish cards with step progression
- Behavioral data sent via WS on view start/end

#### Frontend — Chores (new components per room)

- `LivingRoom.tsx`: scattered objects + click-to-place interaction
- `BedroomRoom.tsx` (Dining): simplified one-time table setting + dish placement
- `BathroomRoom.tsx`: washer→rack + floor item cleanup
- `StudyRoom.tsx`: single fetch-and-carry task
- All use click-select + click-target pattern
- Room states persist in Zustand store

#### Frontend — Phone Messages (modify `PhoneSidebar.tsx`)

- Add Kitchen Timer as a notification sender
- Redesign question content from quiz to contextual conversations
- Add nudge mechanism (5+ unanswered → nudge notification)
- Keep existing lock screen, banner, and reply mechanics

#### Backend — Timeline

- New timeline config files with cooking phase events, chore triggers, Kitchen Timer notifications
- Existing `ongoing_task_event` WS message type can be extended for cooking + chores
- Phone messages updated with new contextual content

### Asset Strategy

- **Phase 1 (now):** Emoji + simple colored SVG shapes as placeholders
- **Phase 2 (later):** AI-generated consistent-style assets (icon/simple illustration style)
- All assets placed within SVG `viewBox="0 0 400 300"` coordinate system using `<image>` tags or inline SVG paths
- Interactive hotspots as HTML overlays with percentage positioning on top of SVG layer

---

## 10. Next Steps (Priority Order)

### Immediate (this week)

1. **Sketch the floor plan layout** in code — fixed grid, all rooms visible, hallway connecting them. No furniture details yet, just colored rectangles with labels. Get character movement working between rooms via waypoints.
2. **Prototype kitchen cooking** for ONE dish (pasta or steak). Implement: clickable burner → popup with actions → state progression → Kitchen Timer notification. Use emoji placeholders.
3. **Implement press-hold recipe** on phone. Just a static panel for now showing pasta steps. Record view timestamps.
4. **Test the loop:** Start cooking → get Kitchen Timer notification → check recipe → perform action → wait → get next notification. Confirm the cognitive load chain works.

### Next (following week)

5. Add remaining 3 dishes with full state machines
6. Implement chore interactions (living room first — most complex)
7. Rewrite phone messages with contextual friend conversations
8. Build 3-minute trial session
9. Implement dining room dish serving (table filling up visually)

### Before Pilot

10. Full 15-minute timeline with all events synchronized
11. Asset upgrade (AI-generated consistent style)
12. Data logging verification — all behavioral measures recording correctly
13. Deploy to Hetzner cloud server (2-core, 4GB)
