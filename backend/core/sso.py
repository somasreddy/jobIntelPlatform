"""
Single Sign-On (SSO / OIDC) provider interface.

STATUS: SCAFFOLD ONLY - NOT LIVE.

This module defines the shape a real SSO integration would take
(authorize-redirect + code-exchange, the standard OAuth2/OIDC
authorization-code flow) and ships exactly one concrete implementation,
`GenericOIDCProvider`, that illustrates how any OIDC-speaking identity
provider (Okta, Auth0, Azure AD / Microsoft Entra ID, Google Workspace,
OneLogin, Keycloak, ...) would plug in.

It cannot actually authenticate anyone right now because there is no real
identity-provider tenant registered for this app in this environment -
SSO_OIDC_ISSUER / SSO_OIDC_CLIENT_ID / SSO_OIDC_CLIENT_SECRET are unset
(see backend/.env.example). Until a real tenant's values are supplied,
every method that would need to talk to an IdP raises `SSONotConfiguredError`
or `NotImplementedError` with a message that says exactly that - this module
never fabricates a token exchange or a synthetic user identity.

This is deliberately NOT wired into any router. Adopting it later (e.g. an
`/api/auth/sso/login` and `/api/auth/sso/callback` pair in api/auth.py) is a
separate, deliberate decision for whoever configures a real IdP tenant.
"""
from __future__ import annotations

import logging
import os
import secrets
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional
from urllib.parse import urlencode

logger = logging.getLogger(__name__)


class SSONotConfiguredError(RuntimeError):
    """
    Raised when an SSO operation is attempted without real identity-provider
    credentials configured. Distinct from NotImplementedError (used below
    for "credentials exist but the code path itself isn't written yet") -
    this one means "there is nothing to call at all."
    """


@dataclass(frozen=True)
class SSOUserInfo:
    """Verified identity claims returned by a completed SSO exchange."""
    subject: str
    email: Optional[str]
    name: Optional[str]
    raw_claims: dict[str, Any] = field(default_factory=dict)


class SSOProvider(ABC):
    """
    Abstract interface every SSO/OIDC provider integration implements.

    A real router would call `authorize_url()` to redirect the user to the
    IdP, then `exchange_code()` on the callback to turn the returned
    authorization code into a verified identity.
    """

    @abstractmethod
    def is_configured(self) -> bool:
        """True only if real IdP credentials (issuer/client id/secret) are set."""
        raise NotImplementedError

    @abstractmethod
    def authorize_url(self, state: str, redirect_uri: str) -> str:
        """Build the URL to redirect the browser to for login."""
        raise NotImplementedError

    @abstractmethod
    async def exchange_code(self, code: str, redirect_uri: str) -> SSOUserInfo:
        """Exchange an authorization code for a verified SSOUserInfo."""
        raise NotImplementedError


def generate_state() -> str:
    """Random, unguessable `state` value for the OAuth2 CSRF check."""
    return secrets.token_urlsafe(32)


class GenericOIDCProvider(SSOProvider):
    """
    Stub implementation for a generic OpenID Connect provider.

    NOT LIVE. Reads three env vars that are unset in this environment -
    setting them to real values from an actual IdP tenant is a prerequisite
    for anything here to work, and is a separate, deliberate future step:

      - SSO_OIDC_ISSUER         e.g. https://your-tenant.okta.com/oauth2/default
      - SSO_OIDC_CLIENT_ID      issued by the IdP when you register this app
      - SSO_OIDC_CLIENT_SECRET  issued by the IdP when you register this app

    See backend/.env.example for the documented config block.
    """

    def __init__(
        self,
        issuer: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
    ) -> None:
        self.issuer = issuer if issuer is not None else os.getenv("SSO_OIDC_ISSUER", "")
        self.client_id = client_id if client_id is not None else os.getenv("SSO_OIDC_CLIENT_ID", "")
        self.client_secret = (
            client_secret if client_secret is not None else os.getenv("SSO_OIDC_CLIENT_SECRET", "")
        )

    def is_configured(self) -> bool:
        return bool(self.issuer and self.client_id and self.client_secret)

    def authorize_url(self, state: str, redirect_uri: str) -> str:
        if not self.is_configured():
            raise SSONotConfiguredError(
                "SSO is not configured: SSO_OIDC_ISSUER, SSO_OIDC_CLIENT_ID and "
                "SSO_OIDC_CLIENT_SECRET must all be set to real values from an "
                "identity provider tenant before a real authorize URL can be "
                "built. See backend/.env.example. (No fallback/demo URL is "
                "returned - that would silently pretend SSO works.)"
            )
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "scope": "openid email profile",
            "state": state,
        }
        return f"{self.issuer.rstrip('/')}/authorize?{urlencode(params)}"

    async def exchange_code(self, code: str, redirect_uri: str) -> SSOUserInfo:
        if not self.is_configured():
            raise SSONotConfiguredError(
                "SSO is not configured: cannot exchange an authorization code "
                "for an identity because there is no real IdP client_secret "
                "configured. This method deliberately does not fabricate a "
                "user identity. See backend/.env.example."
            )
        # A real implementation would, roughly:
        #   1. POST `code` + client_id/client_secret + redirect_uri to
        #      f"{self.issuer}/token" to get an id_token/access_token.
        #   2. Fetch f"{self.issuer}/.well-known/jwks.json" and verify the
        #      id_token's signature against it (never trust an unverified JWT).
        #   3. Map the verified claims (sub/email/name/...) onto SSOUserInfo.
        # None of that is implemented here - there is no real IdP tenant to
        # test it against in this environment. Wire this up once one exists.
        raise NotImplementedError(
            "GenericOIDCProvider.exchange_code has no real token-exchange call "
            "wired up yet. Implement the OIDC token exchange + JWKS-verified "
            "id_token decode here once a real client_secret is configured."
        )


def get_sso_provider() -> SSOProvider:
    """
    Factory a future auth router would call to obtain the active SSO
    provider. Not called from any router today - see module docstring.
    """
    return GenericOIDCProvider()
