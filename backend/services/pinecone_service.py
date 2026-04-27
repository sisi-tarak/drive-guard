import os
from pinecone import Pinecone, ServerlessSpec
from dotenv import load_dotenv

load_dotenv()

# Initialize Pinecone
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index(os.getenv("PINECONE_INDEX"))

def upsert_image_embedding(file_id: str, file_name: str, embedding: list, metadata: dict = {}):
    """Store an image embedding in Pinecone"""
    metadata["file_name"] = file_name
    metadata["file_id"] = file_id
    index.upsert(vectors=[{
        "id": file_id,
        "values": embedding,
        "metadata": metadata
    }])

def search_similar_images(embedding: list, top_k: int = 10):
    """Find similar images by embedding"""
    results = index.query(
        vector=embedding,
        top_k=top_k,
        include_metadata=True
    )
    return results["matches"]

def get_index_stats():
    """Get how many images are indexed"""
    return index.describe_index_stats()