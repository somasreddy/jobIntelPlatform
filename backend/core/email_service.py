"""
Generic transactional email interface.

STATUS: SCAFFOLD ONLY - NOT LIVE.

This gives the rest of the backend one small `EmailService` interface to
depend on for one-off transactional email (e.g. a future "SSO account
linked", "calendar sync failed", password-reset, or notification email) -
with a default implementation that is honest about doing nothing but
logging until a real provider is wired in.

NOT a replacement for services/digest.py: that module is the existing,
already-functional morning-digest feature, which genuinely calls out to
SendGrid/Resend/SMTP today whenever SENDGRID_API_KEY / RESEND_API_KEY /
SMTP_HOST are configured. This module is unrelated scaffolding for
anything else that might need to send a transactional email later, and
intentionally does NOT reuse those provider credentials or call any real
provider - it only ever logs (see `LoggingEmailService` below).

Activating real sending requires a deliberate future choice:
  1. Pick a provider - SendGrid, Postmark, and Amazon SES are common picks;
     none is preferred or implemented here.
  2. Set EMAIL_PROVIDER_API_KEY and EMAIL_FROM_ADDRESS (see
     backend/.env.example).
  3. Implement a new `EmailService` subclass with that provider's real API
     call, and swap `get_email_service()` below to return it.
"""
from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmailSendResult:
    """Outcome of an EmailService.send() call."""
    success: bool
    dry_run: bool
    provider: str
    detail: str


class EmailService(ABC):
    """Abstract interface any transactional-email backend implements."""

    @abstractmethod
    def is_configured(self) -> bool:
        """True only if a real provider API key is set."""
        raise NotImplementedError

    @abstractmethod
    def send(self, to: str, subject: str, body: str, html: Optional[str] = None) -> EmailSendResult:
        """Send (or, in this scaffold, log) a single email."""
        raise NotImplementedError


class LoggingEmailService(EmailService):
    """
    Default, only implementation shipped in this scaffold.

    NOT LIVE: it never talks to a real email provider, whether or not
    EMAIL_PROVIDER_API_KEY happens to be set. It always logs the would-be
    email at INFO level and returns success=False, dry_run=True - a safe,
    honest "dry run" default rather than a fabricated "sent" response.

    Swapping in a real provider (SendGrid/Postmark/SES/etc - your pick)
    means writing a new EmailService subclass that performs that
    provider's real HTTP call using EMAIL_PROVIDER_API_KEY, and pointing
    `get_email_service()` at it. That has deliberately not been done here.
    """

    def __init__(self, api_key: Optional[str] = None, from_address: Optional[str] = None) -> None:
        self.api_key = api_key if api_key is not None else os.getenv("EMAIL_PROVIDER_API_KEY", "")
        self.from_address = (
            from_address if from_address is not None
            else os.getenv("EMAIL_FROM_ADDRESS", "no-reply@example.invalid")
        )

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def send(self, to: str, subject: str, body: str, html: Optional[str] = None) -> EmailSendResult:
        configured = self.is_configured()
        logger.info(
            "[EMAIL DRY RUN - %s] from=%s to=%s subject=%r\n%s",
            "no provider configured" if not configured else "provider key present but no send implementation",
            self.from_address,
            to,
            subject,
            html or body,
        )
        if configured:
            detail = (
                "EMAIL_PROVIDER_API_KEY is set, but LoggingEmailService has no "
                "real provider HTTP call implemented - see the class docstring "
                "for how to add one. The email was logged, not sent."
            )
        else:
            detail = (
                "EMAIL_PROVIDER_API_KEY is not set, so no real provider is "
                "configured. The email was logged, not sent. "
                "See backend/.env.example."
            )
        return EmailSendResult(
            success=False,
            dry_run=True,
            provider="none (dry-run logger)",
            detail=detail,
        )


def get_email_service() -> EmailService:
    """
    Factory for the active EmailService. Not called from any router today -
    a future caller would do `email_service = get_email_service()` and then
    `email_service.send(...)`.
    """
    return LoggingEmailService()
