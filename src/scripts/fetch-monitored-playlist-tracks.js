import { pool } from '../config/database.js';
import { spotifyService } from '../services/spotifyService.js';
import { userModel } from '../models/User.js';

function parseDateUTC(dateString) {
  // Returns a Date object in UTC, or null if invalid
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? null : d;
}

async function getAllActiveMonitoredPlaylists() {
  const [rows] = await pool.query(`
    SELECT mp.spotify_playlist_id, mp.playlist_name, u.spotify_user_id, u.id as user_id
    FROM monitored_playlists mp
    JOIN users u ON mp.user_id = u.id
    WHERE mp.is_active = TRUE
  `);
  return rows;
}

async function getLastSuccessfulRun(userId, playlistId) {
  const [rows] = await pool.query(
    'SELECT last_successful_run FROM target_playlist WHERE user_id = ? AND spotify_playlist_id = ?',
    [userId, playlistId]
  );
  if (rows.length === 0) return null;
  return rows[0].last_successful_run;
}

async function main() {
  try {
    const playlists = await getAllActiveMonitoredPlaylists();
    let allNewTracks = [];
    let trackSources = {};
    for (const playlist of playlists) {
      const { spotify_playlist_id, playlist_name, spotify_user_id, user_id } = playlist;
      console.log(`\n[PROCESS] Playlist: ${playlist_name} (${spotify_playlist_id}) for user ${spotify_user_id}`);
      const lastRunRaw = await getLastSuccessfulRun(user_id, spotify_playlist_id);
      const lastRun = lastRunRaw ? parseDateUTC(lastRunRaw) : null;
      if (lastRunRaw && !lastRun) {
        console.warn(`[WARN] Corrupted last_successful_run timestamp: ${lastRunRaw}. Treating as first run.`);
      }
      const tracks = await spotifyService.getAllPlaylistTracks(spotify_user_id, spotify_playlist_id);
      if (tracks === null) {
        console.error(`[FAIL] Could not fetch tracks for playlist ${spotify_playlist_id}`);
        continue;
      }
      // Filter tracks by added_at > last_successful_run (or, on first run, only those added in the last 7 days)
      const newTracks = tracks.filter(track => {
        const addedAt = parseDateUTC(track.added_at);
        if (!addedAt) {
          console.warn(`[WARN] Corrupted added_at timestamp: ${track.added_at} for track ${track.track_id}`);
          return false;
        }
        if (!lastRun) {
          // First run: only include tracks added in the last 7 days (UTC)
          const now = new Date();
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return addedAt >= sevenDaysAgo;
        }
        return addedAt > lastRun;
      });
      for (const track of newTracks) {
        allNewTracks.push(track);
        if (!trackSources[track.track_id]) trackSources[track.track_id] = [];
        trackSources[track.track_id].push({ playlist_name, playlist_id: spotify_playlist_id });
      }
      for (const track of newTracks) {
        console.log(`[NEW] ${track.added_at} | ${track.artist_names} - ${track.track_name} (${track.track_id})`);
      }
      console.log(`[RESULT] Found ${newTracks.length} new tracks (added after ${lastRun ? lastRun.toISOString() : 'beginning'}) for playlist ${spotify_playlist_id}`);
    }

    // Deduplicate by track_id
    const dedupedMap = new Map();
    for (const track of allNewTracks) {
      if (!dedupedMap.has(track.track_id)) {
        dedupedMap.set(track.track_id, track);
      }
    }
    const dedupedTracks = Array.from(dedupedMap.values());
    const duplicateCount = allNewTracks.length - dedupedTracks.length;

    // Logging statistics
    console.log(`\n[DEDUPLICATION] Total new tracks: ${allNewTracks.length}`);
    console.log(`[DEDUPLICATION] Unique tracks after deduplication: ${dedupedTracks.length}`);
    console.log(`[DEDUPLICATION] Duplicates removed: ${duplicateCount}`);
    if (duplicateCount > 0) {
      console.log(`[DEDUPLICATION] Duplicate track details:`);
      for (const [track_id, sources] of Object.entries(trackSources)) {
        if (sources.length > 1) {
          console.log(`  Track ID: ${track_id} found in:`);
          for (const src of sources) {
            console.log(`    - ${src.playlist_name} (${src.playlist_id})`);
          }
        }
      }
    }
    // Optionally, here you would proceed to add dedupedTracks to the target playlist
  } catch (error) {
    console.error('[FATAL ERROR]', error);
  } finally {
    await pool.end();
  }
}

main(); 