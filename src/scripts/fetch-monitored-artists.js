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
  // release_date can be YYYY, YYYY-MM, or YYYY-MM-DD
  const d = new Date(
    dateStr.length === 4 ? `${dateStr}-01-01` : dateStr.length === 7 ? `${dateStr}-01` : dateStr
  );
  return isNaN(d.getTime()) ? null : d;
}

async function getAllActiveArtistsByUser() {
  const [rows] = await pool.query(`
    SELECT ta.spotify_artist_id, ta.artist_name, u.spotify_user_id, u.id AS user_id
    FROM monitored_artists ta
    JOIN users u ON ta.user_id = u.id
    WHERE ta.is_active = TRUE
    ORDER BY u.id
  `);
  // Group by user
  const byUser = {};
  for (const row of rows) {
    if (!byUser[row.user_id]) {
      byUser[row.user_id] = {
        spotify_user_id: row.spotify_user_id,
        user_id: row.user_id,
        artists: [],
      };
    }
    byUser[row.user_id].artists.push({
      spotify_artist_id: row.spotify_artist_id,
      artist_name: row.artist_name,
    });
  }
  return Object.values(byUser);
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

async function main() {
  try {
    const userGroups = await getAllActiveArtistsByUser();
    if (userGroups.length === 0) {
      console.log('[INFO] No active monitored artists found.');
      return;
    }

    for (const { spotify_user_id, user_id, artists } of userGroups) {
      console.log(`\n[USER] ${spotify_user_id} — ${artists.length} monitored artist(s)`);

      const target = await getOrCreateTargetPlaylist(user_id, spotify_user_id);
      if (!target) {
        console.warn(`[SKIP] Could not get/create target playlist for user ${spotify_user_id}`);
        continue;
      }

      const lastRun = target.last_successful_run ? new Date(target.last_successful_run) : null;
      const cutoff = lastRun ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      console.log(`[INFO] Cutoff date: ${cutoff.toISOString()}`);

      const newTrackMap = new Map(); // track_id -> track object

      for (const { spotify_artist_id, artist_name } of artists) {
        console.log(`\n[ARTIST] ${artist_name} (${spotify_artist_id})`);
        const albums = await spotifyService.getArtistAlbums(spotify_user_id, spotify_artist_id, [
          'album',
          'single',
        ]);
        if (!albums) {
          console.error(`[FAIL] Could not fetch albums for artist ${spotify_artist_id}`);
          continue;
        }

        const recentAlbums = albums.filter((album) => {
          const released = parseDateUTC(album.release_date);
          return released && released >= cutoff;
        });

        console.log(`[INFO] ${recentAlbums.length} recent release(s) from ${artist_name}`);

        for (const album of recentAlbums) {
          const tracks = await spotifyService.getAlbumTracks(spotify_user_id, album.id);
          if (!tracks) continue;
          for (const track of tracks) {
            if (!newTrackMap.has(track.track_id)) {
              newTrackMap.set(track.track_id, {
                ...track,
                release_date: album.release_date,
                album_name: album.name,
              });
              console.log(
                `[NEW] ${album.release_date} | ${track.artist_names} - ${track.track_name}`
              );
            }
          }
        }
      }

      const dedupedTracks = Array.from(newTrackMap.values());
      const trackUris = dedupedTracks.map((t) => `spotify:track:${t.track_id}`);
      const now = new Date();
      const newDescription = `This playlist is managed by automation. Last refreshed: ${now.toISOString().slice(0, 10)}`;

      console.log(
        `\n[REFRESH] ${dedupedTracks.length} unique track(s) for user ${spotify_user_id}`
      );
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
