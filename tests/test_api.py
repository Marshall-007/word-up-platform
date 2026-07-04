"""API integration tests for the Word Up backend.

Runs the FastAPI app in-process against an in-memory MongoDB stand-in
(mongomock-motor), so no external services are required.
"""
import asyncio
import os
import sys
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "word_up_test")
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")

from mongomock_motor import AsyncMongoMockClient  # noqa: E402

import server  # noqa: E402


@pytest.fixture()
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
def reset_rate_limits():
    # Rate-limit buckets are process-global; clear them so tests don't bleed.
    server._rate_buckets.clear()
    yield
    server._rate_buckets.clear()


@pytest.fixture()
def client(monkeypatch):
    mock_client = AsyncMongoMockClient()
    monkeypatch.setattr(server, "db", mock_client["word_up_test"])
    transport = ASGITransport(app=server.app)
    return AsyncClient(transport=transport, base_url="http://testserver")


async def register(client, email="writer@example.com", user_type="creative", name="Test Writer"):
    resp = await client.post("/api/auth/register", json={
        "email": email,
        "password": "password123",
        "name": name,
        "user_type": user_type,
    })
    # The single shared httpx client would otherwise carry the last registered
    # user's session cookie (which the backend checks before the bearer token),
    # so clear it and let each user authenticate via its own JWT.
    client.cookies.clear()
    return resp


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.anyio
async def test_register_login_me(client):
    async with client:
        resp = await register(client)
        assert resp.status_code == 200
        data = resp.json()
        assert data["token"]
        assert data["user"]["email"] == "writer@example.com"
        assert "password_hash" not in data["user"]

        resp = await client.post("/api/auth/login", json={
            "email": "WRITER@example.com",  # case-insensitive
            "password": "password123",
        })
        assert resp.status_code == 200
        token = resp.json()["token"]

        resp = await client.get("/api/auth/me", headers=auth_headers(token))
        assert resp.status_code == 200
        assert resp.json()["email"] == "writer@example.com"


@pytest.mark.anyio
async def test_register_rejects_short_password_and_duplicates(client):
    async with client:
        resp = await client.post("/api/auth/register", json={
            "email": "a@example.com", "password": "short", "name": "A", "user_type": "creative",
        })
        assert resp.status_code == 400

        assert (await register(client, "dup@example.com")).status_code == 200
        resp = await register(client, "dup@example.com")
        assert resp.status_code == 409


@pytest.mark.anyio
async def test_login_wrong_password(client):
    async with client:
        await register(client)
        resp = await client.post("/api/auth/login", json={
            "email": "writer@example.com", "password": "wrong-password",
        })
        assert resp.status_code == 401


@pytest.mark.anyio
async def test_protected_route_requires_auth(client):
    async with client:
        resp = await client.get("/api/auth/me")
        assert resp.status_code == 401


@pytest.mark.anyio
async def test_writer_profile_and_samples(client):
    async with client:
        token = (await register(client)).json()["token"]

        resp = await client.get("/api/writers/profile", headers=auth_headers(token))
        assert resp.status_code == 200

        resp = await client.put("/api/writers/profile", headers=auth_headers(token), json={
            "bio": "I write things", "genres": ["fantasy"],
        })
        assert resp.status_code == 200
        assert resp.json()["bio"] == "I write things"

        # Create up to the 2-sample cap
        for i in range(2):
            resp = await client.post("/api/writers/samples", headers=auth_headers(token), json={
                "title": f"Sample {i}", "content": "Once upon a time" * 20,
                "genre": "fantasy", "format": "short_story", "price_credits": 2,
            })
            assert resp.status_code == 201
        resp = await client.post("/api/writers/samples", headers=auth_headers(token), json={
            "title": "Third", "content": "x", "genre": "fantasy", "format": "short_story",
        })
        assert resp.status_code == 400  # cap enforced

        resp = await client.get("/api/writers/samples", headers=auth_headers(token))
        assert resp.status_code == 200
        assert len(resp.json()) == 2


