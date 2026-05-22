import * as crypto from 'node:crypto';

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm' as const;
  private readonly key: Buffer;

  constructor(encryptionKeyHex: string) {
    if (!encryptionKeyHex || encryptionKeyHex.length < 64) {
      throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }
    this.key = Buffer.from(encryptionKeyHex, 'hex');
  }

  /** Encrypt plaintext with AES-256-GCM. Returns iv:authTag:ciphertext (hex). */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /** Decrypt a string previously encrypted with encrypt(). */
  decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format. Expected iv:authTag:ciphertext');
    }
    const [ivHex, authTagHex, ciphertext] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /** SHA-256 hash for indexable lookups. */
  hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * HMAC-based blind index for encrypted search.
   * Generates deterministic tokens from plaintext that can be indexed and searched
   * without revealing the original value. Uses the encryption key as HMAC secret.
   *
   * Returns space-separated HMAC tokens for each word + the full phrase.
   * Enables partial matching by searching for any token match.
   */
  blindIndex(plaintext: string): string {
    const normalized = plaintext.toLowerCase().trim();
    const words = normalized.split(/\s+/).filter(Boolean);
    const tokens = [
      // Full phrase token
      this.hmacToken(normalized),
      // Individual word tokens
      ...words.map((w) => this.hmacToken(w)),
      // Progressive prefix tokens (1-char through 5-char) for typeahead search
      ...words.flatMap((w) =>
        Array.from({ length: Math.min(w.length, 5) }, (_, i) => this.hmacToken(w.slice(0, i + 1))),
      ),
    ];
    return [...new Set(tokens)].join(' ');
  }

  private hmacToken(value: string): string {
    return crypto.createHmac('sha256', this.key).update(value).digest('hex').slice(0, 16);
  }

  /** Cryptographically secure random token (URL-safe base64). */
  generateToken(bytes: number = 64): string {
    return crypto.randomBytes(bytes).toString('base64url');
  }
}
