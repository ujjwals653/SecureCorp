"""
Backend test suite.

Tests cover every endpoint in PROJECT_CONTEXT.md §8 and the
Definition of Done in AGENT.md.  All tests run using:
    - mocked validate_ticket()  (no real Auth module needed)
    - a hardcoded sample envelope matching §7.1  (no real Crypto core needed)

Run with:
    pytest tests/ -v
"""

import json
import pytest
import sys
import os

from app import create_app

# ---------------------------------------------------------------------------
# Make modules/auth importable from the backend tests directory
# ---------------------------------------------------------------------------
_REPO_ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..")
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from modules.auth.auth import login as auth_login


# ---------------------------------------------------------------------------
# Sample encrypted file envelope matching §7.1 exactly.
# Values are dummy base64 strings — content is irrelevant, shape is what matters.
# ---------------------------------------------------------------------------
SAMPLE_ENVELOPE = {
    "file_id":      "550e8400-e29b-41d4-a716-446655440000",
    "sender_id":    "alice",
    "recipient_id": "bob",
    "ciphertext":   "U2FsdGVkX1+AAAAAAAAAAAAA",          # dummy base64
    "iv":           "AAAAAAAAAA==",                        # dummy 12-byte IV
    "wrapped_key":  "V3JhcHBlZEtleUFBQUFBQUFBQQ==",       # dummy wrapped AES key
    "signature":    "U2lnbmF0dXJlQUFBQUFBQUFBQQ==",       # dummy RSA-PSS sig
    "filename":     "secret.pdf",
    "timestamp":    "2026-10-10T12:00:00Z",
}

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def app(tmp_path):
    """Create a fresh app with an in-memory-like temp DB for each test."""
    import os
    os.environ["DB_PATH"] = str(tmp_path / "test.db")
    application = create_app()
    application.config["TESTING"] = True
    yield application


@pytest.fixture()
def client(app):
    return app.test_client()


# ── helpers ─────────────────────────────────────────────────────────────────
# Generate real signed tickets (Checkpoint 2: real auth module wired in)

def alice_headers():
    t = auth_login("alice", "password123")
    return {"Authorization": f"Bearer {t['ticket']}"}

def bob_headers():
    t = auth_login("bob", "password456")
    return {"Authorization": f"Bearer {t['ticket']}"}

def admin_headers():
    t = auth_login("admin", "adminpass")
    return {"Authorization": f"Bearer {t['ticket']}"}

def bad_headers():
    return {"Authorization": "Bearer totally-invalid-token"}


# ===========================================================================
# 1. POST /api/auth/login
# ===========================================================================

class TestLogin:
    def test_valid_credentials_returns_ticket(self, client):
        r = client.post("/api/auth/login",
                        json={"user_id": "alice", "password": "password123"})
        assert r.status_code == 200
        body = r.get_json()
        # §7.2 shape
        assert body["user_id"] == "alice"
        assert body["role"] in ("employee", "manager", "admin")
        assert "ticket" in body
        assert "issued_at" in body
        assert "expires_at" in body

    def test_wrong_password_returns_401(self, client):
        r = client.post("/api/auth/login",
                        json={"user_id": "alice", "password": "wrong"})
        assert r.status_code == 401
        assert "error" in r.get_json()

    def test_unknown_user_returns_401(self, client):
        r = client.post("/api/auth/login",
                        json={"user_id": "eve", "password": "anything"})
        assert r.status_code == 401

    def test_missing_fields_returns_400(self, client):
        r = client.post("/api/auth/login", json={"user_id": "alice"})
        assert r.status_code == 400


# ===========================================================================
# 2. POST /api/keys/register  &  GET /api/keys/<user_id>
# ===========================================================================

SAMPLE_KEY_REG = {
    "user_id":    "alice",
    "public_key": "TUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUF0",
    "algorithm":  "RSA-OAEP-2048",
}

class TestKeys:
    def test_register_key_success(self, client):
        r = client.post("/api/keys/register",
                        json=SAMPLE_KEY_REG,
                        headers=alice_headers())
        assert r.status_code == 201
        assert r.get_json()["status"] == "registered"

    def test_register_key_no_auth_returns_401(self, client):
        r = client.post("/api/keys/register", json=SAMPLE_KEY_REG)
        assert r.status_code == 401

    def test_register_key_invalid_token_returns_401(self, client):
        r = client.post("/api/keys/register",
                        json=SAMPLE_KEY_REG,
                        headers=bad_headers())
        assert r.status_code == 401

    def test_register_key_wrong_user_returns_403(self, client):
        """Alice cannot register a key under Bob's user_id."""
        payload = {**SAMPLE_KEY_REG, "user_id": "bob"}
        r = client.post("/api/keys/register",
                        json=payload,
                        headers=alice_headers())
        assert r.status_code == 403

    def test_register_key_missing_fields_returns_400(self, client):
        r = client.post("/api/keys/register",
                        json={"user_id": "alice"},
                        headers=alice_headers())
        assert r.status_code == 400

    def test_register_key_invalid_algorithm_returns_400(self, client):
        r = client.post("/api/keys/register",
                        json={**SAMPLE_KEY_REG, "algorithm": "DES"},
                        headers=alice_headers())
        assert r.status_code == 400

    def test_get_key_after_register(self, client):
        client.post("/api/keys/register",
                    json=SAMPLE_KEY_REG,
                    headers=alice_headers())
        r = client.get("/api/keys/alice", headers=alice_headers())
        assert r.status_code == 200
        body = r.get_json()
        assert body["user_id"] == "alice"
        assert body["public_key"] == SAMPLE_KEY_REG["public_key"]
        assert body["algorithm"] == SAMPLE_KEY_REG["algorithm"]

    def test_get_key_not_found_returns_404(self, client):
        r = client.get("/api/keys/nobody", headers=alice_headers())
        assert r.status_code == 404

    def test_get_key_no_auth_returns_401(self, client):
        r = client.get("/api/keys/alice")
        assert r.status_code == 401


