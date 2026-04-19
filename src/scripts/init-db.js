import mysql from 'mysql2/promise';
import { config } from '../config/config.js';

const { host, port, user, password, name: dbName } = config.database;

async function setupDatabase() {
  // Connect without a database so we can create it
  const connection = await mysql.createConnection({ host, port, user, password });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`Database "${dbName}" ready.`);
    await connection.query(`USE \`${dbName}\``);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        spotify_user_id VARCHAR(255) NOT NULL UNIQUE,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        token_expiry_time DATETIME NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_spotify_user_id (spotify_user_id),
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('Table "users" ready.');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS monitored_playlists (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        spotify_playlist_id VARCHAR(255) NOT NULL,
        playlist_name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_playlist (user_id, spotify_playlist_id),
        INDEX idx_user_id (user_id),
        INDEX idx_spotify_playlist_id (spotify_playlist_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('Table "monitored_playlists" ready.');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS target_playlist (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        spotify_playlist_id VARCHAR(255) NOT NULL,
        playlist_name VARCHAR(255) NOT NULL,
        last_successful_run DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_target_playlist (user_id),
        INDEX idx_user_id (user_id),
        INDEX idx_spotify_playlist_id (spotify_playlist_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('Table "target_playlist" ready.');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS top_artists (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        spotify_artist_id VARCHAR(255) NOT NULL,
        artist_name VARCHAR(255) NOT NULL,
        genres TEXT,
        popularity INT,
        \`rank\` INT NOT NULL,
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_artist (user_id, spotify_artist_id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('Table "top_artists" ready.');

    console.log('Database setup complete.');
  } finally {
    await connection.end();
  }
}

setupDatabase().catch((err) => {
  console.error('Database setup failed:', err);
  process.exit(1);
});