@pytest.mark.anyio
async def test_sample_price_validation(client):
    async with client:
        token = (await register(client)).json()["token"]
        resp = await client.post("/api/writers/samples", headers=auth_headers(token), json={
            "title": "Bad price", "content": "text", "genre": "g", "format": "f",
            "price_credits": 0,
        })
        assert resp.status_code == 400


@pytest.mark.anyio
async def test_business_cannot_use_writer_routes_and_vice_versa(client):
    async with client:
        writer_token = (await register(client)).json()["token"]
        biz_token = (await register(client, "biz@example.com", "business", "Acme")).json()["token"]

        resp = await client.post("/api/writers/samples", headers=auth_headers(biz_token), json={
            "title": "t", "content": "c", "genre": "g", "format": "f",
        })
        assert resp.status_code == 403

        resp = await client.get("/api/writers/discover", headers=auth_headers(writer_token))
        assert resp.status_code == 403


@pytest.mark.anyio
async def test_purchase_flow_and_credit_deduction(client):
    async with client:
        writer_token = (await register(client)).json()["token"]
        biz_token = (await register(client, "biz@example.com", "business", "Acme")).json()["token"]

        resp = await client.post("/api/writers/samples", headers=auth_headers(writer_token), json={
            "title": "Paid sample", "content": "Secret content " * 30,
            "genre": "fantasy", "format": "short_story", "price_credits": 3,
        })
        sample_id = resp.json()["id"]

        resp = await client.get("/api/business/credits", headers=auth_headers(biz_token))
        starting = resp.json()["credits"]
        assert starting == 10

        resp = await client.post("/api/business/purchase-sample", headers=auth_headers(biz_token),
                                 json={"sample_id": sample_id})
        assert resp.status_code == 200
        assert resp.json()["credits_remaining"] == starting - 3

        # Double purchase blocked
        resp = await client.post("/api/business/purchase-sample", headers=auth_headers(biz_token),
                                 json={"sample_id": sample_id})
        assert resp.status_code == 409

        resp = await client.get("/api/business/purchases", headers=auth_headers(biz_token))
        assert resp.status_code == 200
        assert len(resp.json()) == 1


@pytest.mark.anyio
async def test_purchase_insufficient_credits(client):
    async with client:
        writer_token = (await register(client)).json()["token"]
        biz_token = (await register(client, "biz@example.com", "business", "Acme")).json()["token"]

        resp = await client.post("/api/writers/samples", headers=auth_headers(writer_token), json={
            "title": "Pricey", "content": "c", "genre": "g", "format": "f", "price_credits": 999,
        })
        sample_id = resp.json()["id"]

        resp = await client.post("/api/business/purchase-sample", headers=auth_headers(biz_token),
                                 json={"sample_id": sample_id})
        assert resp.status_code == 400


@pytest.mark.anyio
async def test_discover_writers_paywall_preview(client):
    async with client:
        writer_token = (await register(client)).json()["token"]
        biz_token = (await register(client, "biz@example.com", "business", "Acme")).json()["token"]

        long_content = "Secret paid content. " * 30
        await client.post("/api/writers/samples", headers=auth_headers(writer_token), json={
            "title": "Paid", "content": long_content, "genre": "fantasy",
            "format": "short_story", "price_credits": 2,
        })

        resp = await client.get("/api/writers/discover", headers=auth_headers(biz_token))
        assert resp.status_code == 200
        writers = resp.json()
        assert len(writers) == 1
        sample = writers[0]["samples"][0]
        # Unpurchased: only a truncated preview, no full content
        assert len(sample["content"]) < len(long_content)
        # Writer email hidden by default
        assert "email" not in writers[0]["user"]


