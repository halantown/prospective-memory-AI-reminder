"""Cooking recipe definitions — 4 dishes with steps, stations, and distractor options.

Design principle for distractors:
- ALL options are plausible/reasonable for the dish and step
- Common sense alone cannot eliminate any option
- Participant MUST consult the recipe to select correctly
- Wording is kept as simple and short as possible
- Cognitive load comes from multi-dish switching, not from reading difficulty

Each step has:
- id: unique step identifier
- label: short display text
- station: which kitchen station to click
- description: recipe instruction shown in recipe view (the ONLY source of truth)
- step_type: 'active' (needs participant action) or 'wait' (auto-progresses)
- wait_duration_s: only for 'wait' steps — how long the wait lasts
- options: ordered list of all option texts (correct + distractors), in the fixed display order
- correct_index: index into `options` that is the correct answer
"""

from dataclasses import dataclass, field
from typing import Literal


@dataclass(frozen=True)
class CookingStepDef:
    id: str
    label: str
    station: str
    description: str
    step_type: Literal["active", "wait"]
    options: list[str] = field(default_factory=list)
    correct_index: int = 0
    wait_duration_s: int = 0


# ─── Dish 1: Roasted Vegetables ───────────────────────────────────────────────

ROASTED_VEGETABLES_STEPS: list[CookingStepDef] = [
    CookingStepDef(
        id="rv_select_veggies",
        label="Select vegetables",
        station="fridge",
        description="Get bell peppers, zucchini, and tomatoes.",
        step_type="active",
        options=[
            "Broccoli, carrots, onion",
            "Bell peppers, zucchini, tomatoes",
            "Eggplant, mushrooms, potato",
            "Asparagus, sweet potato, corn",
        ],
        correct_index=1,
    ),
    CookingStepDef(
        id="rv_chop",
        label="Chop vegetables",
        station="cutting_board",
        description="Slice into thin rounds.",
        step_type="active",
        options=[
            "Dice into small cubes",
            "Cut into long strips",
            "Slice into thin rounds",
            "Chop into large chunks",
        ],
        correct_index=2,
    ),
    CookingStepDef(
        id="rv_season",
        label="Season vegetables",
        station="spice_rack",
        description="Add olive oil + dried herbs.",
        step_type="active",
        options=[
            "Olive oil + garlic",
            "Olive oil + dried herbs",
            "Butter + rosemary",
            "Olive oil + paprika",
        ],
        correct_index=1,
    ),
    CookingStepDef(
        id="rv_oven_place",
        label="Place tray in oven",
        station="oven",
        description="Set oven to 200°C.",
        step_type="active",
        options=[
            "180°C",
            "190°C",
            "200°C",
            "220°C",
        ],
        correct_index=2,
    ),
    CookingStepDef(
        id="rv_wait_oven",
        label="Oven cooking",
        station="oven",
        description="Vegetables are roasting.",
        step_type="wait",
        wait_duration_s=480,
    ),
    CookingStepDef(
        id="rv_oven_remove",
        label="Remove from oven",
        station="oven",
        description="Take out the tray and turn off oven.",
        step_type="active",
        options=[
            "Take out tray, leave oven on",
            "Take out tray, turn off oven",
            "Leave tray, turn off oven",
            "Take out tray, lower to 150°C",
        ],
        correct_index=1,
    ),
    CookingStepDef(
        id="rv_plate",
        label="Plate vegetables",
        station="plating_area",
        description="Arrange on the white oval plate.",
        step_type="active",
        options=[
            "White oval plate",
            "Round wooden board",
            "Blue square plate",
        ],
        correct_index=0,
    ),
]

# ─── Dish 2: Tomato Soup ──────────────────────────────────────────────────────

