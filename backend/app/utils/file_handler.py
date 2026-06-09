import aiofiles
import os
from pathlib import Path
from fastapi import UploadFile, HTTPException, status
from app.config import settings
from app.utils.helpers import sanitize_filename
from datetime import datetime
import uuid


ALLOWED_CT_TYPES = {
    "image/jpeg", "image/jpg", "image/png",
    "application/dicom", "application/octet-stream",
}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".dcm"}


async def save_ct_scan(file: UploadFile, patient_id: str) -> dict:
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed: {ALLOWED_EXTENSIONS}",
        )

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > settings.MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Max size: {settings.MAX_FILE_SIZE_MB}MB",
        )

    date_dir = datetime.now().strftime("%Y/%m")
    upload_dir = Path(settings.UPLOAD_DIR) / "ct_scans" / patient_id / date_dir
    upload_dir.mkdir(parents=True, exist_ok=True)

    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = upload_dir / unique_name

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    return {
        "file_path": str(file_path),
        "file_name": sanitize_filename(file.filename),
        "file_type": ext.lstrip("."),
        "file_size_kb": round(len(content) / 1024, 2),
    }


def delete_file(file_path: str) -> bool:
    try:
        path = Path(file_path)
        if path.exists():
            path.unlink()
            return True
        return False
    except Exception:
        return False
