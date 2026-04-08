"""
PM Task Registry — All 12 prospective memory task definitions.

Pure data module, no database dependencies. Used by:
- database.py (seeding trials)
- timeline generator (building block timelines)
- encoding API (serving task cards)
- reminder selection (baseline text lookup)
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class PMTaskDef:
    task_id: str
    block: int                      # 1, 2, 3
    guest_name: str                 # "Mei", "Lucas", "Sophie"

    # Trigger
    trigger_type: str               # "visitor" | "communication" | "appliance" | "activity"
    trigger_event: str              # human-readable
    trigger_audio: str | None       # audio file name
    trigger_visual: str             # frontend event type

    # Target
    target_room: str                # "study" | "dining_room" | "living_room" | "bathroom"
    target_name: str
    target_visual_desc: str
    target_image: str               # encoding card image filename
    distractor_name: str
    distractor_visual_desc: str
    discriminating_cue: str

    # Action
    action_verb: str
    action_description: str
    action_destination: str

    # Encoding
    encoding_text: str              # full paragraph for encoding card
    quiz_question: str
    quiz_options: list[str] = field(default_factory=list)
    quiz_correct_index: int = 1

    # Baseline reminder
    baseline_reminder: str = ""


# ──────────────────────────────────────────────
# Block 1 — Dinner for Mei
# ──────────────────────────────────────────────

B1_BOOK = PMTaskDef(
    task_id="b1_book",
    block=1,
    guest_name="Mei",
    trigger_type="visitor",
    trigger_event="Doorbell — Mei arrives",
    trigger_audio="doorbell.mp3",
    trigger_visual="visitor_arrival",
    target_room="study",
    target_name="Red book with mountain cover (Erta Ale)",
    target_visual_desc="Red paperback, mountain landscape illustration, title 'Erta Ale'",
    target_image="b1_book_target.png",
    distractor_name="Red book with ocean cover (Blue Horizon)",
    distractor_visual_desc="Red paperback, ocean landscape illustration, title 'Blue Horizon'",
    discriminating_cue="mountain cover illustration + second shelf",
    action_verb="find and bring",
    action_description="Bring to living room and give to Mei",
    action_destination="living_room",
    encoding_text=(
        "Your friend Mei asked to borrow a travel book. When Mei arrives, "
        "go to the study and find the book on the second shelf of the bookcase. "
        "It is a red paperback with a mountain illustration on the cover, "
        "titled Erta Ale. Bring it to the living room and give it to Mei."
    ),
    quiz_question="What is on the cover of the book you need to find?",
    quiz_options=["Ocean landscape", "Mountain landscape", "City skyline"],
    quiz_correct_index=1,
    baseline_reminder="Remember to find the book for Mei.",
)

B1_GIFTBAG = PMTaskDef(
    task_id="b1_giftbag",
    block=1,
    guest_name="Mei",
    trigger_type="communication",
    trigger_event="Phone message: delivery notification",
    trigger_audio="phone_notification.mp3",
    trigger_visual="phone_message_banner",
    target_room="dining_room",
    target_name="Small blue gift bag with bow",
    target_visual_desc="Small blue gift bag, bow decoration on handle",
    target_image="b1_giftbag_target.png",
    distractor_name="Medium blue gift bag with ribbon",
    distractor_visual_desc="Medium blue gift bag, ribbon decoration on handle",
    discriminating_cue="small size + bow (not ribbon)",
    action_verb="get and bring",
    action_description="Bring to entrance to bag the delivered gift",
    action_destination="living_room",
    encoding_text=(
        "You ordered a birthday gift for Mei online. When the delivery notification "
        "arrives on your phone, go to the dining room and get a gift bag from the dresser — "
        "the small blue bag with the bow. Bring it to the entrance to bag the gift."
    ),
    quiz_question="Which gift bag do you need?",
    quiz_options=["Medium bag with ribbon", "Small bag with bow", "Large bag with bow"],
    quiz_correct_index=1,
    baseline_reminder="Remember to get the gift bag.",
)

B1_DISH = PMTaskDef(
    task_id="b1_dish",
    block=1,
    guest_name="Mei",
    trigger_type="appliance",
    trigger_event="Oven preheat-complete chime",
    trigger_audio="oven_chime.mp3",
    trigger_visual="oven_indicator_green",
    target_room="living_room",
    target_name="Oval ceramic baking dish with blue handles",
    target_visual_desc="Oval white ceramic dish, two blue handles on sides",
    target_image="b1_dish_target.png",
    distractor_name="Oval ceramic baking dish with red handles",
    distractor_visual_desc="Oval white ceramic dish, two red handles on sides",
    discriminating_cue="blue handles (not red)",
    action_verb="get and bring",
    action_description="Bring to kitchen for baking",
    action_destination="kitchen",
    encoding_text=(
        "You are baking a dish for Mei tonight. When the oven finishes preheating, "
        "go to the living room and get the baking dish from the display cabinet, "
        "bottom shelf — it is the oval ceramic dish with blue handles. Bring it "
        "to the kitchen."
    ),
    quiz_question="What color are the handles on the baking dish?",
    quiz_options=["Red", "Blue", "Green"],
    quiz_correct_index=1,
    baseline_reminder="Remember to get the baking dish.",
)

B1_SOAP = PMTaskDef(
    task_id="b1_soap",
    block=1,
    guest_name="Mei",
    trigger_type="activity",
    trigger_event="All three steaks plated (first steak cycle complete)",
    trigger_audio="task_complete_chime.mp3",
    trigger_visual="steak_all_plated",
    target_room="bathroom",
    target_name="Pump soap bottle with lemon label",
    target_visual_desc="White pump bottle, yellow lemon label",
    target_image="b1_soap_target.png",
    distractor_name="Pump soap bottle with mint label",
    distractor_visual_desc="White pump bottle, green mint label",
    discriminating_cue="lemon label (not mint)",
    action_verb="get and place",
    action_description="Place by kitchen sink for guests",
    action_destination="kitchen",
    encoding_text=(
        "After you finish plating all three steaks, go to the bathroom and get the "
        "hand soap from the shelf above the sink — the pump bottle with the lemon "
        "label. Put it by the kitchen sink so your guests can wash their hands "
        "before dinner."
    ),
    quiz_question="Which hand soap do you need to get?",
    quiz_options=["Mint label", "Lemon label", "Lavender label"],
    quiz_correct_index=1,
    baseline_reminder="Remember to get the hand soap.",
)

# ──────────────────────────────────────────────
# Block 2 — Dinner for Lucas
# ──────────────────────────────────────────────

B2_VINYL = PMTaskDef(
    task_id="b2_vinyl",
    block=2,
    guest_name="Lucas",
    trigger_type="communication",
    trigger_event="Phone message from Lucas about music",
    trigger_audio="phone_notification.mp3",
    trigger_visual="phone_message_banner",
    target_room="study",
    target_name="Vinyl record Night Drive (car illustration)",
    target_visual_desc="Black vinyl sleeve, car illustration on cover, title 'Night Drive'",
    target_image="b2_vinyl_target.png",
    distractor_name="Vinyl record Dark Side (abstract art)",
    distractor_visual_desc="Black vinyl sleeve, abstract geometric art, title 'Dark Side'",
    discriminating_cue="car illustration + on the desk",
    action_verb="find and place",
    action_description="Place by record player in living room",
    action_destination="living_room",
    encoding_text=(
        "Lucas might ask you to prepare a vinyl record. If he messages about it, "
        "go to the study and find the record on the desk — it has a car illustration "
        "on the cover, titled Night Drive. Put it by the record player in the "
        "living room."
    ),
    quiz_question="What is on the cover of the vinyl record?",
    quiz_options=["Abstract geometric art", "Car illustration", "Mountain landscape"],
    quiz_correct_index=1,
    baseline_reminder="Remember to find the vinyl record for Lucas.",
)

B2_NAPKINRINGS = PMTaskDef(
    task_id="b2_napkinrings",
    block=2,
    guest_name="Lucas",
    trigger_type="activity",
    trigger_event="Table fully set (16 items placed, reset triggered)",
    trigger_audio="task_complete_chime.mp3",
    trigger_visual="table_complete",
    target_room="dining_room",
    target_name="Wooden napkin rings",
    target_visual_desc="Set of 4 natural wood napkin rings, light oak color",
    target_image="b2_napkinrings_target.png",
    distractor_name="Metal napkin rings",
    distractor_visual_desc="Set of 4 silver metal napkin rings, polished",
    discriminating_cue="wooden (not metal)",
    action_verb="get and place",
    action_description="Place on napkins at each seat",
    action_destination="kitchen",
    encoding_text=(
        "After you finish setting the table for the first time, go to the dining room "
        "and get the napkin rings from the wardrobe, top drawer — the set with "
        "wooden rings. Place them on the napkins at each seat."
    ),
    quiz_question="What material are the napkin rings?",
    quiz_options=["Metal", "Wooden", "Ceramic"],
    quiz_correct_index=1,
    baseline_reminder="Remember to get the napkin rings.",
)

B2_POT = PMTaskDef(
    task_id="b2_pot",
    block=2,
    guest_name="Lucas",
    trigger_type="visitor",
    trigger_event="Doorbell — neighbor returns herb plant",
    trigger_audio="doorbell.mp3",
    trigger_visual="visitor_arrival",
    target_room="living_room",
    target_name="Terracotta pot with saucer",
    target_visual_desc="Brown terracotta pot sitting on matching saucer",
    target_image="b2_pot_target.png",
    distractor_name="Terracotta pot without saucer",
    distractor_visual_desc="Brown terracotta pot, no saucer, slightly smaller",
    discriminating_cue="with saucer (not without)",
    action_verb="get and use",
    action_description="Repot the herb plant at the entrance",
    action_destination="living_room",
    encoding_text=(
        "Your neighbor has been looking after your herb plant. When they bring it "
        "back, go to the living room and get the pot from the window shelf — the "
        "terracotta pot with a saucer. Repot the herb into it."
    ),
    quiz_question="Which pot do you need?",
    quiz_options=["The one without a saucer", "The one with a saucer", "The blue glazed one"],
    quiz_correct_index=1,
    baseline_reminder="Remember to get the flower pot.",
)

B2_SOFTENER = PMTaskDef(
    task_id="b2_softener",
    block=2,
    guest_name="Lucas",
    trigger_type="appliance",
    trigger_event="Washing machine done chime",
    trigger_audio="washer_chime.mp3",
    trigger_visual="washer_indicator_done",
    target_room="bathroom",
    target_name="Purple bottle with lavender label",
    target_visual_desc="Purple plastic bottle, lavender flower label",
    target_image="b2_softener_target.png",
    distractor_name="Purple bottle with eucalyptus label",
    distractor_visual_desc="Purple plastic bottle, eucalyptus leaf label",
    discriminating_cue="lavender label (not eucalyptus)",
    action_verb="get and add",
    action_description="Add to dryer cycle",
    action_destination="bathroom",
    encoding_text=(
        "The dinner napkins are in the washing machine. When it finishes, go to the "
        "bathroom and get the fabric softener from the shelf above the machine — "
        "the purple bottle with the lavender label. Add it to the dryer cycle."
    ),
    quiz_question="Which label is on the correct fabric softener?",
    quiz_options=["Eucalyptus", "Lavender", "Rose"],
    quiz_correct_index=1,
    baseline_reminder="Remember to get the fabric softener.",
)

# ──────────────────────────────────────────────
# Block 3 — Dinner for Sophie
# ──────────────────────────────────────────────

B3_HANGER = PMTaskDef(
    task_id="b3_hanger",
    block=3,
    guest_name="Sophie",
    trigger_type="appliance",
    trigger_event="Dryer finished chime",
    trigger_audio="dryer_chime.mp3",
    trigger_visual="dryer_indicator_done",
    target_room="study",
    target_name="Wide-shoulder wooden hanger",
    target_visual_desc="Natural wood hanger, wide curved shoulders",
    target_image="b3_hanger_target.png",
    distractor_name="Narrow-shoulder wooden hanger",
    distractor_visual_desc="Natural wood hanger, narrow straight shoulders",
    discriminating_cue="wide shoulders (not narrow)",
    action_verb="get and use",
    action_description="Hang Sophie's jacket on it in living room",
    action_destination="living_room",
    encoding_text=(
        "Sophie's jacket has been in the dryer since it got wet last visit. When the "
        "dryer finishes, go to the study and get a hanger from the closet, left side — "
        "the wooden hanger with wide shoulders. Hang the jacket on it in the "
        "living room."
    ),
    quiz_question="Which hanger do you need?",
    quiz_options=["Narrow shoulders", "Wide shoulders", "Padded"],
    quiz_correct_index=1,
    baseline_reminder="Remember to get the hanger.",
)

B3_SPEAKER = PMTaskDef(
    task_id="b3_speaker",
    block=3,
    guest_name="Sophie",
    trigger_type="activity",
    trigger_event="Message batch ends (friend says 'OK talk later!')",
    trigger_audio=None,
    trigger_visual="phone_batch_end",
    target_room="living_room",
    target_name="Round Bluetooth speaker with fabric cover",
    target_visual_desc="Small round speaker, gray fabric mesh cover",
    target_image="b3_speaker_target.png",
    distractor_name="Round Bluetooth speaker with rubber cover",
    distractor_visual_desc="Small round speaker, black rubber cover",
    discriminating_cue="fabric cover (not rubber)",
    action_verb="get and set up",
    action_description="Set up in dining area for dinner music",
    action_destination="kitchen",
    encoding_text=(
        "After you finish the first batch of messages, go to the living room and "
        "get the Bluetooth speaker from the sideboard, bottom shelf — the round "
        "one with the fabric cover. Set it up in the dining area for dinner music."
    ),
    quiz_question="What kind of cover does the correct speaker have?",
    quiz_options=["Rubber", "Fabric", "Plastic"],
    quiz_correct_index=1,
    baseline_reminder="Remember to get the speaker.",
)

B3_VASE = PMTaskDef(
    task_id="b3_vase",
    block=3,
    guest_name="Sophie",
    trigger_type="visitor",
    trigger_event="Doorbell — Sophie arrives with flowers",
    trigger_audio="doorbell.mp3",
    trigger_visual="visitor_arrival",
    target_room="dining_room",
    target_name="Small blue glazed ceramic vase",
    target_visual_desc="Small ceramic vase, smooth blue glaze",
    target_image="b3_vase_target.png",
    distractor_name="Small green glazed ceramic vase",
    distractor_visual_desc="Small ceramic vase, smooth green glaze",
    discriminating_cue="blue glaze (not green)",
    action_verb="get and prepare",
    action_description="Fill with water in kitchen and arrange the flowers",
    action_destination="kitchen",
    encoding_text=(
        "Sophie mentioned she would bring flowers. When she arrives with them, go to "
        "the dining room and get the vase from the windowsill — the small ceramic vase "
        "with blue glaze. Fill it with water in the kitchen and arrange the flowers."
    ),
    quiz_question="What color is the glaze on the vase?",
    quiz_options=["Green", "Blue", "White"],
    quiz_correct_index=1,
    baseline_reminder="Remember to get the vase.",
)

B3_HANDCREAM = PMTaskDef(
    task_id="b3_handcream",
    block=3,
    guest_name="Sophie",
    trigger_type="communication",
    trigger_event="Phone message from Sophie asking about hand cream",
    trigger_audio="phone_notification.mp3",
    trigger_visual="phone_message_banner",
    target_room="bathroom",
    target_name="Hand cream tube with lavender label",
    target_visual_desc="White tube, purple lavender flower label",
    target_image="b3_handcream_target.png",
    distractor_name="Hand cream tube with mint label",
    distractor_visual_desc="White tube, green mint leaf label",
    discriminating_cue="lavender label (not mint)",
    action_verb="get and bring",
    action_description="Bring to Sophie in the living room",
    action_destination="living_room",
    encoding_text=(
        "Sophie might ask about the hand cream she liked at your place. If she "
        "messages about it, go to the bathroom and find the tube on the shelf "
        "above the sink — the one with the lavender label. Bring it to Sophie."
    ),
    quiz_question="Which label is on the correct hand cream?",
    quiz_options=["Mint", "Lavender", "Rose"],
    quiz_correct_index=1,
    baseline_reminder="Remember to get the hand cream for Sophie.",
)


# ──────────────────────────────────────────────
# Registry — lookup helpers
# ──────────────────────────────────────────────

_ALL_TASKS: list[PMTaskDef] = [
    B1_BOOK, B1_GIFTBAG, B1_DISH, B1_SOAP,
    B2_VINYL, B2_NAPKINRINGS, B2_POT, B2_SOFTENER,
    B3_HANGER, B3_SPEAKER, B3_VASE, B3_HANDCREAM,
]

_TASK_MAP: dict[str, PMTaskDef] = {t.task_id: t for t in _ALL_TASKS}

_BLOCK_MAP: dict[int, list[PMTaskDef]] = {
    1: [B1_BOOK, B1_GIFTBAG, B1_DISH, B1_SOAP],
    2: [B2_VINYL, B2_NAPKINRINGS, B2_POT, B2_SOFTENER],
    3: [B3_HANGER, B3_SPEAKER, B3_VASE, B3_HANDCREAM],
}

# Fixed trigger order per block (activity trigger always last)
BLOCK_TRIGGER_ORDER: dict[int, list[str]] = {
    1: ["b1_dish", "b1_book", "b1_giftbag", "b1_soap"],
    2: ["b2_vinyl", "b2_pot", "b2_softener", "b2_napkinrings"],
    3: ["b3_hanger", "b3_vase", "b3_handcream", "b3_speaker"],
}

# Fixed trigger times (seconds from block start) for non-activity tasks
BLOCK_TRIGGER_TIMES: dict[int, dict[str, int]] = {
    1: {"b1_dish": 195, "b1_book": 360, "b1_giftbag": 420},
    2: {"b2_vinyl": 180, "b2_pot": 300, "b2_softener": 390},
    3: {"b3_hanger": 200, "b3_vase": 330, "b3_handcream": 410},
}

# Activity trigger watch-start times and fallback deadlines
ACTIVITY_WATCH_CONFIG: dict[str, dict] = {
    "b1_soap":        {"watch_from": 440, "fallback": 530, "condition": "all_steaks_plated"},
    "b2_napkinrings": {"watch_from": 430, "fallback": 520, "condition": "table_full_set"},
    "b3_speaker":     {"watch_from": 450, "fallback": 525, "condition": "message_batch_end"},
}

# Guest names per block
BLOCK_GUESTS: dict[int, str] = {1: "Mei", 2: "Lucas", 3: "Sophie"}

# Neutral robot utterances per block
NEUTRAL_UTTERANCES: dict[int, list[str]] = {
    1: [
        "The kitchen smells wonderful already!",
        "I think Mei will love this dinner.",
        "Cooking is such a nice way to spend the evening.",
        "The weather looks pleasant outside.",
    ],
    2: [
        "Lucas always has great music taste.",
        "The dining table looks elegant.",
        "I enjoy helping with dinner preparations.",
        "What a cozy evening to have friends over.",
    ],
    3: [
        "Sophie is always so cheerful.",
        "The house feels warm and welcoming.",
        "Dinner parties are the best kind of gatherings.",
        "Everything is coming together nicely.",
    ],
}


def get_task(task_id: str) -> PMTaskDef:
    """Look up a single PM task by ID. Raises KeyError if not found."""
    return _TASK_MAP[task_id]


def get_tasks_for_block(block: int) -> list[PMTaskDef]:
    """Return the 4 PM tasks for a given block (1, 2, or 3)."""
    return list(_BLOCK_MAP[block])


def get_all_tasks() -> list[PMTaskDef]:
    """Return all 12 PM tasks."""
    return list(_ALL_TASKS)


def get_task_as_dict(task_id: str) -> dict:
    """Return a task as a plain dict (for JSON serialization)."""
    from dataclasses import asdict
    return asdict(get_task(task_id))


def get_task_config(task_id: str) -> dict:
    """Return task_config dict matching the PMTrial.task_config format."""
    t = get_task(task_id)
    return {
        "task_id": t.task_id,
        "trigger_type": t.trigger_type,
        "trigger_event": t.trigger_visual,
        "target_room": t.target_room,
        "target_object": t.target_name,
        "target_action": t.action_description,
        "distractor_object": t.distractor_name,
        "action_destination": t.action_destination,
        "discriminating_cue": t.discriminating_cue,
    }


def task_def_to_config(task_def: PMTaskDef) -> dict:
    """Convert PMTaskDef to the task_config JSON stored in PMTrial."""
    return {
        "task_id": task_def.task_id,
        "trigger_type": task_def.trigger_type,
        "trigger_event": task_def.trigger_visual,
        "target_room": task_def.target_room,
        "target_object": task_def.target_name,
        "target_action": task_def.action_description,
        "distractor_object": task_def.distractor_name,
        "action_destination": task_def.action_destination,
        "discriminating_cue": task_def.discriminating_cue,
    }


def task_def_to_encoding_card(task_def: PMTaskDef) -> dict:
    """Convert PMTaskDef to encoding card JSON stored in PMTrial."""
    return {
        "trigger_description": task_def.trigger_event,
        "target_room": task_def.target_room,
        "target_description": task_def.target_name,
        "target_image": f"/assets/pm/{task_def.target_image}",
        "action_description": task_def.action_description,
        "encoding_text": task_def.encoding_text,
        "visual_cues": {
            "target": task_def.target_visual_desc,
            "distractor": task_def.distractor_visual_desc,
            "cue": task_def.discriminating_cue,
        },
        "quiz_question": task_def.quiz_question,
        "quiz_options": task_def.quiz_options,
        "quiz_correct_index": task_def.quiz_correct_index,
    }
