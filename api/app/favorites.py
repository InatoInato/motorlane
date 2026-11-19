from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, Response
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

from app.auth import CurrentUser, Database
from app.car_photos import listings_output
from app.database import Car, Favorite
from app.schemas import CarOutput

router = APIRouter(prefix="/favorites", tags=["favorites"])
CarId = Annotated[int, Path(gt=0, le=2_147_483_647)]


@router.put("/{car_id}", status_code=204)
async def save(car_id: CarId, user: CurrentUser, session: Database) -> Response:
    # Lock the car against deletion until the favorite transaction commits.
    car = await session.scalar(
        select(Car.id)
        .where(Car.id == car_id)
        .with_for_update(key_share=True, read=True)
    )
    if car is None:
        raise HTTPException(404, "Car not found")
    await session.execute(
        insert(Favorite).values(user_id=user.id, car_id=car_id).on_conflict_do_nothing()
    )
    await session.commit()
    return Response(status_code=204)


@router.delete("/{car_id}", status_code=204)
async def remove(car_id: CarId, user: CurrentUser, session: Database) -> Response:
    await session.execute(
        delete(Favorite).where(Favorite.user_id == user.id, Favorite.car_id == car_id)
    )
    await session.commit()
    return Response(status_code=204)


@router.get("/{car_id}")
async def status(
    car_id: CarId, user: CurrentUser, session: Database
) -> dict[str, bool]:
    return {"saved": await session.get(Favorite, (user.id, car_id)) is not None}


@router.get("", response_model=list[CarOutput])
async def list_favorites(
    user: CurrentUser,
    session: Database,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[CarOutput]:
    cars = await session.scalars(
        select(Car)
        .join(Favorite, Favorite.car_id == Car.id)
        .where(Favorite.user_id == user.id)
        .order_by(Favorite.created_at.desc(), Favorite.car_id.desc())
        .limit(limit)
        .offset(offset)
    )
    return await listings_output(list(cars))
