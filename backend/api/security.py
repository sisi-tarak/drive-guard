import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter
from services.drive_service import get_drive_service, list_all_files
from services.pii_service import scan_text_for_pii
from googleapiclient.errors import HttpError
import io

router = APIRouter()

def extract_text_from_file(service, file):
    """Extract text content from a Drive file"""
    mime = file.get("mimeType", "")
    file_id = file["id"]

    try:
        # Google Docs
        if mime == "application/vnd.google-apps.document":
            result = service.files().export(
                fileId=file_id,
                mimeType="text/plain"
            ).execute()
            return result.decode("utf-8") if isinstance(result, bytes) else result

        # Plain text files
        elif mime == "text/plain":
            result = service.files().get_media(fileId=file_id).execute()
            return result.decode("utf-8") if isinstance(result, bytes) else result

        else:
            return None

    except HttpError:
        return None
    except Exception:
        return None


@router.get("/security/scan")
async def scan_drive_for_pii():
    """Scan all Drive documents for PII and sensitive data"""
    service = get_drive_service()
    files = list_all_files(service)

    all_findings = []
    scanned = 0
    skipped = 0

    for file in files:
        text = extract_text_from_file(service, file)

        if text is None:
            skipped += 1
            continue

        findings = scan_text_for_pii(text, file["name"])
        if findings:
            all_findings.append({
                "file_name": file["name"],
                "file_id": file["id"],
                "drive_link": f"https://drive.google.com/file/d/{file['id']}/view",
                "findings_count": len(findings),
                "findings": findings
            })
        scanned += 1

    return {
        "scanned_files": scanned,
        "skipped_files": skipped,
        "files_with_pii": len(all_findings),
        "results": all_findings
    }