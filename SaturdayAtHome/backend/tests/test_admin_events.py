from routes.admin import ALLOWED_ADMIN_EVENTS


def test_admin_allowlist_covers_state_driven_controls():
    required = {
        "block_start",
        "room_transition",
        "robot_speak",
        "trigger_appear",
        "window_close",
        "reminder_fire",
        "block_end",
    }
    assert required.issubset(ALLOWED_ADMIN_EVENTS)
