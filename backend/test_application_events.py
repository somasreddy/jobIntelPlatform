import asyncio
import uuid

from api.applications import ApplicationCreate, ApplicationUpdate, create_application, update_application
from models.database import Application, ApplicationEvent, OutboxEvent


class ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeSession:
    def __init__(self, result=None):
        self.result = result
        self.added = []

    def add(self, value):
        if getattr(value, "id", None) is None:
            value.id = uuid.uuid4()
        self.added.append(value)

    async def flush(self):
        return None

    async def refresh(self, value):
        return None

    async def execute(self, statement):
        return ScalarResult(self.result)


def test_create_application_writes_timeline_and_outbox_atomically():
    session = FakeSession()
    user_id = uuid.uuid4()
    job_id = uuid.uuid4()

    response = asyncio.run(create_application(
        ApplicationCreate(job_id=str(job_id), status="Saved"),
        db=session,
        uid=user_id,
    ))

    assert response["status"] == "Saved"
    assert response["statusKey"] == "saved"
    assert next(item for item in session.added if isinstance(item, Application)).status == "saved"
    assert any(isinstance(item, Application) for item in session.added)
    assert any(isinstance(item, ApplicationEvent) and item.event_type == "application_created" for item in session.added)
    assert any(isinstance(item, OutboxEvent) and item.event_type == "application.created" for item in session.added)


def test_status_change_writes_before_after_event_and_outbox():
    user_id = uuid.uuid4()
    app = Application(id=uuid.uuid4(), user_id=user_id, status="Saved")
    session = FakeSession(result=app)

    asyncio.run(update_application(
        str(app.id),
        ApplicationUpdate(status="Shortlisted"),
        db=session,
        uid=user_id,
    ))

    event = next(item for item in session.added if isinstance(item, ApplicationEvent))
    outbox = next(item for item in session.added if isinstance(item, OutboxEvent))
    assert event.from_status == "saved"
    assert event.to_status == "shortlisted"
    assert outbox.payload["from_status"] == "saved"
    assert outbox.payload["to_status"] == "shortlisted"
