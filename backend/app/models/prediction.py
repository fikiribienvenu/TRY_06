from beanie import Document
from pydantic import Field, ConfigDict
from typing import Optional, Dict, List
from datetime import datetime, timezone
from enum import Enum


class CancerType(str, Enum):
    NO_CANCER = "No Cancer"
    ADENOCARCINOMA = "Adenocarcinoma"
    SQUAMOUS_CELL = "Squamous Cell Carcinoma"
    SCLC = "Small Cell Lung Cancer"
    LARGE_CELL = "Large Cell Carcinoma"
    BENIGN = "Benign"
    OTHER = "Other Rare Subtype"


class Prediction(Document):
    model_config = ConfigDict(protected_namespaces=())

    ct_scan_id: str
    patient_id: str
    performed_by: str              # radiologist id
    prediction: CancerType
    confidence: float              # 0–100
    class_probabilities: Dict[str, float] = {}
    model_version: str = "1.0.0"
    preprocessing_info: Dict = {}
    heatmap_generated: bool = False
    heatmap_path: Optional[str] = None
    raw_output: Optional[Dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "predictions"
        indexes = ["ct_scan_id", "patient_id", "prediction"]
