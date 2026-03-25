# Game Audit & Visual Asset Integration Guide

> **Date**: 2026-03-25
> **Scope**: Full codebase audit against experiment plan v3 + integration roadmap for visual assets + development prompts
> **Codebase snapshot**: Screenshot from 2026-03-21 + all source files reviewed

---

## Part 1: Codebase Audit — Current State vs. Experiment Design

### 1.1 What Works ✅

| System | Status | Notes |
|--------|--------|-------|
| **Session flow** | ✅ Working | Token login → encoding → playing → microbreak → next block → debrief. Full lifecycle. |
| **Latin Square counterbalancing** | ✅ Working | 6 groups × 4 unreminded positions = 24 combos. `config.py` + `condition_assigner.py` + `admin.py` all aligned. |
| **12 PM task definitions** | ✅ Complete | `pm_tasks.py` has all 12 tasks with trigger types, target/distractor pairs, encoding text, quiz data, baseline reminders. |
| **Block timeline engine** | ✅ Working | `timeline.py` fires events on schedule via WebSocket. Time ticks, phone messages, robot speech, PM triggers all pushing. |
| **Timeline generator** | ✅ Working | `timeline_generator.py` builds per-participant timelines with correct trigger times, reminder lead times, activity watchers, fake triggers, neutral utterances. |
| **WebSocket bidirectional** | ✅ Working | `game_handler.py` handles start_game, room_switch, task_action, pm_attempt, phone_reply, phone_read, mouse_position, heartbeat. Each handler wrapped in try-except. |
| **Connection management** | ✅ Working | Queue-based pump, keepalive, supersede-on-reconnect (code 4001), participant eviction. |
| **Execution window** | ✅ Working | 30s primary + 60s extended. Silent backend timer. Auto-scores 0 on expiry. Room sequence tracking. |
| **PM scorer (0-6)** | ✅ Working | `pm_scorer.py` implements full 0-6 scale. Accepts room, target_selected, action_performed. Score 6/5/4/3/2/1/0 mapped to behavior. |
| **PM attempt recording** | ✅ Working | `PMAttemptRecord` model captures granular timing: trigger_fired_at, trigger_received_at, first_action_time, first_room_switch, first_pm_room_entered, target_selected_at, action_completed_at, room_sequence. |
| **Resumption lag tracking** | ✅ Working | Recorded on first ongoing task action after PM completion. |
| **Encoding quiz** | ✅ Working | Multi-attempt with re-show on failure, auto-pass after 2 failures. Quiz attempts logged to DB. |
| **Phone message system** | ✅ Working | Rich messages with replies (arithmetic/commonsense/social), ads, chat, PM triggers. Banner + lock screen + read/reply logging. |
| **Kitchen (steak cooking)** | ✅ Working | 3 pans, state machine (empty→cooking→ready_to_flip→cooking_side2→ready_to_plate→done/burnt). Color gradient. Timers run even when room inactive. |
| **Dining (table setting)** | ✅ Working | 4 seats × 4 utensils. Drag-and-drop + click fallback. Round cycling with score. |
| **Room dimming** | ✅ Working | Inactive rooms dimmed (opacity 0.45, pointer-events none). Urgent steaks pierce through dimming. |
| **Trigger effects** | ✅ Working | Audio (Web Audio API synthesized tones) + visual banners for all 4 trigger types + fake triggers. |
| **Mouse tracking** | ✅ Working | 200ms sampling, 5s batch upload. |
| **Admin dashboard** | ✅ Working | Create participant, list, overview stats, live online status. |
| **Data logging** | ✅ Working | InteractionLog, MouseTrack, OngoingTaskScore, GameStateSnapshot, PhoneMessageLog all modeled and written. |
| **Dev token** | ✅ Working | `ABC123` auto-created/reset on startup. Blocks and trials pre-seeded. |

### 1.2 What's Missing or Broken ❌

#### ❌ CRITICAL — Blocks Experiment

