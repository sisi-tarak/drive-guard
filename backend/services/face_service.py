from PIL import Image
import numpy as np

_deepface = None

def _get_deepface():
    global _deepface
    if _deepface is None:
        from deepface import DeepFace
        _deepface = DeepFace
    return _deepface

# ArcFace: state-of-the-art accuracy, robust to pose/lighting/expression changes
# retinaface: detects faces at any angle including profile; mtcnn → opencv → skip as fallbacks
_MODEL = "ArcFace"
_DETECTORS = ("retinaface", "mtcnn", "opencv", "skip")

# ArcFace cosine similarity threshold (lower = more permissive / higher recall)
SIMILARITY_THRESHOLD = 0.65


def get_face_embedding(image: Image.Image):
    """
    Extract a 512-dim ArcFace embedding from the most prominent face in the image.
    Returns None only if every detector backend fails entirely.
    """
    DeepFace = _get_deepface()
    # PIL → RGB; DeepFace/OpenCV expects BGR
    img_array = np.array(image)[:, :, ::-1].copy()

    for detector in _DETECTORS:
        try:
            results = DeepFace.represent(
                img_path=img_array,
                model_name=_MODEL,
                enforce_detection=False,
                detector_backend=detector,
                align=True,          # align face before embedding (fixes head tilt)
            )
            if not results:
                continue
            # When multiple faces are detected, use the one with highest confidence
            best = max(results, key=lambda r: r.get("face_confidence", 0))
            return best["embedding"]
        except Exception as e:
            print(f"Face embedding ({detector}): {e}")
            continue

    return None


def compare_faces(e1: list, e2: list) -> float:
    """Cosine similarity between two face embeddings. Range: -1 to 1 (higher = more similar)."""
    try:
        a, b = np.array(e1), np.array(e2)
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
    except Exception:
        return 0.0


def has_face(image: Image.Image) -> bool:
    try:
        DeepFace = _get_deepface()
        img_array = np.array(image)[:, :, ::-1].copy()
        faces = DeepFace.extract_faces(
            img_path=img_array,
            enforce_detection=True,
            detector_backend="retinaface",
        )
        return len(faces) > 0
    except Exception:
        return False
