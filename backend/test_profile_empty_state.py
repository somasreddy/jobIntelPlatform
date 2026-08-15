"""Profile API empty-state regression coverage."""
from __future__ import annotations

import asyncio
import uuid

from fastapi import Response

from api.profile import get_profile


class _EmptyResult:
    def scalar_one_or_none(self):
        return None


class _EmptySession:
    async def execute(self, _statement):
        return _EmptyResult()


def test_missing_profile_is_a_normal_empty_state() -> None:
    response = asyncio.run(get_profile(uid=uuid.uuid4(), db=_EmptySession()))

    assert isinstance(response, Response)
    assert response.status_code == 204
    assert response.body == b""
