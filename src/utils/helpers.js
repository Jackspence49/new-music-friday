import crypto from 'crypto';
import { config } from '../config/config.js';

// Encrypt sensitive data
export const encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(config.security.encryptionKey), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
};

// Decrypt sensitive data
export const decrypt = (text) => {
  const iv = Buffer.from(text.iv, 'hex');
  const encryptedText = Buffer.from(text.encryptedData, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(config.security.encryptionKey), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};

// Format date to YYYY-MM-DD
export const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

// Generate a random string
export const generateRandomString = (length) => {
  return crypto.randomBytes(length).toString('hex');
}; 