TOMATO_SOUP_STEPS: list[CookingStepDef] = [
    CookingStepDef(
        id="ts_select_ingredients",
        label="Select ingredients",
        station="fridge",
        description="Get tomatoes, onion, and garlic.",
        step_type="active",
        options=[
            "Tomatoes, onion, celery",
            "Tomatoes, leek, garlic",
            "Tomatoes, onion, garlic",
            "Tomatoes, shallot, ginger",
        ],
        correct_index=2,
    ),
    CookingStepDef(
        id="ts_chop",
        label="Chop ingredients",
        station="cutting_board",
        description="Dice the onion, crush the garlic, quarter the tomatoes.",
        step_type="active",
        options=[
            "Dice onion, slice garlic, halve tomatoes",
            "Dice onion, crush garlic, quarter tomatoes",
            "Slice onion, mince garlic, dice tomatoes",
            "Dice onion, crush garlic, dice tomatoes",
        ],
        correct_index=1,
    ),
    CookingStepDef(
        id="ts_saute",
        label="Sauté base",
        station="burner2",
        description="Sauté onion and garlic on medium heat.",
        step_type="active",
        options=[
            "Onion and garlic on low heat",
            "Onion and garlic on medium heat",
            "Onion and garlic on high heat",
            "Onion and tomatoes on medium heat",
        ],
        correct_index=1,
    ),
    CookingStepDef(
        id="ts_add_liquid",
        label="Add liquid",
        station="burner2",
        description="Add vegetable stock.",
        step_type="active",
        options=[
            "Chicken stock",
            "Water",
            "Vegetable stock",
            "Beef stock",
        ],
        correct_index=2,
    ),
    CookingStepDef(
        id="ts_wait_simmer1",
        label="Simmering",
        station="burner2",
        description="Soup is simmering.",
        step_type="wait",
        wait_duration_s=120,
    ),
    CookingStepDef(
        id="ts_stir",
        label="Stir soup",
        station="burner2",
        description="Stir and reduce heat to low.",
        step_type="active",
        options=[
            "Stir, keep on medium",
            "Stir, reduce to low",
            "Stir, increase to high",
            "Don't stir, reduce to low",
        ],
        correct_index=1,
    ),
    CookingStepDef(
        id="ts_wait_simmer2",
        label="Continue simmering",
        station="burner2",
        description="Soup continues simmering.",
        step_type="wait",
        wait_duration_s=120,
    ),
    CookingStepDef(
        id="ts_season",
        label="Season soup",
        station="spice_rack",
        description="Add salt + basil.",
        step_type="active",
        options=[
            "Salt + pepper",
            "Salt + oregano",
            "Salt + basil",
            "Salt + thyme",
        ],
        correct_index=2,
    ),
    CookingStepDef(
        id="ts_plate",
        label="Serve soup",
        station="plating_area",
        description="Ladle into the deep red bowl.",
        step_type="active",
        options=[
            "Deep red bowl",
            "White soup plate",
            "Small black bowl",
        ],
        correct_index=0,
    ),
]

# ─── Dish 3: Spaghetti ───────────────────────────────────────────────────────

SPAGHETTI_STEPS: list[CookingStepDef] = [
    CookingStepDef(
        id="sp_pot_water",
        label="Prepare pot",
        station="burner1",
        description="Fill the large pot with water, add a pinch of salt.",
        step_type="active",
        options=[
            "Large pot, water, salt",
            "Large pot, water, no salt",
            "Medium pot, water, salt",
            "Large pot, water, olive oil",
        ],
        correct_index=0,
    ),
    CookingStepDef(
        id="sp_wait_boil",
        label="Water heating",
        station="burner1",
        description="Waiting for water to boil.",
        step_type="wait",
        wait_duration_s=120,
    ),
    CookingStepDef(
        id="sp_add_pasta",
        label="Add pasta",
        station="burner1",
        description="Add spaghetti, cook for 9 minutes.",
        step_type="active",
        options=[
            "Spaghetti, 7 minutes",
            "Spaghetti, 9 minutes",
            "Spaghetti, 11 minutes",
            "Spaghetti, 8 minutes",
        ],
        correct_index=1,
    ),
    CookingStepDef(
        id="sp_wait_cook",
        label="Pasta cooking",
        station="burner1",
        description="Pasta is cooking.",
        step_type="wait",
        wait_duration_s=120,
    ),
    CookingStepDef(
        id="sp_drain",
        label="Drain pasta",
        station="burner1",
        description="Drain and save a cup of pasta water.",
        step_type="active",
        options=[
            "Drain, discard all water",
            "Drain, save a cup of water",
            "Drain, rinse with cold water",
            "Drain, add olive oil",
        ],
        correct_index=1,
    ),
    CookingStepDef(
        id="sp_add_sauce",
        label="Add sauce",
        station="spice_rack",
        description="Add pesto sauce.",
        step_type="active",
        options=[
            "Tomato sauce",
            "Pesto sauce",
            "Cream sauce",
            "Butter + garlic",
        ],
        correct_index=1,
    ),
    CookingStepDef(
        id="sp_toss",
        label="Toss pasta",
        station="burner1",
        description="Toss on low heat for 1 minute.",
        step_type="active",
        options=[
            "Toss on low, 1 minute",
            "Toss on medium, 1 minute",
            "Toss on low, 2 minutes",
            "Stir on low, 1 minute",
        ],
        correct_index=0,
    ),
    CookingStepDef(
        id="sp_plate",
        label="Plate spaghetti",
        station="plating_area",
        description="Serve on the flat yellow plate.",
        step_type="active",
        options=[
            "Deep white bowl",
            "Flat yellow plate",
            "Round grey plate",
        ],
        correct_index=1,
    ),
]

