import time

from models.entities import Hob, HobStatus
from services.hob_service import reconcile_hob


def test_reconcile_hob_keeps_recent_ash():
    hob = Hob(id=0, status=HobStatus.ASH, started_at=time.time() - 1.0, peppered=True)
    reconcile_hob(hob)
    assert hob.status == HobStatus.ASH
    assert hob.peppered is True


def test_reconcile_hob_clears_ash_after_two_seconds():
    hob = Hob(id=1, status=HobStatus.ASH, started_at=time.time() - 2.1, peppered=True)
    reconcile_hob(hob)
    assert hob.status == HobStatus.EMPTY
    assert hob.started_at == 0.0
    assert hob.peppered is False
