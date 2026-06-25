from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from pathlib import Path
from typing import Optional
from datetime import datetime
import io
from loguru import logger


PRIMARY = HexColor("#1a3c5e")
ACCENT = HexColor("#2563eb")
LIGHT_BG = HexColor("#f8fafc")
BORDER = HexColor("#e2e8f0")
SUCCESS = HexColor("#16a34a")
WARNING = HexColor("#d97706")
DANGER = HexColor("#dc2626")


def generate_report_pdf(
    patient_name: str,
    patient_id: str,
    patient_age: int,
    patient_gender: str,
    ct_scan_date: str,
    prediction: str,
    confidence: float,
    radiologist: str,
    senior_doctor: str,
    recommendations: list[str],
    gemini_explanation: Optional[str],
    ct_image_path: Optional[str],
    report_id: str,
    published_at: str,
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Title"], textColor=white, fontSize=20, alignment=TA_CENTER)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], textColor=PRIMARY, fontSize=13)
    body = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10, leading=15)
    small = ParagraphStyle("Small", parent=styles["Normal"], fontSize=8, textColor=HexColor("#64748b"))

    story = []

    # Header
    header_data = [[Paragraph("<b>PulmoScan AI</b><br/><font size=9>Lung Cancer Prediction System</font>", title_style)]]
    header_table = Table(header_data, colWidths=[doc.width])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PRIMARY),
        ("TOPPADDING", (0, 0), (-1, -1), 16),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 16),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 0.3*inch))

    # Report info
    story.append(Paragraph("CT SCAN ANALYSIS REPORT", ParagraphStyle("RTitle", parent=styles["Heading1"], textColor=PRIMARY, fontSize=16, alignment=TA_CENTER)))
    story.append(Spacer(1, 0.1*inch))

    info_data = [
        ["Report ID:", report_id, "Published:", published_at],
        ["Patient Name:", patient_name, "Patient ID:", patient_id],
        ["Age / Gender:", f"{patient_age} yrs / {patient_gender.title()}", "Scan Date:", ct_scan_date],
    ]
    info_table = Table(info_data, colWidths=[1.5*inch, 2.5*inch, 1.5*inch, 2*inch])
    info_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 0.2*inch))

    # Prediction result
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph("AI PREDICTION RESULT", h2))

    pred_color = DANGER if prediction != "No Cancer" else SUCCESS
    pred_data = [
        [Paragraph(f"<font color='#{pred_color.hexval()[2:]}' size=14><b>{prediction}</b></font>",
                   ParagraphStyle("P", parent=styles["Normal"], alignment=TA_CENTER)),
         Paragraph(f"<b>Confidence Score</b><br/><font size=24>{confidence:.1f}%</font>",
                   ParagraphStyle("C", parent=styles["Normal"], alignment=TA_CENTER))],
    ]
    pred_table = Table(pred_data, colWidths=[doc.width * 0.5, doc.width * 0.5])
    pred_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 16),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 16),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(pred_table)
    story.append(Spacer(1, 0.2*inch))

    # CT image
    if ct_image_path and Path(ct_image_path).exists():
        story.append(Paragraph("CT SCAN IMAGE", h2))
        try:
            img = Image(ct_image_path, width=3*inch, height=3*inch)
            story.append(img)
        except Exception:
            story.append(Paragraph("CT scan image unavailable.", body))
        story.append(Spacer(1, 0.2*inch))

    # Recommendations
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph("CLINICAL RECOMMENDATIONS", h2))
    for i, rec in enumerate(recommendations, 1):
        story.append(Paragraph(f"{i}. {rec}", body))
    story.append(Spacer(1, 0.2*inch))

    # Gemini explanation
    if gemini_explanation:
        story.append(HRFlowable(width="100%", thickness=1, color=BORDER))
        story.append(Spacer(1, 0.1*inch))
        story.append(Paragraph("AI-ASSISTED EXPLANATION", h2))
        story.append(Paragraph(gemini_explanation, body))
        story.append(Spacer(1, 0.2*inch))

    # Doctors
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    story.append(Spacer(1, 0.1*inch))
    doc_data = [
        ["Reviewed by (Radiologist):", radiologist, "Approved by (Senior):", senior_doctor],
    ]
    doc_table = Table(doc_data, colWidths=[1.8*inch, 2.2*inch, 1.8*inch, 2.2*inch])
    doc_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(doc_table)

    # Footer
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph(
        "This report is generated by PulmoScan AI and reviewed by qualified medical professionals. "
        "AI predictions are assistive tools and should not replace professional medical judgment.",
        small
    ))

    doc.build(story)
    return buffer.getvalue()
