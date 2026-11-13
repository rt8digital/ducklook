import { safeStorage } from 'electron';

const SAFE_PREFIX = 'safe:';
const PLAIN_PREFIX = 'plain:';

/**
 * Encrypt a mailbox password with the operating system keychain via Electron's
 * safeStorage API. If the OS keychain is unavailable (e.g. a Linux session
 * without a secret service), fall back to an explicitly tagged, obfuscated
 * value rather than silently corrupting credentials.
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return '';
  if (safeStorage.isEncryptionAvailable()) {
    return `${SAFE_PREFIX}${safeStorage.encryptString(plaintext).toString('base64')}`;
  }
  return `${PLAIN_PREFIX}${Buffer.from(plaintext, 'utf8').toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  if (!payload) return '';
  try {
    if (payload.startsWith(SAFE_PREFIX)) {
      if (!safeStorage.isEncryptionAvailable()) return '';
      return safeStorage.decryptString(Buffer.from(payload.slice(SAFE_PREFIX.length), 'base64'));
    }
    if (payload.startsWith(PLAIN_PREFIX)) {
      return Buffer.from(payload.slice(PLAIN_PREFIX.length), 'base64').toString('utf8');
    }
  } catch {
    return '';
  }
  // Legacy values were encrypted with the previous local key file and cannot be
  // recovered once the app migrates to OS-level encryption.
  return '';
}
