# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Run the application
npm start          # node src/index.js
npm run dev        # nodemon src/index.js (auto-restart on changes)

# Lint and format
npm run lint       # eslint .
npm run format     # prettier --write .

# Database setup (run once, requires MySQL and .env)
node src/scripts/init-db.js

# Spotify OAuth authorization flow (interactive CLI)
node src/scripts/spotifyAuth.js

# Manage which playlists are monitored (interactive CLI)
node src/scripts/manage-monitored-playlists.js

# Core job: fetch new tracks and refresh target playlist
node src/scripts/fetch-monitored-playlist-tracks.js
```

There is no test runner configured — `npm test` exits with an error. Tests in `src/tests/` must be run directly (e.g. `node src/tests/encryption.test.js`).

## Architecture

The project is a **script-driven Node.js app** (ESM, `"type": "module"`) with no HTTP server — `src/index.js` is a stub with TODO comments. All real logic lives in the scripts and services.

### Data flow for the core job (`fetch-monitored-playlist-tracks.js`)

1. Queries MySQL for all active rows in `monitored_playlists` (joined with `users`).
2. For each user, ensures a `target_playlist` row and a corresponding Spotify playlist ("New Adds") exist, creating them if needed.
3. Fetches all tracks from each monitored playlist via `SpotifyService.getAllPlaylistTracks()`.
4. Filters tracks to only those added after `target_playlist.last_successful_run` (first run: last 7 days).
5. Deduplicates across monitored playlists by `track_id`.
6. Clears the target playlist, adds the new tracks, updates its description, and writes `last_successful_run` back to the DB.

### Two Spotify API layers (important distinction)

- **`src/services/spotifyService.js`** — Uses the native `fetch` API directly against `api.spotify.com`. Handles token refresh internally via `tokenService`. Used for reading playlists/tracks.
- **`src/services/spotify.js`** — Uses the `spotify-web-api-node` SDK wrapper. Used for write operations: creating playlists, clearing/adding tracks, updating playlist details. Both layers call `tokenService.getValidAccessToken()` before each request.

### Token lifecycle (`src/services/tokenService.js`)

`TokenService` holds an in-memory `Map` cache keyed by `spotify_user_id`. On cache miss or expiry it reads the encrypted `refresh_token` from MySQL, calls Spotify's token refresh endpoint, updates the cache, and (if Spotify issued a new refresh token) writes back to the DB via `userModel.createOrUpdate()`.

### Database schema (MySQL, `mysql2/promise` pool)

Three tables managed by sequential migration files in `src/scripts/migrations/`:

- **`users`** — `spotify_user_id`, `email`, `access_token` (encrypted), `refresh_token` (encrypted), `token_expiry_time`
- **`monitored_playlists`** — `user_id` FK, `spotify_playlist_id`, `playlist_name`, `is_active`
- **`target_playlist`** — one row per user; `spotify_playlist_id`, `playlist_name`, `last_successful_run`

There are **two database pool files**: `src/config/database.js` (the canonical one, used by scripts) and `src/models/database.js` (a near-duplicate, used only by `src/models/`). New code should use `src/config/database.js`.

### Encryption (`src/utils/encryption.js`)

`Encryption.encrypt` / `Encryption.decrypt` use AES-256-CBC with a random IV prepended as hex. The `ENCRYPTION_KEY` env var must be exactly 32 bytes (raw) or 64 hex characters.

### Environment variables

All config flows through `src/config/config.js` which reads from `.env`:

| Variable                                                               | Purpose                                      |
| ---------------------------------------------------------------------- | -------------------------------------------- |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` / `SPOTIFY_REDIRECT_URI` | Spotify OAuth app credentials                |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`              | MySQL connection                             |
| `ENCRYPTION_KEY`                                                       | 32-byte key for AES-256-CBC token encryption |
| `JWT_SECRET`                                                           | Used for additional key derivation           |
