import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter, UploadFile, File, HTTPException
from PIL import Image
from io import BytesIO
from services.face_service import get_face_embedding, compare_faces
from services.drive_service import get_drive_service, get_all_images
from services.clip_service import download_drive_image

router = APIRouter()

@router.post("/face/search")
async def search_by_face(file: UploadFile = File(...)):
    """Upload a photo of a person to find all matching photos in Drive"""
    try:
        # Read uploaded image
        contents = await file.read()
        query_image = Image.open(BytesIO(contents)).convert("RGB")

        # Get face embedding from uploaded photo
        print("Extracting face from uploaded photo...")
        query_embedding = get_face_embedding(query_image)

        if query_embedding is None:
            raise HTTPException(
                status_code=400,
                detail="No face detected in uploaded image. Please upload a clear photo of a person."
            )

        # Get all images from Drive
        print("Fetching Drive images...")
        service = get_drive_service()
        drive_images = get_all_images(service)

        matches = []

        for drive_file in drive_images:
            print(f"Checking {drive_file['name']}...")
            
            # Download Drive image
            drive_img = download_drive_image(drive_file['id'], service)
            if drive_img is None:
                continue

            # Get face embedding from Drive image
            drive_embedding = get_face_embedding(drive_img)
            if drive_embedding is None:
                continue

            # Compare faces
            similarity = compare_faces(query_embedding, drive_embedding)

            # Only include if similarity is above threshold
            if similarity > 0.7:
                matches.append({
                    "file_id": drive_file["id"],
                    "file_name": drive_file["name"],
                    "similarity_score": round(similarity, 3),
                    "drive_link": f"https://drive.google.com/file/d/{drive_file['id']}/view"
                })

        # Sort by similarity score
        matches.sort(key=lambda x: x["similarity_score"], reverse=True)

        return {
            "matches": matches,
            "total": len(matches),
            "drive_images_checked": len(drive_images)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))