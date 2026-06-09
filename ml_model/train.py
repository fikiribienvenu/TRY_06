"""
PulmoScan AI - Lung Cancer Classification Model Training
Dataset: Chest CT-Scan Images (Adenocarcinoma, Large Cell Carcinoma, Normal, Squamous Cell Carcinoma)
Architecture: EfficientNetB3 transfer learning
"""
import os
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
import json

import tensorflow as tf
from tensorflow.keras import layers, Model, optimizers, callbacks
from tensorflow.keras.applications import EfficientNetB3
from tensorflow.keras.preprocessing.image import ImageDataGenerator

# Config
IMG_SIZE = (224, 224)
BATCH_SIZE = 32
EPOCHS = 30
FINE_TUNE_EPOCHS = 15
LEARNING_RATE = 1e-3
FINE_TUNE_LR = 1e-5
DATA_DIR = Path("data/organized")
WEIGHTS_DIR = Path("weights")
CLASS_NAMES = ["Adenocarcinoma", "Large Cell Carcinoma", "Normal", "Squamous Cell Carcinoma"]


def build_model(num_classes: int = 4) -> Model:
    base = EfficientNetB3(
        weights="imagenet",
        include_top=False,
        input_shape=(*IMG_SIZE, 3),
    )
    base.trainable = False

    inputs = tf.keras.Input(shape=(*IMG_SIZE, 3))
    x = base(inputs, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.4)(x)
    x = layers.Dense(256, activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    return Model(inputs, outputs)


def create_data_generators():
    train_datagen = ImageDataGenerator(
        rescale=1.0 / 255,
        rotation_range=15,
        width_shift_range=0.1,
        height_shift_range=0.1,
        shear_range=0.1,
        zoom_range=0.1,
        horizontal_flip=True,
        fill_mode="nearest",
    )
    val_datagen = ImageDataGenerator(rescale=1.0 / 255)

    train_gen = train_datagen.flow_from_directory(
        str(DATA_DIR / "train"),
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode="categorical",
        classes=CLASS_NAMES,
    )
    val_gen = val_datagen.flow_from_directory(
        str(DATA_DIR / "val"),
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode="categorical",
        classes=CLASS_NAMES,
    )
    test_gen = val_datagen.flow_from_directory(
        str(DATA_DIR / "test"),
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode="categorical",
        classes=CLASS_NAMES,
        shuffle=False,
    )
    return train_gen, val_gen, test_gen


def get_callbacks(phase: str):
    WEIGHTS_DIR.mkdir(exist_ok=True)
    return [
        callbacks.EarlyStopping(monitor="val_accuracy", patience=7, restore_best_weights=True, verbose=1),
        callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.3, patience=4, min_lr=1e-7, verbose=1),
        callbacks.ModelCheckpoint(
            str(WEIGHTS_DIR / f"best_{phase}.h5"),
            monitor="val_accuracy",
            save_best_only=True,
            verbose=1,
        ),
        callbacks.CSVLogger(str(WEIGHTS_DIR / f"training_{phase}.csv")),
    ]


def train():
    print("=" * 60)
    print("PulmoScan AI - Model Training")
    print("=" * 60)

    if not (DATA_DIR / "train").exists():
        print("ERROR: Dataset not found. Run: python download_dataset.py first")
        return

    train_gen, val_gen, test_gen = create_data_generators()
    print(f"\nClasses: {train_gen.class_indices}")
    print(f"Training samples: {train_gen.samples}")
    print(f"Validation samples: {val_gen.samples}")
    print(f"Test samples: {test_gen.samples}")

    # Save class indices
    with open(str(WEIGHTS_DIR / "class_indices.json"), "w") as f:
        json.dump(train_gen.class_indices, f, indent=2)

    # Phase 1: Train head
    print("\n[Phase 1] Training classification head...")
    model = build_model(num_classes=len(CLASS_NAMES))
    model.compile(
        optimizer=optimizers.Adam(LEARNING_RATE),
        loss="categorical_crossentropy",
        metrics=["accuracy", tf.keras.metrics.AUC(name="auc")],
    )
    model.summary()

    history1 = model.fit(
        train_gen,
        epochs=EPOCHS,
        validation_data=val_gen,
        callbacks=get_callbacks("phase1"),
    )

    # Phase 2: Fine-tuning
    print("\n[Phase 2] Fine-tuning EfficientNetB3...")
    base_model = model.layers[1]
    base_model.trainable = True
    for layer in base_model.layers[:-30]:
        layer.trainable = False

    model.compile(
        optimizer=optimizers.Adam(FINE_TUNE_LR),
        loss="categorical_crossentropy",
        metrics=["accuracy", tf.keras.metrics.AUC(name="auc")],
    )

    history2 = model.fit(
        train_gen,
        epochs=FINE_TUNE_EPOCHS,
        validation_data=val_gen,
        callbacks=get_callbacks("phase2"),
    )

    # Evaluate
    print("\n[Evaluation] Test set performance:")
    results = model.evaluate(test_gen, verbose=1)
    print(f"Test Loss: {results[0]:.4f}")
    print(f"Test Accuracy: {results[1]*100:.2f}%")
    print(f"Test AUC: {results[2]:.4f}")

    # Save final model
    final_path = str(WEIGHTS_DIR / "lung_cancer_model.h5")
    model.save(final_path)
    print(f"\nModel saved to {final_path}")

    # Save metrics
    from sklearn.metrics import classification_report, confusion_matrix
    y_pred = model.predict(test_gen)
    y_pred_classes = np.argmax(y_pred, axis=1)
    y_true = test_gen.classes

    report = classification_report(y_true, y_pred_classes, target_names=CLASS_NAMES)
    print("\nClassification Report:")
    print(report)

    with open(str(WEIGHTS_DIR / "evaluation_report.txt"), "w") as f:
        f.write(f"Test Accuracy: {results[1]*100:.2f}%\n")
        f.write(f"Test AUC: {results[2]:.4f}\n\n")
        f.write(report)

    _plot_history(history1, history2)
    print("\nTraining complete!")


def _plot_history(history1, history2):
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # Combine histories
    acc = history1.history["accuracy"] + history2.history["accuracy"]
    val_acc = history1.history["val_accuracy"] + history2.history["val_accuracy"]
    loss = history1.history["loss"] + history2.history["loss"]
    val_loss = history1.history["val_loss"] + history2.history["val_loss"]

    axes[0].plot(acc, label="Train Accuracy")
    axes[0].plot(val_acc, label="Val Accuracy")
    axes[0].axvline(x=len(history1.history["accuracy"]) - 1, color="gray", linestyle="--", label="Fine-tune start")
    axes[0].set_title("Model Accuracy")
    axes[0].set_xlabel("Epoch")
    axes[0].legend()

    axes[1].plot(loss, label="Train Loss")
    axes[1].plot(val_loss, label="Val Loss")
    axes[1].axvline(x=len(history1.history["loss"]) - 1, color="gray", linestyle="--")
    axes[1].set_title("Model Loss")
    axes[1].set_xlabel("Epoch")
    axes[1].legend()

    plt.tight_layout()
    plt.savefig(str(WEIGHTS_DIR / "training_history.png"), dpi=150)
    print("Training plot saved to weights/training_history.png")


if __name__ == "__main__":
    train()
