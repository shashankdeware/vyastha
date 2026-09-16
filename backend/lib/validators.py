"""
Production-grade validation helpers for Indian business fields.
Used by Pydantic models in server.py to enforce backend validation
(frontend validation must never be the only line of defence).
"""
import re

# GSTIN state codes 01-38 (as allotted by the Indian government)
VALID_GST_STATE_CODES = {f"{i:02d}" for i in range(1, 39)}

MOBILE_RE = re.compile(r"^[6-9]\d{9}$")
PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
PINCODE_RE = re.compile(r"^[1-9][0-9]{5}$")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

MAX_EMAIL_LENGTH = 254


def validate_indian_mobile(value: str) -> str:
    """Exactly 10 digits, starting with 6-9. Raises ValueError if invalid."""
    v = (value or "").strip()
    if not v:
        return v
    if not MOBILE_RE.match(v):
        raise ValueError(
            "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9 (digits only)."
        )
    return v


def validate_pan(value: str) -> str:
    """Format ABCDE1234F. Auto-uppercases before validating."""
    v = (value or "").strip().upper()
    if not v:
        return v
    if not PAN_RE.match(v):
        raise ValueError("Enter a valid PAN in the format ABCDE1234F.")
    return v


def validate_gstin(value: str) -> str:
    """15-char Indian GSTIN structure with state-code sanity check."""
    v = (value or "").strip().upper()
    if not v:
        return v
    if len(v) != 15:
        raise ValueError("GSTIN must be exactly 15 characters.")
    if not GSTIN_RE.match(v):
        raise ValueError(
            "Enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5)."
        )
    if v[:2] not in VALID_GST_STATE_CODES:
        raise ValueError("GSTIN state code (first 2 digits) is not a recognised Indian state/UT code.")
    return v


def validate_pincode(value: str) -> str:
    """Exactly 6 digits, cannot start with 0."""
    v = (value or "").strip()
    if not v:
        return v
    if not PINCODE_RE.match(v):
        raise ValueError("Enter a valid 6-digit Indian PIN code.")
    return v


def validate_email_format(value: str, max_length: int = MAX_EMAIL_LENGTH) -> str:
    v = (value or "").strip()
    if not v:
        return v
    if " " in v:
        raise ValueError("Email address cannot contain spaces.")
    if len(v) > max_length:
        raise ValueError(f"Email address is too long (max {max_length} characters).")
    if not EMAIL_RE.match(v):
        raise ValueError("Enter a valid email address.")
    return v