@pytest.mark.anyio
async def test_projects_and_applications_lifecycle(client):
    async with client:
        writer_token = (await register(client)).json()["token"]
        biz_token = (await register(client, "biz@example.com", "business", "Acme")).json()["token"]

        resp = await client.post("/api/business/projects", headers=auth_headers(biz_token), json={
            "title": "Blog series", "description": "10 posts", "genre": "marketing",
        })
        assert resp.status_code == 201
        project_id = resp.json()["id"]

        resp = await client.get("/api/projects", headers=auth_headers(writer_token))
        assert resp.status_code == 200
        assert len(resp.json()) == 1

        resp = await client.post("/api/applications", headers=auth_headers(writer_token), json={
            "project_id": project_id, "cover_letter": "Pick me",
        })
        assert resp.status_code == 201
        app_id = resp.json()["application"]["id"]

        # Duplicate application blocked
        resp = await client.post("/api/applications", headers=auth_headers(writer_token), json={
            "project_id": project_id,
        })
        assert resp.status_code == 409

        resp = await client.get("/api/business/applications", headers=auth_headers(biz_token))
        assert len(resp.json()) == 1

        resp = await client.put(f"/api/applications/{app_id}", headers=auth_headers(biz_token),
                                json={"status": "accepted"})
        assert resp.status_code == 200

        # Accepting moves the project to in_progress
        resp = await client.get("/api/business/projects", headers=auth_headers(biz_token))
        assert resp.json()[0]["status"] == "in_progress"


@pytest.mark.anyio
async def test_application_authorization(client):
    async with client:
        writer_token = (await register(client)).json()["token"]
        biz1 = (await register(client, "biz1@example.com", "business", "B1")).json()["token"]
        biz2 = (await register(client, "biz2@example.com", "business", "B2")).json()["token"]

        resp = await client.post("/api/business/projects", headers=auth_headers(biz1), json={
            "title": "P", "description": "D", "genre": "g",
        })
        project_id = resp.json()["id"]
        resp = await client.post("/api/applications", headers=auth_headers(writer_token), json={
            "project_id": project_id,
        })
        app_id = resp.json()["application"]["id"]

        # Another business cannot accept applications on someone else's project
        resp = await client.put(f"/api/applications/{app_id}", headers=auth_headers(biz2),
                                json={"status": "accepted"})
        assert resp.status_code == 403

        # Another business cannot delete someone else's project
        resp = await client.delete(f"/api/business/projects/{project_id}", headers=auth_headers(biz2))
        assert resp.status_code == 403


@pytest.mark.anyio
async def test_settings_roundtrip(client):
    async with client:
        token = (await register(client)).json()["token"]
        resp = await client.get("/api/auth/settings", headers=auth_headers(token))
        assert resp.status_code == 200
        assert resp.json()["emailNotifications"] is True

        resp = await client.put("/api/auth/settings", headers=auth_headers(token),
                                json={"darkMode": True, "language": "fr"})
        assert resp.status_code == 200
        saved = resp.json()
        assert saved["darkMode"] is True
        assert saved["language"] == "fr"


@pytest.mark.anyio
async def test_change_password_and_profile_update(client):
    async with client:
        token = (await register(client)).json()["token"]

        resp = await client.post("/api/auth/change-password", headers=auth_headers(token), json={
            "current_password": "wrong", "new_password": "newpassword1",
        })
        assert resp.status_code == 400

        resp = await client.post("/api/auth/change-password", headers=auth_headers(token), json={
            "current_password": "password123", "new_password": "newpassword1",
        })
        assert resp.status_code == 200
        new_token = resp.json()["token"]
        assert new_token  # a fresh JWT is returned

        # The OLD token is now invalid (token_version bumped).
        client.cookies.clear()
        resp = await client.get("/api/auth/me", headers=auth_headers(token))
        assert resp.status_code == 401

        # The NEW token keeps the current device logged in.
        resp = await client.get("/api/auth/me", headers=auth_headers(new_token))
        assert resp.status_code == 200

        resp = await client.post("/api/auth/login", json={
            "email": "writer@example.com", "password": "newpassword1",
        })
        assert resp.status_code == 200

        resp = await client.put("/api/auth/profile", headers=auth_headers(new_token), json={
            "name": "Renamed",
        })
        assert resp.status_code == 200
        assert resp.json()["name"] == "Renamed"


