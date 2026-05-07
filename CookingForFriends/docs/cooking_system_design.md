# Cooking System — High-Level Design

## 1. Core Concept

The cooking system is a **timeline-driven ongoing task** that runs for 15 minutes. The participant prepares 4 dishes simultaneously. Every operation has a fixed time window on the timeline — if the participant doesn't act in time, the step is skipped and the system moves on.

The cooking system exists to create **sustained, predictable cognitive load** that competes with phone messages (unpredictable interruptions) and PM tasks for the participant's attention.

## 2. Interaction Flow

**Terminology**
- **Cooking Indicator**: the persistent orange cooking cue shown above the phone tabs. It displays the current cooking step and countdown. The component is currently `KitchenTimerBanner.tsx`, but user-facing docs should call it the Cooking Indicator.
- **Kitchen Utensils**: all clickable kitchen interaction points, including the fridge, cutting board, burners, oven, spice rack, and plating area. These may still be named `station` internally in backend/frontend code.

```
Timeline triggers a new cooking step
    ↓
Recipe tab on phone updates: shows current step + countdown
    ↓
Participant press-holds phone → sees recipe with current step & remaining time
    ↓
Participant releases phone → goes to kitchen
    ↓
Participant clicks the correct Kitchen Utensil (e.g., burner, fridge, cutting board)
    ↓
Popup appears with 3-4 options (1 correct + 2-3 distractors)
    ↓
Correct → step completes, wait for next step
Wrong → visual feedback (brief red flash), step marked as failed, auto-advance
Timeout → step auto-skipped, next step becomes active
```

**Key constraint:** Recipe tab and Chat tab share the phone. Viewing the recipe and reading/replying to messages are mutually exclusive.

## 3. The Four Dishes

### Dish 1: Roasted Vegetables (longest passive time)
- **Character:** Long oven wait, low active steps, first to start
- **Steps:**
  1. Fridge → select vegetables (distractors: wrong ingredients)
  2. Cutting board → chop vegetables (distractors: wrong action e.g. "blend", "peel")
  3. Spice rack → season with olive oil + herbs (distractors: wrong seasoning combo)
  4. Oven → place tray and set temperature (distractors: wrong temperature)
  5. [WAIT ~8 min — oven cooks automatically]
  6. Oven → remove tray (distractors: wrong action e.g. "increase temperature")
  7. Plating area → plate roasted vegetables

### Dish 2: Tomato Soup (periodic attention needed)
- **Character:** Needs occasional stirring during simmer, medium duration
- **Steps:**
  1. Fridge → select onion + tomatoes (distractors: wrong vegetables)
  2. Cutting board → chop onion and tomatoes (distractors: wrong action)
  3. Burner 2 → sauté base in pot (distractors: wrong cookware/action)
  4. Burner 2 → add water (distractors: wrong liquid e.g. "add milk")
  5. [WAIT ~2 min — simmering]
  6. Burner 2 → stir soup (distractors: wrong action)
  7. [WAIT ~2 min — continue simmering]
  8. Spice rack → add salt + pepper (distractors: wrong seasoning)
  9. Plating area → ladle into bowl

### Dish 3: Spaghetti (sequential, clear steps)
- **Character:** Linear progression, defined wait periods
- **Steps:**
  1. Burner 1 → place pot with water (distractors: wrong cookware)
  2. [WAIT ~2 min — water heating]
  3. Burner 1 → add pasta (distractors: wrong ingredient e.g. "add rice")
  4. [WAIT ~2 min — pasta cooking]
  5. Burner 1 → drain pasta (distractors: wrong action e.g. "add more water")
  6. Spice rack → add sauce (distractors: wrong sauce type)
  7. Burner 1 → toss pasta with sauce (distractors: wrong action)
  8. Plating area → plate spaghetti

