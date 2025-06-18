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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; 