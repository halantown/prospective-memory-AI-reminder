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

| Public asset path | Internal station ID | Used by |
|-------------------|---------------------|---------|
| `assets/kitchen/fridge.png` | `fridge` | Roasted Vegetables, Tomato Soup, Steak |
| `assets/kitchen/cutting_board.png` | `cutting_board` | Roasted Vegetables, Tomato Soup, Steak |
| `assets/kitchen/spice_rack.png` | `spice_rack` | Roasted Vegetables, Tomato Soup, Spaghetti |
| `assets/kitchen/burner1.png` | `burner1` | Spaghetti |
| `assets/kitchen/burner2.png` | `burner2` | Tomato Soup |
| `assets/kitchen/burner3.png` | `burner3` | Steak |
| `assets/kitchen/oven.png` | `oven` | Roasted Vegetables |
| `assets/kitchen/plating_area.png` | `plating_area` | All dishes |

Kitchen positions are percentages of the kitchen room div and should match
`STATION_POSITIONS` in `KitchenRoom.tsx`.

| Station ID | left | top | width | height |
|------------|------|-----|-------|--------|
| `fridge` | 78% | 2% | 20% | 32% |
| `cutting_board` | 22% | 2% | 28% | 14% |
| `spice_rack` | 2% | 72% | 25% | 20% |
| `burner1` | 18% | 32% | 20% | 30% |
| `burner2` | 40% | 32% | 20% | 30% |
| `burner3` | 60% | 32% | 20% | 30% |
| `oven` | 65% | 70% | 33% | 28% |
| `plating_area` | 52% | 2% | 24% | 14% |

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
- Correct choice: brief green feedback, mark step complete, advance.
- Wrong choice: brief red feedback, mark step failed, advance.
- Timeout: mark step missed, show "Missed!" feedback in the Cooking Indicator,
  advance.
- Wait steps require no action and auto-transition.

## Measures

Logged cooking measures include:

- Step accuracy: correct, wrong, missed
- Step response time from activation to selection
- Per-dish completion and accuracy
- Recipe viewing frequency and duration
- Runtime snapshots including active cooking steps, phone state, and PM state

## Asset Specification

| Asset | Recommendation |
|-------|----------------|
| Kitchen utensil images | PNG with transparency, 256 x 256 px |
| Dish images | PNG with transparency, 512 x 512 px |
| Perspective | Top-down, matching the floor plan |
| Style | Pixel art or flat illustration matching the existing home aesthetic |

Dish image paths:

| Public asset path | Dish ID |
|-------------------|---------|
| `assets/dishes/roasted_vegetables.png` | `roasted_vegetables` |
| `assets/dishes/tomato_soup.png` | `tomato_soup` |
| `assets/dishes/spaghetti.png` | `spaghetti` |
| `assets/dishes/steak.png` | `steak` |

Archived/older assets may exist under frontend `_archive` folders. Treat them as
reference only unless a current component still imports them.