| Issue | Severity | Location | Details |
|-------|----------|----------|---------|
| **Room layout mismatch** | 🔴 Critical | `WorldView.tsx` | Code has 5 rooms: Kitchen, **Bedroom** (dining), Living Room, Study, **Bathroom** (laundry). But screenshot shows **"Balcony"** instead of "Bathroom". The experiment plan says "Bathroom" is where soap/softener/handcream targets are. Need to decide: keep "Bathroom" as in pm_tasks.py, or rename to "Balcony"? Currently the code says `bathroom` everywhere in the backend PM tasks. |
| **"Dining Room" is actually "Bedroom"** | 🔴 Critical | `WorldView.tsx` line 32 | The room labeled "Dining Room" in the screenshot is mapped to `id: 'bedroom'` in code. This is because `BedroomRoom.tsx` renders the table-setting task. But PM tasks in `pm_tasks.py` use `target_room: "bedroom"` for gift bag, napkin rings, vase — these targets should appear in the same room that has the table. **The naming is inconsistent and will confuse during scoring.** |
| **Visual asset integration — 0%** | ✅ Fixed | Multiple | `RoomItems.tsx` (36 SVG components) copied to `src/components/game/items/`. `PMTargetItems.tsx` rewritten with SVG rendering and 3-item groups. Encoding card SVGs served from `public/assets/encoding/`. |
| **Encoding cards use wrong images** | ✅ Fixed | `EncodingPage.tsx` | Encoding page now displays SVG illustrations from `/assets/encoding/{task_id}.svg` above the story text. Smaller image shown during re-show phase. |
| **PMTargetItems uses wrong item data** | ✅ Fixed | `PMTargetItems.tsx` | Rewritten with correct 3-item groups (Target + D1 + D2) matching `pm_tasks.py`. Uses SVG components from `ROOM_ITEMS` map. Item IDs now match scorer expectations (`{task_id}_target`, `{task_id}_d1`, `{task_id}_d2`). |
| **No third ongoing task** | 🟡 Major | Design gap | Experiment plan §4.3 lists 3 parallel cognitive loads: steak cooking, table setting, phone messages. The phone fills this role. But the plan mentions a third room/task ("待定"). Current implementation only has cooking + dining + phone. This is sufficient per the latest meeting decisions but should be explicitly noted. |
| **Activity trigger detection incomplete** | ✅ Fixed | `KitchenRoom.tsx`, `BedroomRoom.tsx` | Kitchen now emits `all_steaks_plated` event after plating last steak (all pans empty). Dining now emits `table_complete` event on round completion. |
| **Block-specific message pools missing** | 🟡 Major | `data/messages/` | Only `messages_day1.json` exists. Blocks 2 and 3 fall back to day1 messages. The senders (Alice, Emma, Tom, Jake) should change per block to match the guest (Mei/Lucas/Sophie). PM trigger messages in the pool reference `pm_b1_t1`, `pm_b1_t3` — these need block-specific variants. |
| **Reminder text resolution is baseline-only** | 🟡 Major | `timeline.py` `_resolve_reminder()` | Always returns `task_def.baseline_reminder` regardless of condition. For AF condition, should return the AF-level reminder. For AFCB, should return AF+CB reminder. Currently no AF/AFCB variant texts exist in the DB or task registry. |
| **Robot avatar is just an emoji** | 🟡 Medium | `RobotAvatar.tsx` | Shows 🤖 emoji. Should be Pepper 2D avatar per experiment plan. Not blocking but reduces ecological validity. |
| **No Pepper visual/walking animation** | 🟡 Medium | `RobotAvatar.tsx` | Robot is pinned to bottom-left of current room. Should move between rooms and follow participant. |
| **Oven indicator not functional** | 🟠 Minor | `KitchenFurniture.tsx` | Oven is drawn as static furniture. The `oven_indicator_green` trigger visual (b1_dish) has no corresponding oven state change in the frontend. |
| **Washer/dryer indicators not functional** | 🟠 Minor | `BathroomFurniture.tsx` | Washing machine drawn as static. `washer_indicator_done` / `dryer_indicator_done` trigger visuals have no state changes. |
| **Phone PM trigger messages not differentiated** | 🟠 Minor | `PhoneSidebar.tsx` | PM trigger phone messages are correctly hidden from the frontend (no special styling) — this is intentional. But the trigger messages in `messages_day1.json` have `"type": "pm_trigger"` which is stripped by `build_ws_payload`. This works correctly. ✅ |
| **`block_default.json` is outdated** | 🟠 Minor | `data/timelines/` | Static fallback timeline still references old trigger IDs (`pm_b1_t1`, `pm_b1_t2`). The `timeline_generator.py` generates correct timelines dynamically, so this file is only used as emergency fallback. Should be updated or deleted. |

