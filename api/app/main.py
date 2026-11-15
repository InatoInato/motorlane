import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Path, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser
from app.auth import router as auth_router
from app.database import Car, engine, get_session
from app.schemas import CarInput, CarOutput, ErrorResponse


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    await engine.dispose()


app = FastAPI(
    title="Motorlane API",
    version="0.1.0",
    docs_url="/docs",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("WEB_ORIGIN", "http://localhost:3000")],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(auth_router)

Database = Annotated[AsyncSession, Depends(get_session)]
CarId = Annotated[int, Path(gt=0, le=2_147_483_647)]
NOT_FOUND = {404: {"model": ErrorResponse, "description": "Car not found"}}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


async def find_car(car_id: int, session: AsyncSession) -> Car:
    car = await session.get(Car, car_id)
    if car is None:
        raise HTTPException(status_code=404, detail="Car not found")
    return car


@app.post("/cars", response_model=CarOutput, status_code=201)
async def create_car(
    data: CarInput, session: Database, response: Response, user: CurrentUser
) -> Car:
    car = Car(**data.model_dump(), owner_id=user.id)
    session.add(car)
    await session.commit()
    response.headers["Location"] = f"/cars/{car.id}"
    return car


@app.get("/cars", response_model=list[CarOutput])
async def list_cars(
    session: Database,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[Car]:
    # Stable ordering makes offset pagination predictable.
    cars = await session.scalars(
        select(Car).order_by(Car.id).limit(limit).offset(offset)
    )
    return list(cars)


@app.get("/cars/{car_id}", response_model=CarOutput, responses=NOT_FOUND)
async def get_car(car_id: CarId, session: Database) -> Car:
    return await find_car(car_id, session)


@app.put("/cars/{car_id}", response_model=CarOutput, responses=NOT_FOUND)
async def replace_car(
    car_id: CarId, data: CarInput, session: Database, user: CurrentUser
) -> Car:
    car = await find_car(car_id, session)
    if car.owner_id != user.id:
        raise HTTPException(403, "Only the seller can change this listing")
    # PUT replaces every editable field; the generated ID stays the same.
    for field, value in data.model_dump().items():
        setattr(car, field, value)
    await session.commit()
    return car


@app.delete("/cars/{car_id}", status_code=204, responses=NOT_FOUND)
async def delete_car(car_id: CarId, session: Database, user: CurrentUser) -> Response:
    car = await find_car(car_id, session)
    if car.owner_id != user.id:
        raise HTTPException(403, "Only the seller can change this listing")
    await session.delete(car)
    await session.commit()
    return Response(status_code=204)
