import time

from tests.conftest import make_pdf

MOTOR = (
    "A premium efficiency motor rated at 50 horsepower operates at 1800 rpm. "
    "Rewinding should be performed by qualified service centers to preserve efficiency."
)
PUMP = "Centrifugal pumps must be primed before starting. Cavitation damages the impeller vanes."


def _upload(client, pages, name="manual.pdf"):
    r = client.post("/api/documents", files={"file": (name, make_pdf(pages), "application/pdf")})
    assert r.status_code == 201, r.text
    return r.json()["document"]


def _wait_ready(client, doc_id):
    for _ in range(50):
        d = client.get(f"/api/documents/{doc_id}").json()
        if d["status"] != "PROCESSING":
            return d
        time.sleep(0.05)
    raise AssertionError("document never finished processing")


def test_upload_index_and_chat_with_validated_citation(client):
    doc = _upload(client, [MOTOR, PUMP])
    detail = _wait_ready(client, doc["id"])
    assert detail["status"] == "READY" and detail["page_count"] == 2 and detail["chunk_count"] >= 2

    r = client.post("/api/chat", json={"question": "Who should perform rewinding of the motor?"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["found"] is True
    assert body["citations"][0]["page_number"] == 1
    assert body["citations"][0]["document_title"] == "manual"
    assert body["retrieved"]

    r = client.post(
        "/api/chat",
        json={"question": "What damages the impeller vanes?", "conversation_id": body["conversation_id"]},
    )
    assert r.json()["citations"][0]["page_number"] == 2


def test_documents_are_scoped_to_session(client):
    doc = _upload(client, [MOTOR])
    assert [d["id"] for d in client.get("/api/documents").json()] == [doc["id"]]
    other = client.get("/api/documents", headers={"X-Session-Id": "someone-else"}).json()
    assert other == []
    assert client.get(f"/api/documents/{doc['id']}", headers={"X-Session-Id": "x"}).status_code == 404
    assert (
        client.get(f"/api/documents/{doc['id']}/file", headers={"X-Session-Id": "test-session"}).status_code
        == 200
    )


def test_upload_rejections_and_quota(client):
    bad = client.post("/api/documents", files={"file": ("x.pdf", b"hello", "application/pdf")})
    assert bad.status_code == 415
    too_long = client.post(
        "/api/documents", files={"file": ("big.pdf", make_pdf(["x " * 20] * 21), "application/pdf")}
    )
    assert too_long.status_code == 422
    _upload(client, [MOTOR], "a.pdf")
    r = client.post("/api/documents", files={"file": ("c.pdf", make_pdf([PUMP]), "application/pdf")})
    assert r.status_code == 429  # uploads_per_ip_per_day=2, the 21-page reject counted


def test_chat_quota_and_not_found(client):
    _wait_ready(client, _upload(client, [MOTOR])["id"])
    r = client.post("/api/chat", json={"question": "What is the boiling point of mercury on Venus?"})
    assert r.json()["found"] is False
    for _ in range(4):
        client.post("/api/chat", json={"question": "motor rpm?"})
    assert client.post("/api/chat", json={"question": "motor rpm?"}).status_code == 429


def test_delete_upload(client):
    doc = _upload(client, [MOTOR])
    _wait_ready(client, doc["id"])
    # Stored in the DB (free hosts have ephemeral disks), not as a file.
    pdf = client.get(f"/api/documents/{doc['id']}/file", headers={"X-Session-Id": "test-session"})
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert client.delete(f"/api/documents/{doc['id']}").status_code == 204
    assert client.get(f"/api/documents/{doc['id']}").status_code == 404


def test_config_and_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.get("/api/config").json()["vision_enabled"] is False


def test_delete_refuses_processing_and_samples(client):
    from app.api import routes
    from documind_core.db import DocumentRow

    doc = _upload(client, [MOTOR])
    _wait_ready(client, doc["id"])
    for field, value, code in (("status", "PROCESSING", 409), ("source", "sample", 403)):
        with routes.get_session_factory()() as s:
            row = s.get(DocumentRow, doc["id"])
            original = getattr(row, field)
            setattr(row, field, value)
            s.commit()
        assert client.delete(f"/api/documents/{doc['id']}").status_code == code
        with routes.get_session_factory()() as s:
            setattr(s.get(DocumentRow, doc["id"]), field, original)
            s.commit()
