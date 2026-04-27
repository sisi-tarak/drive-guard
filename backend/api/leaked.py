import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter, HTTPException
from services.drive_service import get_drive_service

router = APIRouter()


@router.get("/leaked/scan")
def scan_leaked_links():
    try:
        service = get_drive_service()
    except Exception as exc:
        raise HTTPException(401, f"Google Drive not connected: {exc}")

    leaked = []
    page_token = None

    while True:
        try:
            resp = service.files().list(
                pageSize=50,
                fields="nextPageToken, files(id, name, mimeType, webViewLink, permissions(type, role))",
                pageToken=page_token,
                supportsAllDrives=False,
                includeItemsFromAllDrives=False,
            ).execute()
        except Exception as exc:
            raise HTTPException(500, f"Drive API error: {exc}")

        for file in resp.get("files", []):
            for perm in file.get("permissions", []):
                if perm.get("type") == "anyone":
                    role = perm.get("role", "reader")
                    risk = "high" if role in ("writer", "owner") else "medium"
                    leaked.append({
                        "file_id": file["id"],
                        "file_name": file["name"],
                        "mime_type": file.get("mimeType", ""),
                        "drive_link": file.get(
                            "webViewLink",
                            f"https://drive.google.com/file/d/{file['id']}/view",
                        ),
                        "role": role,
                        "risk": risk,
                        "permission_label": "Public on web" if risk == "high" else "Anyone with link",
                    })
                    break

        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    return {
        "leaked_count": len(leaked),
        "files": leaked,
    }