# ─── Dish 4: Steak ───────────────────────────────────────────────────────────

STEAK_STEPS: list[CookingStepDef] = [
    CookingStepDef(
        id="st_select",
        label="Select steak",
        station="fridge",
        description="Get the ribeye steak.",
        step_type="active",
        options=[
            "Sirloin steak",
            "Ribeye steak",
            "Tenderloin steak",
            "Rump steak",
        ],
        correct_index=1,
    ),
    CookingStepDef(
        id="st_season",
        label="Season steak",
        station="cutting_board",
        description="Rub with salt, pepper, and olive oil.",
        step_type="active",
        options=[
            "Salt, pepper, butter",
            "Salt, garlic, olive oil",
            "Salt, pepper, olive oil",
            "Salt, pepper, sesame oil",
        ],
        correct_index=2,
    ),
    CookingStepDef(
        id="st_heat_pan",
        label="Heat pan",
        station="burner3",
        description="Heat the cast iron pan on high.",
        step_type="active",
        options=[
            "Cast iron pan, medium heat",
            "Non-stick pan, high heat",
            "Cast iron pan, high heat",
            "Stainless steel pan, high heat",
        ],
        correct_index=2,
    ),
    CookingStepDef(
        id="st_place",
        label="Place steak",
        station="burner3",
        description="Place steak and don't move it.",
        step_type="active",
        options=[
            "Place and press down",
            "Place and don't move",
            "Place and swirl the pan",
            "Place and flip quickly",
        ],
        correct_index=1,
    ),
    CookingStepDef(
        id="st_wait_side1",
        label="Cooking side 1",
        station="burner3",
        description="Searing first side.",
        step_type="wait",
        wait_duration_s=90,
    ),
    CookingStepDef(
        id="st_flip",
        label="Flip steak",
        station="burner3",
        description="Flip once, add a knob of butter.",
        step_type="active",
        options=[
            "Flip, add olive oil",
            "Flip, add butter",
            "Flip, add nothing",
            "Flip, add garlic oil",
        ],
        correct_index=1,
    ),
    CookingStepDef(
        id="st_wait_side2",
        label="Cooking side 2",
        station="burner3",
        description="Searing second side.",
        step_type="wait",
        wait_duration_s=90,
    ),
    CookingStepDef(
        id="st_plate",
        label="Plate steak",
        station="plating_area",
        description="Rest on the warm black plate for 2 minutes.",
        step_type="active",
        options=[
            "Warm black plate, 2 min rest",
            "Cold white plate, no rest",
            "Warm black plate, no rest",
        ],
        correct_index=0,
    ),
]

# ─── Registry ─────────────────────────────────────────────────────────────────

ALL_RECIPES: dict[str, list[CookingStepDef]] = {
    "roasted_vegetables": ROASTED_VEGETABLES_STEPS,
    "tomato_soup": TOMATO_SOUP_STEPS,
    "spaghetti": SPAGHETTI_STEPS,
    "steak": STEAK_STEPS,
}

DISH_LABELS: dict[str, str] = {
    "roasted_vegetables": "Roasted Vegetables",
    "tomato_soup": "Tomato Soup",
    "spaghetti": "Spaghetti",
    "steak": "Steak",
}

DISH_EMOJIS: dict[str, str] = {
    "roasted_vegetables": "🥕",
    "tomato_soup": "🍅",
    "spaghetti": "🍝",
    "steak": "🥩",
}