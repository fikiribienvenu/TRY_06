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
    to: str, patient_name: str, prediction: str, confidence: float
) -> bool:
    subject = f"{settings.APP_NAME} - Your CT Scan Report is Ready"
    html = f"""
    <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1a3c5e; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">PulmoScan AI</h1>
    </div>
    <div style="padding: 30px; background: #f8fafc;">
        <h2>Dear {patient_name},</h2>
        <p>Your CT scan report has been reviewed and approved by our medical team.</p>
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p><strong>Finding:</strong> {prediction}</p>
            <p><strong>Confidence Score:</strong> {confidence:.1f}%</p>
        </div>
        <p>Please log in to your patient portal to view the complete report and recommendations.</p>
        <a href="{settings.FRONTEND_URL}/patient/reports"
           style="display:inline-block; background:#1a3c5e; color:white; padding:12px 24px;
                  border-radius:6px; text-decoration:none; margin-top:10px;">
            View Full Report
        </a>
    </div>
    </body></html>
    """
    return await send_email(to, subject, html)


async def send_appointment_email(
    to: str, patient_name: str, appointment_type: str,
    scheduled_at: str, status: str
) -> bool:
    subject = f"{settings.APP_NAME} - Appointment {status.title()}"
    html = f"""
    <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1a3c5e; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">PulmoScan AI</h1>
    </div>
    <div style="padding: 30px;">
        <h2>Dear {patient_name},</h2>
        <p>Your appointment has been <strong>{status}</strong>.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p><strong>Type:</strong> {appointment_type.replace('_', ' ').title()}</p>
            <p><strong>Date/Time:</strong> {scheduled_at}</p>
        </div>
        <p>Log in to manage your appointments.</p>
    </div>
    </body></html>
    """
    return await send_email(to, subject, html)
