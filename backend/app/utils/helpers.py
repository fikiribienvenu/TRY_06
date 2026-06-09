import uuid
import secrets
import string
from datetime import datetime, timezone


def generate_patient_id() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m")
    uid = secrets.token_hex(3).upper()
    return f"PSC-{ts}-{uid}"


def generate_report_id() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d")
    uid = secrets.token_hex(4).upper()
    return f"RPT-{ts}-{uid}"


def paginate(query, page: int, page_size: int):
    skip = (page - 1) * page_size
    return query.skip(skip).limit(page_size)


def sanitize_filename(filename: str) -> str:
    allowed = string.ascii_letters + string.digits + "._-"
    clean = "".join(c if c in allowed else "_" for c in filename)
    return clean[:100]
