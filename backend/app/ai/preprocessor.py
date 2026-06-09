import numpy as np
from pathlib import Path
from PIL import Image
from loguru import logger
from typing import Optional
import io

IMG_SIZE = (224, 224)


def preprocess_image(image_path: str) -> Optional[np.ndarray]:
    try:
        path = Path(image_path)
        if not path.exists():
            logger.error(f"Image not found: {image_path}")
            return None

        suffix = path.suffix.lower()

        if suffix == ".dcm":
            return _preprocess_dicom(path)
        else:
            return _preprocess_standard(path)
    except Exception as e:
        logger.error(f"Preprocessing failed: {e}")
        return None


def _preprocess_standard(path: Path) -> np.ndarray:
    img = Image.open(path).convert("RGB")
    img = img.resize(IMG_SIZE, Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)


def _preprocess_dicom(path: Path) -> np.ndarray:
    import pydicom
    ds = pydicom.dcmread(str(path))
    pixel_array = ds.pixel_array.astype(np.float32)

    # Normalize to 0-255
    pixel_min = pixel_array.min()
    pixel_max = pixel_array.max()
    if pixel_max > pixel_min:
        pixel_array = (pixel_array - pixel_min) / (pixel_max - pixel_min) * 255.0

    img = Image.fromarray(pixel_array.astype(np.uint8))
    if img.mode != "RGB":
        img = img.convert("RGB")
    img = img.resize(IMG_SIZE, Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)


def generate_gradcam_heatmap(
    model,
    image_array: np.ndarray,
    pred_class_idx: int,
    output_path: str,
) -> bool:
    try:
        import tensorflow as tf
        import matplotlib.pyplot as plt
        import matplotlib.cm as cm

        last_conv = None
        for layer in reversed(model.layers):
            if "conv" in layer.name.lower():
                last_conv = layer.name
                break

        if not last_conv:
            return False

        grad_model = tf.keras.models.Model(
            inputs=model.inputs,
            outputs=[model.get_layer(last_conv).output, model.output],
        )

        with tf.GradientTape() as tape:
            conv_outputs, predictions = grad_model(image_array)
            loss = predictions[:, pred_class_idx]

        grads = tape.gradient(loss, conv_outputs)
        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
        conv_outputs = conv_outputs[0]
        heatmap = conv_outputs @ pooled_grads[..., tf.newaxis]
        heatmap = tf.squeeze(heatmap)
        heatmap = np.maximum(heatmap.numpy(), 0)
        if heatmap.max() > 0:
            heatmap /= heatmap.max()

        img = Image.fromarray((image_array[0] * 255).astype(np.uint8))
        heatmap_resized = np.uint8(255 * heatmap)
        heatmap_img = Image.fromarray(heatmap_resized).resize(IMG_SIZE)
        heatmap_arr = np.array(heatmap_img)
        colored = cm.jet(heatmap_arr / 255.0)[:, :, :3]
        colored = (colored * 255).astype(np.uint8)
        colored_img = Image.fromarray(colored)
        superimposed = Image.blend(img.convert("RGB"), colored_img, alpha=0.4)
        superimposed.save(output_path)
        return True
    except Exception as e:
        logger.error(f"GradCAM failed: {e}")
        return False
