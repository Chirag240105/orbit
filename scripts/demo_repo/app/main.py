from fastapi import FastAPI

from app.routers.auth import router as auth_router

app = FastAPI(title="ORBIT flow trace demo")
app.include_router(auth_router)
