import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { Logger } from '@nestjs/common';

/**
 * Shared AES-256-GCM helper for encrypting credential VALUES (WhatsApp
 * access tokens, Facebook/Instagram page tokens, AI provider API keys, etc.)
 * before they're stored in SystemSetting / WaPhoneNumber / SocialPageAccount
 * rows, which today hold them as plain text.
 *
 * NOTE ON PRIOR ART: this was built expecting to copy an existing encryption
 * pattern from google-contacts.service.ts, since that file's own comment
 * block claims parity with "WhatsApp/Facebook credentials" precedent — but
 * reading it shows it stores its OAuth tokens as plain text too (see its
 * GOOGLE_KEYS comment: "Same plain-text-in-SystemSetting precedent... rather
 * than introducing the first encryption-at-rest subsystem in this codebase
 * for this credential alone."). There is no existing encryption-at-rest
 * subsystem anywhere in this backend to match — this is a from-scratch
 * design (AES-256-GCM: authenticated encryption, the standard modern
 * symmetric choice; the auth tag also means a corrupted/tampered stored
 * value fails decryption loudly instead of silently returning garbage).
 *
 * Format written by encrypt(): `enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`.
 * The "enc:v1:" prefix lets decrypt() cheaply recognize an already-encrypted
 * value without needing to attempt-and-catch a decrypt on every legacy
 * plaintext row — a bare access token / API key never legitimately starts
 * with this prefix, so the check is safe.
 *
 * Key: read from CREDENTIALS_ENCRYPTION_KEY (any string; use a long random
 * one in production) and passed through SHA-256 to always yield a 32-byte
 * AES-256 key regardless of the input string's length — same "paste a
 * strong secret string, any length" ergonomics as JWT_SECRET /
 * STOREFRONT_JWT_SECRET already used in this codebase, rather than
 * requiring an exact hex-encoded byte count.
 *
 * THE BACKWARD-COMPATIBILITY CONTRACT (read this before touching decrypt()):
 * every credential currently live in the database was written before this
 * helper existed, so it is plain text, not encrypt()'s format. decrypt()
 * MUST return such values unchanged rather than throwing — see its own
 * comment below. This is what makes the rollout safe with no migration
 * script: old rows keep working forever until the next time they're saved
 * through the normal "save credentials" path, which encrypts them.
 */

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1:';
const IV_LENGTH = 12; // 96-bit IV — the GCM-recommended size

const logger = new Logger('CredentialEncryption');
let warnedMissingKey = false;

function getKey(): Buffer | null {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    if (!warnedMissingKey) {
      logger.warn(
        'CREDENTIALS_ENCRYPTION_KEY is not set — credential values (WhatsApp/Facebook/AI provider ' +
        'keys) will be stored and read as PLAIN TEXT. Set this env var to enable encryption at rest.',
      );
      warnedMissingKey = true;
    }
    return null;
  }
  return createHash('sha256').update(raw, 'utf8').digest(); // always 32 bytes, regardless of input length
}

/** True if `value` looks like something encrypt() produced (cheap prefix check — no crypto attempted). */
export function isEncrypted(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * Encrypts plaintext for storage. If CREDENTIALS_ENCRYPTION_KEY isn't set,
 * returns the plaintext UNCHANGED (a warning is logged by getKey()) rather
 * than throwing — this keeps every "save credentials" action working on a
 * box that hasn't been configured with the key yet, consistent with the
 * read-side plaintext fallback in decrypt() below.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Decrypts a value produced by encrypt(). Every legacy plaintext value (no
 * "enc:v1:" prefix), and any value that carries the prefix but fails to
 * decrypt for any reason (missing/rotated key, corruption, truncation), is
 * returned AS-IS instead of throwing — so an old unencrypted credential, or
 * one this process temporarily can't decrypt, keeps working exactly like it
 * did before this helper existed. Callers should never need their own
 * try/catch around this — call it unconditionally on every DB-sourced
 * value before use.
 */
export function decrypt(value: string): string {
  if (!isEncrypted(value)) return value; // legacy plaintext — use as-is

  const key = getKey();
  if (!key) return value; // encrypted value but no key configured in this process — nothing we can do

  try {
    const rest = value.slice(PREFIX.length);
    const [ivB64, tagB64, dataB64] = rest.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
    return plaintext.toString('utf8');
  } catch (err) {
    logger.warn(`Failed to decrypt a stored credential value — falling back to the raw stored value: ${err instanceof Error ? err.message : err}`);
    return value;
  }
}
