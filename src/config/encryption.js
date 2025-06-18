import { config } from './config.js';

export const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32, // 256 bits
  ivLength: 16,  // 128 bits
  saltLength: 64, // 512 bits
  tagLength: 16,  // 128 bits
  iterations: 100000, // PBKDF2 iterations
  digest: 'sha256',
  encoding: 'utf8',
  keyDerivation: {
    algorithm: 'pbkdf2',
    iterations: 100000,
    digest: 'sha256'
  }
};

// Validate encryption key
if (!config.security.encryptionKey || config.security.encryptionKey.length < 32) {
  throw new Error('ENCRYPTION_KEY environment variable must be set and be at least 32 characters long');
}

export const ENCRYPTION_KEY = config.security.encryptionKey; 