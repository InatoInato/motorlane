import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Car

CAR = {
    "make": "Toyota",
    "model": "Camry",
    "year": 2020,
    "price": 18000,
    "milage": 65000,
}


async def test_health(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_crud(client: AsyncClient) -> None:
    assert (await client.get("/cars")).json() == []
    created = await client.post("/cars", json=CAR)
    assert created.status_code == 201
    car = created.json()
    assert car == {**CAR, "id": car["id"]}
    location = created.headers["location"]
    assert (await client.get(location)).json() == car
    assert (await client.get("/cars")).json() == [car]

    replacement = {**CAR, "price": 17000, "milage": 66000}
    updated = await client.put(location, json=replacement)
    assert updated.status_code == 200
    assert updated.json() == {**replacement, "id": car["id"]}
    assert (await client.get(location)).json() == updated.json()

    deleted = await client.delete(location)
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert (await client.get(location)).status_code == 404
    assert (await client.get("/cars")).json() == []


@pytest.mark.parametrize("method", ["get", "put", "delete"])
async def test_missing_car(client: AsyncClient, method: str) -> None:
    kwargs = {"json": CAR} if method == "put" else {}
    response = await client.request(method, "/cars/2147483647", **kwargs)
    assert response.status_code == 404
    assert response.json() == {"detail": "Car not found"}


@pytest.mark.parametrize("car_id", ["0", "-1", "2147483648", "abc"])
async def test_invalid_id(client: AsyncClient, car_id: str) -> None:
    assert (await client.get(f"/cars/{car_id}")).status_code == 422


@pytest.mark.parametrize(
    "changes",
    [
        {"make": "   "},
        {"model": ""},
        {"make": "x" * 81},
        {"year": 1885},
        {"year": 2101},
        {"price": -1},
        {"price": 2147483648},
        {"milage": -1},
        {"milage": None},
        {"seller_id": 1},
    ],
)
@pytest.mark.parametrize("method", ["post", "put"])
async def test_invalid_input(
    client: AsyncClient, changes: dict[str, object], method: str
) -> None:
    location = (await client.post("/cars", json=CAR)).headers["location"]
    url = "/cars" if method == "post" else location
    response = await client.request(method, url, json={**CAR, **changes})
    assert response.status_code == 422
    # Invalid updates must leave the existing row untouched.
    assert (await client.get(location)).json()["price"] == CAR["price"]
    assert len((await client.get("/cars")).json()) == 1


async def test_put_requires_all_fields(client: AsyncClient) -> None:
    location = (await client.post("/cars", json=CAR)).headers["location"]
    assert (await client.put(location, json={"price": 1})).status_code == 422


async def test_trim_names_and_paginate(client: AsyncClient) -> None:
    first = (await client.post("/cars", json={**CAR, "make": " Toyota "})).json()
    second = (await client.post("/cars", json=CAR)).json()
    assert first["make"] == "Toyota"
    assert (await client.get("/cars?limit=1")).json() == [first]
    assert (await client.get("/cars?limit=1&offset=1")).json() == [second]
    assert (await client.get("/cars?offset=2")).json() == []


@pytest.mark.parametrize("query", ["limit=0", "limit=101", "offset=-1"])
async def test_invalid_pagination(client: AsyncClient, query: str) -> None:
    assert (await client.get(f"/cars?{query}")).status_code == 422


@pytest.mark.parametrize(
    "changes",
    [{"make": " "}, {"model": ""}, {"year": 1885}, {"price": -1}, {"milage": -1}],
)
async def test_database_constraints_roll_back(
    session: AsyncSession, changes: dict[str, object]
) -> None:
    # Bypass Pydantic to prove PostgreSQL enforces the invariants itself.
    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            session.add(Car(**CAR))
            session.add(Car(**{**CAR, **changes}))
            await session.flush()
    assert list(await session.scalars(select(Car))) == []


async def test_browser_can_send_json(client: AsyncClient) -> None:
    response = await client.options(
        "/cars",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
