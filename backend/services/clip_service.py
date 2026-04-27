from PIL import Image
from transformers import CLIPProcessor, CLIPModel
import torch
from io import BytesIO

print("Loading CLIP model... (first time takes 1-2 minutes)")
model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
print("CLIP model loaded!")

def get_image_embedding(image):
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        outputs = model(**inputs, input_ids=torch.zeros(1, 1, dtype=torch.long))
        embedding = outputs.image_embeds
    embedding = embedding / embedding.norm(dim=-1, keepdim=True)
    return embedding.squeeze().tolist()

def get_text_embedding(text):
    inputs = processor(text=[text], images=None, return_tensors="pt", padding=True)
    with torch.no_grad():
        outputs = model(**inputs, pixel_values=torch.zeros(1, 3, 224, 224))
        embedding = outputs.text_embeds
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
    