"""
Picks 2 CT scan images per class from the test split and copies them
to sample_images/<ClassName>/ with clean numbered names.
"""
import shutil
from pathlib import Path

SRC  = Path("ml_model/data/organized/test")
DEST = Path("sample_images")

CLASSES = [
    "Adenocarcinoma",
    "Large Cell Carcinoma",
    "Normal",
    "Squamous Cell Carcinoma",
]

DEST.mkdir(exist_ok=True)

for cls in CLASSES:
    src_dir = SRC / cls
    if not src_dir.exists():
        print(f"  [SKIP] {cls} — source folder not found")
        continue

    images = sorted(src_dir.glob("*.png"))[:2]
    if not images:
        images = sorted(src_dir.glob("*.jpg"))[:2]

    safe_name = cls.replace(" ", "_")
    out_dir = DEST / safe_name
    out_dir.mkdir(exist_ok=True)

    for i, img in enumerate(images, 1):
        dest_file = out_dir / f"sample_{i}.png"
        shutil.copy2(img, dest_file)
        print(f"  [OK] {cls} -> sample_images/{safe_name}/sample_{i}.png")

print(f"\nDone. Upload these images to test the Radiologist CT scan flow.")
