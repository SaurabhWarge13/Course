import { isFiniteNumber, isNonEmptyString, isRecord } from '../../shared/guards';
import type { Session, User } from './types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_PASSWORD_LENGTH = 128;

export type LoginFieldErrors = {
  email?: string;
  password?: string;
};

// Login only rejects impossible input; the server decides whether a password is correct.
export function validateLogin(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  const trimmedEmail = email.trim();
  if (trimmedEmail.length === 0) {
    errors.email = 'Email is required';
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = 'Enter a valid email address';
  }
  if (password.length === 0) {
    errors.password = 'Password is required';
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.password = `Password must be at most ${MAX_PASSWORD_LENGTH} characters`;
  }
  return errors;
}

export function isValidSession(value: unknown): value is Session {
  return (
    isRecord(value) &&
    isNonEmptyString(value.userId) &&
    isNonEmptyString(value.accessToken) &&
    isNonEmptyString(value.refreshToken) &&
    isFiniteNumber(value.accessTokenExpiresAt)
  );
}

export function isValidUser(value: unknown): value is User {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.email) &&
    typeof value.name === 'string'
  );
}
