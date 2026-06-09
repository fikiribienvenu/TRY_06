import numpy as np
from pathlib import Path
from loguru import logger
from typing import Optional
import threading

_model = None
_model_lock = threading.Lock()
MODEL_PATH = Path("ml_model/weights/lung_cancer_model.h5")
IMG_SIZE = (224, 224)

CLASS_NAMES = [
    "Adenocarcinoma",
    "Large Cell Carcinoma",
    "No Cancer",
    "Squamous Cell Carcinoma",
]

# Map model classes to our CancerType enum values
CLASS_MAP = {
    "Adenocarcinoma": "Adenocarcinoma",
    "Large Cell Carcinoma": "Large Cell Carcinoma",
    "No Cancer": "No Cancer",
    "Squamous Cell Carcinoma": "Squamous Cell Carcinoma",
}


def load_model():
    global _model
    with _model_lock:
        if _model is not None:
            return _model

        if not MODEL_PATH.exists():
            logger.warning(f"Model weights not found at {MODEL_PATH}. Using mock predictions.")
            return None

        try:
            import tensorflow as tf
            _model = tf.keras.models.load_model(str(MODEL_PATH))
            logger.success(f"Loaded lung cancer model from {MODEL_PATH}")
            return _model
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return None


def get_model():
    return _model or load_model()
