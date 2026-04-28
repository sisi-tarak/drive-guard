import sys
import os
import re
import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from PIL import Image
from io import BytesIO
from services.face_service import get_face_embedding, compare_faces, SIMILARITY_THRESHOLD
from services.drive_service import get_drive_service, get_all_images, get_images_in_folder
from services.clip_service import download_drive_image

router = APIRouter()

# Thread pool shared across all face search requests
_executor = ThreadPoolExecutor(max_workers=4)

# Thread-local Drive service so each thread has its own HTTP connection
_thread_local = threading.local()


def _get_thread_service():
    """Return a Drive service bound to the current thread (avoids httplib2 thread-safety issues)."""
    if not hasattr(_thread_local, "service"):
        _thread_local.service = get_drive_service()
    return _thread_local.service


def _match_image(img_file: dict, query_embedding: list) -> dict | None:
    """
    Download one Drive image, extract its face embedding, and return a match
    dict if similarity >= threshold, else None. Runs inside a thread pool.
    """
    try:
        service = _get_thread_service()
        drive_img = download_drive_image(img_file["id"], service)
        if drive_img is None:
            return None

        emb = get_face_embedding(drive_img)
        if emb is None:
            return None

        sim = compare_faces(query_embedding, emb)
        if sim >= SIMILARITY_THRESHOLD:
            print(f"  ✓ {img_file['name']}  sim={sim:.3f}")
            return {
                "file_id": img_file["id"],
                "file_name": img_file["name"],
                "similarity_score": round(sim, 3),
                "drive_link": f"https://drive.google.com/file/d/{img_file['id']}/view",
            }
    except Exception as e:
        print(f"  ! Error on {img_file.get('name', '?')}: {e}")
    return None


async def _parallel_search(image_list: list, query_embedding: list) -> list:
    """
    Run face matching across all images concurrently (4 threads).
    Returns matches sorted by similarity descending.
    """
    loop = asyncio.get_event_loop()
    tasks = [
        loop.run_in_executor(_executor, _match_image, img_file, query_embedding)
        for img_file in image_list
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    matches = [r for r in results if isinstance(r, dict)]
    return sorted(matches, key=lambda x: x["similarity_score"], reverse=True)


def _extract_folder_id(url: str):
    m = re.search(r"/folders/([a-zA-Z0-9_-]+)", url)
    return m.group(1) if m else None


@router.post("/face/search")
async def search_by_face(file: UploadFile = File(...)):
    """Find all Drive photos that contain the person in the uploaded photo."""
    try:
        contents = await file.read()
        query_image = Image.open(BytesIO(contents)).convert("RGB")

        print("Extracting face embedding from uploaded photo...")
        query_embedding = get_face_embedding(query_image)
        if query_embedding is None:
            raise HTTPException(
                status_code=400,
                detail="No face detected in uploaded image. Please upload a clear photo of a person.",
            )

        service = get_drive_service()
        drive_images = get_all_images(service)
        print(f"Scanning {len(drive_images)} Drive images in parallel...")

        matches = await _parallel_search(drive_images, query_embedding)
        return {
            "matches": matches,
            "total": len(matches),
            "drive_images_checked": len(drive_images),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/face/search-in-folder")
async def search_face_in_folder(
    file: UploadFile = File(...),
    folder_url: str = Form(...),
):
    """Scan a specific Drive folder for photos containing the uploaded person's face."""
    try:
        folder_id = _extract_folder_id(folder_url)
        if not folder_id:
            raise HTTPException(status_code=400, detail="Invalid Drive folder URL")

        contents = await file.read()
        query_image = Image.open(BytesIO(contents)).convert("RGB")

        print("Extracting face embedding from uploaded photo...")
        query_embedding = get_face_embedding(query_image)
        if query_embedding is None:
            raise HTTPException(
                status_code=400,
                detail="No face detected in uploaded image. Please upload a clear photo of a person.",
            )

        service = get_drive_service()
        try:
            folder_images = get_images_in_folder(service, folder_id)
        except Exception as e:
            raise HTTPException(status_code=403, detail=f"Cannot access folder: {e}")

        print(f"Scanning {len(folder_images)} folder images in parallel...")
        matches = await _parallel_search(folder_images, query_embedding)
        return {
            "matches": matches,
            "total": len(matches),
            "folder_images_checked": len(folder_images),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
