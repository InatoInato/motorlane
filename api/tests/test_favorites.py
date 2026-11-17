import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from app.database import Favorite

CAR = {"make": "BMW", "model": "X5", "year": 2020, "price": 20000, "milage": 100}


async def test_favorites_lifecycle(client, session):
    car = (await client.post("/cars", json=CAR)).json()
    path = f"/favorites/{car['id']}"
    assert (await client.get(path)).json() == {"saved": False}
    for _ in range(2):
        assert (await client.put(path)).status_code == 204
    rows = (await client.get("/favorites")).json()
    assert rows == [car]
    favorite = await session.scalar(select(Favorite))
    assert favorite.created_at is not None
    assert (await client.get(path)).json() == {"saved": True}
    for _ in range(2):
        assert (await client.delete(path)).status_code == 204
    assert (await client.get("/favorites")).json() == []


async def test_favorites_isolation_and_deleted_cars(client, session):
    car = (await client.post("/cars", json=CAR)).json()
    path = f"/favorites/{car['id']}"
    await client.put(path)
    first_token = client.headers["Authorization"]
    credentials = {"username": "otheruser", "password": "another-password"}
    await client.post("/auth/register", json=credentials)
    token = (await client.post("/auth/login", json=credentials)).json()["token"]
    client.headers["Authorization"] = f"Bearer {token}"
    assert (await client.get("/favorites")).json() == []
    assert (await client.get(path)).json() == {"saved": False}
    await client.delete(path)
    await client.put(path)
    client.headers["Authorization"] = first_token
    assert len((await client.get("/favorites")).json()) == 1
    assert (await client.delete(f"/cars/{car['id']}")).status_code == 204
    assert await session.scalar(select(func.count()).select_from(Favorite)) == 0
    assert (await client.put(path)).status_code == 404
    assert (await client.delete(path)).status_code == 204


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/favorites"),
        ("get", "/favorites/1"),
        ("put", "/favorites/1"),
        ("delete", "/favorites/1"),
    ],
)
async def test_favorites_require_auth(client, method, path):
    client.headers.clear()
    assert (await client.request(method, path)).status_code == 401


async def test_favorites_pagination_and_constraint(client, session):
    cars = [(await client.post("/cars", json=CAR)).json() for _ in range(3)]
    for car in cars:
        await client.put(f"/favorites/{car['id']}")
    assert (await client.get("/favorites?limit=1&offset=1")).json() == [cars[1]]
    for query in ["limit=0", "limit=101", "offset=-1"]:
        assert (await client.get(f"/favorites?{query}")).status_code == 422
    row = await session.scalar(select(Favorite))
    user_id, car_id = row.user_id, row.car_id
    session.expunge(row)
    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            session.add(Favorite(user_id=user_id, car_id=car_id))
            await session.flush()
    await session.execute(delete(Favorite))


async def test_concurrent_saves_keep_one_favorite():
    import asyncio
    from uuid import uuid4

    from conftest import TEST_DATABASE_URL
    from sqlalchemy.dialects.postgresql import insert
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.database import Car, User

    engine = create_async_engine(TEST_DATABASE_URL)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as setup:
        user = User(username=f"fav_{uuid4().hex}", password_hash="unused")
        setup.add(user)
        await setup.flush()
        car = Car(**CAR, owner_id=user.id)
        setup.add(car)
        await setup.commit()
    try:

        async def save():
            async with factory() as transaction:
                await transaction.execute(
                    insert(Favorite)
                    .values(user_id=user.id, car_id=car.id)
                    .on_conflict_do_nothing()
                )
                await transaction.commit()

        await asyncio.gather(save(), save())
        async with factory() as check:
            assert (
                await check.scalar(
                    select(func.count())
                    .select_from(Favorite)
                    .where(Favorite.user_id == user.id)
                )
                == 1
            )
    finally:
        async with factory() as cleanup:
            await cleanup.execute(delete(Car).where(Car.id == car.id))
            await cleanup.execute(delete(User).where(User.id == user.id))
            await cleanup.commit()
        await engine.dispose()
