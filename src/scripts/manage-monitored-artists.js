/* eslint-disable no-console */
import readline from 'readline';
import { pool } from '../config/database.js';
import { userModel } from '../models/User.js';
import { tokenService } from '../services/tokenService.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function getUserIdBySpotifyId(spotifyUserId) {
  const user = await userModel.findBySpotifyId(spotifyUserId);
  if (!user) throw new Error(`No user found for Spotify ID: ${spotifyUserId}`);
  return user.id;
}

async function fetchArtistById(spotifyUserId, artistId) {
  const accessToken = await tokenService.getValidAccessToken(spotifyUserId);
  const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 404) throw new Error('Artist not found on Spotify.');
  if (!response.ok) throw new Error(`Spotify API error: ${response.statusText}`);
  return response.json();
}

async function searchArtists(spotifyUserId, query) {
  const accessToken = await tokenService.getValidAccessToken(spotifyUserId);
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=5`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Spotify API error: ${response.statusText}`);
  const data = await response.json();
  return data.artists.items;
}

async function addArtist(spotifyUserId, artistId) {
  try {
    const userId = await getUserIdBySpotifyId(spotifyUserId);
    const artist = await fetchArtistById(spotifyUserId, artistId);
    await pool.query(
      `INSERT INTO monitored_artists (user_id, spotify_artist_id, artist_name, is_active)
       VALUES (?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE artist_name = VALUES(artist_name), is_active = TRUE, updated_at = CURRENT_TIMESTAMP`,
      [userId, artist.id, artist.name]
    );
    console.log(
      `[ADD] Artist added/activated: ${artist.name} (${artist.id}) for user ${spotifyUserId}`
    );
  } catch (error) {
    console.error(`[ERROR][ADD] ${error.message}`);
  }
}

async function searchAndAdd(spotifyUserId) {
  try {
    const query = (await prompt('Search artist name: ')).trim();
    const results = await searchArtists(spotifyUserId, query);
    if (results.length === 0) {
      console.log('No artists found.');
      return;
    }
    results.forEach((a, i) => console.log(`  ${i + 1}. ${a.name} (${a.id})`));
    const choice = (await prompt('Pick number to add (or 0 to cancel): ')).trim();
    const idx = parseInt(choice, 10) - 1;
    if (idx < 0 || idx >= results.length) {
      console.log('Cancelled.');
      return;
    }
    const artist = results[idx];
    const userId = await getUserIdBySpotifyId(spotifyUserId);
    await pool.query(
      `INSERT INTO monitored_artists (user_id, spotify_artist_id, artist_name, is_active)
       VALUES (?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE artist_name = VALUES(artist_name), is_active = TRUE, updated_at = CURRENT_TIMESTAMP`,
      [userId, artist.id, artist.name]
    );
    console.log(
      `[ADD] Artist added/activated: ${artist.name} (${artist.id}) for user ${spotifyUserId}`
    );
  } catch (error) {
    console.error(`[ERROR][SEARCH] ${error.message}`);
  }
}

async function setArtistActiveFlag(spotifyUserId, artistId, isActive) {
  try {
    const userId = await getUserIdBySpotifyId(spotifyUserId);
    const [rows] = await pool.query(
      'SELECT * FROM monitored_artists WHERE user_id = ? AND spotify_artist_id = ?',
      [userId, artistId]
    );
    if (rows.length === 0) throw new Error('Artist not found for this user.');
    await pool.query(
      'UPDATE monitored_artists SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND spotify_artist_id = ?',
      [isActive, userId, artistId]
    );
    const label = isActive ? 'ACTIVATE' : 'DEACTIVATE';
    console.log(
      `[${label}] Artist ${artistId} for user ${spotifyUserId} is now ${isActive ? 'active' : 'inactive'}`
    );
  } catch (error) {
    const label = isActive ? 'ACTIVATE' : 'DEACTIVATE';
    console.error(`[ERROR][${label}] ${error.message}`);
  }
}

async function listArtists(spotifyUserId) {
  try {
    const userId = await getUserIdBySpotifyId(spotifyUserId);
    const [rows] = await pool.query(
      'SELECT spotify_artist_id, artist_name, is_active FROM monitored_artists WHERE user_id = ? ORDER BY artist_name',
      [userId]
    );
    if (rows.length === 0) {
      console.log('No artists found for this user.');
      return;
    }
    console.log(`\nArtists for user ${spotifyUserId}:`);
    rows.forEach((r) =>
      console.log(
        `  [${r.is_active ? 'active' : 'inactive'}] ${r.artist_name} (${r.spotify_artist_id})`
      )
    );
  } catch (error) {
    console.error(`[ERROR][LIST] ${error.message}`);
  }
}

async function main() {
  try {
    const action = (await prompt('Action (add/search/activate/deactivate/list): '))
      .trim()
      .toLowerCase();
    const spotifyUserId = (await prompt('Spotify User ID: ')).trim();

    if (action === 'search') {
      await searchAndAdd(spotifyUserId);
    } else if (action === 'list') {
      await listArtists(spotifyUserId);
    } else if (action === 'add' || action === 'activate' || action === 'deactivate') {
      const artistId = (await prompt('Spotify Artist ID: ')).trim();
      if (action === 'add') {
        await addArtist(spotifyUserId, artistId);
      } else {
        await setArtistActiveFlag(spotifyUserId, artistId, action === 'activate');
      }
    } else {
      console.error('Unknown action. Use add, search, activate, deactivate, or list.');
    }
  } finally {
    rl.close();
    await pool.end();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('[FATAL ERROR]', err);
  rl.close();
  pool.end();
  process.exit(0);
});
