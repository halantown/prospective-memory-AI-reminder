# Cooking System

Current reference for the cooking ongoing task, kitchen interaction model, and
related visual assets.

## Purpose

Cooking is the primary ongoing task. It creates sustained, predictable cognitive
load while the participant also handles phone messages and PM trigger
encounters.

The participant prepares four dishes during the main experiment:

- Roasted Vegetables
- Tomato Soup
- Spaghetti
- Steak

The schedule is deterministic. Every participant sees the same cooking sequence
at the same gameplay times.

## Runtime Ownership

| Concern | Owner |
|---------|-------|
| Recipe definitions and options | `backend/data/cooking_recipes.py` |
| Cooking schedule | `backend/data/cooking_timeline.py` and runtime plan lane |
| Runtime execution | `backend/engine/cooking_engine.py` |
| Frontend phone recipe | `frontend/src/components/game/phone/RecipeTab.tsx` |
| Cooking cue | `frontend/src/components/game/phone/KitchenTimerBanner.tsx` |
| Kitchen hotspots | `frontend/src/components/game/rooms/KitchenRoom.tsx` |

Cooking runs on the shared backend `GameClock`. PM trigger pipelines pause that
clock, so active-step deadlines, wait steps, phone delivery, and time ticks
resume after the PM flow completes.

## Interaction Flow

Terminology:

- **Cooking Indicator**: the persistent orange cooking cue above the phone tabs.
  The component is currently `KitchenTimerBanner.tsx`.
- **Kitchen Utensils**: clickable kitchen interaction points. Internally these
  are still called `station` in backend/frontend code.

```text
CookingEngine activates a step
  -> Recipe tab updates
  -> Cooking Indicator shows the step and countdown
  -> Participant navigates to the kitchen
  -> Participant clicks the matching Kitchen Utensil
  -> Popup shows 3-4 options
  -> Correct, wrong, or timeout result is logged
  -> Dish advances to the next active/wait step
```

Recipe and chat share the phone UI, so reading the recipe and handling messages
compete for attention.

## Dishes and Steps

### Roasted Vegetables

Character: early start, long oven wait, low active density.

| Step | Kitchen Utensil | Type | t (s) |
|------|-----------------|------|-------|
| Select vegetables | `fridge` | active | 0 |
| Chop vegetables | `cutting_board` | active | 30 |
| Season with olive oil and herbs | `spice_rack` | active | 60 |
| Place tray in oven | `oven` | active | 90 |
| Oven cooking | `oven` | wait 480s | 120 |
| Remove from oven | `oven` | active | 600 |
| Plate roasted vegetables | `plating_area` | active | 630 |

### Tomato Soup

Character: medium duration, needs periodic attention during simmer.

| Step | Kitchen Utensil | Type | t (s) |
|------|-----------------|------|-------|
| Select onion and tomatoes | `fridge` | active | 120 |
| Chop onion and tomatoes | `cutting_board` | active | 150 |
| Saute base in pot | `burner2` | active | 210 |
| Add water | `burner2` | active | 240 |
| Simmering | `burner2` | wait 120s | 270 |
| Stir soup | `burner2` | active | 330 |
| Continue simmering | `burner2` | wait 120s | 360 |
| Add salt and pepper | `spice_rack` | active | 420 |
| Ladle into bowl | `plating_area` | active | 480 |

### Spaghetti

Character: linear, clear wait periods.

| Step | Kitchen Utensil | Type | t (s) |
|------|-----------------|------|-------|
| Place pot with water | `burner1` | active | 180 |
| Water heating | `burner1` | wait 120s | 210 |
| Add pasta | `burner1` | active | 300 |
| Pasta cooking | `burner1` | wait 120s | 330 |
| Drain pasta | `burner1` | active | 420 |
| Add sauce | `spice_rack` | active | 450 |
| Toss pasta with sauce | `burner1` | active | 480 |
| Plate spaghetti | `plating_area` | active | 510 |

### Steak

Character: latest start, dense and time-critical.

| Step | Kitchen Utensil | Type | t (s) |
|------|-----------------|------|-------|
| Select steak | `fridge` | active | 540 |
| Season steak | `cutting_board` | active | 570 |
| Heat pan | `burner3` | active | 600 |
| Place steak in pan | `burner3` | active | 630 |
| Cooking side 1 | `burner3` | wait 90s | 660 |
| Flip steak | `burner3` | active | 750 |
| Cooking side 2 | `burner3` | wait 90s | 780 |
| Plate steak | `plating_area` | active | 840 |

## Kitchen Utensils

Kitchen station image assets are optional. If a PNG is absent under
`frontend/public/assets/kitchen/<station>.png`, the frontend falls back to a
labelled station graphic.

