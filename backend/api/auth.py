import os
import pickle
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request as GoogleRequest

router = APIRouter()

SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
]

_CREDENTIALS_PATH = os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json")
_TOKEN_PATH = os.getenv("GOOGLE_TOKEN_PATH", "token.pickle")

_pending_flows: dict = {}


def _redirect_uri() -> str:
    return os.getenv("OAUTH_REDIRECT_URI", "http://127.0.0.1:8000/api/auth/callback")


@router.get("/auth/status")
def auth_status():
    if not os.path.exists(_TOKEN_PATH):
        return {"connected": False}
    try:
        with open(_TOKEN_PATH, "rb") as f:
            creds = pickle.load(f)
        if creds and creds.valid:
            return {"connected": True}
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(GoogleRequest())
            with open(_TOKEN_PATH, "wb") as f:
                pickle.dump(creds, f)
            return {"connected": True}
    except Exception:
        pass
    return {"connected": False}


@router.get("/auth/login")
def login():
    if not os.path.exists(_CREDENTIALS_PATH):
        raise HTTPException(
            500,
            "credentials.json not found. Add your Google OAuth credentials file to the backend directory.",
        )
    flow = Flow.from_client_secrets_file(
        _CREDENTIALS_PATH, scopes=SCOPES, redirect_uri=_redirect_uri()
    )
    auth_url, state = flow.authorization_url(
        access_type="offline", include_granted_scopes="true", prompt="consent"
    )
    _pending_flows[state] = flow
    return RedirectResponse(auth_url)


@router.get("/auth/callback")
def callback(code: str, state: str):
    flow = _pending_flows.pop(state, None)
    if not flow:
        raise HTTPException(400, "Invalid or expired OAuth state. Please try signing in again.")
    try:
        flow.fetch_token(code=code)
        creds = flow.credentials
        with open(_TOKEN_PATH, "wb") as f:
            pickle.dump(creds, f)
    except Exception as exc:
        raise HTTPException(500, f"OAuth token exchange failed: {exc}")
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    return RedirectResponse(f"{frontend_url}?connected=true")


@router.get("/auth/logout")
def logout():
    if os.path.exists(_TOKEN_PATH):
        os.remove(_TOKEN_PATH)
    return {"message": "Disconnected from Google Drive"}
