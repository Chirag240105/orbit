"""Password authentication and short-lived HS256 bearer tokens."""

import base64
import hashlib
import hmac
import json
import time

import bcrypt
from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.session import get_db
from app.models import User

auth_router = APIRouter(prefix="/api/auth", tags=["authentication"])


def auth_throttle(request: Request) -> None:
    request.app.state.auth_rate_limit(request)


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def _valid_email(cls, value: str) -> str:
        value = value.strip().lower()
        if value.count("@") != 1 or "." not in value.rsplit("@", 1)[1]:
            raise ValueError("Enter a valid email address")
        return value


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def issue_token(user_id: int, secret: str, lifetime_minutes: int) -> str:
    now = int(time.time())
    header = _b64(b'{"alg":"HS256","typ":"JWT"}')
    payload = _b64(json.dumps({"sub": str(user_id), "iat": now, "exp": now + lifetime_minutes * 60}, separators=(",", ":")).encode())
    signing_input = f"{header}.{payload}"
    signature = _b64(hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest())
    return f"{signing_input}.{signature}"


def verify_token(token: str, secret: str) -> int:
    try:
        header, payload, signature = token.split(".")
        header_data = json.loads(base64.urlsafe_b64decode(header + "=" * (-len(header) % 4)))
        if header_data.get("alg") != "HS256" or header_data.get("typ") != "JWT":
            raise ValueError
        signing_input = f"{header}.{payload}"
        expected = _b64(hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            raise ValueError
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if claims.get("exp", 0) <= time.time() or claims.get("iat", time.time()) > time.time() + 60:
            raise ValueError
        return int(claims["sub"])
    except (ValueError, TypeError, KeyError, json.JSONDecodeError):
        raise AppError("invalid_token", "Your session is invalid or expired. Sign in again.", 401) from None


def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise AppError("authentication_required", "Sign in to access ORBIT data.", 401)
    user_id = verify_token(authorization[7:].strip(), request.app.state.jwt_secret)
    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise AppError("invalid_token", "Your session is invalid or expired. Sign in again.", 401)
    db.info["user_id"] = user.id
    return user


@auth_router.post("/register", dependencies=[Depends(auth_throttle)])
def register(body: Credentials, request: Request, db: Session = Depends(get_db)):
    if db.scalar(select(User.id).where(User.email == body.email)) is not None:
        raise AppError("email_taken", "An account with that email already exists.", 409)
    password_digest = hashlib.sha256(body.password.encode()).digest()
    user = User(email=body.email, password_hash=bcrypt.hashpw(password_digest, bcrypt.gensalt()).decode())
    db.add(user)
    db.commit()
    return {"access_token": issue_token(user.id, request.app.state.jwt_secret, request.app.state.settings.jwt_lifetime_minutes), "token_type": "bearer"}


@auth_router.post("/login", dependencies=[Depends(auth_throttle)])
def login(body: Credentials, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email))
    password_digest = hashlib.sha256(body.password.encode()).digest()
    valid = user is not None and bcrypt.checkpw(password_digest, user.password_hash.encode())
    if not valid:
        raise AppError("invalid_credentials", "Email or password is incorrect.", 401)
    return {"access_token": issue_token(user.id, request.app.state.jwt_secret, request.app.state.settings.jwt_lifetime_minutes), "token_type": "bearer"}


@auth_router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"id": user.id, "email": user.email}