@pytest.mark.anyio
async def test_delete_account(client):
    async with client:
        token = (await register(client)).json()["token"]
        resp = await client.delete("/api/auth/account", headers=auth_headers(token))
        assert resp.status_code == 200
        resp = await client.get("/api/auth/me", headers=auth_headers(token))
        assert resp.status_code == 401


@pytest.mark.anyio
async def test_file_upload_and_authorized_download(client):
    async with client:
        writer_token = (await register(client)).json()["token"]
        biz_token = (await register(client, "biz@example.com", "business", "Acme")).json()["token"]
        other_biz = (await register(client, "biz2@example.com", "business", "Rival")).json()["token"]

        # Upload a small PDF-like document via multipart form.
        pdf_bytes = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"
        resp = await client.post(
            "/api/writers/samples/upload",
            headers=auth_headers(writer_token),
            data={"title": "My Script", "genre": "drama", "format": "screenplay",
                  "price_credits": "2"},
            files={"file": ("my-script.pdf", pdf_bytes, "application/pdf")},
        )
        assert resp.status_code == 201, resp.text
        sample = resp.json()
        assert sample["pdf_url"].startswith("/api/uploads/")
        assert sample["pdf_filename"] == "my-script.pdf"
        filename = sample["pdf_url"].split("/uploads/")[-1]

        # Unauthenticated download is rejected.
        resp = await client.get(f"/api/uploads/{filename}")
        assert resp.status_code == 401

        # A business that has NOT purchased is rejected.
        resp = await client.get(f"/api/uploads/{filename}", headers=auth_headers(other_biz))
        assert resp.status_code == 403

        # The owning writer can download.
        resp = await client.get(f"/api/uploads/{filename}", headers=auth_headers(writer_token))
        assert resp.status_code == 200
        assert resp.content == pdf_bytes

        # After purchasing, the business can download.
        resp = await client.post("/api/business/purchase-sample", headers=auth_headers(biz_token),
                                 json={"sample_id": sample["id"]})
        assert resp.status_code == 200
        resp = await client.get(f"/api/uploads/{filename}", headers=auth_headers(biz_token))
        assert resp.status_code == 200
        assert resp.content == pdf_bytes

        # Disallowed extension is rejected.
        resp = await client.post(
            "/api/writers/samples/upload",
            headers=auth_headers(writer_token),
            data={"title": "Sneaky", "genre": "g", "format": "f"},
            files={"file": ("evil.exe", b"MZ...", "application/octet-stream")},
        )
        assert resp.status_code == 400

        # Path traversal in the download route is rejected.
        resp = await client.get("/api/uploads/..%2F.env", headers=auth_headers(writer_token))
        assert resp.status_code in (400, 404)

        # Purchased access survives the writer deleting the sample: the file is
        # kept, the purchases list still resolves via snapshot, and download works.
        resp = await client.delete(f"/api/writers/samples/{sample['id']}",
                                   headers=auth_headers(writer_token))
        assert resp.status_code == 200
        resp = await client.get("/api/business/purchases", headers=auth_headers(biz_token))
        assert resp.status_code == 200
        purchased = resp.json()
        assert len(purchased) == 1
        assert purchased[0]["sample"]["title"] == "My Script"
        resp = await client.get(f"/api/uploads/{filename}", headers=auth_headers(biz_token))
        assert resp.status_code == 200
        assert resp.content == pdf_bytes


@pytest.mark.anyio
async def test_health_endpoint(client):
    async with client:
        resp = await client.get("/api/health")
        assert resp.status_code == 200
