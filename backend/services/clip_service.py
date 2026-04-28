from PIL import Image
from io import BytesIO

_model = None
_processor = None

def _load_model():
    global _model, _processor
    if _model is None:
        from transformers import CLIPProcessor, CLIPModel
        print("Loading CLIP model... (first time takes 1-2 minutes)")
        _model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        _processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        print("CLIP model loaded!")
    return _model, _processor

def get_image_embedding(image):
    import torch
    model, processor = _load_model()
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        embedding = model.get_image_features(**inputs)
    embedding = embedding / embedding.norm(dim=-1, keepdim=True)
    return embedding.squeeze().tolist()

def get_text_embedding(text):
    import torch
    model, processor = _load_model()
    inputs = processor(text=[text], return_tensors="pt", padding=True)
    with torch.no_grad():
        embedding = model.get_text_features(**inputs)
    embedding = embedding / embedding.norm(dim=-1, keepdim=True)
    return embedding.squeeze().tolist()

def download_drive_image(file_id, service):
    try:
        request = service.files().get_media(fileId=file_id)
        image_data = request.execute()
        image = Image.open(BytesIO(image_data)).convert("RGB")
        return image
    except Exception as e:
        print(f"Could not download image {file_id}: {e}")
        return None
