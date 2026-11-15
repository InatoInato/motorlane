import os
from collections.abc import AsyncIterator

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://motorlane:motorlane@localhost:5433/motorlane",
)
engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
Session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Car(Base):
    __tablename__ = "cars"
    # These checks also protect writes made outside the API.
    __table_args__ = (
        CheckConstraint("length(trim(make)) > 0", name="car_make_not_blank"),
        CheckConstraint("length(trim(model)) > 0", name="car_model_not_blank"),
        CheckConstraint("year BETWEEN 1886 AND 2100", name="car_year_range"),
        CheckConstraint("price >= 0", name="car_price_nonnegative"),
        CheckConstraint("milage >= 0", name="car_milage_nonnegative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    make: Mapped[str] = mapped_column(String(80))
    model: Mapped[str] = mapped_column(String(80))
    year: Mapped[int]
    price: Mapped[int]
    milage: Mapped[int]


async def get_session() -> AsyncIterator[AsyncSession]:
    # Every request owns its session; an unfinished transaction rolls back on close.
    async with Session() as session:
        yield session


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True)
    password_hash: Mapped[str] = mapped_column(String(256))


class LoginSession(Base):
    __tablename__ = "login_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    expires: Mapped[int]
