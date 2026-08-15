"""
Simple leveled-interval spaced-repetition scheduler for the Interview Prep
question bank (frontend/app/interview/page.tsx).

This is the classic Leitner system (https://en.wikipedia.org/wiki/Leitner_system):
a small number of "boxes" with increasing review intervals. A self-graded
"strong" recall promotes a question to the next box (pushes it further out);
a "weak" recall demotes it straight back to box 0 (resurfaces tomorrow) so
questions the candidate is shaky on get repeated practice sooner.

Deliberately NOT an LLM call and NOT a fabricated "AI confidence score" -
it's a deterministic, well-known scheduling algorithm driven entirely by the
candidate's own self-assessment of each attempt (the same mechanism real
spaced-repetition tools like Anki use for recall-based decks).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal, Tuple

Grade = Literal["weak", "strong"]

# Box index -> days until the next review. Box 0 = brand new / just missed;
# climbing roughly geometrically, matching the classic Leitner spacing.
BOX_INTERVALS_DAYS: Tuple[int, ...] = (1, 2, 4, 7, 14, 30, 60)
MAX_BOX = len(BOX_INTERVALS_DAYS) - 1


def apply_grade(current_box: int, grade: Grade) -> Tuple[int, int]:
    """Return (new_box, interval_days) after applying a self-graded review.

    - "strong": promote one box (capped at MAX_BOX) - pushes the question
      further out, per classic Leitner promotion.
    - "weak": demote straight back to box 0 - resurfaces tomorrow so the
      candidate gets another shot at it soon.
    """
    current_box = max(0, min(current_box, MAX_BOX))
    new_box = min(current_box + 1, MAX_BOX) if grade == "strong" else 0
    return new_box, BOX_INTERVALS_DAYS[new_box]


def next_review_at(interval_days: int, now: datetime | None = None) -> datetime:
    """Compute the next review timestamp, `interval_days` from `now` (UTC)."""
    base = now or datetime.now(timezone.utc)
    return base + timedelta(days=interval_days)


def is_due(next_review: datetime, now: datetime | None = None) -> bool:
    """Whether a question scheduled for `next_review` is due as of `now`."""
    base = now or datetime.now(timezone.utc)
    if next_review.tzinfo is None:
        next_review = next_review.replace(tzinfo=timezone.utc)
    return next_review <= base