# ===========================================================================
# 3. POST /api/files/upload
# ===========================================================================

class TestUpload:
    def _upload(self, client, payload=None, headers=None):
        return client.post("/api/files/upload",
                           json=payload or SAMPLE_ENVELOPE,
                           headers=headers or alice_headers())

    def test_upload_valid_envelope_returns_201(self, client):
        r = self._upload(client)
        assert r.status_code == 201
        body = r.get_json()
        assert body["status"] == "stored"
        assert "file_id" in body

    def test_upload_uses_provided_file_id(self, client):
        r = self._upload(client)
        assert r.get_json()["file_id"] == SAMPLE_ENVELOPE["file_id"]

    def test_upload_generates_file_id_when_missing(self, client):
        env = {k: v for k, v in SAMPLE_ENVELOPE.items() if k != "file_id"}
        r = self._upload(client, payload=env)
        assert r.status_code == 201
        assert r.get_json()["file_id"]  # non-empty

    def test_upload_no_auth_returns_401(self, client):
        r = client.post("/api/files/upload", json=SAMPLE_ENVELOPE)
        assert r.status_code == 401

    def test_upload_missing_field_returns_400(self, client):
        env = {k: v for k, v in SAMPLE_ENVELOPE.items() if k != "ciphertext"}
        r = self._upload(client, payload=env)
        assert r.status_code == 400
        assert "ciphertext" in r.get_json()["message"]

    def test_upload_wrong_sender_returns_403(self, client):
        """Alice's ticket cannot upload as Bob."""
        env = {**SAMPLE_ENVELOPE, "sender_id": "bob"}
        r = self._upload(client, payload=env)
        assert r.status_code == 403

    def test_upload_duplicate_file_id_returns_409(self, client):
        self._upload(client)
        r = self._upload(client)
        assert r.status_code == 409


# ===========================================================================
# 4. GET /api/files/<file_id>  — RBAC (Act 6 mechanism)
# ===========================================================================

class TestGetFile:
    def _upload_and_get_id(self, client) -> str:
        r = client.post("/api/files/upload",
                        json=SAMPLE_ENVELOPE,
                        headers=alice_headers())
        return r.get_json()["file_id"]

    def test_sender_can_retrieve_file(self, client):
        fid = self._upload_and_get_id(client)
        r = client.get(f"/api/files/{fid}", headers=alice_headers())
        assert r.status_code == 200
        body = r.get_json()
        # Response must match §7.1 shape
        for field in ("file_id", "sender_id", "recipient_id",
                      "ciphertext", "iv", "wrapped_key",
                      "signature", "filename", "timestamp"):
            assert field in body, f"Missing field: {field}"

    def test_recipient_can_retrieve_file(self, client):
        fid = self._upload_and_get_id(client)
        r = client.get(f"/api/files/{fid}", headers=bob_headers())
        assert r.status_code == 200

    def test_unauthorized_user_gets_403(self, client):
        """Eve (admin token but neither sender nor recipient) must be denied."""
        fid = self._upload_and_get_id(client)
        r = client.get(f"/api/files/{fid}", headers=admin_headers())
        assert r.status_code == 403

    def test_missing_auth_returns_401(self, client):
        fid = self._upload_and_get_id(client)
        r = client.get(f"/api/files/{fid}")
        assert r.status_code == 401

    def test_nonexistent_file_returns_404(self, client):
        r = client.get("/api/files/does-not-exist", headers=alice_headers())
        assert r.status_code == 404


# ===========================================================================
# 5. GET /api/files/inbox
# ===========================================================================

class TestInbox:
    def test_bob_sees_files_addressed_to_him(self, client):
        client.post("/api/files/upload",
                    json=SAMPLE_ENVELOPE,
                    headers=alice_headers())
        r = client.get("/api/files/inbox", headers=bob_headers())
        assert r.status_code == 200
        files = r.get_json()
        assert any(f["file_id"] == SAMPLE_ENVELOPE["file_id"] for f in files)

    def test_alice_inbox_is_empty_when_nothing_addressed_to_her(self, client):
        client.post("/api/files/upload",
                    json=SAMPLE_ENVELOPE,
                    headers=alice_headers())
        r = client.get("/api/files/inbox", headers=alice_headers())
        assert r.status_code == 200
        assert r.get_json() == []

    def test_inbox_no_auth_returns_401(self, client):
        r = client.get("/api/files/inbox")
        assert r.status_code == 401


# ===========================================================================
# 6. GET /api/ids/alerts — admin role required
# ===========================================================================

class TestIdsAlerts:
    def test_admin_gets_empty_list(self, client):
        r = client.get("/api/ids/alerts", headers=admin_headers())
        assert r.status_code == 200
        assert isinstance(r.get_json(), list)

    def test_non_admin_gets_403(self, client):
        r = client.get("/api/ids/alerts", headers=alice_headers())
        assert r.status_code == 403

    def test_no_auth_gets_401(self, client):
        r = client.get("/api/ids/alerts")
        assert r.status_code == 401
