import sys
import os

# Suppress TensorFlow/oneDNN verbose logs before any import loads TF
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# On Railway/cloud: write credentials.json from the GOOGLE_CREDENTIALS_JSON env var
_creds_json_env = os.getenv("GOOGLE_CREDENTIALS_JSON")
if _creds_json_env and not os.path.exists("credentials.json"):
    with open("credentials.json", "w") as _f:
        _f.write(_creds_json_env)

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