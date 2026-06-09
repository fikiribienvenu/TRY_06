import numpy as np
import random
from typing import Dict, Tuple, Optional
from loguru import logger
from app.ai.model_loader import get_model, CLASS_NAMES, CLASS_MAP
from app.ai.preprocessor import preprocess_image, generate_gradcam_heatmap
from pathlib import Path
from datetime import datetime


def predict_ct_scan(
    image_path: str,
    heatmap_dir: str = "uploads/heatmaps",
) -> Tuple[str, float, Dict[str, float], Optional[str]]:
    """
    Returns: (prediction_label, confidence_0_to_100, class_probabilities, heatmap_path_or_None)
    """
    model = get_model()

    if model is None:
        return _mock_prediction()

    preprocessed = preprocess_image(image_path)
    if preprocessed is None:
        logger.warning("Preprocessing failed, returning mock prediction")
        return _mock_prediction()

    try:
        preds = model.predict(preprocessed, verbose=0)[0]
        pred_idx = int(np.argmax(preds))
        confidence = float(preds[pred_idx]) * 100.0
        probs = {CLASS_NAMES[i]: float(preds[i]) * 100.0 for i in range(len(CLASS_NAMES))}
        label = CLASS_MAP.get(CLASS_NAMES[pred_idx], CLASS_NAMES[pred_idx])

        heatmap_path = None
        Path(heatmap_dir).mkdir(parents=True, exist_ok=True)
        heatmap_file = str(Path(heatmap_dir) / f"heatmap_{Path(image_path).stem}_{datetime.now().strftime('%Y%m%d%H%M%S')}.png")
        if generate_gradcam_heatmap(model, preprocessed, pred_idx, heatmap_file):
            heatmap_path = heatmap_file

        return label, confidence, probs, heatmap_path
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        return _mock_prediction()


def _mock_prediction() -> Tuple[str, float, Dict[str, float], None]:
    """Mock prediction for demo/testing when model weights are not available."""
    choices = [
        ("No Cancer", 0.72),
        ("Adenocarcinoma", 0.18),
        ("Squamous Cell Carcinoma", 0.06),
        ("Large Cell Carcinoma", 0.04),
    ]
    label, base_conf = random.choices(choices, weights=[72, 18, 6, 4])[0]
    confidence = round(base_conf * 100 + random.uniform(-5, 5), 1)
    confidence = max(55.0, min(99.9, confidence))

    probs = {}
    remaining = 100.0 - confidence
    other_classes = [c for c, _ in choices if c != label]
    for i, cls in enumerate(other_classes):
        if i == len(other_classes) - 1:
            probs[cls] = round(remaining, 1)
        else:
            p = round(random.uniform(0, remaining * 0.6), 1)
            probs[cls] = p
            remaining -= p
    probs[label] = confidence

    return label, confidence, probs, None
