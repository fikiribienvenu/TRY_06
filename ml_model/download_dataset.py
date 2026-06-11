"""
Dataset: Chest CT-Scan Images Dataset
Source: Kaggle - mohamedhanyyy/chest-ctscan-images
URL: https://www.kaggle.com/datasets/mohamedhanyyy/chest-ctscan-images

Classes:
  - adenocarcinoma
  - large.cell.carcinoma
  - normal
  - squamous.cell.carcinoma

~1,000 CT scan images across 4 classes.
Dataset already contains train/test splits — we create val from train.

Instructions:
  1. Install kaggle CLI: pip install kaggle
  2. Get your API token from https://www.kaggle.com/settings/account
     (set KAGGLE_TOKEN env var OR save token to ~/.kaggle/access_token)
  3. Run: python download_dataset.py
"""
import os
import sys
import shutil
import random
from pathlib import Path

DATASET_NAME = "mohamedhanyyy/chest-ctscan-images"
DATA_DIR = Path("data")
RAW_DIR  = DATA_DIR / "raw"

# Mapping from dataset folder names → canonical class names
CLASS_MAP = {
    "adenocarcinoma":            "Adenocarcinoma",
    "large.cell.carcinoma":      "Large Cell Carcinoma",
    "large cell carcinoma":      "Large Cell Carcinoma",
    "largecellcarcinoma":        "Large Cell Carcinoma",
    "normal":                    "Normal",
    "squamous.cell.carcinoma":   "Squamous Cell Carcinoma",
    "squamous cell carcinoma":   "Squamous Cell Carcinoma",
    "squamouscellcarcinoma":     "Squamous Cell Carcinoma",
}

CLASS_NAMES = ["Adenocarcinoma", "Large Cell Carcinoma", "Normal", "Squamous Cell Carcinoma"]


def download_kaggle_dataset():
    try:
        import kaggle
    except ImportError:
        print("Installing kaggle...")
        os.system(f"{sys.executable} -m pip install kaggle")
        import kaggle

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {DATASET_NAME}  ...")
    kaggle.api.authenticate()
    kaggle.api.dataset_download_files(DATASET_NAME, path=str(RAW_DIR), unzip=True)
    print(f"Dataset downloaded to {RAW_DIR}")

    _organize_dataset()


def _organize_dataset():
    """
    Dataset structure: Data/{train,valid,test}/{class_folder}/*.png
    We use the provided valid split as our val, keep test as-is.
    Output: data/organized/{train,val,test}/{CanonicalClass}/
    """
    print("\nOrganizing dataset...")

    organized = DATA_DIR / "organized"

    # Clean previous organized data
    if organized.exists():
        shutil.rmtree(organized)

    # Create output directories
    for split in ["train", "val", "test"]:
        for cls in CLASS_NAMES:
            (organized / split / cls).mkdir(parents=True, exist_ok=True)

    # Map raw split names to output split names
    split_mapping = {
        "train": "train",
        "valid": "val",
        "test":  "test",
    }

    for raw_split, out_split in split_mapping.items():
        src = _find_split_dir(raw_split)
        if src:
            _copy_split(src, organized / out_split, out_split)
        else:
            print(f"  Warning: '{raw_split}' split not found in raw data")

    _print_stats(organized)


def _find_split_dir(split_name: str):
    """Search recursively for a folder named 'train', 'valid', or 'test'."""
    for folder in RAW_DIR.rglob("*"):
        if folder.is_dir() and folder.name.lower() == split_name.lower():
            sub = list(folder.iterdir())
            if any(s.is_dir() for s in sub):
                return folder
    return None


def _canonical(folder_name: str):
    """Map a raw folder name to a canonical class name.
    Handles dotted names, spaces, underscores, and TNM staging suffixes
    e.g. 'adenocarcinoma_left.lower.lobe_T2_N0_M0_Ib' → 'Adenocarcinoma'
    """
    key = folder_name.lower().strip()

    # Direct match first
    if key in CLASS_MAP:
        return CLASS_MAP[key]

    # Replace dots with spaces and try again
    key2 = key.replace(".", " ").replace("_", " ")
    if key2 in CLASS_MAP:
        return CLASS_MAP[key2]

    # Prefix match — strip TNM staging or location suffixes
    # e.g. 'adenocarcinoma_left.lower.lobe_T2_N0_M0_Ib' → 'adenocarcinoma'
    for map_key, canonical in CLASS_MAP.items():
        # Check if folder name STARTS WITH the map key (using _ or . as separator)
        clean_key = map_key.replace(" ", "").replace(".", "")
        clean_folder = key.replace(".", "").replace(" ", "").replace("_", "")
        if clean_folder.startswith(clean_key):
            return canonical

    return None


def _copy_split(src_dir: Path, dst_dir: Path, split_label: str):
    """Copy all images from src_dir class subfolders to dst_dir."""
    total = 0
    for cls_dir in src_dir.iterdir():
        if not cls_dir.is_dir():
            continue
        canonical = _canonical(cls_dir.name)
        if not canonical:
            print(f"  Skipping unknown folder: {cls_dir.name}")
            continue
        images = (
            list(cls_dir.glob("*.png"))
            + list(cls_dir.glob("*.jpg"))
            + list(cls_dir.glob("*.jpeg"))
        )
        for img in images:
            shutil.copy2(img, dst_dir / canonical / img.name)
            total += 1
    print(f"  {split_label}: copied {total} images")


def _copy_split_with_val(src_dir: Path, organized: Path, val_ratio: float = 0.20):
    """Copy train images into train/val splits."""
    random.seed(42)
    for cls_dir in src_dir.iterdir():
        if not cls_dir.is_dir():
            continue
        canonical = _canonical(cls_dir.name)
        if not canonical:
            continue
        images = (
            list(cls_dir.glob("*.png"))
            + list(cls_dir.glob("*.jpg"))
            + list(cls_dir.glob("*.jpeg"))
        )
        random.shuffle(images)
        n_val   = max(1, int(len(images) * val_ratio))
        n_train = len(images) - n_val

        for img in images[:n_train]:
            shutil.copy2(img, organized / "train" / canonical / img.name)
        for img in images[n_train:]:
            shutil.copy2(img, organized / "val"   / canonical / img.name)

        print(f"  {canonical}: {len(images)} total → train:{n_train}, val:{n_val}")


def _print_stats(organized: Path):
    print("\n" + "=" * 50)
    print("Dataset Statistics")
    print("=" * 50)
    grand_total = 0
    for split in ["train", "val", "test"]:
        split_dir = organized / split
        if not split_dir.exists():
            continue
        print(f"\n{split.upper()}:")
        split_total = 0
        for cls_dir in sorted(split_dir.iterdir()):
            if cls_dir.is_dir():
                count = len(list(cls_dir.glob("*")))
                print(f"  {cls_dir.name:<30} {count:>4}")
                split_total += count
        print(f"  {'SUBTOTAL':<30} {split_total:>4}")
        grand_total += split_total
    print(f"\n  GRAND TOTAL: {grand_total} images")
    print("=" * 50)
    print(f"\nOrganized dataset ready at: {(organized).resolve()}")


if __name__ == "__main__":
    download_kaggle_dataset()
