async def test_session_lifecycle(client):
    assert (await client.get("/auth/me")).status_code == 200
    assert (await client.post("/auth/logout")).status_code == 204
    assert (await client.get("/auth/me")).status_code == 401
    assert (await client.post("/cars", json={})).status_code == 401


async def test_credentials(client):
    data = {"username": "testseller", "password": "test-password-123"}
    assert (await client.post("/auth/register", json=data)).status_code == 409
    data["password"] = "incorrect-password"
    assert (await client.post("/auth/login", json=data)).status_code == 401


async def test_ownership(client):
    data = {"make": "BMW", "model": "X5", "year": 2020, "price": 20000, "milage": 100}
    car = (await client.post("/cars", json=data)).json()
    other = {"username": "other", "password": "other-password-123"}
    await client.post("/auth/register", json=other)
    login = (await client.post("/auth/login", json=other)).json()
    client.headers["Authorization"] = "Bearer " + login["token"]
    assert (await client.put(f"/cars/{car['id']}", json=data)).status_code == 403
    assert (await client.delete(f"/cars/{car['id']}")).status_code == 403
    client.headers.clear()
    assert (await client.get(f"/cars/{car['id']}")).status_code == 200


async def test_password_minimum_length(client):
    credentials = {"username": "eightchars", "password": "1234567"}
    assert (await client.post("/auth/register", json=credentials)).status_code == 422
    credentials["password"] = "12345678"
    assert (await client.post("/auth/register", json=credentials)).status_code == 201
    assert (await client.post("/auth/login", json=credentials)).status_code == 200


import pytest
from httpx import AsyncClient


@pytest.mark.parametrize("endpoint", ["login", "register"])
@pytest.mark.parametrize(
    ("username", "password", "location"),
    [
        ("valid_user", "fake123", ["body", "password"]),
        ("invalid username", "synthetic-password-123", ["body", "username"]),
        (None, "synthetic-password-123", ["body"]),
    ],
    ids=["short-password", "invalid-username", "invalid-body-shape"],
)
async def test_auth_validation_does_not_echo_password(
    client: AsyncClient,
    endpoint: str,
    username: str | None,
    password: str,
    location: list[str],
) -> None:
    credentials = {"username": username, "password": password}
    body = [credentials] if username is None else credentials
    response = await client.post(f"/auth/{endpoint}", json=body)

    assert response.status_code == 422
    if password in response.text:
        pytest.fail(
            "Auth validation response echoed the submitted password", pytrace=False
        )
    detail = response.json()["detail"]
    assert any(error["loc"] == location and error["msg"] for error in detail)
