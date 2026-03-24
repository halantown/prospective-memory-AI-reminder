from routes.admin import ALLOWED_ADMIN_EVENTS


def test_admin_allowlist_covers_dashboard_controls():
    required = {
        "block_start",
        "block_end",
        "steak_spawn",
        "force_yellow_steak",
        "trigger_appear",
        "window_close",
        "reminder_fire",
        "robot_neutral",
        "fake_trigger_fire",
        "message_bubble",
        "plant_needs_water",
    }
    assert required.issubset(ALLOWED_ADMIN_EVENTS)
