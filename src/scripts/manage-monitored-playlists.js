import readline from 'readline';
import { pool } from '../config/database.js';
import { userModel } from '../models/User.js';
import { tokenService } from '../services/tokenService.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function getUserIdBySpotifyId(spotifyUserId) {
  const user = await userModel.findBySpotifyId(spotifyUserId);
  if (!user) throw new Error(`No user found for Spotify ID: ${spotifyUserId}`);
  return user.id;
}

async function validateAndFetchPlaylist(spotifyUserId, playlistId) {
  try {
    const accessToken = await tokenService.getValidAccessToken(spotifyUserId);
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (response.status === 404) throw new Error('Playlist not found (may be deleted or private)');
    if (!response.ok) throw new Error(`Spotify API error: ${response.statusText}`);
    const playlist = await response.json();
    return playlist;
  } catch (error) {
    throw new Error(`Failed to validate playlist: ${error.message}`);
  }
}

async function addMonitoredPlaylist(spotifyUserId, playlistId) {
  try {
    const userId = await getUserIdBySpotifyId(spotifyUserId);
    const playlist = await validateAndFetchPlaylist(spotifyUserId, playlistId);
    const playlistName = playlist.name;
    await pool.query(
      `INSERT INTO monitored_playlists (user_id, spotify_playlist_id, playlist_name, is_active)
       VALUES (?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE playlist_name = VALUES(playlist_name), is_active = TRUE, updated_at = CURRENT_TIMESTAMP`,
      [userId, playlistId, playlistName]
    );
    console.log(`[ADD] Monitored playlist added/activated: ${playlistName} (${playlistId}) for user ${spotifyUserId}`);
  } catch (error) {
    console.error(`[ERROR][ADD] ${error.message}`);
  }
}

async function setPlaylistActiveFlag(spotifyUserId, playlistId, isActive) {
  try {
    const userId = await getUserIdBySpotifyId(spotifyUserId);
    const [rows] = await pool.query(
      'SELECT * FROM monitored_playlists WHERE user_id = ? AND spotify_playlist_id = ?',
      [userId, playlistId]
    );
    if (rows.length === 0) throw new Error('Monitored playlist not found for this user.');
    await pool.query(
      'UPDATE monitored_playlists SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND spotify_playlist_id = ?',
      [isActive, userId, playlistId]
    );
    console.log(`[${isActive ? 'ACTIVATE' : 'DEACTIVATE'}] Playlist ${playlistId} for user ${spotifyUserId} is now ${isActive ? 'active' : 'inactive'}`);
  } catch (error) {
    console.error(`[ERROR][${isActive ? 'ACTIVATE' : 'DEACTIVATE'}] ${error.message}`);
  }
}

async function main() {
  try {
    const action = (await prompt('Action (add/activate/deactivate): ')).trim().toLowerCase();
    const spotifyUserId = (await prompt('Spotify User ID: ')).trim();
    const playlistId = (await prompt('Spotify Playlist ID: ')).trim();
    if (action === 'add') {
      await addMonitoredPlaylist(spotifyUserId, playlistId);
    } else if (action === 'activate') {
      await setPlaylistActiveFlag(spotifyUserId, playlistId, true);
    } else if (action === 'deactivate') {
      await setPlaylistActiveFlag(spotifyUserId, playlistId, false);
    } else {
      console.error('Unknown action. Use add, activate, or deactivate.');
    }
  } finally {
    rl.close();
    await pool.end();
    process.exit(0);
  }
}

main().catch(err => {
  console.error('[FATAL ERROR]', err);
  rl.close();
  pool.end();
  process.exit(0);
}); 