### Dish 4: Steak (time-critical, last to start)
- **Character:** Dense operations, requires sustained attention, most time-pressure
- **Steps:**
  1. Fridge → select steak (distractors: wrong meat cut)
  2. Cutting board → season steak (distractors: wrong action e.g. "slice")
  3. Burner 3 → heat pan (distractors: wrong cookware)
  4. Burner 3 → place steak (distractors: wrong action)
  5. [WAIT ~1.5 min — cooking side 1]
  6. Burner 3 → flip steak (distractors: wrong action e.g. "remove", "press down")
  7. [WAIT ~1.5 min — cooking side 2]
  8. Plating area → plate steak

## 4. Timeline

Design principle: **At any given moment (after the initial ramp-up), at least 2 dishes should have a pending active step**, ensuring sustained cognitive load throughout the 15-minute session.

```
Time    Event                                           Active dishes
─────   ─────────────────────────────────────────────   ─────────────
0:00    Roast Veg step 1: select vegetables (30s)       [RV]
0:30    Roast Veg step 2: chop vegetables (30s)         [RV]
1:00    Roast Veg step 3: season (30s)                  [RV]
1:30    Roast Veg step 4: place in oven (30s)           [RV]
2:00    Roast Veg WAIT starts (oven cooking)            [—]
2:00    Soup step 1: select ingredients (30s)            [Soup]
2:30    Soup step 2: chop (30s)                          [Soup]
3:00    Pasta step 1: place pot with water (30s)         [Soup, Pasta]
3:30    Soup step 3: sauté base (30s)                    [Soup, Pasta]
4:00    Soup step 4: add water (30s)                     [Soup, Pasta]
4:30    Soup WAIT starts (simmering)                     [Pasta]
4:30    — gap: only pasta water heating —
5:00    Pasta step 3: add pasta (30s)                    [Pasta]
5:30    Soup step 6: stir soup (30s)                     [Soup, Pasta]
6:00    — pasta cooking wait —
6:30    Soup WAIT 2 continues                            [—]
7:00    Pasta step 5: drain (30s)                        [Pasta, Soup]
7:00    Soup step 8: add seasoning (30s)                 [Pasta, Soup]
7:30    Pasta step 6: add sauce (30s)                    [Pasta, Soup]
8:00    Pasta step 7: toss (30s)                         [Pasta]
8:00    Soup step 9: ladle into bowl (30s)               [Pasta, Soup]
8:30    Pasta step 8: plate spaghetti (30s)              [Pasta]
9:00    Steak step 1: select steak (30s)                 [Steak]
9:30    Steak step 2: season (30s)                       [Steak]
10:00   Roast Veg step 6: remove from oven (30s)         [RV, Steak]
10:00   Steak step 3: heat pan (30s)                     [RV, Steak]
10:30   Steak step 4: place steak (30s)                  [RV, Steak]
10:30   Roast Veg step 7: plate vegetables (30s)         [RV, Steak]
11:00   Steak WAIT (cooking side 1)                      [Steak]
12:30   Steak step 6: flip (30s)                         [Steak]
13:00   Steak WAIT (cooking side 2)                      [Steak]
14:00   Steak step 8: plate steak (30s)                  [Steak]
14:30   Session wind-down
15:00   END
```

**Notes on timeline:**
- Default step window: **30 seconds**. Adjust in pilot if too tight or too loose.
- Gaps exist around 4:30-5:00 and 6:00-7:00 — these are intentional lighter moments (only 1 dish active). Phone messages should be denser during these windows to maintain overall load.
- PM triggers should be placed during high-load periods (2+ active dishes) to maximize ongoing-task disengagement cost.
- The timeline is fully deterministic — every participant sees the same sequence at the same times.

## 5. Recipe Display (Phone)

The recipe lives in the **Recipe tab** on the phone (bottom tab bar: 💬 Chats | 📖 Recipe).
The phone no longer locks during the active experiment; chats, recipe, and system banners remain immediately accessible.
The Cooking Indicator is the primary recurring pressure cue and stays visible above both phone tabs.

