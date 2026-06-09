"""
Dataset: Chest CT-Scan Images Dataset
Source: Kaggle - mohammadhossein77/chest-ct-scan-data
URL: https://www.kaggle.com/datasets/mohammadhossein77/chest-ct-scan-data

Classes:
  - Adenocarcinoma (malignant)
  - Large Cell Carcinoma (malignant)
  - Normal (no cancer)
  - Squamous Cell Carcinoma (malignant)

~1,000 CT scan images across 4 classes.

Instructions:
  1. Install kaggle CLI: pip install kaggle
  2. Get your API key from https://www.kaggle.com/settings/account
  3. Place kaggle.json in ~/.kaggle/ or set KAGGLE_USERNAME and KAGGLE_KEY env vars
  4. Run: python download_dataset.py
"""
import os
import sys
import zipfile
from pathlib import Path

DATASET_NAME = "mohammadhossein77/chest-ct-scan-data"
DATA_DIR = Path("data")
RAW_DIR = DATA_DIR / "raw"


def download_kaggle_dataset():
    try:
        import kaggle
    except ImportError:
        print("Installing kaggle...")
        os.system(f"{sys.executable} -m pip install kaggle")
        import kaggle

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {DATASET_NAME}...")
    kaggle.api.authenticate()
    kaggle.api.dataset_download_files(DATASET_NAME, path=str(RAW_DIR), unzip=True)
    print(f"Dataset downloaded to {RAW_DIR}")

    _organize_dataset()


def _organize_dataset():
    """Organize downloaded files into train/val/test splits."""
    import shutil
    import random

    print("Organizing dataset...")

    class_map = {
        "adenocarcinoma": "Adenocarcinoma",
        "large.cell.carcinoma": "Large Cell Carcinoma",
        "normal": "Normal",
        "squamouscellcarcinoma": "Squamous Cell Carcinoma",
        "squamous cell carcinoma": "Squamous Cell Carcinoma",
    }

    splits = {"train": 0.7, "val": 0.15, "test": 0.15}
    organized = DATA_DIR / "organized"

    for split in splits:
        for cls in class_map.values():
            (organized / split / cls).mkdir(parents=True, exist_ok=True)

    # Find all images
    all_images = {}
    for folder in RAW_DIR.rglob("*"):
        if folder.is_dir():
            folder_name_lower = folder.name.lower().replace(" ", "").replace("_", "")
            for key, canonical in class_map.items():
                if key.replace(" ", "").replace(".", "") in folder_name_lower:
                    images = list(folder.glob("*.jpg")) + list(folder.glob("*.jpeg")) + list(folder.glob("*.png"))
                    if images:
                        all_images.setdefault(canonical, []).extend(images)
                    break

    total = 0
    for cls, images in all_images.items():
        random.shuffle(images)
        n = len(images)
        n_train = int(n * splits["train"])
        n_val = int(n * splits["val"])

        for i, img in enumerate(images):
            if i < n_train:
                split = "train"
            elif i < n_train + n_val:
                split = "val"
            else:
                split = "test"

            dest = organized / split / cls / img.name
            shutil.copy2(img, dest)
            total += 1

        print(f"  {cls}: {n} images → train:{n_train}, val:{n_val}, test:{n - n_train - n_val}")

    print(f"\nTotal: {total} images organized into {organized}")
    _print_stats(organized)


def _print_stats(organized: Path):
    print("\nDataset Statistics:")
    print("-" * 40)
    for split in ["train", "val", "test"]:
        split_dir = organized / split
        if not split_dir.exists():
            continue
        print(f"\n{split.upper()}:")
        for cls_dir in sorted(split_dir.iterdir()):
            if cls_dir.is_dir():
                count = len(list(cls_dir.glob("*")))
                print(f"  {cls_dir.name}: {count}")


if __name__ == "__main__":
    download_kaggle_dataset()
