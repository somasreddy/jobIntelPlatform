"""
Calendar event creation interface.

STATUS: SCAFFOLD ONLY - NOT LIVE.

This defines the shape a real calendar integration would take (e.g. "add
an interview to the candidate's calendar") and ships one default
implementation, `LoggingCalendarService`, that is honest about doing
nothing but logging until a real calendar provider is wired in.

It cannot actually create a calendar event right now because there is no
calendar OAuth app registration in this environment - no client_id/secret
for Google Calendar, Microsoft Graph/Outlook, Cronofy, or any other
provider (see CALENDAR_OAUTH_* in backend/.env.example, currently unset).

This is deliberately NOT wired into any router. Activating it requires a
deliberate future choice:
  1. Pick a calendar provider and register an OAuth app with it (none is
     preferred or implemented here).
  2. Set CALENDAR_OAUTH_CLIENT_ID / CALENDAR_OAUTH_CLIENT_SECRET /
     CALENDAR_OAUTH_REDIRECT_URI (see backend/.env.example).
  3. Implement a new `CalendarService` subclass with that provider's real
     OAuth token flow + "create event" API call, and swap
     `get_calendar_service()` below to return it.
"""
from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CalendarEventRequest:
    """What a caller wants scheduled - provider-agnostic."""
    title: str
    start: datetime
    end: datetime
    description: Optional[str] = None
    location: Optional[str] = None
    attendee_emails: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class CalendarEventResult:
    """Outcome of a CalendarService.create_event() call."""
    success: bool
    dry_run: bool
    provider: str
    detail: str
    event_id: Optional[str] = None


class CalendarService(ABC):
    """Abstract interface any calendar-provider integration implements."""

    @abstractmethod
    def is_configured(self) -> bool:
        """True only if real calendar OAuth credentials are set."""
        raise NotImplementedError

    @abstractmethod
    def create_event(self, request: CalendarEventRequest) -> CalendarEventResult:
        """Create (or, in this scaffold, log) a single calendar event."""
        raise NotImplementedError


class LoggingCalendarService(CalendarService):
    """
    Default, only implementation shipped in this scaffold.

    NOT LIVE: it never talks to a real calendar API, whether or not
    CALENDAR_OAUTH_CLIENT_ID/SECRET happen to be set. create_event() always
    logs the would-be event at INFO level and returns a CalendarEventResult
    with success=False, dry_run=True, event_id=None - never a fabricated
    event id that could be mistaken for a real, created event.
    """

    def __init__(self, client_id: Optional[str] = None, client_secret: Optional[str] = None) -> None:
        self.client_id = client_id if client_id is not None else os.getenv("CALENDAR_OAUTH_CLIENT_ID", "")
        self.client_secret = (
            client_secret if client_secret is not None else os.getenv("CALENDAR_OAUTH_CLIENT_SECRET", "")
        )

    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    def create_event(self, request: CalendarEventRequest) -> CalendarEventResult:
        configured = self.is_configured()
        logger.info(
            "[CALENDAR DRY RUN - %s] title=%r start=%s end=%s attendees=%s",
            "no provider configured" if not configured else "provider creds present but no create-event implementation",
            request.title,
            request.start.isoformat(),
            request.end.isoformat(),
            request.attendee_emails,
        )
        if configured:
            detail = (
                "CALENDAR_OAUTH_CLIENT_ID/SECRET are set, but LoggingCalendarService "
                "has no real provider API call implemented - see the class "
                "docstring for how to add one. The event was logged, not created."
            )
        else:
            detail = (
                "CALENDAR_OAUTH_CLIENT_ID/SECRET are not set, so no real calendar "
                "provider is configured. The event was logged, not created. "
                "See backend/.env.example."
            )
        return CalendarEventResult(
            success=False,
            dry_run=True,
            provider="none (dry-run logger)",
            detail=detail,
            event_id=None,
        )


def get_calendar_service() -> CalendarService:
    """
    Factory for the active CalendarService. Not called from any router
    today - a future caller would do `cal = get_calendar_service()` and
    then `cal.create_event(...)`.
    """
    return LoggingCalendarService()
