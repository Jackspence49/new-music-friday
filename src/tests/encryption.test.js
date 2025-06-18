import { expect } from 'chai';
import { Encryption, encryption } from '../utils/encryption.js';
import { ENCRYPTION_CONFIG } from '../config/encryption.js';

describe('Encryption', () => {
  describe('generateSalt', () => {
    it('should generate a salt of correct length', () => {
      const salt = Encryption.generateSalt();
      expect(salt).to.be.instanceof(Buffer);
      expect(salt.length).to.equal(ENCRYPTION_CONFIG.saltLength);
    });

    it('should generate unique salts', () => {
      const salt1 = Encryption.generateSalt();
      const salt2 = Encryption.generateSalt();
      expect(salt1).to.not.deep.equal(salt2);
    });
  });

  describe('deriveKey', () => {
    it('should derive a key of correct length', () => {
      const salt = Encryption.generateSalt();
      const key = Encryption.deriveKey(salt);
      expect(key).to.be.instanceof(Buffer);
      expect(key.length).to.equal(ENCRYPTION_CONFIG.keyLength);
    });

    it('should derive the same key for the same salt', () => {
      const salt = Encryption.generateSalt();
      const key1 = Encryption.deriveKey(salt);
      const key2 = Encryption.deriveKey(salt);
      expect(key1).to.deep.equal(key2);
    });
  });

  describe('encrypt', () => {
    it('should encrypt a string', () => {
      const text = 'test string';
      const encrypted = encryption.encrypt(text);
      expect(encrypted).to.be.a('string');
      expect(encrypted).to.not.equal(text);
    });

    it('should throw error for non-string input', () => {
      expect(() => encryption.encrypt(123)).to.throw('Input must be a string');
      expect(() => encryption.encrypt({})).to.throw('Input must be a string');
      expect(() => encryption.encrypt(null)).to.throw('Input must be a string');
    });

    it('should produce different output for same input', () => {
      const text = 'test string';
      const encrypted1 = encryption.encrypt(text);
      const encrypted2 = encryption.encrypt(text);
      expect(encrypted1).to.not.equal(encrypted2);
    });
  });

  describe('decrypt', () => {
    it('should decrypt an encrypted string', () => {
      const original = 'test string';
      const encrypted = encryption.encrypt(original);
      const decrypted = encryption.decrypt(encrypted);
      expect(decrypted).to.equal(original);
    });

    it('should throw error for invalid encrypted data', () => {
      expect(() => encryption.decrypt('invalid')).to.throw('Decryption failed');
    });

    it('should throw error for non-string input', () => {
      expect(() => encryption.decrypt(123)).to.throw('Input must be a string');
      expect(() => encryption.decrypt({})).to.throw('Input must be a string');
      expect(() => encryption.decrypt(null)).to.throw('Input must be a string');
    });
  });

  describe('validateEncryptedData', () => {
    it('should validate correctly encrypted data', () => {
      const text = 'test string';
      const encrypted = encryption.encrypt(text);
      expect(encryption.validateEncryptedData(encrypted)).to.be.true;
    });

    it('should reject invalid encrypted data', () => {
      expect(encryption.validateEncryptedData('invalid')).to.be.false;
      expect(encryption.validateEncryptedData('')).to.be.false;
      expect(encryption.validateEncryptedData(null)).to.be.false;
    });
  });

  describe('end-to-end', () => {
    it('should handle various string lengths', () => {
      const testStrings = [
        '',                    // empty string
        'a',                   // single character
        'test',               // short string
        'Hello, World!',      // medium string
        'a'.repeat(1000),     // long string
        'Special chars: !@#$%^&*()', // special characters
        'Unicode: 你好世界',    // unicode characters
        'Mixed: 123!@#你好'     // mixed content
      ];

      testStrings.forEach(str => {
        const encrypted = encryption.encrypt(str);
        const decrypted = encryption.decrypt(encrypted);
        expect(decrypted).to.equal(str);
      });
    });
  });
}); 