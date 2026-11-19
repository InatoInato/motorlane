import hashlib
import hmac
import secrets
import time
from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.database import LoginSession, User, get_session


class AuthRoute(APIRoute):
    def get_route_handler(self) -> Callable[[Request], Awaitable[Response]]:
        handler = super().get_route_handler()

        async def redact_validation_errors(request: Request) -> Response:
            try:
                return await handler(request)
            except RequestValidationError as exc:
                # Even a body-level error can carry the entire credentials payload.
                detail = [
                    {"loc": error["loc"], "msg": error["msg"], "type": error["type"]}
                    for error in exc.errors()
                ]
                return JSONResponse(status_code=422, content={"detail": detail})

        return redact_validation_errors


router = APIRouter(prefix="/auth", tags=["auth"], route_class=AuthRoute)
Database = Annotated[AsyncSession, Depends(get_session)]
bearer = HTTPBearer(auto_error=False)


class Credentials(BaseModel):
    username: str = Field(pattern=r"^[a-zA-Z0-9_]{3,80}$")
    password: str = Field(min_length=8, max_length=128)


def password_hash(password: str, salt: str) -> str:
    return hashlib.scrypt(
        password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1
    ).hex()


async def current_user(
    session: Database,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User:
    token = credentials.credentials if credentials else ""
    login = await session.get(LoginSession, hashlib.sha256(token.encode()).hexdigest())
    if login is None or login.expires <= int(time.time()):
        raise HTTPException(
            401, "Please sign in", headers={"WWW-Authenticate": "Bearer"}
        )
    user = await session.get(User, login.user_id)
    if user is None:
        raise HTTPException(401, "Please sign in")
    return user


CurrentUser = Annotated[User, Depends(current_user)]


@router.post("/register", status_code=201)
async def register(data: Credentials, session: Database) -> dict:
    salt = secrets.token_hex(16)
    digest = await run_in_threadpool(password_hash, data.password, salt)
    user = User(username=data.username.lower(), password_hash=f"{salt}:{digest}")
    session.add(user)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(409, "Username already exists") from None
    return {"id": user.id, "username": user.username}


@router.post("/login")
async def login(data: Credentials, session: Database) -> dict:
    user = await session.scalar(
        select(User).where(User.username == data.username.lower())
    )
    salt, expected = user.password_hash.split(":") if user else ("00" * 16, "")
    digest = await run_in_threadpool(password_hash, data.password, salt)
    if not hmac.compare_digest(digest, expected):
        raise HTTPException(401, "Invalid username or password")
    # Store only a digest so a database leak does not reveal usable sessions.
    token = secrets.token_urlsafe(32)
    session.add(
        LoginSession(
            token_hash=hashlib.sha256(token.encode()).hexdigest(),
            user_id=user.id,
            expires=int(time.time()) + 86400,
        )
    )
    await session.commit()
    return {"token": token, "id": user.id, "username": user.username}


@router.get("/me")
async def me(user: CurrentUser) -> dict:
    return {"id": user.id, "username": user.username}


@router.post("/logout", status_code=204)
async def logout(
    user: CurrentUser,
    session: Database,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
) -> None:
    login = await session.get(
        LoginSession, hashlib.sha256(credentials.credentials.encode()).hexdigest()
    )
    await session.delete(login)
    await session.commit()
