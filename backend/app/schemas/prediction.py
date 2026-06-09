from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime
from app.models.prediction import CancerType


class PredictionResponse(BaseModel):
    id: str
    ct_scan_id: str
    patient_id: str
    prediction: CancerType
    confidence: float
    class_probabilities: Dict[str, float]
    model_version: str
    heatmap_generated: bool
    heatmap_path: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PredictionPublicResponse(BaseModel):
    prediction: str
    confidence: float
    timestamp: str
