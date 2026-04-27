from deepface import DeepFace
from PIL import Image
import numpy as np
import tempfile
import os
from io import BytesIO

def get_face_embedding(image: Image.Image):
    """Extract face embedding from an image"""
    try:
        # Convert PIL image to numpy array
        img_array = np.array(image)
        
        # Get face embedding using DeepFace
        embedding_obj = DeepFace.represent(
            img_path=img_array,
            model_name="Facenet",
            enforce_detection=False
        )
        
        if embedding_obj and len(embedding_obj) > 0:
            return embedding_obj[0]["embedding"]
        return None
        
    except Exception as e:
        print(f"Face embedding error: {e}")
        return None

def compare_faces(embedding1: list, embedding2: list):
    """Compare two face embeddings and return similarity score"""
    try:
        import numpy as np
        e1 = np.array(embedding1)
        e2 = np.array(embedding2)
        
        # Cosine similarity
        similarity = np.dot(e1, e2) / (np.linalg.norm(e1) * np.linalg.norm(e2))
        return float(similarity)
    except Exception as e:
        print(f"Face comparison error: {e}")
        return 0.0

def has_face(image: Image.Image):
    """Check if image contains a face"""
    try:
        img_array = np.array(image)
        faces = DeepFace.extract_faces(
            img_path=img_array,
            enforce_detection=True
        )
        return len(faces) > 0
    except:
        return False