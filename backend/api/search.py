import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter, UploadFile, File, HTTPException
from PIL import Image
from io import BytesIO
from services.clip_service import get_image_embedding, get_text_embedding
from services.pinecone_service import search_similar_images
from services.drive_service import get_drive_service
from services.gemini_service import enhance_search_query

router = APIRouter()

@router.post("/search/image")
async def search_by_image(file: UploadFile = File(...)):
    """Upload an image to find similar images in your Drive"""
    try:
        # Read uploaded image
        contents = await file.read()
        image = Image.open(BytesIO(contents)).convert("RGB")

        # Generate embedding
        embedding = get_image_embedding(image)

        # Search Pinecone
        matches = search_similar_images(embedding, top_k=10)

        results = []
        for match in matches:
            fid = match["id"]
            meta = match.get("metadata", {})
            results.append({
                "file_id": fid,
                "file_name": meta.get("file_name", "Unknown"),
                "similarity_score": round(match["score"], 3),
                "drive_link": meta.get("web_view_link") or f"https://drive.google.com/file/d/{fid}/view",
                "thumbnail_url": meta.get("thumbnail_url", ""),
            })

        return {"results": results, "total": len(results)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search/text")
async def search_by_text(query: str):
    """Search Drive images using a text description, enhanced by Gemini AI"""
    try:
        # Gemini expands the query into a rich visual description for better CLIP matching
        enhanced_query = enhance_search_query(query)

        # Generate CLIP embedding from the (possibly enhanced) query
        embedding = get_text_embedding(enhanced_query)

        # Search Pinecone
        matches = search_similar_images(embedding, top_k=10)

        results = []
        for match in matches:
            fid = match["id"]
            meta = match.get("metadata", {})
            results.append({
                "file_id": fid,
                "file_name": meta.get("file_name", "Unknown"),
                "similarity_score": round(match["score"], 3),
                "drive_link": meta.get("web_view_link") or f"https://drive.google.com/file/d/{fid}/view",
                "thumbnail_url": meta.get("thumbnail_url", ""),
            })

        return {
            "results": results,
            "total": len(results),
            "original_query": query,
            "enhanced_query": enhanced_query if enhanced_query != query else None,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))