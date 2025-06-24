import { pool } from '../config/database.js';
import { spotifyService } from '../services/spotifyService.js';
import { createUserPlaylist, clearPlaylistTracks, addTracksToPlaylist, updatePlaylistDetails } from '../services/spotify.js';

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

async function getLastSuccessfulRun(userId) {
  const [rows] = await pool.query(
    'SELECT last_successful_run FROM target_playlist WHERE user_id = ?',
    [userId]
  );
  if (rows.length === 0) return null;
  return rows[0].last_successful_run;
}

// Helper to get or create the target playlist for a user
async function getOrCreateTargetPlaylist(userId, spotifyUserId) {
  // Check if a target playlist exists for this user
  const [rows] = await pool.query(
    'SELECT * FROM target_playlist WHERE user_id = ?',
    [userId]
  );
  if (rows.length > 0) {
    return rows[0];
  }
  // Create the playlist on Spotify
  try {
    const playlistName = 'New Adds';
    const playlistDescription = 'This playlist is managed by automation. New songs are added here automatically.';
    const playlist = await createUserPlaylist(spotifyUserId, playlistName, {
      public: true,
      description: playlistDescription
    });
    // Store in DB
    await pool.query(
      'INSERT INTO target_playlist (user_id, spotify_playlist_id, playlist_name) VALUES (?, ?, ?)',
      [userId, playlist.id, playlist.name]
    );
    console.log(`[CREATE] Created and stored target playlist '${playlist.name}' (${playlist.id}) for user ${spotifyUserId}`);
    return { user_id: userId, spotify_playlist_id: playlist.id, playlist_name: playlist.name };
  } catch (error) {
    console.error(`[ERROR][CREATE] Failed to create target playlist for user ${spotifyUserId}:`, error.message);
    return null;
  }
}

async function main() {
  try {
    const playlists = await getAllActiveMonitoredPlaylists();
    let allNewTracks = [];
    let trackSources = {};
    // --- Target playlist creation logic ---
    // For each user, ensure a target playlist exists
    const userTargetPlaylists = {};
    for (const playlist of playlists) {
      const { spotify_user_id, user_id } = playlist;
      if (!userTargetPlaylists[user_id]) {
        const target = await getOrCreateTargetPlaylist(user_id, spotify_user_id);
        if (!target) {
          console.warn(`[SKIP] Skipping user ${spotify_user_id} due to target playlist creation failure.`);
          userTargetPlaylists[user_id] = null;
        } else {
          userTargetPlaylists[user_id] = target;
        }
      }
    }
    // ... existing code ...
    for (const playlist of playlists) {
      const { spotify_playlist_id, playlist_name, spotify_user_id, user_id } = playlist;
      console.log(`\n[PROCESS] Playlist: ${playlist_name} (${spotify_playlist_id}) for user ${spotify_user_id}`);
      const lastRunRaw = await getLastSuccessfulRun(user_id);
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

    // --- Weekly Target Playlist Refresh ---
    // Group deduped tracks by user (no duplicates per user)
    const userTracks = {};
    const userTrackIds = {};
    for (const track of dedupedTracks) {
      for (const src of trackSources[track.track_id] || []) {
        const userId = playlists.find(p => p.spotify_playlist_id === src.playlist_id)?.user_id;
        if (userId && userTargetPlaylists[userId]) {
          if (!userTracks[userId]) userTracks[userId] = [];
          if (!userTrackIds[userId]) userTrackIds[userId] = new Set();
          if (!userTrackIds[userId].has(track.track_id)) {
            userTracks[userId].push(track);
            userTrackIds[userId].add(track.track_id);
          }
        }
      }
    }
    // For each user, refresh their target playlist
    for (const [userId, target] of Object.entries(userTargetPlaylists)) {
      if (!target) continue;
      const { spotify_playlist_id, playlist_name } = target;
      const user = playlists.find(p => p.user_id == userId);
      if (!user) continue;
      const spotifyUserId = user.spotify_user_id;
      const tracks = userTracks[userId] || [];
      const trackUris = tracks.map(t => `spotify:track:${t.track_id}`);
      // Playlist name with week
      const now = new Date();
      const newName = "New Adds";
      const newDescription = `This playlist is managed by automation. Last refreshed: ${now.toISOString().slice(0,10)}`;
      console.log(`\n[REFRESH] Refreshing target playlist for user ${spotifyUserId}: ${spotify_playlist_id}`);
      try {
        // 1. Clear playlist
        await clearPlaylistTracks(spotifyUserId, spotify_playlist_id);
        console.log(`[REFRESH] Cleared playlist ${spotify_playlist_id}`);
        // 2. Add new tracks (if any)
        if (trackUris.length > 0) {
          await addTracksToPlaylist(spotifyUserId, spotify_playlist_id, trackUris);
          console.log(`[REFRESH] Added ${trackUris.length} tracks to playlist ${spotify_playlist_id}`);
        } else {
          console.log(`[REFRESH] No new tracks to add for user ${spotifyUserId}`);
        }
        // 3. Update playlist name/description
        await updatePlaylistDetails(spotifyUserId, spotify_playlist_id, { name: newName, description: newDescription });
        console.log(`[REFRESH] Updated playlist name/description for ${spotify_playlist_id}`);
        // 4. Update last_successful_run
        await pool.query(
          'UPDATE target_playlist SET last_successful_run = ? WHERE user_id = ? AND spotify_playlist_id = ?',
          [now, userId, spotify_playlist_id]
        );
        console.log(`[REFRESH] Updated last_successful_run for user ${spotifyUserId}`);
      } catch (err) {
        console.error(`[ERROR][REFRESH] Error refreshing playlist for user ${spotifyUserId}:`, err.message);
      }
    }
  } catch (error) {
    console.error('[FATAL ERROR]', error);
  } finally {
    await pool.end();
  }
}

main(); 