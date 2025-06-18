import mysql from 'mysql2/promise';
import { config } from '../config/config.js';
import { Encryption } from '../utils/encryption.js';

class User {
  constructor() {
    // Create pool with explicit database selection
    this.pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.name,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test the connection
    this.testConnection();
  }

  async testConnection() {
    try {
      const connection = await this.pool.getConnection();
      console.log('Database connection successful');
      connection.release();
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  async createTable() {
    const connection = await this.pool.getConnection();
    try {
      // First, check the existing table structure
      const [columns] = await connection.execute('SHOW COLUMNS FROM users');
      console.log('Existing table structure:', columns.map(col => col.Field).join(', '));

      // Check if we need to add the spotify_id column
      const hasSpotifyId = columns.some(col => col.Field === 'spotify_user_id');
      
      if (!hasSpotifyId) {
        console.log('Adding spotify_user_id column...');
        await connection.execute(`
          ALTER TABLE users 
          ADD COLUMN spotify_user_id VARCHAR(255) UNIQUE,
          ADD COLUMN access_token TEXT,
          ADD COLUMN refresh_token TEXT,
          ADD COLUMN token_expiry_time DATETIME,
          ADD COLUMN email VARCHAR(255) UNIQUE
        `);
        console.log('Table structure updated successfully');
      } else {
        console.log('Table structure is up to date');
      }
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        console.log('Creating users table...');
        await connection.execute(`
          CREATE TABLE users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            spotify_user_id VARCHAR(255) NOT NULL UNIQUE,
            access_token TEXT NOT NULL,
            refresh_token TEXT NOT NULL,
            token_expiry_time DATETIME NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);
        console.log('Users table created successfully');
      } else {
        throw error;
      }
    } finally {
      connection.release();
    }
  }

  async createOrUpdate(spotifyId, email, refreshToken, tokenExpiresAt = null, accessToken = null) {
    const connection = await this.pool.getConnection();
    try {
      const encryptedToken = Encryption.encrypt(refreshToken);
      
      await connection.execute(`
        INSERT INTO users (spotify_user_id, email, refresh_token, token_expiry_time, access_token)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          email = VALUES(email),
          refresh_token = VALUES(refresh_token),
          token_expiry_time = VALUES(token_expiry_time),
          access_token = VALUES(access_token),
          updated_at = CURRENT_TIMESTAMP
      `, [spotifyId, email, encryptedToken, tokenExpiresAt, accessToken]);
    } finally {
      connection.release();
    }
  }

  async findBySpotifyId(spotifyId) {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM users WHERE spotify_user_id = ?',
        [spotifyId]
      );
      
      if (rows.length === 0) {
        return null;
      }

      const user = rows[0];
      return {
        ...user,
        refreshToken: Encryption.decrypt(user.refresh_token)
      };
    } finally {
      connection.release();
    }
  }

  async updateTokenExpiry(spotifyId, expiresAt) {
    const connection = await this.pool.getConnection();
    try {
      await connection.execute(
        'UPDATE users SET token_expiry_time = ?, updated_at = CURRENT_TIMESTAMP WHERE spotify_user_id = ?',
        [expiresAt, spotifyId]
      );
    } finally {
      connection.release();
    }
  }
}

export const userModel = new User(); 