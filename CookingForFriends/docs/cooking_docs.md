# Cooking System — Asset Catalogue

All assets listed here need to be created before the kitchen room looks polished.
Placeholders are already rendered in the frontend; dropping a real image at the
listed path is all that's needed to swap it in.

---

## 1. Kitchen Station Furniture

Eight interactive hotspots in KitchenRoom. Each maps 1-to-1 to a station in the
backend (`cooking_recipes.py` / `cooking_timeline.py`).

| File path (public/) | Station ID | Used by dish(es) | Description |
|---|---|---|---|
| `assets/kitchen/fridge.png` | `fridge` | Roasted Vegetables, Tomato Soup, Steak | Kitchen fridge — top-down view |
| `assets/kitchen/cutting_board.png` | `cutting_board` | Roasted Vegetables, Tomato Soup, Steak | Wooden cutting board on counter |
| `assets/kitchen/spice_rack.png` | `spice_rack` | Roasted Vegetables, Tomato Soup, Spaghetti | Spice rack / pantry shelf |
| `assets/kitchen/burner1.png` | `burner1` | Spaghetti (all steps) | Stovetop burner — pot with water/pasta |
| `assets/kitchen/burner2.png` | `burner2` | Tomato Soup (all steps) | Stovetop burner — pot for soup |
| `assets/kitchen/burner3.png` | `burner3` | Steak (all steps) | Stovetop burner — pan for steak |
| `assets/kitchen/oven.png` | `oven` | Roasted Vegetables (place / wait / remove) | Oven with baking tray |
| `assets/kitchen/plating_area.png` | `plating_area` | All 4 dishes (final plating step) | Counter with serving plates |

### Station positions in the kitchen room
(% of kitchen room div — same values as `STATION_POSITIONS` in `KitchenRoom.tsx`)

| Station ID | left | top | width | height |
|---|---|---|---|---|
| `fridge` | 78% | 2% | 20% | 32% |
| `cutting_board` | 22% | 2% | 28% | 14% |
| `spice_rack` | 2% | 72% | 25% | 20% |
| `burner1` | 18% | 32% | 20% | 30% |
| `burner2` | 40% | 32% | 20% | 30% |
| `burner3` | 60% | 32% | 20% | 30% |
| `oven` | 65% | 70% | 33% | 28% |
| `plating_area` | 52% | 2% | 24% | 14% |

---

## 2. Dish Images

Used in the **RecipeTab** (phone sidebar) recipe book and the dish progress strip at
the bottom of KitchenRoom.

| File path (public/) | Dish | Dish ID | Emoji |
|---|---|---|---|
| `assets/dishes/roasted_vegetables.png` | Roasted Vegetables | `roasted_vegetables` | 🥕 |
| `assets/dishes/tomato_soup.png` | Tomato Soup | `tomato_soup` | 🍅 |
| `assets/dishes/spaghetti.png` | Spaghetti | `spaghetti` | 🍝 |
| `assets/dishes/steak.png` | Steak | `steak` | 🥩 |

---

## 3. Cooking Step Reference

Quick reference of which steps fire at which station — useful for deciding what
state each furniture image should show.

### Roasted Vegetables 🥕
| Step | Station | Type | t (s) |
|---|---|---|---|
| Select vegetables | `fridge` | active | 0 |
| Chop vegetables | `cutting_board` | active | 30 |
| Season with olive oil & herbs | `spice_rack` | active | 60 |
| Place tray in oven | `oven` | active | 90 |
| Oven cooking | `oven` | **wait 480 s** | 120 |
| Remove from oven | `oven` | active | 600 |
| Plate roasted vegetables | `plating_area` | active | 630 |

### Tomato Soup 🍅
| Step | Station | Type | t (s) |
|---|---|---|---|
| Select onion & tomatoes | `fridge` | active | 120 |
| Chop onion and tomatoes | `cutting_board` | active | 150 |
| Sauté base in pot | `burner2` | active | 210 |
| Add water | `burner2` | active | 240 |
| Simmering | `burner2` | **wait 120 s** | 270 |
| Stir soup | `burner2` | active | 330 |
| Continue simmering | `burner2` | **wait 120 s** | 360 |
| Add salt & pepper | `spice_rack` | active | 420 |
| Ladle into bowl | `plating_area` | active | 480 |

### Spaghetti 🍝
| Step | Station | Type | t (s) |
|---|---|---|---|
| Place pot with water | `burner1` | active | 180 |
| Water heating | `burner1` | **wait 120 s** | 210 |
| Add pasta | `burner1` | active | 300 |
| Pasta cooking | `burner1` | **wait 120 s** | 330 |
| Drain pasta | `burner1` | active | 420 |
| Add sauce | `spice_rack` | active | 450 |
| Toss pasta with sauce | `burner1` | active | 480 |
| Plate spaghetti | `plating_area` | active | 510 |

### Steak 🥩
| Step | Station | Type | t (s) |
|---|---|---|---|
| Select steak | `fridge` | active | 540 |
| Season steak | `cutting_board` | active | 570 |
| Heat pan | `burner3` | active | 600 |
| Place steak in pan | `burner3` | active | 630 |
| Cooking side 1 | `burner3` | **wait 90 s** | 660 |
| Flip steak | `burner3` | active | 750 |
| Cooking side 2 | `burner3` | **wait 90 s** | 780 |
| Plate steak | `plating_area` | active | 840 |

---

## 4. Image Specification

| Property | Recommendation |
|---|---|
| Perspective | Top-down (matching floorplan view) |
| Format | PNG with transparency |
| Size | 256 × 256 px (furniture); 512 × 512 px (dish hero) |
| Style | Pixel art or flat illustration to match existing floorplan aesthetic |
| Background | Transparent — images are composited on the dark kitchen floor |

---

## 5. Archived Assets

Previously used SVG-drawn furniture components are in:

- `frontend/src/components/game/rooms/_archive/` — old `*Furniture.tsx`
- `frontend/public/assets/_archive/encoding/` — encoding-phase item SVGs + variants

These can be permanently deleted once new assets are in place.
