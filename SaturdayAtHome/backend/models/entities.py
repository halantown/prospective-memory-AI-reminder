"""Domain entities — data classes and enums."""

from dataclasses import dataclass
from enum import Enum


class HobStatus(str, Enum):
    EMPTY = "empty"
    COOKING_SIDE1 = "cooking_side1"
    READY_SIDE1 = "ready_side1"
    COOKING_SIDE2 = "cooking_side2"
    READY_SIDE2 = "ready_side2"
    BURNING = "burning"
    ASH = "ash"


@dataclass
class Hob:
    id: int
    status: HobStatus = HobStatus.EMPTY
    started_at: float = 0.0
    cooking_ms: float = 13000
    ready_ms: float = 4000
    ash_ms: float = 9000
    peppered: bool = False