### 1.3 Timeline Engine Deep Audit

**Flow verification (reading the code path):**

```
EncodingPage → "I've memorized this" → quiz pass → "Start Cooking!" button
  → wsSend({ type: 'start_game', data: { block_number } })
  → setPhase('playing') → React renders GamePage
  → GamePage mounts → useWebSocket(sessionId, blockNumber)
  → WebSocket connects → ws.onopen fires
  → Phase is 'playing' → sends start_game message
  → Backend _ws_receiver → _handle_start_game
  → Block status check (PENDING/ENCODING) → set PLAYING
  → run_timeline(participant_id, block_number, condition, send_fn, db_factory)
  → load_timeline → timeline_generator.generate_block_timeline (or fallback JSON)
  → asyncio.create_task(_run()) → events fire on schedule
```

**Identified issues in the timeline flow:**

1. **Double start_game**: The `GamePage` sends `start_game` from `useWebSocket`'s `ws.onopen` callback. But `_handle_start_game` also gets called. If the block is already PLAYING (e.g., page refresh), the `_handle_start_game` guard rejects it, and the auto-start in `handle_game_ws` picks it up. This is handled correctly but the two paths could race. The `_active_timelines` dict and cancel-before-create prevents duplicate timelines. ✅

2. **Activity watcher fallback timing**: `ACTIVITY_WATCH_CONFIG` defines `b1_soap: watch_from=440, fallback=530`. But `timeline_generator.py` passes `fallback_time=watch_cfg["fallback"]` which is 530 (absolute seconds from block start). In `_register_activity_watcher`, `fallback_at = start_time + fallback_time_offset`. This is correct — fallback fires at start_time + 530s. ✅

3. **Phone message scheduling**: ✅ **Fixed**. `timeline_generator.py` now loads actual message IDs and timestamps from `messages_day{N}.json` pool files instead of generating counter-based IDs. PM trigger type messages are filtered out (injected separately by PM trigger logic).

4. **Reminder placeholder resolution**: The generator creates `"text": "{{reminder:b1_book}}"`. In `_run()`, this is resolved by `_resolve_reminder(task_id, condition)` which always returns `task_def.baseline_reminder`. For CONTROL condition, this still returns a baseline reminder text — but CONTROL should have NO reminders. **However**, looking more carefully: `timeline_generator.py` line 111-115 skips reminder events for CONTROL: `is_reminded = (condition != "CONTROL" and task_id != unreminded_task_id)`. So CONTROL blocks never have `robot_speak` reminder events in the timeline. ✅ The issue is only that AF and AFCB conditions both get the same baseline text.

5. **Event ordering**: Events at the same timestamp are sorted by `type_priority` (block_start=0, block_end=99, everything else=50). Multiple events at the same time (e.g., t=240 has pm_trigger + phone_message + ongoing_task_event) fire sequentially in the same tick. This is fine for WebSocket delivery. ✅

### 1.4 Scoring System Audit

**Score 6 (Perfect)**: Correct room + correct target + correct action + ≤15s. ✅
**Score 5 (Delayed)**: All correct + >15s but ≤30s. ✅
**Score 4 (Target correct, action error)**: Right target, wrong action. ✅
**Score 3 (Room correct, target wrong)**: Right room, picked wrong item. ✅
**Score 2 (PM intent, wrong room)**: Went to wrong room. ✅
**Score 1 (Very late)**: After 30s but before 60s. ✅
**Score 0 (No response)**: No PM behavior in 60s. Auto-scored by window expiry. ✅

**Target matching**: `pm_scorer.py` accepts both full description match and ID-based match (`{task_id}_target`). The frontend's `PMTargetItems.tsx` sends IDs like `b1_book_target`, `b1_book_d1`, `b1_book_d2`. ✅ IDs now aligned after PMTargetItems rewrite.

