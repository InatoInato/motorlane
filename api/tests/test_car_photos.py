from io import BytesIO
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

import httpx
import pytest
from PIL import Image
from sqlalchemy import text
from test_cars import CAR

from app import photo_storage

MOTO_ENDPOINT = "http://localhost:5001"


@pytest.fixture
def photo_bucket(monkeypatch):
    name = f"motorlane-test-{uuid4().hex}"
    for key, value in {
        "AWS_ACCESS_KEY_ID": "motorlane-test",
        "AWS_SECRET_ACCESS_KEY": "motorlane-test",
        "AWS_DEFAULT_REGION": "us-east-1",
        "S3_ENDPOINT_URL": MOTO_ENDPOINT,
        "S3_PUBLIC_ENDPOINT_URL": MOTO_ENDPOINT,
        "S3_PHOTO_BUCKET": name,
    }.items():
        monkeypatch.setenv(key, value)
    monkeypatch.delenv("AWS_SESSION_TOKEN", raising=False)
    monkeypatch.delenv("AWS_SECURITY_TOKEN", raising=False)
    photo_storage.s3_client.cache_clear()
    photo_storage.ensure_local_bucket()
    photo_storage.ensure_local_bucket()
    storage = photo_storage.s3_client(MOTO_ENDPOINT)
    try:
        yield storage, name
    finally:
        for key in keys(storage, name):
            storage.delete_object(Bucket=name, Key=key)
        storage.delete_bucket(Bucket=name)
        photo_storage.s3_client.cache_clear()


def keys(storage, name):
    return {
        obj["Key"] for obj in storage.list_objects_v2(Bucket=name).get("Contents", [])
    }


def image_bytes(format="PNG", color="blue"):
    out = BytesIO()
    Image.new("RGB", (16, 16), color).save(out, format=format)
    return out.getvalue()


async def upload(client, path, data):
    return await client.put(
        f"{path}/photo", files={"photo": ("cover.png", data, "image/png")}
    )


@pytest.mark.parametrize(("format", "mime"), photo_storage.FORMATS.items())
async def test_cover_upload_and_signed_download(client, photo_bucket, format, mime):
    storage, name = photo_bucket
    created = await client.post("/cars", json=CAR)
    path = created.headers["location"]
    assert created.json()["photo_url"] is None

    data = image_bytes(format)
    response = await upload(client, path, data)
    assert response.status_code == 200
    assert "photo_key" not in response.json()
    url = response.json()["photo_url"]
    signed = urlsplit(url)
    assert signed.netloc == "localhost:5001"
    assert parse_qs(signed.query)["X-Amz-Expires"] == ["300"]

    await client.put(f"/favorites/{created.json()['id']}")
    async with httpx.AsyncClient() as host:
        for download_url in (
            url,
            (await client.get(path)).json()["photo_url"],
            (await client.get("/cars")).json()[0]["photo_url"],
            (await client.get("/favorites")).json()[0]["photo_url"],
        ):
            downloaded = await host.get(download_url)
            assert downloaded.status_code == 200
            assert downloaded.headers["content-type"] == mime
            assert downloaded.content == data

    assert (await client.delete(path)).status_code == 204
    assert keys(storage, name) == set()


async def test_cover_validation_and_ownership(client, photo_bucket):
    storage, name = photo_bucket
    path = (await client.post("/cars", json=CAR)).headers["location"]
    assert (await upload(client, path, b"not an image")).status_code == 415
    assert (await upload(client, path, image_bytes("JPEG")[:-10])).status_code == 415
    assert (
        await upload(client, path, b"x" * (photo_storage.MAX_PHOTO_BYTES + 1))
    ).status_code == 413
    client.headers.pop("Authorization")
    assert (await upload(client, path, image_bytes())).status_code == 401

    account = {"username": "another", "password": "another-password"}
    await client.post("/auth/register", json=account)
    token = (await client.post("/auth/login", json=account)).json()["token"]
    client.headers["Authorization"] = f"Bearer {token}"
    assert (await upload(client, path, image_bytes())).status_code == 403
    assert keys(storage, name) == set()


async def test_cover_replacement_keeps_old_cover_on_failure(
    client, session, photo_bucket, monkeypatch
):
    storage, name = photo_bucket
    path = (await client.post("/cars", json=CAR)).headers["location"]
    original = image_bytes()
    assert (await upload(client, path, original)).status_code == 200
    original_keys = keys(storage, name)
    assert len(original_keys) == 1

    # Moto rejects the write to a bucket that doesn't exist.
    replacement = image_bytes(color="red")
    with monkeypatch.context() as env:
        env.setenv("S3_PHOTO_BUCKET", name + "-missing")
        assert (await upload(client, path, replacement)).status_code == 503

    # A real PostgreSQL write failure rolls back the swap, even after S3 accepted it.
    await session.execute(
        text("""
        CREATE FUNCTION pg_temp.reject_cover_update() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'test cover write failed'; END
        $$
    """)
    )
    await session.execute(
        text("""
        CREATE TRIGGER reject_cover_update BEFORE UPDATE OF photo_key ON cars
        FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_cover_update()
    """)
    )
    await session.commit()
    assert (await upload(client, path, replacement)).status_code == 500
    assert keys(storage, name) == original_keys

    async with httpx.AsyncClient() as host:
        url = (await client.get(path)).json()["photo_url"]
        assert (await host.get(url)).content == original

        await session.execute(text("DROP TRIGGER reject_cover_update ON cars"))
        await session.commit()
        replaced = await upload(client, path, replacement)
        assert replaced.status_code == 200
        current_keys = keys(storage, name)
        assert len(current_keys) == 1 and current_keys.isdisjoint(original_keys)
        assert (await host.get(url)).status_code == 404
        assert (await host.get(replaced.json()["photo_url"])).content == replacement
