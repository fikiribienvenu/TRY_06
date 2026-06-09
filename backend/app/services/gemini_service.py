import google.generativeai as genai
from loguru import logger
from app.config import settings
from typing import Optional


def _init_gemini():
    if settings.GEMINI_API_KEY:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        return genai.GenerativeModel("gemini-1.5-flash")
    return None


_model = None


def get_model():
    global _model
    if _model is None:
        _model = _init_gemini()
    return _model


async def generate_patient_explanation(
    prediction: str,
    confidence: float,
    patient_age: int,
    patient_gender: str,
    recommendations: list[str],
) -> Optional[str]:
    model = get_model()
    if not model:
        return _fallback_explanation(prediction, confidence, recommendations)

    prompt = f"""
You are a compassionate medical AI assistant at PulmoScan AI hospital.
Write a clear, empathetic explanation for a patient about their CT scan results.

Patient Details:
- Age: {patient_age}
- Gender: {patient_gender}
- AI Finding: {prediction}
- Confidence: {confidence:.1f}%
- Recommended Actions: {', '.join(recommendations)}

Instructions:
1. Use simple, non-technical language
2. Be empathetic and reassuring
3. Clearly explain what the finding means
4. Explain why the recommendations are important
5. Encourage the patient to speak with their doctor
6. Keep it under 200 words
7. Do NOT make definitive diagnoses — emphasize this is an AI-assisted screening
"""
    try:
        response = await model.generate_content_async(prompt)
        return response.text
    except Exception as e:
        logger.error(f"Gemini error: {e}")
        return _fallback_explanation(prediction, confidence, recommendations)


async def generate_treatment_recommendations(
    prediction: str,
    confidence: float,
    patient_age: int,
    patient_gender: str,
    junior_notes: str,
    senior_notes: str,
) -> list[str]:
    model = get_model()
    if not model:
        return _fallback_recommendations(prediction)

    prompt = f"""
You are a senior oncologist reviewing a lung CT scan AI report.
Generate concise treatment recommendations.

Finding: {prediction} (confidence: {confidence:.1f}%)
Patient: {patient_age}yr {patient_gender}
Junior Doctor Notes: {junior_notes or 'None'}
Senior Doctor Notes: {senior_notes or 'None'}

Return ONLY a numbered list of 3-6 specific clinical recommendations.
Each recommendation should be one sentence.
"""
    try:
        response = await model.generate_content_async(prompt)
        lines = [
            line.strip().lstrip("0123456789.-) ")
            for line in response.text.strip().split("\n")
            if line.strip() and not line.strip().startswith("#")
        ]
        return [l for l in lines if l][:6]
    except Exception as e:
        logger.error(f"Gemini recommendations error: {e}")
        return _fallback_recommendations(prediction)


def _fallback_explanation(prediction: str, confidence: float, recommendations: list[str]) -> str:
    if prediction == "No Cancer":
        return (
            f"Your CT scan analysis shows no signs of lung cancer (confidence: {confidence:.1f}%). "
            "This is encouraging news. However, regular check-ups are important for maintaining your health. "
            "Please continue to follow up with your doctor as scheduled."
        )
    return (
        f"Your CT scan analysis detected findings consistent with {prediction} "
        f"(confidence: {confidence:.1f}%). This AI-assisted screening has been reviewed by our medical team. "
        f"The following steps are recommended: {'; '.join(recommendations[:3])}. "
        "Please discuss these results with your doctor who will guide you through the next steps."
    )


def _fallback_recommendations(prediction: str) -> list[str]:
    base = ["Consult with an oncologist for specialist evaluation"]
    if prediction == "No Cancer":
        return ["Schedule routine follow-up imaging in 12 months", "Maintain healthy lifestyle habits", "Contact your doctor if symptoms develop"]
    return base + [
        "Schedule a biopsy for histological confirmation",
        "Complete staging workup including PET-CT scan",
        "Pulmonary function tests recommended",
        "Multidisciplinary tumor board review",
        "Patient counseling and support services referral",
    ]
