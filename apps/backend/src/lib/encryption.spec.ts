import { describe, it, expect, beforeEach } from 'vitest';
import { EncryptionService } from './encryption.js';

describe('EncryptionService', () => {
  const validKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  let service: EncryptionService;

  beforeEach(() => {
    service = new EncryptionService(validKey);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should throw if ENCRYPTION_KEY is missing', () => {
      expect(() => new EncryptionService('')).toThrow(
        'ENCRYPTION_KEY must be a 64-character hex string',
      );
    });

    it('should throw if ENCRYPTION_KEY is too short', () => {
      expect(() => new EncryptionService('tooshort')).toThrow(
        'ENCRYPTION_KEY must be a 64-character hex string',
      );
    });
  });

  describe('encrypt / decrypt', () => {
    it('should encrypt and decrypt a simple string', () => {
      const plaintext = 'Hello, World!';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt an empty string', () => {
      const plaintext = '';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt unicode text', () => {
      const plaintext = 'Sensitive PII: Jose Garcia, Date: 01/15/1990';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt a long string', () => {
      const plaintext = 'A'.repeat(10000);
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for the same plaintext', () => {
      const plaintext = 'Same input';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);
      expect(encrypted1).not.toBe(encrypted2);
      expect(service.decrypt(encrypted1)).toBe(plaintext);
      expect(service.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should produce output in iv:authTag:ciphertext format', () => {
      const encrypted = service.encrypt('test');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toMatch(/^[0-9a-f]{32}$/);
      expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
      expect(parts[2]).toMatch(/^[0-9a-f]+$/);
    });

    it('should throw on tampered ciphertext', () => {
      const encrypted = service.encrypt('sensitive data');
      const parts = encrypted.split(':');
      const tampered = `${parts[0]}:${parts[1]}:ff${parts[2].slice(2)}`;
      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('should throw on tampered auth tag', () => {
      const encrypted = service.encrypt('sensitive data');
      const parts = encrypted.split(':');
      const tampered = `${parts[0]}:${'0'.repeat(32)}:${parts[2]}`;
      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('should throw on invalid format (no colons)', () => {
      expect(() => service.decrypt('invalidformat')).toThrow('Invalid encrypted text format');
    });

    it('should throw on invalid format (wrong number of parts)', () => {
      expect(() => service.decrypt('a:b')).toThrow('Invalid encrypted text format');
    });
  });

  describe('hash', () => {
    it('should produce a hex SHA-256 hash', () => {
      const hash = service.hash('test');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce consistent hashes for the same input', () => {
      expect(service.hash('same input')).toBe(service.hash('same input'));
    });

    it('should produce different hashes for different inputs', () => {
      expect(service.hash('input1')).not.toBe(service.hash('input2'));
    });
  });

  describe('generateToken', () => {
    it('should generate a URL-safe base64 token', () => {
      const token = service.generateToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate tokens of expected length', () => {
      const token = service.generateToken(64);
      expect(token.length).toBeGreaterThan(80);
    });

    it('should generate unique tokens', () => {
      expect(service.generateToken()).not.toBe(service.generateToken());
    });

    it('should respect custom byte length', () => {
      const shortToken = service.generateToken(16);
      const longToken = service.generateToken(128);
      expect(longToken.length).toBeGreaterThan(shortToken.length);
    });
  });
});
