import logging
from typing import Annotated
from uuid import uuid4

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, File, HTTPException, Path, UploadFile
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from starlette.concurrency import run_in_threadpool

from app import photo_storage
from app.auth import CurrentUser, Database
from app.database import Car
from app.schemas import CarOutput

logger = logging.getLogger(__name__)
router = APIRouter()


def car_output(car: Car) -> CarOutput:
    output = CarOutput.model_validate(car)
    if car.photo_key:
        try:
            output.photo_url = photo_storage.photo_url(car.photo_key)
        except (BotoCoreError, ClientError, KeyError):
            logger.exception("Could not sign cover for car %s", car.id)
    return output


async def listing_output(car: Car) -> CarOutput:
    if car.photo_key:
        return await run_in_threadpool(car_output, car)
    return CarOutput.model_validate(car)


async def listings_output(cars: list[Car]) -> list[CarOutput]:
    if any(car.photo_key for car in cars):
        return await run_in_threadpool(lambda: [car_output(car) for car in cars])
    return [CarOutput.model_validate(car) for car in cars]


async def owned_car(
    car_id: int, user_id: int, session: Database, *, lock: bool = False
) -> Car:
    query = select(Car).where(Car.id == car_id)
    car = await session.scalar(query.with_for_update() if lock else query)
    if car is None:
        raise HTTPException(404, "Car not found")
    if car.owner_id != user_id:
        raise HTTPException(403, "Only the seller can change this listing")
    return car


@router.put("/cars/{car_id}/photo", response_model=CarOutput)
async def upload_photo(
    car_id: Annotated[int, Path(gt=0, le=2_147_483_647)],
    user: CurrentUser,
    session: Database,
    photo: Annotated[UploadFile, File()],
) -> CarOutput:
    user_id = user.id
    await owned_car(car_id, user_id, session)
    # Release the read transaction before decoding the image or calling S3.
    await session.rollback()
    data = await photo.read(photo_storage.MAX_PHOTO_BYTES + 1)
    if len(data) > photo_storage.MAX_PHOTO_BYTES:
        raise HTTPException(413, "Cover photos must be 5 MB or smaller")
    try:
        content_type = await run_in_threadpool(photo_storage.image_content_type, data)
    except ValueError as error:
        raise HTTPException(415, str(error)) from error

    key = f"covers/{car_id}/{uuid4().hex}"
    try:
        url = await run_in_threadpool(photo_storage.photo_url, key)
        await run_in_threadpool(photo_storage.put_photo, key, data, content_type)
    except (BotoCoreError, ClientError, KeyError) as error:
        logger.exception("Could not upload cover for car %s", car_id)
        await run_in_threadpool(photo_storage.delete_photo, key)
        raise HTTPException(503, "Photo storage is unavailable. Try again.") from error

    try:
        # Serialize swaps and recheck ownership in case the listing changed during upload.
        car = await owned_car(car_id, user_id, session, lock=True)
        old_key = car.photo_key
        car.photo_key = key
        await session.commit()
    except (SQLAlchemyError, HTTPException) as error:
        try:
            await session.rollback()
        finally:
            await run_in_threadpool(photo_storage.delete_photo, key)
        if isinstance(error, HTTPException):
            raise
        logger.exception("Could not save cover for car %s", car_id)
        raise HTTPException(
            500, "Could not save the cover photo. Try again."
        ) from error

    if old_key:
        await run_in_threadpool(photo_storage.delete_photo, old_key)
    return CarOutput.model_validate(car).model_copy(update={"photo_url": url})
