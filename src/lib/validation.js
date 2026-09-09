/**
 * Shared client-side validation rules, kept in sync with the backend checks in
 * server/routes/auth.js so signup, login, and password reset behave the same.
 */

export const NAME_RE = /^[a-zA-Z\s-]+$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&-_])[A-Za-z\d@$!%*?&-_]{5,}$/;

export function validateFullName(value) {
  const v = (value ?? '').trim();
  if (!v) return 'Full name is required.';
  if (!NAME_RE.test(v)) return 'Name can only contain letters, spaces, and hyphens.';
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