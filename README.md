# New Music Friday

**New Music Friday** is a Node.js application for tracking, managing, and discovering new music releases on Spotify. It automates playlist management, monitors user-selected playlists, and securely stores credentials and tokens. The project is designed for music enthusiasts who want to keep up with the latest tracks and automate their Spotify playlist curation.

---

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Scripts & Usage](#scripts--usage)
  - [start](#start)
  - [dev](#dev)
  - [lint](#lint)
  - [format](#format)
  - [test](#test)
  - [Database Migration: init-db.js](#database-migration-init-dbjs)
  - [Spotify Authorization: spotifyAuth.js](#spotify-authorization-spotifyauthjs)
  - [Manage Monitored Playlists: manage-monitored-playlists.js](#manage-monitored-playlistsjs)
  - [Fetch Monitored Playlist Tracks: fetch-monitored-playlist-tracks.js](#fetch-monitored-playlist-tracksjs)
- [Security](#security)
- [License](#license)

---

## Features

- **Spotify OAuth2 Authorization**: Securely connect your Spotify account.
- **Automated Playlist Management**: Monitor and aggregate new tracks from selected playlists.
- **Database-backed**: Uses MySQL for persistent storage of users, playlists, and tokens.
- **Encryption**: Sensitive data (like refresh tokens) is encrypted using AES-256-GCM.
- **Scriptable**: Includes scripts for database setup, playlist management, and more.
- **Extensible**: Modular structure for easy feature expansion.

---

## Project Structure

```
├── src/
│   ├── config/         # Configuration files
│   ├── models/         # Database models
│   ├── scripts/        # Utility and setup scripts
│   ├── services/       # Business logic and Spotify API integration
│   ├── tests/          # Unit tests
│   └── utils/          # Utility functions
├── package.json        # Project metadata and scripts
├── README.md           # Project documentation
```

---

## Getting Started

### Prerequisites

- **Node.js** (v16+ recommended)
- **npm** (v8+ recommended)
- **MySQL** database (running and accessible)
- A [Spotify Developer Application](https://developer.spotify.com/dashboard) for API credentials

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd new-music-friday
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   - Create a `.env` file in the project root with the following variables:
     ```
     SPOTIFY_CLIENT_ID=your_client_id
     SPOTIFY_CLIENT_SECRET=your_client_secret
     SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
     DB_HOST=localhost
     DB_PORT=3306
     DB_NAME=your_database_name
     DB_USER=your_database_user
     DB_PASSWORD=your_database_password
     JWT_SECRET=your_jwt_secret
     ENCRYPTION_KEY=your_encryption_key
     ```

---

## Environment Variables

| Variable                | Description                                 |
|-------------------------|---------------------------------------------|
| SPOTIFY_CLIENT_ID       | Spotify API client ID                       |
| SPOTIFY_CLIENT_SECRET   | Spotify API client secret                   |
| SPOTIFY_REDIRECT_URI    | Spotify OAuth redirect URI                  |
| DB_HOST                 | MySQL host                                  |
| DB_PORT                 | MySQL port                                  |
| DB_NAME                 | MySQL database name                         |
| DB_USER                 | MySQL user                                  |
| DB_PASSWORD             | MySQL password                              |
| JWT_SECRET              | Secret for JWT and encryption key derivation|
| ENCRYPTION_KEY          | 32+ char key for AES-256-GCM encryption     |

---

## Scripts & Usage

### `npm start`

**Description:**  
Runs the main application (`src/index.js`).  
**Prerequisites:**  
- `.env` file configured  
- Database is running and accessible  
- Spotify credentials set

**Usage:**  
```bash
npm start
```

---

### `npm run dev`

**Description:**  
Runs the app in development mode with automatic restarts on file changes using `nodemon`.  
**Prerequisites:**  
- Same as `npm start`  
- Nodemon is installed (already included in devDependencies)

**Usage:**  
```bash
npm run dev
```

---

### `npm run lint`

**Description:**  
Checks code for style and syntax issues using ESLint.  
**Prerequisites:**  
- No special prerequisites; ESLint is included in devDependencies

**Usage:**  
```bash
npm run lint
```

---

### `npm run format`

**Description:**  
Formats the codebase using Prettier.  
**Prerequisites:**  
- No special prerequisites; Prettier is included in devDependencies

**Usage:**  
```bash
npm run format
```

---

### `npm test`

**Description:**  
Placeholder script.  
**To run actual tests:**  
- Install Mocha and Chai:
  ```bash
  npm install --save-dev mocha chai
  ```
- Run tests:
  ```bash
  npx mocha src/tests/**/*.test.js
  ```

**Prerequisites:**  
- Mocha and Chai installed  
- `.env` file configured (if tests require config)

---

### Database Migration: `src/scripts/init-db.js`

**Description:**  
Runs all SQL migrations in `src/scripts/migrations/` to set up or update the database schema.  
**Prerequisites:**  
- MySQL database running and accessible  
- `.env` file with DB credentials

**Usage:**  
```bash
node src/scripts/init-db.js
```

---

### Spotify Authorization: `src/scripts/spotifyAuth.js`

**Description:**  
Guides you through the Spotify OAuth process, exchanges the code for tokens, and stores user credentials in the database.  
**Prerequisites:**  
- Spotify Developer App credentials in `.env`  
- Database set up (run migrations first)

**Usage:**  
```bash
node src/scripts/spotifyAuth.js
```
Follow the prompts in your terminal.

---

### Manage Monitored Playlists: `src/scripts/manage-monitored-playlists.js`

**Description:**  
Add, activate, or deactivate monitored playlists for a user.  
**Prerequisites:**  
- User must be authorized (see Spotify Authorization above)  
- Database set up

**Usage:**  
```bash
node src/scripts/manage-monitored-playlists.js
```
Follow the interactive prompts.

---

### Fetch Monitored Playlist Tracks: `src/scripts/fetch-monitored-playlist-tracks.js`

**Description:**  
Fetches new tracks from all active monitored playlists, deduplicates them, and updates each user's target playlist.  
**Prerequisites:**  
- Database set up and migrated  
- Users authorized and playlists monitored  
- Valid Spotify tokens in DB

**Usage:**  
```bash
node src/scripts/fetch-monitored-playlist-tracks.js
```

---

## Security

- Sensitive data is encrypted using AES-256-GCM.
- Never commit your `.env` file or credentials to version control.
- Regularly rotate your `ENCRYPTION_KEY` and `JWT_SECRET`.
- Use different credentials for development and production.

---

## License

This project is licensed under the ISC License.