**Phone lock status:** lock-screen behavior is intentionally disabled for now. `LockScreen.tsx`,
`phoneLocked`, and `phoneLastActivity` may still exist as legacy code, but the runtime phone UI
should be treated as always unlocked unless the lock-screen feature is explicitly reintroduced.

**Press-and-hold mechanic:**
- Participant presses and holds anywhere on the Recipe tab to view the recipe
- Releasing hides the recipe
- While holding: cannot interact with chat, kitchen, or anything else

**Recipe content when viewed:**
- Shows all 4 dishes in a 2x2 grid
- Each dish shows the previous step, current step, and next step when available
- Previous, completed, missed, and wrong-choice steps use the same grey strikethrough treatment
- Current steps are highlighted; future steps are dimmed
- The recipe itself does not use red/green correctness coding

**Behavioral data logged:**
- `recipe_view_start`: timestamp (press)
- `recipe_view_end`: timestamp (release)
- Duration of each view
- Which dish/step was current at time of viewing
- Game state snapshot: active cooking steps, pending messages, PM task status

## 6. Kitchen Interaction

**Kitchen Utensils** are clickable areas in the kitchen room:

| Kitchen Utensil | Function                        |
|-------------|--------------------------------|
| Fridge       | Select raw ingredients          |
| Cutting Board| Prep actions (chop, season)     |
| Burner 1     | Pasta                          |
| Burner 2     | Soup                           |
| Burner 3     | Steak                          |
| Oven         | Roasted vegetables             |
| Spice Rack   | Seasonings and sauces          |
| Plating Area | Final plating of finished dish  |

**On click:** popup appears with 3-4 options. Only 1 is correct for the current step. Options are context-appropriate distractors (wrong ingredients, wrong actions, wrong settings).

**Popup rules:**
- Correct choices briefly flash the popup border green, then close and advance.
- Wrong choices briefly flash the popup border red, then close and advance.
- Missed steps flash the Cooking Indicator red with "Missed!" before the next step appears.
- Only appears if the clicked Kitchen Utensil is relevant to a currently active step
- If clicked Kitchen Utensil has no active step: brief "nothing to do here" feedback, no popup
- After correct selection: popup closes, step marked complete, brief green feedback
- After wrong selection: popup closes, step marked failed, brief red feedback, auto-advance to next step
- Popup auto-dismisses after step timeout

## 7. Scoring (Ongoing Task DV)

**Cooking step accuracy:**
- Per step: correct (1) / incorrect (0) / missed (0)
- Aggregate: percentage of steps completed correctly out of total steps
- Per-dish breakdown available

**Step response time:**
- Time from step activation to participant's selection
- Only for steps where participant made a selection (not missed)

**Recipe viewing behavior (process measure):**
- View frequency, duration, timing relative to step activation
- Used to understand participant's monitoring strategy

## 8. Integration with Phone Messages

- Phone messages and recipe share the same device — mutually exclusive access
- During cooking gaps (only 1 active dish or wait periods), message frequency should increase
- During high-load periods (2 active dishes), messages still arrive but participant must choose what to prioritize
- Message timeline and cooking timeline are both pre-determined and synchronized

## 9. State Machine (Per Dish)

```
IDLE → ACTIVE (step N) → COMPLETED / SKIPPED → ACTIVE (step N+1) → ... → DONE
```

- Backend pushes step activations at fixed timeline timestamps
- Frontend displays current step in recipe, enables corresponding Kitchen Utensil
- On correct action: state → next step (or DONE if last)
- On wrong action: state → next step (marked as failed)
- On timeout: state → next step (marked as missed)
- WAIT states: no action needed, countdown visible in recipe, auto-transitions

## 10. Open Items for Pilot Calibration

1. **30-second step window** — may be too tight or too loose. Pilot will test.
2. **Number of distractors** — 3-4 options per popup. May simplify to 2 if cognitive load is already high enough from multitasking.
3. **Timeline gaps** — verify that message density during gaps maintains adequate overall load.
4. **Visual feedback quality** — depends on available assets. Minimum: text-based recipe + clickable kitchen zones with popup menus.
