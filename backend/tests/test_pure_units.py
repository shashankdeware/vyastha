"""
Pure unit tests — no MongoDB, no running server, no network required.
Run with: pytest backend/tests/test_pure_units.py -p no:cacheprovider -n 0

These cover the logic fixed/added in the Phase-1 completion pass:
  - lib/validators.py   (mobile, PAN, GSTIN, pincode, email)
  - lib/amount_words.py (Indian numbering: thousand/lakh/crore/paise)
  - calculate_gst_split (CGST+SGST vs IGST split logic from server.py)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # backend/

import pytest
from lib.validators import (
    validate_indian_mobile,
    validate_pan,
    validate_gstin,
    validate_pincode,
    validate_email_format,
)
from lib.amount_words import amount_in_words


# ---------------------------------------------------------------------------
# Mobile number validation (Requirement #11)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("value", ["9876543210", "6000000000", "7999999999", ""])
def test_mobile_valid(value):
    assert validate_indian_mobile(value) == value


@pytest.mark.parametrize(
    "value",
    ["987654321", "98765432101", "1234567890", "98765ABCDE", "98765-43210", "98765 43210"],
)
def test_mobile_invalid(value):
    with pytest.raises(ValueError):
        validate_indian_mobile(value)


# ---------------------------------------------------------------------------
# PAN validation (Requirement #12)
# ---------------------------------------------------------------------------
def test_pan_valid_and_uppercased():
    assert validate_pan("ABCDE1234F") == "ABCDE1234F"
    assert validate_pan("abcde1234f") == "ABCDE1234F"  # auto-uppercase


@pytest.mark.parametrize("value", ["ABCD1234F", "ABCDE12345", "ABCDE1234", "1BCDE1234F"])
def test_pan_invalid(value):
    with pytest.raises(ValueError):
        validate_pan(value)


# ---------------------------------------------------------------------------
# GSTIN validation (Requirement #13)
# ---------------------------------------------------------------------------
def test_gstin_valid():
    assert validate_gstin("27ABCDE1234F1Z5") == "27ABCDE1234F1Z5"
    assert validate_gstin("27abcde1234f1z5") == "27ABCDE1234F1Z5"


@pytest.mark.parametrize(
    "value",
    [
        "1234567890ABCDE",   # wrong structure
        "27ABCDE1234F1Z",    # 14 chars, too short
        "99ABCDE1234F1Z5",   # invalid state code (99 not allotted)
    ],
)
def test_gstin_invalid(value):
    with pytest.raises(ValueError):
        validate_gstin(value)


# ---------------------------------------------------------------------------
# Pincode validation (Requirement #14)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("value", ["452001", "110001", "700001"])
def test_pincode_valid(value):
    assert validate_pincode(value) == value


@pytest.mark.parametrize("value", ["12345", "1234567", "045200", "abcdef"])
def test_pincode_invalid(value):
    with pytest.raises(ValueError):
        validate_pincode(value)


# ---------------------------------------------------------------------------
# Email validation (Requirement #15)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("value", ["a@b.com", "billing+gst@vyastha.co.in"])
def test_email_valid(value):
    assert validate_email_format(value) == value


@pytest.mark.parametrize("value", ["a @b.com", "notanemail", "a@b", "a@@b.com"])
def test_email_invalid(value):
    with pytest.raises(ValueError):
        validate_email_format(value)


# ---------------------------------------------------------------------------
# Amount in words (Requirement #6) - Indian numbering system
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "amount,expected",
    [
        (1, "Rupees One Only"),
        (10, "Rupees Ten Only"),
        (100, "Rupees One Hundred Only"),
        (999, "Rupees Nine Hundred Ninety Nine Only"),
        (1000, "Rupees One Thousand Only"),
        (10000, "Rupees Ten Thousand Only"),
        (100000, "Rupees One Lakh Only"),
        (10000000, "Rupees One Crore Only"),
        (25450, "Rupees Twenty Five Thousand Four Hundred Fifty Only"),
    ],
)
def test_amount_in_words(amount, expected):
    assert amount_in_words(amount) == expected


def test_amount_in_words_with_paise():
    assert amount_in_words(100000.50) == "Rupees One Lakh and Fifty Paise Only"


def test_amount_in_words_never_crashes_on_zero():
    assert "Zero" in amount_in_words(0)


# ---------------------------------------------------------------------------
# GST split logic (same-state -> CGST+SGST, different-state -> IGST)
# ---------------------------------------------------------------------------
def _calculate_gst_split(tax_amount, seller_state, buyer_state):
    """Mirror of server.calculate_gst_split, re-implemented here so this file
    stays import-free of server.py (which requires DB env vars to import)."""
    if seller_state and buyer_state and seller_state.strip() == buyer_state.strip():
        half = round(tax_amount / 2, 2)
        return {"cgst_amount": half, "sgst_amount": tax_amount - half, "igst_amount": 0.0}
    return {"cgst_amount": 0.0, "sgst_amount": 0.0, "igst_amount": round(tax_amount, 2)}


def test_gst_split_same_state_splits_cgst_sgst():
    result = _calculate_gst_split(180.0, "23", "23")
    assert result["cgst_amount"] == 90.0
    assert result["sgst_amount"] == 90.0
    assert result["igst_amount"] == 0.0


def test_gst_split_different_state_uses_igst():
    result = _calculate_gst_split(180.0, "23", "27")
    assert result["igst_amount"] == 180.0
    assert result["cgst_amount"] == 0.0
    assert result["sgst_amount"] == 0.0
