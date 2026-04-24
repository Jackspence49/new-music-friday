/* eslint-disable no-console */
import { pool } from '../config/database.js';
import { spotifyService } from '../services/spotifyService.js';
import {
  createUserPlaylist,
  clearPlaylistTracks,
  addTracksToPlaylist,
  updatePlaylistDetails,
} from '../services/spotify.js';

function parseDateUTC(dateStr) {
  if (!dateStr) return null;
  // Handles YYYY, YYYY-MM, YYYY-MM-DD, and full ISO strings
  const d = new Date(
    dateStr.length === 4 ? `${dateStr}-01-01` : dateStr.length === 7 ? `${dateStr}-01` : dateStr
  );
  return isNaN(d.getTime()) ? null : d;
}

async function getAllUsers() {
  const [rows] = await pool.query('SELECT id AS user_id, spotify_user_id FROM users');
  return rows;
}

async function getMonitoredPlaylistsForUser(userId) {
  const [rows] = await pool.query(
    'SELECT spotify_playlist_id, playlist_name FROM monitored_playlists WHERE user_id = ? AND is_active = TRUE',
    [userId]
  );
  return rows;
}

async function getMonitoredArtistsForUser(userId) {
  const [rows] = await pool.query(
    'SELECT spotify_artist_id, artist_name FROM monitored_artists WHERE user_id = ? AND is_active = TRUE',
    [userId]
  );
  return rows;
}

async function getOrCreateTargetPlaylist(userId, spotifyUserId) {
  const [rows] = await pool.query('SELECT * FROM target_playlist WHERE user_id = ?', [userId]);
  if (rows.length > 0) return rows[0];
  const playlist = await createUserPlaylist(spotifyUserId, 'New Adds', {
    public: true,
    description: 'This playlist is managed by automation. New songs are added here automatically.',
  });
  await pool.query(
    'INSERT INTO target_playlist (user_id, spotify_playlist_id, playlist_name) VALUES (?, ?, ?)',
    [userId, playlist.id, playlist.name]
  );
  console.log(
    `[CREATE] Created target playlist '${playlist.name}' (${playlist.id}) for user ${spotifyUserId}`
  );
  return {
    user_id: userId,
    spotify_playlist_id: playlist.id,
    playlist_name: playlist.name,
    last_successful_run: null,
  };
}

async function collectPlaylistTracks(spotifyUserId, playlists, cutoff) {
  const trackMap = new Map();
  for (const { spotify_playlist_id, playlist_name } of playlists) {
    console.log(`\n[PLAYLIST] ${playlist_name} (${spotify_playlist_id})`);
    const tracks = await spotifyService.getAllPlaylistTracks(spotifyUserId, spotify_playlist_id);
    if (tracks === null) {
      console.error(`[FAIL] Could not fetch tracks for playlist ${spotify_playlist_id}`);
      continue;
    }
    const recent = tracks.filter((t) => {
      const addedAt = parseDateUTC(t.added_at);
      if (!addedAt) return false;
      return addedAt >= cutoff;
    });
    console.log(`[INFO] ${recent.length} track(s) added after cutoff`);
    for (const track of recent) {
      if (!trackMap.has(track.track_id)) {
        trackMap.set(track.track_id, track);
        console.log(`[NEW] ${track.added_at} | ${track.artist_names} - ${track.track_name}`);
      }
    }
  }
  return trackMap;
}

async function collectArtistTracks(spotifyUserId, artists, cutoff) {
  const trackMap = new Map();
  for (const { spotify_artist_id, artist_name } of artists) {
    console.log(`\n[ARTIST] ${artist_name} (${spotify_artist_id})`);
    const albums = await spotifyService.getArtistAlbums(spotifyUserId, spotify_artist_id, [
      'album',
      'single',
    ]);
    if (!albums) {
      console.error(`[FAIL] Could not fetch albums for artist ${spotify_artist_id}`);
      continue;
    }
    const recentAlbums = albums.filter((a) => {
      const released = parseDateUTC(a.release_date);
      return released && released >= cutoff;
    });
    console.log(`[INFO] ${recentAlbums.length} recent release(s) from ${artist_name}`);
    for (const album of recentAlbums) {
      const tracks = await spotifyService.getAlbumTracks(spotifyUserId, album.id);
      if (!tracks) continue;
      for (const track of tracks) {
        if (!trackMap.has(track.track_id)) {
          trackMap.set(track.track_id, {
            ...track,
            release_date: album.release_date,
            album_name: album.name,
          });
          console.log(`[NEW] ${album.release_date} | ${track.artist_names} - ${track.track_name}`);
        }
      }
    }
  }
  return trackMap;
}

