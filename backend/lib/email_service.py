"""
Email delivery service for Vyastha.

Uses Python's built-in smtplib/email libraries so no new dependency is
required. Reads SMTP configuration from environment variables so the
existing Vyastha deployment/config pattern (.env) is reused as-is.

Required environment variables (set these in backend/.env to enable
email sending):

    SMTP_HOST          e.g. "smtp.gmail.com" or "smtp.sendgrid.net"
    SMTP_PORT          e.g. "587" (STARTTLS) or "465" (SSL)
    SMTP_USER          SMTP auth username (often the sender email or API key id)
    SMTP_PASSWORD      SMTP auth password / API key
    SMTP_FROM_EMAIL    the "From" address shown to recipients
    SMTP_FROM_NAME     (optional) display name, e.g. "Vyastha Billing"
    SMTP_USE_SSL       (optional) "true" to use implicit SSL on connect instead of STARTTLS

If these are not configured, `is_configured()` returns False and callers
must surface a clear error to the user instead of pretending to succeed.
"""
import os
import base64
import smtplib
import logging
from email.message import EmailMessage
from email.utils import formataddr

logger = logging.getLogger(__name__)


class EmailNotConfiguredError(Exception):
    """Raised when SMTP settings are missing so callers can show a clear message."""
    pass


class EmailSendError(Exception):
    """Raised when the SMTP server rejects or fails to send the message."""
    pass


def is_configured() -> bool:
    return bool(
        os.environ.get("SMTP_HOST")
        and os.environ.get("SMTP_USER")
        and os.environ.get("SMTP_PASSWORD")
        and os.environ.get("SMTP_FROM_EMAIL")
    )


def send_email_with_pdf(
    to_email: str,
    subject: str,
    body_text: str,
    pdf_base64: str,
    attachment_filename: str,
) -> None:
    """
    Send an email with a PDF attachment.

    pdf_base64 may optionally include a data-URI prefix
    (e.g. "data:application/pdf;base64,...."), which is stripped automatically.

    Raises EmailNotConfiguredError or EmailSendError on failure.
    Never fails silently - callers should catch these and report to the user.
    """
    if not is_configured():
        raise EmailNotConfiguredError(
            "Email sending is not configured. Set SMTP_HOST, SMTP_USER, "
            "SMTP_PASSWORD and SMTP_FROM_EMAIL in the backend environment."
        )

    host = os.environ.get("SMTP_HOST")
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD")
    from_email = os.environ.get("SMTP_FROM_EMAIL")
    from_name = os.environ.get("SMTP_FROM_NAME", "Vyastha Billing")
    use_ssl = os.environ.get("SMTP_USE_SSL", "false").strip().lower() == "true"

    # Strip data-URI prefix if the frontend sent one
    if "," in pdf_base64 and pdf_base64.strip().lower().startswith("data:"):
        pdf_base64 = pdf_base64.split(",", 1)[1]

    try:
        pdf_bytes = base64.b64decode(pdf_base64, validate=True)
    except Exception as exc:
        raise EmailSendError(f"Invalid PDF data: {exc}") from exc

    if not pdf_bytes:
        raise EmailSendError("Generated PDF was empty.")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((from_name, from_email))
    msg["To"] = to_email
    msg.set_content(body_text)
    msg.add_attachment(
        pdf_bytes,
        maintype="application",
        subtype="pdf",
        filename=attachment_filename,
    )

    try:
        if use_ssl:
            with smtplib.SMTP_SSL(host, port, timeout=20) as server:
                server.login(user, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=20) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(user, password)
                server.send_message(msg)
    except smtplib.SMTPAuthenticationError as exc:
        logger.error(f"SMTP auth failed: {exc}")
        raise EmailSendError("Email server rejected the sender credentials.") from exc
    except (smtplib.SMTPException, OSError) as exc:
        logger.error(f"SMTP send failed: {exc}")
        raise EmailSendError(f"Failed to send email: {exc}") from exc
