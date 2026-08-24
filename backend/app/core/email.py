import smtplib
import logging
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_admin_payment_notification(consultation_id: int, patient_name: str) -> bool:
    subject = f"Verifikasi Pembayaran Diperlukan - Konsultasi #{consultation_id}"
    body = (
        f"Pasien {patient_name} telah mengunggah bukti pembayaran untuk konsultasi #{consultation_id}.\n\n"
        f"Silakan masuk ke panel admin untuk memverifikasi pembayaran."
    )

    message = MIMEText(body, "plain")
    message["Subject"] = subject
    message["From"] = settings.smtp_from_email
    message["To"] = settings.admin_notification_email

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.starttls()
            server.login(settings.smtp_username, settings.smtp_password)
            server.sendmail(settings.smtp_username, [settings.admin_notification_email], message.as_string())
        return True
    except Exception:
        logger.exception(f"Failed to send admin notification email for consultation {consultation_id}")
        return False