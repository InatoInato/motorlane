from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

CarName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)
]


class CarInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    make: CarName
    model: CarName
    year: int = Field(ge=1886, le=2100)
    price: int = Field(ge=0, le=2_147_483_647, description="Whole US dollars")
    milage: int = Field(ge=0, le=2_147_483_647, description="Kilometres")


class CarOutput(CarInput):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int | None = None


class ErrorResponse(BaseModel):
    detail: str
