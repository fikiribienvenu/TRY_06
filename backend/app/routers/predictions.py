from fastapi import APIRouter, Depends, HTTPException
from app.models.prediction import Prediction
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.core.dependencies import get_current_active_user

router = APIRouter(prefix="/predictions", tags=["Predictions"])


@router.get("/{prediction_id}")
async def get_prediction(
    prediction_id: str,
    actor: User = Depends(get_current_active_user),
):
    pred = await Prediction.get(prediction_id)
    if not pred:
        raise HTTPException(status_code=404, detail="Prediction not found")

    # Patients can only see their own predictions
    if actor.role == UserRole.PATIENT:
        patient = await Patient.find_one(Patient.user_id == str(actor.id))
        if not patient or pred.patient_id != str(patient.id):
            raise HTTPException(status_code=403, detail="Access denied")

    heatmap_url = None
    if pred.heatmap_path:
        heatmap_url = "/" + pred.heatmap_path.replace("\\", "/")

    return {
        "id":                  str(pred.id),
        "ct_scan_id":          pred.ct_scan_id,
        "patient_id":          pred.patient_id,
        "prediction":          pred.prediction,
        "confidence":          pred.confidence,
        "class_probabilities": pred.class_probabilities,
        "heatmap_generated":   pred.heatmap_generated,
        "heatmap_url":         heatmap_url,
        "model_version":       pred.model_version,
        "created_at":          pred.created_at,
    }
