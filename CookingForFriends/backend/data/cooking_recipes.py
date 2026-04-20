"""Cooking recipe definitions — 4 dishes with steps, stations, and distractor options.

Each step has:
- id: unique step identifier
- label: short display text
- station: which kitchen station to click
- description: fuller description shown in recipe view
- step_type: 'active' (needs participant action) or 'wait' (auto-progresses)
- wait_duration_s: only for 'wait' steps — how long the wait lasts
- correct_option: the correct action text
- distractors: list of wrong option texts (2-3 per step)

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
    correct_option: str = ""
    distractors: list[str] = field(default_factory=list)
    wait_duration_s: int = 0


# ─── Dish 1: Roasted Vegetables ───────────────────────────────────────────────

ROASTED_VEGETABLES_STEPS: list[CookingStepDef] = [
    CookingStepDef(
        id="rv_select_veggies",
        label="Select vegetables",
        station="fridge",
        description="Get bell peppers, zucchini, and cherry tomatoes from the fridge.",
        step_type="active",
        correct_option="Bell peppers, zucchini & tomatoes",
        distractors=["Lettuce & cucumber", "Mushrooms & spinach", "Frozen peas & corn"],
    ),
    CookingStepDef(
        id="rv_chop",
        label="Chop vegetables",
        station="cutting_board",
        description="Cut the vegetables into bite-sized pieces.",
        step_type="active",
        correct_option="Chop into pieces",
        distractors=["Blend into paste", "Peel and leave whole", "Grate finely"],
    ),
    CookingStepDef(
        id="rv_season",
        label="Season with olive oil & herbs",
        station="spice_rack",
        description="Drizzle olive oil and sprinkle dried herbs over the vegetables.",
        step_type="active",
        correct_option="Olive oil + dried herbs",
        distractors=["Butter + sugar", "Vinegar + mustard", "Soy sauce + sesame oil"],
    ),
    CookingStepDef(
        id="rv_oven_place",
        label="Place tray in oven",
        station="oven",
        description="Put the baking tray in the oven and set to 200°C.",
        step_type="active",
        correct_option="Set oven to 200°C",
        distractors=["Set oven to 100°C", "Set oven to 300°C", "Turn on the grill"],
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
        correct_option="Remove tray from oven",
        distractors=["Increase temperature", "Add more oil", "Turn on fan mode"],
    ),
    CookingStepDef(
        id="rv_plate",
        label="Plate roasted vegetables",
        station="plating_area",
        description="Arrange the roasted vegetables on a serving plate.",
        step_type="active",
        correct_option="Plate vegetables",
        distractors=["Put back in fridge", "Blend into soup"],
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
        correct_option="Tomatoes & onion",
        distractors=["Potatoes & carrots", "Lettuce & cucumber", "Cream & cheese"],
    ),
    CookingStepDef(
        id="ts_chop",
        label="Chop onion and tomatoes",
        station="cutting_board",
        description="Dice the onion and roughly chop the tomatoes.",
        step_type="active",
        correct_option="Dice onion, chop tomatoes",
        distractors=["Blend raw", "Peel and leave whole", "Grate finely"],
    ),
    CookingStepDef(
        id="ts_saute",
        label="Sauté base in pot",
        station="burner2",
        description="Heat the pot and sauté onion and tomatoes together.",
        step_type="active",
        correct_option="Sauté in pot",
        distractors=["Deep fry in pan", "Bake in oven", "Steam in microwave"],
    ),
    CookingStepDef(
        id="ts_add_water",
        label="Add water",
        station="burner2",
        description="Pour water into the pot to make the soup base.",
        step_type="active",
        correct_option="Add water",
        distractors=["Add milk", "Add orange juice", "Add vinegar"],
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
        correct_option="Stir the soup",
        distractors=["Drain the liquid", "Add ice cubes", "Turn off heat"],
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
        correct_option="Salt + pepper",
        distractors=["Cinnamon + sugar", "Chili flakes + paprika", "Vanilla extract"],
    ),
    CookingStepDef(
        id="ts_plate",
        label="Ladle into bowl",
        station="plating_area",
        description="Ladle the finished soup into a serving bowl.",
        step_type="active",
        correct_option="Ladle into bowl",
        distractors=["Pour into mug", "Strain and discard"],
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
        correct_option="Pot with water on burner",
        distractors=["Pan with oil on burner", "Empty pot on burner", "Kettle on burner"],
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
        correct_option="Add spaghetti",
        distractors=["Add rice", "Add potatoes", "Add flour"],
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
        correct_option="Drain pasta",
        distractors=["Add more water", "Mash the pasta", "Rinse with cold water"],
    ),
    CookingStepDef(
        id="sp_add_sauce",
        label="Add sauce",
        station="spice_rack",
        description="Add tomato sauce to the drained pasta.",
        step_type="active",
        correct_option="Add tomato sauce",
        distractors=["Add chocolate sauce", "Add plain yoghurt", "Add mustard"],
    ),
    CookingStepDef(
        id="sp_toss",
        label="Toss pasta with sauce",
        station="burner1",
        description="Toss the spaghetti to coat evenly with sauce.",
        step_type="active",
        correct_option="Toss pasta with sauce",
        distractors=["Deep fry the pasta", "Blend the pasta", "Bake in oven"],
    ),
    CookingStepDef(
        id="sp_plate",
        label="Plate spaghetti",
        station="plating_area",
        description="Serve the spaghetti onto a plate.",
        step_type="active",
        correct_option="Plate spaghetti",
        distractors=["Put in storage container", "Discard leftover"],
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
        correct_option="Beef sirloin steak",
        distractors=["Chicken breast", "Pork chop", "Fish fillet"],
    ),
    CookingStepDef(
        id="st_season",
        label="Season steak",
        station="cutting_board",
        description="Season the steak with salt and pepper.",
        step_type="active",
        correct_option="Season with salt & pepper",
        distractors=["Slice into strips", "Marinate overnight", "Coat in flour"],
    ),
    CookingStepDef(
        id="st_heat_pan",
        label="Heat pan",
        station="burner3",
        description="Heat up the pan with a little oil.",
        step_type="active",
        correct_option="Heat pan with oil",
        distractors=["Heat pot with water", "Heat wok on high", "Turn on oven grill"],
    ),
    CookingStepDef(
        id="st_place",
        label="Place steak in pan",
        station="burner3",
        description="Place the seasoned steak in the hot pan.",
        step_type="active",
        correct_option="Place steak in pan",
        distractors=["Place steak in oven", "Place steak in pot", "Place steak on plate"],
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
        correct_option="Flip steak",
        distractors=["Remove from pan", "Press down with spatula", "Add water to pan"],
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
        correct_option="Plate steak",
        distractors=["Put back in fridge", "Cut into tiny pieces"],
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