### 1.5 Room-Name Mapping Issue (Critical)

The screenshot and code have a naming inconsistency that must be resolved:

| In Code (`WorldView.tsx`) | In Screenshot | In `pm_tasks.py` | Actual Function |
|---------------------------|---------------|-------------------|-----------------|
| `kitchen` | Kitchen | kitchen | Steak cooking ✅ |
| `bedroom` | **Dining Room** | bedroom | Table setting + PM targets for giftbag/napkinrings/vase |
| `living_room` | Living Room | living_room | PM targets for dish/pot/speaker |
| `study` | Study | study | PM targets for book/vinyl/hanger |
| `bathroom` | **Balcony** | bathroom | Washer/dryer + PM targets for soap/softener/handcream |

**Problem**: The `bedroom` room renders the Dining Room UI, but `pm_tasks.py` assigns targets to `bedroom` expecting it to be a bedroom (dresser, wardrobe, windowsill). The `bathroom` room renders a balcony with plants/washer, but pm_tasks.py expects a bathroom (shelf above sink).

**Decision needed**: Either (a) rename the rooms in the frontend to match pm_tasks.py, or (b) update pm_tasks.py to match the actual room contents. Option (a) is simpler — the table-setting task can be in a "Dining Room" and the target_room in pm_tasks.py can stay "bedroom" as a backend identifier. The user never sees the room ID, only the label.

**Recommendation**: Keep backend IDs as-is. Update frontend labels to be semantically correct. Add a mapping layer. The room where table-setting happens should be labeled "Dining Room" (already is). The room with washer should be "Balcony" (already is in screenshot). Update the encoding card text and `target_room` display to show the user-facing label, not the internal ID.

---

## Part 2: Visual Asset Integration Specification

### 2.1 Files to Integrate

**Encoding Card SVGs (12 files):**
```
frontend/assets/encoding_card/b1_book.svg
frontend/assets/encoding_card/b1_giftbag.svg
frontend/assets/encoding_card/b1_dish.svg
frontend/assets/encoding_card/b1_soap.svg
frontend/assets/encoding_card/b2_vinyl.svg
frontend/assets/encoding_card/b2_napkinrings.svg
frontend/assets/encoding_card/b2_pot.svg
frontend/assets/encoding_card/b2_softener.svg
frontend/assets/encoding_card/b3_hanger.svg
frontend/assets/encoding_card/b3_speaker.svg
frontend/assets/encoding_card/b3_vase.svg
frontend/assets/encoding_card/b3_handcream.svg
```

**Room Item Components (1 file, 36 components):**
```
frontend/assets/RoomItems.tsx  → 12 groups × 3 items (Target/D1/D2)
```

**Avatar Components (1 file):**
```
frontend/assets/Avatars.tsx  → Avatar, AvatarSVG, CHARACTERS, PHONE_SENDERS
```

### 2.2 Encoding Page Integration

**Current state**: `EncodingPage.tsx` renders text-only cards with colored info boxes (trigger/room/target/action). No images.

**Target state**: Each encoding card should display the corresponding SVG illustration above the text content.

**Implementation**:

1. Move SVG files to `frontend/public/assets/encoding/` so they're served as static files.
2. In `EncodingPage.tsx`, add an `<img>` tag that loads the SVG based on `task_config.task_id`:
```tsx
const svgPath = `/assets/encoding/${card.task_config.task_id}.svg`
<img src={svgPath} alt="Target item" className="w-full max-w-[280px] mx-auto" />
```
3. Update `_task_def_to_encoding_card()` in `admin.py` to set `target_image` to the SVG path pattern.

### 2.3 PMTargetItems Rewrite — From Emoji to SVG Components

**Current state**: `PMTargetItems.tsx` has a hardcoded `TASK_ITEM_PAIRS` array with emoji placeholders and incorrect descriptions. It renders 2 items per task (target + distractor).

**Target state**: Renders 3 items per task (Target + D1 + D2) using the SVG components from `RoomItems.tsx`. Items appear as small interactive scene elements in each room.

**Key changes**:

1. **Import `ROOM_ITEMS` from `RoomItems.tsx`** — provides `{ target, d1, d2 }` for each task_id.
2. **Rewrite `TASK_ITEM_PAIRS`** — align with `pm_tasks.py` definitions. Use 3 items instead of 2.
3. **Render SVG components inside room scenes** — each item is a small SVG rendered at a specific position within the room's coordinate space.
4. **Item IDs** must match what `pm_scorer.py` expects: `{task_id}_target`, `{task_id}_d1`, `{task_id}_d2`.
5. **Randomize item order** per participant (but deterministically based on participant seed) so target position varies.

**Rendering approach**:
```tsx
import { ROOM_ITEMS } from '../../assets/RoomItems'

// In the room component, wrap items in an SVG viewbox
<svg viewBox="0 0 200 120" className="w-full h-full">
  {items.map((item, i) => {
    const Comp = item.component  // e.g., B1BookTarget
    return <Comp key={item.id} x={positions[i].x} y={positions[i].y} scale={0.8}
                 clickable={isActive} onClick={() => handleSelect(item.id)} />
  })}
</svg>
```

### 2.4 Scorer Alignment

When the PMTargetItems rewrite is done, the `pm_attempt` message sent from frontend must include:
```json
{
  "type": "pm_attempt",
  "data": {
    "action_step": "Bring to living room and give to Mei",
    "target_selected": "b1_book_target",  // or "b1_book_d1" / "b1_book_d2"
    "room": "study",
    "timestamp": 1711234567.89
  }
}
```

The scorer in `pm_scorer.py` already handles `{task_id}_target` pattern matching. The action string must match `task_config.target_action` for a correct action score.

### 2.5 Avatar Integration

**Current state**: Phone messages use single-character colored circles (emoji-based). Robot is 🤖 emoji.

**Target state**: Use `Avatar` component from `Avatars.tsx` for phone message senders. Use `CHARACTERS` for guest-specific avatars (Mei/Lucas/Sophie).

**Changes**:
1. In `PhoneSidebar.tsx`, replace the inline avatar div with `<Avatar name={msg.sender} color={getColorForSender(msg.sender)} size={28} />`.
2. Map phone message senders to colors using `PHONE_SENDERS` lookup.

---

## Part 3: Activity Trigger Gap Fix

### 3.1 Problem

Activity triggers (`b1_soap`, `b2_napkinrings`, `b3_speaker`) fire when game-state conditions are met. But the frontend never sends the events that the backend watches for:

- `all_steaks_plated` → Kitchen never reports this. The `handlePanClick` in `KitchenRoom.tsx` sends `plate` action but never checks if all 3 pans have been plated in a cycle.
- `table_full_set` → Dining sends `round_complete` but the backend watches for `table_complete` event.
- `message_batch_end` → No mechanism exists to signal batch completion.

### 3.2 Fix

**Kitchen (all_steaks_plated)**:
In `KitchenRoom.tsx` `handlePanClick` case `ready_to_plate`:
```tsx
// After plating, check if all pans are now empty (a full cycle completed)
const updatedPans = get().pans
const allEmpty = updatedPans.every(p => p.state === 'empty')
if (allEmpty) {
  wsSend({
    type: 'task_action',
    data: { task: 'steak', event: 'steak_plated', all_plated: true, timestamp: Date.now() / 1000 }
  })
}
```

**Dining (table_full_set)**:
In `BedroomRoom.tsx` when `allComplete` becomes true:
```tsx
wsSend({
  type: 'task_action',
  data: { task: 'dining', event: 'table_complete', round: diningRound + 1, timestamp: Date.now() / 1000 }
})
```

**Phone (message_batch_end)**:
Add a special message in the message pool with `"type": "batch_end"`. When the timeline fires it, the frontend receives it as a regular phone message. The backend's `_check_activity_conditions` already watches for `task: 'phone', event: 'batch_end'`. But this event needs to be triggered differently — it should fire from the timeline after a set of messages, not from user action. **Alternative**: Have the timeline fire a `phone_batch_end` event directly as a `pm_trigger` type, bypassing the phone system. The `timeline_generator.py` already handles this for activity triggers via `pm_watch_activity`.

---