async function main() {
  try {
    const users = await getAllUsers();
    if (users.length === 0) {
      console.log('[INFO] No users found.');
      return;
    }

    for (const { user_id, spotify_user_id } of users) {
      console.log(`\n========== USER: ${spotify_user_id} ==========`);

      const [monitoredPlaylists, monitoredArtists] = await Promise.all([
        getMonitoredPlaylistsForUser(user_id),
        getMonitoredArtistsForUser(user_id),
      ]);

      if (monitoredPlaylists.length === 0 && monitoredArtists.length === 0) {
        console.log('[SKIP] No monitored playlists or artists for this user.');
        continue;
      }

      const target = await getOrCreateTargetPlaylist(user_id, spotify_user_id);
      if (!target) {
        console.warn(`[SKIP] Could not get/create target playlist for user ${spotify_user_id}`);
        continue;
      }

      const lastRun = target.last_successful_run ? new Date(target.last_successful_run) : null;
      const cutoff = lastRun ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      console.log(`[INFO] Cutoff: ${cutoff.toISOString()}`);

      // Collect tracks from both sources in parallel
      const [playlistTrackMap, artistTrackMap] = await Promise.all([
        monitoredPlaylists.length > 0
          ? collectPlaylistTracks(spotify_user_id, monitoredPlaylists, cutoff)
          : Promise.resolve(new Map()),
        monitoredArtists.length > 0
          ? collectArtistTracks(spotify_user_id, monitoredArtists, cutoff)
          : Promise.resolve(new Map()),
      ]);

      // Merge: playlist tracks first, then artist tracks fill in any gaps
      const mergedMap = new Map([...playlistTrackMap, ...artistTrackMap]);
      // Re-add playlist tracks so they aren't overwritten by artist tracks with same ID
      for (const [id, track] of playlistTrackMap) mergedMap.set(id, track);

      const dedupedTracks = Array.from(mergedMap.values());
      const trackUris = dedupedTracks.map((t) => `spotify:track:${t.track_id}`);

      console.log(
        `\n[SUMMARY] ${playlistTrackMap.size} from playlists, ${artistTrackMap.size} from artists`
      );
      console.log(`[SUMMARY] ${dedupedTracks.length} unique track(s) after merge`);

      const now = new Date();
      const newDescription = `This playlist is managed by automation. Last refreshed: ${now.toISOString().slice(0, 10)}`;

      try {
        await clearPlaylistTracks(spotify_user_id, target.spotify_playlist_id);
        console.log(`[REFRESH] Cleared playlist ${target.spotify_playlist_id}`);

        if (trackUris.length > 0) {
          await addTracksToPlaylist(spotify_user_id, target.spotify_playlist_id, trackUris);
          console.log(`[REFRESH] Added ${trackUris.length} tracks`);
        } else {
          console.log(`[REFRESH] No new tracks to add`);
        }

        await updatePlaylistDetails(spotify_user_id, target.spotify_playlist_id, {
          name: 'New Adds',
          description: newDescription,
        });

        await pool.query(
          'UPDATE target_playlist SET last_successful_run = ? WHERE user_id = ? AND spotify_playlist_id = ?',
          [now, user_id, target.spotify_playlist_id]
        );
        console.log(`[REFRESH] Updated last_successful_run`);
      } catch (err) {
        console.error(`[ERROR][REFRESH] ${err.message}`);
      }
    }
  } catch (error) {
    console.error('[FATAL ERROR]', error);
  } finally {
    await pool.end();
  }
}

main();