| Internal station ID | Used by |
|---------------------|---------|
| `fridge` | Roasted Vegetables, Tomato Soup, Steak |
| `cutting_board` | Roasted Vegetables, Tomato Soup, Steak |
| `spice_rack` | Roasted Vegetables, Tomato Soup, Spaghetti |
| `burner1` | Spaghetti |
| `burner2` | Tomato Soup |
| `burner3` | Steak |
| `oven` | Roasted Vegetables |
| `plating_area` | All dishes |

Kitchen positions are percentages of the kitchen room div and should match
`STATION_POSITIONS` in `KitchenRoom.tsx`.

| Station ID | left | top | width | height |
|------------|------|-----|-------|--------|
| `fridge` | 84.4% | 5% | 9% | 28% |
| `cutting_board` | 54.2% | 15.5% | 15.1% | 9% |
| `spice_rack` | 77.3% | 13% | 8% | 12% |
| `burner1` | 29.1% | 12.25% | 12% | 16.5% |
| `burner2` | 31% | 15% | 0% | 0% |
| `burner3` | 31% | 15% | 0% | 0% |
| `oven` | 13.1% | 24% | 12% | 12% |
| `plating_area` | 51.5% | 51% | 14.2% | 19% |

## Recipe Display

The recipe lives in the phone Recipe tab. The phone lock screen is currently
disabled during the active experiment; chats, recipe, and system banners remain
accessible.

Recipe display rules:

- Shows all four dishes.
- Shows previous, current, and next step when available.
- Current active steps are highlighted.
- Completed, missed, and wrong-choice steps use the same grey strikethrough
  treatment.
- The recipe itself does not use red/green correctness coding.

## Popup and Feedback Rules

- Only open a popup when the clicked Kitchen Utensil has an active step.
- Show 3-4 context-appropriate options.
- Correct choice: ascending chime (`cookingCorrect`), green border + scale pulse
  on selected card, popup holds for 600 ms then closes.
- Wrong choice: low buzzer (`cookingWrong`), red border + horizontal shake on
  selected card, popup holds for 1000 ms then closes.
- Timeout: descending tone (`cookingMissed`), "Missed!" in Cooking Indicator,
  no popup open.
- Wait steps require no action and auto-transition.

## Sound Effects

All cooking/robot sounds are synthesized via Web Audio API (no asset files).

| Sound ID | Trigger | Description |
|----------|---------|-------------|
| `cookingCorrect` | Correct option selected | Two-tone ascending chime (C5→E5) |
| `cookingWrong` | Wrong option selected | Low buzzer (180 Hz square, bandpass filtered) |
| `cookingMissed` | Step timeout | Two-tone descending (A4→E4, triangle) |
| `robotBeep` | Robot idle comment / proactive prompt | Two quick sine blips (800→1000 Hz) |

## Robot Proactive Prompt

After 3 consecutive cooking errors (wrong + missed combined, reset on any
correct answer), the robot speaks a brief supportive comment pointing to the
recipe. The robot plays a `robotBeep` chirp before the speech bubble appears.

- Threshold: 3 consecutive errors.
- Cooldown: 90 seconds between triggers.
- Speech bubble auto-dismisses after 4 seconds.
- Non-modal — participant can keep cooking during the prompt.
- Does NOT fire during PM overlays (game time frozen).
- Logged as `robot_proactive_prompt` event in backend.

## Chat Message Expiry

Chat messages with answer choices expire after 50 seconds if unanswered. The
timer is per-message, starting when the message arrives on the frontend.

- Reply window: 50 000 ms (`MESSAGE_REPLY_WINDOW_MS` in `useMessageExpiry.ts`).
- On expiry: choice buttons disappear, a `feedbackMissed` bubble appears
  (contact-specific text, mild social-friction tone), and a soft notification
  sound (`phoneMessageSoft`) plays.
- PM overlay pause: timers pause when `gameTimeFrozen` is true (PM pipeline
  active) and resume with remaining time when gameplay resumes.
- Backend logging: frontend sends `phone_message_expired` WS event; handler
  marks `PhoneMessageLog.status = "missed"` and stores the expiry timestamp.
- Badge logic: expired messages no longer show the red "unanswered" dot on the
  contact avatar.

## Measures

Logged cooking measures include:

- Step accuracy: correct, wrong, missed
- Step response time from activation to selection
- Per-dish completion and accuracy
- Recipe viewing frequency and duration
- Runtime snapshots including active cooking steps, phone state, and PM state

## Optional Asset Paths

These paths are optional enhancement points, not required current assets.

Kitchen station paths follow:

```text
frontend/public/assets/kitchen/<station_id>.png
```

Dish image paths follow:

```text
frontend/public/assets/dishes/<dish_id>.png
```
