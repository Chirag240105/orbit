from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.auth import authenticate

router = APIRouter()


class LoginBody(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(body: LoginBody):
    user = authenticate(body.email, body.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"user_id": user["id"], "display_name": user["display_name"]}
