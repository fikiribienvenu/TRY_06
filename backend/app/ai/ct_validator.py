"""
CT Scan Image Validator
Checks whether an uploaded image is likely a lung CT scan
based on visual/statistical properties before running prediction.

CT scans have specific characteristics:
- Primarily grayscale or near-grayscale (low color saturation)
- High contrast between lung tissue (dark) and surrounding structures (bright)
- Specific intensity distribution (bimodal histogram for air/tissue)
- Typical square-ish aspect ratio
"""

import numpy as np
from pathlib import Path
from PIL import Image
from loguru import logger
from typing import Tuple


def validate_ct_scan(image_path: str) -> Tuple[bool, str]:
    """
    Validates whether the uploaded image is likely a CT scan.

    Returns:
        (is_valid: bool, reason: str)
    """
    try:
        path = Path(image_path)

        # DICOM files are always medical — skip visual check
        if path.suffix.lower() == ".dcm":
            return True, "DICOM file accepted"

        # Load image
        img = Image.open(path)
        width, height = img.size

        # ── Check 1: Minimum resolution ───────────────────────────────
        if width < 64 or height < 64:
            return False, "Image resolution too low. CT scans must be at least 64×64 pixels."

        # ── Check 2: Aspect ratio (CT scans are typically close to square) ──
        aspect_ratio = max(width, height) / min(width, height)
        if aspect_ratio > 3.0:
            return False, (
                "Image aspect ratio is too wide/tall. "
                "CT scan images are typically square or near-square."
            )

        # ── Check 3: Convert to RGB array for analysis ────────────────
        img_rgb = img.convert("RGB")
        arr = np.array(img_rgb, dtype=np.float32)

        r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

        # ── Check 4: Color saturation ─────────────────────────────────
        # CT scans are grayscale — R≈G≈B for all pixels.
        # A natural photo has high color variance between channels.
        # Saturation = how different the channels are from each other
        channel_max = np.maximum(np.maximum(r, g), b)
        channel_min = np.minimum(np.minimum(r, g), b)
        # Avoid division by zero
        channel_range = channel_max - channel_min
        nonzero_mask = channel_max > 10  # ignore nearly black pixels

        if nonzero_mask.sum() > 0:
            mean_saturation = channel_range[nonzero_mask].mean()
        else:
            mean_saturation = 0

        # CT scans: saturation typically < 25
        # Natural color photos: saturation typically > 40
        if mean_saturation > 40:
            return False, (
                "This does not appear to be a CT scan image. "
                "CT scans are grayscale. The uploaded image contains too much color. "
                "Please upload a valid lung CT scan image."
            )

        # ── Check 5: Contrast check ───────────────────────────────────
        # CT scans have high dynamic range (dark lung fields + bright structures)
        gray = 0.299 * r + 0.587 * g + 0.114 * b
        std_dev = gray.std()

        # Too uniform (solid color / screenshot / blank) — not a CT scan
        if std_dev < 10:
            return False, (
                "Image appears to have very low contrast. "
                "Please upload a valid CT scan with visible lung structures."
            )

        # ── Check 6: Check for typical CT scan dark regions (air/lung) ─
        # Lung fields are typically very dark (pixel values < 60)
        dark_pixel_ratio = (gray < 60).sum() / gray.size
        bright_pixel_ratio = (gray > 180).sum() / gray.size

        # A CT scan should have significant dark areas (lung tissue/air)
        # AND some brighter areas (chest wall, spine)
        # If 95%+ pixels are bright (like a white document/screenshot),
        # it's definitely not a CT scan
        if bright_pixel_ratio > 0.90:
            return False, (
                "Image appears to be mostly white. "
                "Please upload a valid lung CT scan image, not a document or screenshot."
            )

        # If less than 5% dark pixels — could be a color photo of a person/object
        if dark_pixel_ratio < 0.05 and mean_saturation > 20:
            return False, (
                "This does not look like a lung CT scan. "
                "CT scans show internal body structures in grayscale. "
                "Please upload a valid CT scan image."
            )

        return True, "Image passed CT scan validation"

    except Exception as e:
        logger.error(f"CT scan validation error: {e}")
        # On validation error, allow through (don't block on validator bugs)
        return True, f"Validation skipped: {e}"