## Part 4: Block-Specific Message Pools

### 4.1 Current State

Only `messages_day1.json` exists with senders Alice, Emma, Tom, Jake. These names don't match the guest names (Mei, Lucas, Sophie).

### 4.2 Required Files

```
data/messages/messages_day1.json  — Block 1 (Mei): senders include Mei + friends
data/messages/messages_day2.json  — Block 2 (Lucas): senders include Lucas + friends
data/messages/messages_day3.json  — Block 3 (Sophie): senders include Sophie + friends
```

Each file needs:
- ~20 regular messages (arithmetic/commonsense/social) with 3-choice replies
- ~5 ads (no replies)
- ~3 chat messages (no replies)
- PM trigger messages for communication-type triggers in that block
- Appropriate timing (`t` values) matching the timeline generator's message schedule

### 4.3 PM Trigger Messages per Block

| Block | Comm Trigger Task | Trigger Message Sender | Trigger Message Content |
|-------|-------------------|----------------------|------------------------|
| 1 | b1_giftbag | "Delivery" or system | "Your package has been delivered to the front door!" |
| 2 | b2_vinyl | Lucas | "Hey, can you put on some music for tonight? That vinyl I liked last time?" |
| 3 | b3_handcream | Sophie | "Hey! Do you still have that hand cream I loved? The one that smelled so nice?" |

---

## Part 5: Reminder Text Variants

### 5.1 Current Gap

`_resolve_reminder()` always returns `task_def.baseline_reminder`. This is a short, generic reminder like "Remember to find the book for Mei."

For the experiment to work:
- **CONTROL**: No reminder (already handled — no reminder events in timeline)
- **AF**: Detailed reminder with visual cues matching encoding
- **AFCB**: AF content + contextual bridge prefix

### 5.2 Where to Store

Option A: In `pm_tasks.py` as additional fields on `PMTaskDef`.
Option B: In `ReminderMessage` DB table (already modeled in `block.py`).
Option C: Pre-generate during participant creation and store in `PMTrial.reminder_text`.

**Recommendation**: Option A for now (fastest). Add `af_reminder` and `afcb_reminder_template` fields to `PMTaskDef`. The AFCB template uses `{activity}` placeholder filled at runtime based on user's current activity.

### 5.3 Example for b1_book

```python
baseline_reminder="Remember to find the book for Mei.",
af_reminder="Remember to find the red book with the mountain cover, titled Erta Ale, on the second shelf in the study. Bring it to Mei in the living room.",
afcb_reminder_template="Since you're {activity}, take a moment — remember to find the red book with the mountain cover, titled Erta Ale, on the second shelf in the study. Bring it to Mei.",
```

---

## Part 7: Priority Order

| Priority | Task | Effort | Impact | Status |
|----------|------|--------|--------|--------|
| **P0** | Rewrite PMTargetItems with SVG components + 3 items | 3-4 hours | Fixes core experiment mechanic | ✅ Done |
| **P0** | Integrate encoding card SVGs into EncodingPage | 30 min | Fixes encoding quality | ✅ Done |
| **P0** | Fix item IDs to match scorer expectations | 30 min | Fixes scoring accuracy | ✅ Done (part of PMTargetItems rewrite) |
| **P1** | Fix activity trigger detection (kitchen + dining) | 1 hour | Enables activity-type PM triggers | ✅ Done |
| **P1** | Fix phone message scheduling (use pool IDs) | 1 hour | Ensures all messages delivered | ✅ Done |
| **P1** | Create messages_day2.json and messages_day3.json | 2 hours | Block-specific content | ⬜ Pending |
| **P2** | Add AF/AFCB reminder text variants | 2 hours | Enables condition differentiation | ⬜ Pending |
| **P2** | Resolve room naming (bedroom ↔ dining room) | 1 hour | Consistency | ⬜ Pending |
| **P3** | Replace robot emoji with Pepper SVG | 1 hour | Ecological validity | ⬜ Pending |
| **P3** | Add oven/washer state indicators | 1 hour | Trigger visual feedback | ⬜ Pending |
| **P3** | Update block_default.json or remove | 15 min | Cleanup | ⬜ Pending |
