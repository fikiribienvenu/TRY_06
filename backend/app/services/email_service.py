import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path
from loguru import logger
from app.config import settings


_jinja_env = None


def _get_jinja_env():
    global _jinja_env
    if _jinja_env is None:
        templates_dir = Path(__file__).parent.parent / "templates" / "email"
        templates_dir.mkdir(parents=True, exist_ok=True)
        _jinja_env = Environment(
            loader=FileSystemLoader(str(templates_dir)),
            autoescape=select_autoescape(["html"]),
        )
    return _jinja_env


async def send_email(to: str, subject: str, html_body: str, text_body: str = "") -> bool:
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning(f"SMTP not configured. Would send email to {to}: {subject}")
        return False

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>"
    message["To"] = to

    if text_body:
        message.attach(MIMEText(text_body, "plain"))
    message.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info(f"Email sent to {to}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return False


async def send_credentials_email(
    to: str, full_name: str, email: str, password: str, role: str
) -> bool:
    subject = f"Welcome to {settings.APP_NAME} - Your Account Credentials"
    html = f"""
    <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1a3c5e; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">PulmoScan AI</h1>
        <p style="color: #90cdf4;">Lung Cancer Prediction System</p>
    </div>
    <div style="padding: 30px; background: #f8fafc;">
        <h2>Welcome, {full_name}!</h2>
        <p>Your account has been created with the role of <strong>{role.replace('_', ' ').title()}</strong>.</p>
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p><strong>Login URL:</strong> <a href="{settings.FRONTEND_URL}/login">{settings.FRONTEND_URL}/login</a></p>
            <p><strong>Email:</strong> {email}</p>
            <p><strong>Temporary Password:</strong> <code style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px;">{password}</code></p>
        </div>
        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px;">
            <strong>Important:</strong> You must change your password on your first login.
        </div>
        <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            This is an automated message from {settings.APP_NAME}. Do not reply to this email.
        </p>
    </div>
    </body></html>
    """
    return await send_email(to, subject, html)


async def send_report_published_email(
    to: str, patient_name: str, prediction: str,
    confidence: float, gemini_explanation: str = None,
    recommendations: list = None,
) -> bool:
    subject = f"{settings.APP_NAME} - Your CT Scan Report is Ready"

    recs_html = ""
    if recommendations:
        items = "".join(f"<li style='margin-bottom:6px'>{r}</li>" for r in recommendations)
        recs_html = f"""
        <div style="margin:20px 0;">
            <h3 style="color:#1a3c5e;margin-bottom:10px;">Medical Recommendations</h3>
            <ol style="color:#475569;padding-left:20px;">{items}</ol>
        </div>"""

    gemini_html = ""
    if gemini_explanation:
        gemini_html = f"""
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin:20px 0;">
            <p style="color:#1d4ed8;font-weight:600;margin:0 0 10px;">🤖 AI Explanation for You</p>
            <p style="color:#1e40af;line-height:1.6;margin:0;">{gemini_explanation}</p>
        </div>"""

    result_color = "#16a34a" if prediction in ("No Cancer", "Normal") else "#dc2626"
    result_bg    = "#f0fdf4" if prediction in ("No Cancer", "Normal") else "#fef2f2"
    result_border= "#bbf7d0" if prediction in ("No Cancer", "Normal") else "#fecaca"

    html = f"""
    <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
    <div style="background:#1a3c5e;padding:24px;text-align:center;">
        <h1 style="color:white;margin:0;">PulmoScan AI</h1>
        <p style="color:#93c5fd;margin:4px 0 0;">Lung Cancer Prediction System</p>
    </div>
    <div style="padding:30px;background:#f8fafc;">
        <h2 style="color:#1e293b;">Dear {patient_name},</h2>
        <p style="color:#475569;">Your CT scan has been reviewed and approved by our medical team. Here are your results:</p>

        <div style="background:{result_bg};border:1px solid {result_border};border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
            <p style="font-size:22px;font-weight:bold;color:{result_color};margin:0;">{prediction}</p>
            <p style="font-size:28px;font-weight:bold;color:#1e293b;margin:4px 0;">{confidence:.1f}%</p>
            <p style="color:#64748b;font-size:13px;margin:0;">AI Confidence Score</p>
        </div>

        {gemini_html}
        {recs_html}

        <p style="color:#475569;">Please log in to your patient portal to view the complete report and download your PDF.</p>
        <div style="text-align:center;margin:24px 0;">
            <a href="{settings.FRONTEND_URL}/patient/reports"
               style="background:#1a3c5e;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
                View My Report
            </a>
        </div>
        <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px;margin-top:20px;">
            <p style="margin:0;font-size:12px;color:#854d0e;">
                <strong>Important:</strong> This AI-assisted report has been reviewed by a senior doctor.
                Please discuss your results with your healthcare provider.
            </p>
        </div>
        <p style="color:#94a3b8;font-size:11px;margin-top:24px;">
            This is an automated message from {settings.APP_NAME}. Do not reply to this email.
        </p>
    </div>
    </body></html>
    """
    return await send_email(to, subject, html)


async def send_appointment_rejection_email(
    to: str, patient_name: str, appointment_type: str,
    reason: str, next_available: str = None,
) -> bool:
    subject = f"{settings.APP_NAME} - Appointment Request Not Confirmed"

    next_html = ""
    if next_available:
        next_html = f"""
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:15px;margin:15px 0;">
            <p style="margin:0;color:#1d4ed8;font-weight:600;">Next Available Date</p>
            <p style="margin:6px 0 0;color:#1e40af;font-size:18px;font-weight:bold;">{next_available}</p>
            <p style="margin:4px 0 0;color:#64748b;font-size:12px;">
                Please contact the clinic or log in to request a new appointment on that date.
            </p>
        </div>"""

    html = f"""
    <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
    <div style="background:#1a3c5e;padding:24px;text-align:center;">
        <h1 style="color:white;margin:0;">PulmoScan AI</h1>
        <p style="color:#93c5fd;margin:4px 0 0;">Lung Cancer Prediction System</p>
    </div>
    <div style="padding:30px;background:#f8fafc;">
        <h2 style="color:#1e293b;">Dear {patient_name},</h2>
        <p style="color:#475569;">We regret to inform you that your appointment request could not be confirmed.</p>

        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;margin:20px 0;">
            <p style="font-weight:bold;color:#dc2626;margin:0 0 6px;font-size:16px;">Appointment Not Confirmed</p>
            <p style="margin:0;color:#475569;"><strong>Type:</strong> {appointment_type}</p>
        </div>

        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:15px;margin:15px 0;">
            <p style="margin:0;font-weight:bold;color:#1e293b;">Reason:</p>
            <p style="margin:8px 0 0;color:#475569;">{reason}</p>
        </div>

        {next_html}

        <p style="color:#475569;">
            You can log in to your patient portal to request a new appointment at your convenience.
        </p>
        <div style="text-align:center;margin:24px 0;">
            <a href="{settings.FRONTEND_URL}/patient/appointments"
               style="background:#1a3c5e;color:white;padding:14px 32px;border-radius:8px;
                      text-decoration:none;font-weight:600;display:inline-block;">
                Request New Appointment
            </a>
        </div>
        <p style="color:#94a3b8;font-size:11px;margin-top:24px;">
            This is an automated message from {settings.APP_NAME}. Do not reply to this email.
        </p>
    </div>
    </body></html>
    """
    return await send_email(to, subject, html)


async def send_appointment_email(
    to: str, patient_name: str, appointment_type: str,
    scheduled_at: str, status: str, doctor_name: str = ""
) -> bool:
    subject = f"{settings.APP_NAME} - Appointment {status.title()}"
    doctor_line = f"<p><strong>Doctor:</strong> Dr. {doctor_name}</p>" if doctor_name else ""
    html = f"""
    <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1a3c5e; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">PulmoScan AI</h1>
    </div>
    <div style="padding: 30px;">
        <h2>Dear {patient_name},</h2>
        <p>Your appointment has been <strong>{status}</strong>.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p><strong>Type:</strong> {appointment_type}</p>
            {doctor_line}
            <p><strong>Date &amp; Time:</strong> {scheduled_at}</p>
        </div>
        <p>Please arrive 10 minutes early. Log in to your portal to view details.</p>
        <a href="{settings.FRONTEND_URL}/patient/appointments"
           style="display:inline-block; background:#1a3c5e; color:white; padding:12px 24px;
                  border-radius:6px; text-decoration:none; margin-top:10px;">
            View My Appointments
        </a>
        <p style="color:#64748b; font-size:12px; margin-top:30px;">
            This is an automated message from {settings.APP_NAME}.
        </p>
    </div>
    </body></html>
    """
    return await send_email(to, subject, html)
