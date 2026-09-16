// Shared validation helpers for Indian business fields.
// Mirrors backend/lib/validators.py — frontend gives instant feedback,
// backend is the enforced source of truth (never rely on this alone).

export const MOBILE_RE = /^[6-9]\d{9}$/;
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PINCODE_RE = /^[1-9][0-9]{5}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_GST_STATE_CODES = new Set(
  Array.from({ length: 38 }, (_, i) => String(i + 1).padStart(2, '0'))
);

// Each validator returns '' when valid, or a user-facing error message.
// Empty string input is treated as "not provided" (valid) - required-ness
// is a separate concern handled by the calling form.

export function validateMobile(value) {
  const v = (value || '').trim();
  if (!v) return '';
  if (!MOBILE_RE.test(v)) {
    return 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.';
  }
  return '';
}

export function validatePAN(value) {
  const v = (value || '').trim().toUpperCase();
  if (!v) return '';
  if (!PAN_RE.test(v)) {
    return 'Enter a valid PAN in the format ABCDE1234F.';
  }
  return '';
}

export function validateGSTIN(value) {
  const v = (value || '').trim().toUpperCase();
  if (!v) return '';
  if (v.length !== 15) return 'GSTIN must be exactly 15 characters.';
  if (!GSTIN_RE.test(v)) return 'Enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5).';
  if (!VALID_GST_STATE_CODES.has(v.slice(0, 2))) {
    return 'GSTIN state code (first 2 digits) is not a recognised Indian state/UT code.';
  }
  return '';
}

export function validatePincode(value) {
  const v = (value || '').trim();
  if (!v) return '';
  if (!PINCODE_RE.test(v)) return 'Enter a valid 6-digit Indian PIN code.';
  return '';
}

export function validateEmailFormat(value) {
  const v = (value || '').trim();
  if (!v) return '';
  if (/\s/.test(v)) return 'Email address cannot contain spaces.';
  if (v.length > 254) return 'Email address is too long.';
  if (!EMAIL_RE.test(v)) return 'Enter a valid email address.';
  return '';
}

// Normalizes-on-blur helpers (auto-uppercase PAN/GSTIN as the user types,
// matching the backend which always uppercases before validating).
export const toUpperTrim = (value) => (value || '').toUpperCase();

/**
 * Validate a set of {field: value} pairs against a {field: validatorFn} map.
 * Returns { errors: {field: message}, isValid: boolean }.
 */
export function validateFields(values, validators) {
  const errors = {};
  Object.keys(validators).forEach((field) => {
    const msg = validators[field](values[field]);
    if (msg) errors[field] = msg;
  });
  return { errors, isValid: Object.keys(errors).length === 0 };
}
