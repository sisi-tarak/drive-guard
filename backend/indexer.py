import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.drive_service import get_drive_service, get_all_images
from services.clip_service import get_image_embedding, download_drive_image
from services.pinecone_service import upsert_image_embedding, get_index_stats


def index_all_drive_images():
    print("Connecting to Google Drive...")
    service = get_drive_service()

    print("Fetching all images from Drive...")
    images = get_all_images(service)
    print(f"Found {len(images)} images in your Drive")

    if not images:
        print("No images found. Upload some images to your Drive and try again.")
        return

    success = 0
    failed = 0

    for i, image_file in enumerate(images):
        print(f"Processing {i+1}/{len(images)}: {image_file['name']}")

        img = download_drive_image(image_file['id'], service)
        if img is None:
            failed += 1
            continue

        embedding = get_image_embedding(img)

        upsert_image_embedding(
            file_id=image_file['id'],
            file_name=image_file['name'],
            embedding=embedding,
            metadata={
                "mimeType": image_file.get('mimeType', ''),
                "thumbnail_url": image_file.get('thumbnailLink', ''),
                "web_view_link": image_file.get('webViewLink', ''),
            },
        )
        success += 1

    stats = get_index_stats()
    print(f"\n✅ Indexing complete!")
    print(f"   Successful: {success}")
    print(f"   Failed:     {failed}")
    print(f"   Total vectors in Pinecone: {stats['total_vector_count']}")


if __name__ == "__main__":
    index_all_drive_images()
