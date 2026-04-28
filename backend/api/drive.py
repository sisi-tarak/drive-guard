import sys
import os
import urllib.parse
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import io
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, StreamingResponse
from googleapiclient.http import MediaIoBaseDownload
from services.drive_service import get_drive_service

router = APIRouter()

_THUMB_MAX_BYTES = 5_000_000  # 5 MB


@router.get("/drive/thumbnail/{file_id}")
async def get_thumbnail(file_id: str):
    """Download a Drive image and serve it as a thumbnail (≤5 MB)."""
    try:
        service = get_drive_service()
    except Exception as exc:
        raise HTTPException(401, f"Google Drive not connected: {exc}")

    try:
        meta = service.files().get(
            fileId=file_id,
            fields="mimeType,size"
        ).execute()

        mime = meta.get("mimeType", "image/jpeg")
        if not mime.startswith("image/"):
            raise HTTPException(400, "Not an image file")

        size = int(meta.get("size", 0))
        if size > _THUMB_MAX_BYTES:
            raise HTTPException(413, "File too large for thumbnail preview")

        buf = io.BytesIO()
        request = service.files().get_media(fileId=file_id)
        downloader = MediaIoBaseDownload(buf, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()

        buf.seek(0)
        return Response(
            content=buf.read(),
            media_type=mime,
            headers={"Cache-Control": "public, max-age=3600"},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))


@router.get("/drive/download/{file_id}")
async def download_file(file_id: str):
    """Stream the original Drive file to the browser at full quality (no size cap)."""
    try:
        service = get_drive_service()
    except Exception as exc:
        raise HTTPException(401, f"Google Drive not connected: {exc}")

    try:
        meta = service.files().get(fileId=file_id, fields="name,mimeType").execute()
        mime = meta.get("mimeType", "application/octet-stream")
        fname = urllib.parse.quote(meta.get("name", file_id))

        buf = io.BytesIO()
        req = service.files().get_media(fileId=file_id)
        dl = MediaIoBaseDownload(buf, req)
        done = False
        while not done:
            _, done = dl.next_chunk()
        buf.seek(0)
        data = buf.read()

        def iterfile():
            yield data

        return StreamingResponse(
            iterfile(),
            media_type=mime,
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{fname}"}
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))


@router.get("/drive/stats")
async def drive_stats():
    """Return Drive quota and authenticated user info."""
    try:
        service = get_drive_service()
    except Exception as exc:
        raise HTTPException(401, f"Google Drive not connected: {exc}")

    try:
        about = service.about().get(fields="storageQuota,user").execute()
        quota = about.get("storageQuota", {})
        user = about.get("user", {})
        return {
            "user_name": user.get("displayName", ""),
            "user_email": user.get("emailAddress", ""),
            "total_bytes": int(quota.get("limit", 0)),
            "used_bytes": int(quota.get("usage", 0)),
        }
    except Exception as exc:
        raise HTTPException(500, str(exc))
