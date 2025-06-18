import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-fallback-encryption-key-min-32-chars!!'; // Must be 32 bytes
const IV_LENGTH = 16; // For AES, this is always 16

// Ensure the key is exactly 32 bytes
const getKey = () => {
  // If the key is a hex string, decode it
  const key = ENCRYPTION_KEY.length === 64 
    ? Buffer.from(ENCRYPTION_KEY, 'hex')
    : Buffer.from(ENCRYPTION_KEY);
    
  if (key.length !== 32) {
    throw new Error(`Encryption key must be exactly 32 bytes, got ${key.length} bytes`);
  }
  return key;
};

export class Encryption {
  static encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  static decrypt(text) {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }
} 