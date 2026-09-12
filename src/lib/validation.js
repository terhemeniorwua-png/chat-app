/**
 * Shared client-side validation rules, kept in sync with the backend checks in
 * server/routes/auth.js so signup, login, and password reset behave the same.
 */

export const NAME_RE = /^[a-zA-Z\s-]+$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^\+?[0-9][0-9\s()\-]{6,19}$/;
export const USERNAME_RE = /^[a-z0-9_.]{3,30}$/;
export const PASSWORD_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&-_])[A-Za-z\d@$!%*?&-_]{5,}$/;

export function validateFullName(value) {
  const v = (value ?? '').trim();
  if (!v) return 'Full name is required.';
  if (!NAME_RE.test(v)) return 'Name can only contain letters, spaces, and hyphens.';
  return '';
}

export function validatePhoneNumber(value) {
  const v = (value ?? '').trim();
  if (!v) return 'Phone number is required.';
  if (!PHONE_RE.test(v)) return 'Please enter a valid phone number.';
  return '';
}

export function validateUsername(value) {
  const v = (value ?? '').trim();
  if (!v) return 'Username is required.';
  if (!USERNAME_RE.test(v.toLowerCase())) {
    return 'Username must be 3-30 characters: letters, numbers, underscore, dot.';
  }
  return '';
}

export function validateEmail(value) {
  const v = (value ?? '').trim();
  if (!v) return 'Email is required.';
  if (!EMAIL_RE.test(v)) return 'Please enter a valid email address.';
  return '';
}

export function validatePassword(value) {
  const v = value ?? '';
  if (!v) return 'Password is required.';
  if (v.length < 5) return 'Password must be at least 5 characters long.';
  if (!PASSWORD_RE.test(v)) {
    return 'Password must include an uppercase letter, a lowercase letter, a number, and a special character.';
  }
  return '';
}