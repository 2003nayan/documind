"""Daily usage caps stored in Postgres so they survive restarts of a free host."""

import hashlib
from datetime import UTC, datetime

from documind_core.db import UsageCounterRow
from sqlalchemy.orm import Session


class QuotaError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


def subject_for_ip(ip: str) -> str:
    return "ip:" + hashlib.sha256(ip.encode()).hexdigest()[:16]


def _today() -> datetime:
    return datetime.now(UTC)


def check_and_increment(
    session: Session, *, ip: str, action: str, per_ip: int, global_limit: int | None
) -> None:
    day = _today().date()
    subjects = [(subject_for_ip(ip), per_ip)]
    if global_limit is not None:
        subjects.append(("global", global_limit))
    rows = []
    for subject, limit in subjects:
        row = session.get(UsageCounterRow, (day, subject, action))
        if row is None:
            row = UsageCounterRow(day=day, subject=subject, action=action, count=0)
            session.add(row)
        if row.count >= limit:
            who = "today's demo" if subject == "global" else "your daily"
            raise QuotaError(f"You have reached {who} {action} limit ({limit}). Please try again tomorrow.")
        rows.append(row)
    for row in rows:
        row.count += 1
    session.commit()


def usage(session: Session, *, ip: str, action: str) -> int:
    row = session.get(UsageCounterRow, (_today().date(), subject_for_ip(ip), action))
    return row.count if row else 0
