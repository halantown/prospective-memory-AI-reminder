"""Domain entities — data classes and enums."""

from dataclasses import dataclass
from enum import Enum


class HobStatus(str, Enum):
    EMPTY = "empty"
    COOKING = "cooking"
    READY = "ready"
    BURNING = "burning"


@dataclass
class Hob:
    id: int
    status: HobStatus = HobStatus.EMPTY
    started_at: float = 0.0
    cooking_ms: float = 18000
    ready_ms: float = 6000

