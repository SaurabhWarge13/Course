import * as Keychain from 'react-native-keychain';
import { isValidSession } from '../../domain/auth/validation';
import { parseJsonSafely } from '../../shared/guards';
import type { TokenStorage } from './TokenStorage';

export function createKeychainTokenStorage(service: string): TokenStorage {
  return {
    async load() {
      let credentials: false | Keychain.UserCredentials;
      try {
        credentials = await Keychain.getGenericPassword({ service });
      } catch (cause) {
        return { kind: 'error', cause };
      }
      if (!credentials) {
        return { kind: 'none' };
      }
      const parsed = parseJsonSafely(credentials.password);
      return isValidSession(parsed) ? { kind: 'session', session: parsed } : { kind: 'malformed' };
    },
    async save(session) {
      const result = await Keychain.setGenericPassword(session.userId, JSON.stringify(session), {
        service,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      if (!result) {
        throw new Error('Keychain rejected the session write');
      }
    },
    async clear() {
      await Keychain.resetGenericPassword({ service });
    },
  };
}
