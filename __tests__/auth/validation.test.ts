import {
  isValidSession,
  isValidUser,
  validateLogin,
} from '../../src/domain/auth/validation';
import { alice, sessionFor } from '../fakes/fixtures';

describe('validateLogin', () => {
  it('rejects an empty email and password', () => {
    expect(validateLogin('', '')).toEqual({
      email: 'Email is required',
      password: 'Password is required',
    });
  });

  it('rejects a malformed email', () => {
    expect(validateLogin('not-an-email', 'Password@123').email).toBe('Enter a valid email address');
  });

  it('accepts any non-empty password up to 128 characters and rejects longer ones', () => {
    expect(validateLogin('a@b.co', 'x')).toEqual({});
    expect(validateLogin('a@b.co', 'a'.repeat(128))).toEqual({});
    expect(validateLogin('a@b.co', 'a'.repeat(129)).password).toBe(
      'Password must be at most 128 characters',
    );
  });

  it('accepts valid input', () => {
    expect(validateLogin('  a@b.co ', 'Password@123')).toEqual({});
  });
});

describe('session and profile guards', () => {
  it('accepts a complete session', () => {
    expect(isValidSession(sessionFor(alice))).toBe(true);
  });

  it('rejects sessions with missing or non-finite fields', () => {
    expect(isValidSession({ ...sessionFor(alice), refreshToken: '' })).toBe(false);
    expect(isValidSession({ ...sessionFor(alice), accessTokenExpiresAt: Number.NaN })).toBe(false);
    expect(isValidSession({ ...sessionFor(alice), userId: undefined })).toBe(false);
    expect(isValidSession('garbage')).toBe(false);
  });

  it('validates users', () => {
    expect(isValidUser(alice)).toBe(true);
    expect(isValidUser({ id: '', email: 'x@y.z', name: 'X' })).toBe(false);
    expect(isValidUser(null)).toBe(false);
  });
});
