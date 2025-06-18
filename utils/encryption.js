import crypto from 'crypto';
import { ENCRYPTION_CONFIG, ENCRYPTION_KEY } from '../config/encryption.js';

class EncryptionError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'EncryptionError';
    this.originalError = originalError;
  }
}

export class Encryption {
  static generateSalt() {
    return crypto.randomBytes(ENCRYPTION_CONFIG.saltLength);
  }

  static deriveKey(salt) {
    return crypto.pbkdf2Sync(
      ENCRYPTION_KEY,
      salt,
      ENCRYPTION_CONFIG.keyDerivation.iterations,
      ENCRYPTION_CONFIG.keyLength,
      ENCRYPTION_CONFIG.keyDerivation.digest
    );
  }

  static encrypt(text) {
    try {
      if (typeof text !== 'string') {
        throw new EncryptionError('Input must be a string');
      }

      // Generate random salt and IV
      const salt = this.generateSalt();
      const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
      
      // Derive key using salt
      const key = this.deriveKey(salt);
      
      // Create cipher
      const cipher = crypto.createCipheriv(
        ENCRYPTION_CONFIG.algorithm,
        key,
        iv
      );
      
      // Encrypt the text
      const encrypted = Buffer.concat([
        cipher.update(text, ENCRYPTION_CONFIG.encoding),
        cipher.final()
      ]);
      
      // Get auth tag
      const tag = cipher.getAuthTag();
      
      // Combine all components
      const result = Buffer.concat([salt, iv, tag, encrypted]);
      
      return result.toString('base64');
    } catch (error) {
      if (error instanceof EncryptionError) {
        throw error;
      }
      throw new EncryptionError('Encryption failed', error);
    }
  }

  static decrypt(encryptedData) {
    try {
      if (typeof encryptedData !== 'string') {
        throw new EncryptionError('Input must be a string');
      }

      const buffer = Buffer.from(encryptedData, 'base64');
      
      // Validate buffer length
      const minLength = ENCRYPTION_CONFIG.saltLength + 
                       ENCRYPTION_CONFIG.ivLength + 
                       ENCRYPTION_CONFIG.tagLength;
      
      if (buffer.length < minLength) {
        throw new EncryptionError('Invalid encrypted data length');
      }
      
      // Extract components
      const salt = buffer.slice(0, ENCRYPTION_CONFIG.saltLength);
      const iv = buffer.slice(
        ENCRYPTION_CONFIG.saltLength,
        ENCRYPTION_CONFIG.saltLength + ENCRYPTION_CONFIG.ivLength
      );
      const tag = buffer.slice(
        ENCRYPTION_CONFIG.saltLength + ENCRYPTION_CONFIG.ivLength,
        ENCRYPTION_CONFIG.saltLength + ENCRYPTION_CONFIG.ivLength + ENCRYPTION_CONFIG.tagLength
      );
      const encrypted = buffer.slice(
        ENCRYPTION_CONFIG.saltLength + ENCRYPTION_CONFIG.ivLength + ENCRYPTION_CONFIG.tagLength
      );
      
      // Recreate key using salt
      const key = this.deriveKey(salt);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(
        ENCRYPTION_CONFIG.algorithm,
        key,
        iv
      );
      decipher.setAuthTag(tag);
      
      // Decrypt
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return decrypted.toString(ENCRYPTION_CONFIG.encoding);
    } catch (error) {
      if (error instanceof EncryptionError) {
        throw error;
      }
      throw new EncryptionError('Decryption failed', error);
    }
  }

  static validateEncryptedData(encryptedData) {
    try {
      const buffer = Buffer.from(encryptedData, 'base64');
      const minLength = ENCRYPTION_CONFIG.saltLength + 
                       ENCRYPTION_CONFIG.ivLength + 
                       ENCRYPTION_CONFIG.tagLength;
      
      return buffer.length >= minLength;
    } catch {
      return false;
    }
  }
}

export const encryption = new Encryption(); 