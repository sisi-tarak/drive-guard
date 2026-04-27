import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.search import router as search_router
from api.security import router as security_router
from api.face import router as face_router
from api.auth import router as auth_router
from api.leaked import router as leaked_router
from api.drive import router as drive_router

app = FastAPI(title="DriveGuard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(auth_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(security_router, prefix="/api")
app.include_router(face_router, prefix="/api")
app.include_router(leaked_router, prefix="/api")
app.include_router(drive_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "DriveGuard API is running!"}