"""Cooking recipe definitions — 4 dishes with steps, stations, and distractor options.

Each step has:
- id: unique step identifier
- label: short display text
- station: which kitchen station to click
- description: fuller description shown in recipe view
- step_type: 'active' (needs participant action) or 'wait' (auto-progresses)
- wait_duration_s: only for 'wait' steps — how long the wait lasts
- options: ordered list of all option texts (correct + distractors), in the fixed display order
- correct_index: index into `options` that is the correct answer

Source: cooking_system_design.md Section 3.
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
        description="Get bell peppers, zucchini, and cherry tomatoes from the fridge.",
        step_type="active",
        options=["Lettuce & cucumber", "Bell peppers, zucchini & tomatoes", "Mushrooms & spinach", "Frozen peas & corn"],
        correct_index=1,
    ),
    CookingStepDef(
        id="rv_chop",
        label="Chop vegetables",
        station="cutting_board",
        description="Cut the vegetables into bite-sized pieces.",
        step_type="active",
        options=["Blend into paste", "Peel and leave whole", "Chop into pieces", "Grate finely"],
        correct_index=2,
    ),
    CookingStepDef(
        id="rv_season",
        label="Season with olive oil & herbs",
        station="spice_rack",
        description="Drizzle olive oil and sprinkle dried herbs over the vegetables.",
        step_type="active",
        options=["Butter + sugar", "Olive oil + dried herbs", "Vinegar + mustard", "Soy sauce + sesame oil"],
        correct_index=1,
    ),
    CookingStepDef(
        id="rv_oven_place",
        label="Place tray in oven",
        station="oven",
        description="Put the baking tray in the oven and set to 200°C.",
        step_type="active",
        options=["Set oven to 100°C", "Turn on the grill", "Set oven to 300°C", "Set oven to 200°C"],
        correct_index=3,
    ),
    CookingStepDef(
        id="rv_wait_oven",
        label="Oven cooking",
        station="oven",
        description="Vegetables are roasting in the oven.",
        step_type="wait",
        wait_duration_s=480,  # ~8 min
    ),
    CookingStepDef(
        id="rv_oven_remove",
        label="Remove from oven",
        station="oven",
        description="Take the roasted vegetables out of the oven.",
        step_type="active",
        options=["Increase temperature", "Remove tray from oven", "Add more oil", "Turn on fan mode"],
        correct_index=1,
    ),
    CookingStepDef(
        id="rv_plate",
        label="Plate roasted vegetables",
        station="plating_area",
        description="Arrange the roasted vegetables on a serving plate.",
        step_type="active",
        options=["Put back in fridge", "Blend into soup", "Plate vegetables"],
        correct_index=2,
    ),
]

# ─── Dish 2: Tomato Soup ──────────────────────────────────────────────────────

TOMATO_SOUP_STEPS: list[CookingStepDef] = [
    CookingStepDef(
        id="ts_select_ingredients",
        label="Select onion & tomatoes",
        station="fridge",
        description="Get fresh tomatoes and an onion from the fridge.",
        step_type="active",
        options=["Potatoes & carrots", "Cream & cheese", "Tomatoes & onion", "Lettuce & cucumber"],
        correct_index=2,
    ),
    CookingStepDef(
        id="ts_chop",
        label="Chop onion and tomatoes",
        station="cutting_board",
        description="Dice the onion and roughly chop the tomatoes.",
        step_type="active",
        options=["Blend raw", "Dice onion, chop tomatoes", "Peel and leave whole", "Grate finely"],
        correct_index=1,
    ),
    CookingStepDef(
        id="ts_saute",
        label="Sauté base in pot",
        station="burner2",
        description="Heat the pot and sauté onion and tomatoes together.",
        step_type="active",
        options=["Bake in oven", "Deep fry in pan", "Steam in microwave", "Sauté in pot"],
        correct_index=3,
    ),
    CookingStepDef(
        id="ts_add_water",
        label="Add water",
        station="burner2",
        description="Pour water into the pot to make the soup base.",
        step_type="active",
        options=["Add milk", "Add water", "Add orange juice", "Add vinegar"],
        correct_index=1,
    ),
    CookingStepDef(
        id="ts_wait_simmer1",
        label="Simmering",
        station="burner2",
        description="Let the soup simmer on medium heat.",
        step_type="wait",
        wait_duration_s=120,  # ~2 min
    ),
    CookingStepDef(
        id="ts_stir",
        label="Stir soup",
        station="burner2",
        description="Give the soup a good stir to prevent sticking.",
        step_type="active",
        options=["Add ice cubes", "Turn off heat", "Drain the liquid", "Stir the soup"],
        correct_index=3,
    ),
    CookingStepDef(
        id="ts_wait_simmer2",
        label="Continue simmering",
        station="burner2",
        description="Soup continues simmering.",
        step_type="wait",
        wait_duration_s=120,  # ~2 min
    ),
    CookingStepDef(
        id="ts_season",
        label="Add salt & pepper",
        station="spice_rack",
        description="Season the soup with salt and freshly ground pepper.",
        step_type="active",
        options=["Cinnamon + sugar", "Salt + pepper", "Chili flakes + paprika", "Vanilla extract"],
        correct_index=1,
    ),
    CookingStepDef(
        id="ts_plate",
        label="Ladle into bowl",
        station="plating_area",
        description="Ladle the finished soup into a serving bowl.",
        step_type="active",
        options=["Strain and discard", "Pour into mug", "Ladle into bowl"],
        correct_index=2,
    ),
]

# ─── Dish 3: Spaghetti ───────────────────────────────────────────────────────

SPAGHETTI_STEPS: list[CookingStepDef] = [
    CookingStepDef(
        id="sp_pot_water",
        label="Place pot with water",
        station="burner1",
        description="Fill a pot with water and place it on the burner.",
        step_type="active",
        options=["Pan with oil on burner", "Pot with water on burner", "Empty pot on burner", "Kettle on burner"],
        correct_index=1,
    ),
    CookingStepDef(
        id="sp_wait_boil",
        label="Water heating",
        station="burner1",
        description="Waiting for the water to come to a boil.",
        step_type="wait",
        wait_duration_s=120,  # ~2 min
    ),
    CookingStepDef(
        id="sp_add_pasta",
        label="Add pasta",
        station="burner1",
        description="Add the spaghetti to the boiling water.",
        step_type="active",
        options=["Add rice", "Add flour", "Add spaghetti", "Add potatoes"],
        correct_index=2,
    ),
    CookingStepDef(
        id="sp_wait_cook",
        label="Pasta cooking",
        station="burner1",
        description="Pasta is cooking in the boiling water.",
        step_type="wait",
        wait_duration_s=120,  # ~2 min
    ),
    CookingStepDef(
        id="sp_drain",
        label="Drain pasta",
        station="burner1",
        description="Drain the water from the cooked pasta.",
        step_type="active",
        options=["Add more water", "Rinse with cold water", "Drain pasta", "Mash the pasta"],
        correct_index=2,
    ),
    CookingStepDef(
        id="sp_add_sauce",
        label="Add sauce",
        station="spice_rack",
        description="Add tomato sauce to the drained pasta.",
        step_type="active",
        options=["Add chocolate sauce", "Add tomato sauce", "Add plain yoghurt", "Add mustard"],
        correct_index=1,
    ),
    CookingStepDef(
        id="sp_toss",
        label="Toss pasta with sauce",
        station="burner1",
        description="Toss the spaghetti to coat evenly with sauce.",
        step_type="active",
        options=["Blend the pasta", "Deep fry the pasta", "Bake in oven", "Toss pasta with sauce"],
        correct_index=3,
    ),
    CookingStepDef(
        id="sp_plate",
        label="Plate spaghetti",
        station="plating_area",
        description="Serve the spaghetti onto a plate.",
        step_type="active",
        options=["Discard leftover", "Plate spaghetti", "Put in storage container"],
        correct_index=1,
    ),
]

# ─── Dish 4: Steak ───────────────────────────────────────────────────────────

STEAK_STEPS: list[CookingStepDef] = [
    CookingStepDef(
        id="st_select",
        label="Select steak",
        station="fridge",
        description="Take the steak out of the fridge.",
        step_type="active",
        options=["Chicken breast", "Beef sirloin steak", "Pork chop", "Fish fillet"],
        correct_index=1,
    ),
    CookingStepDef(
        id="st_season",
        label="Season steak",
        station="cutting_board",
        description="Season the steak with salt and pepper.",
        step_type="active",
        options=["Marinate overnight", "Coat in flour", "Season with salt & pepper", "Slice into strips"],
        correct_index=2,
    ),
    CookingStepDef(
        id="st_heat_pan",
        label="Heat pan",
        station="burner3",
        description="Heat up the pan with a little oil.",
        step_type="active",
        options=["Heat pot with water", "Turn on oven grill", "Heat wok on high", "Heat pan with oil"],
        correct_index=3,
    ),
    CookingStepDef(
        id="st_place",
        label="Place steak in pan",
        station="burner3",
        description="Place the seasoned steak in the hot pan.",
        step_type="active",
        options=["Place steak in oven", "Place steak in pan", "Place steak in pot", "Place steak on plate"],
        correct_index=1,
    ),
    CookingStepDef(
        id="st_wait_side1",
        label="Cooking side 1",
        station="burner3",
        description="First side of steak is searing.",
        step_type="wait",
        wait_duration_s=90,  # ~1.5 min
    ),
    CookingStepDef(
        id="st_flip",
        label="Flip steak",
        station="burner3",
        description="Flip the steak to cook the other side.",
        step_type="active",
        options=["Press down with spatula", "Flip steak", "Add water to pan", "Remove from pan"],
        correct_index=1,
    ),
    CookingStepDef(
        id="st_wait_side2",
        label="Cooking side 2",
        station="burner3",
        description="Second side of steak is searing.",
        step_type="wait",
        wait_duration_s=90,  # ~1.5 min
    ),
    CookingStepDef(
        id="st_plate",
        label="Plate steak",
        station="plating_area",
        description="Place the finished steak on a plate.",
        step_type="active",
        options=["Put back in fridge", "Cut into tiny pieces", "Plate steak"],
        correct_index=2,
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
