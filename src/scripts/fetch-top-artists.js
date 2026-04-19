import { pool } from '../config/database.js';
import { spotifyService } from '../services/spotifyService.js';

async function getAllUsers() {
  const [rows] = await pool.query('SELECT id, spotify_user_id FROM users');
  return rows;
}

async function upsertTopArtists(userId, artists) {
  if (artists.length === 0) return;

  const placeholders = artists.map(() => '(?, ?, ?, ?, ?, NOW())').join(', ');
  const values = artists.flatMap((a) => [
    userId,
    a.spotify_artist_id,
    a.artist_name,
    a.genres,
    a.popularity,
    a.rank,
  ]);

  await pool.query(
    `INSERT INTO top_artists
       (user_id, spotify_artist_id, artist_name, genres, popularity, \`rank\`, fetched_at)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE
       artist_name  = VALUES(artist_name),
       genres       = VALUES(genres),
       popularity   = VALUES(popularity),
       \`rank\`     = VALUES(\`rank\`),
       fetched_at   = VALUES(fetched_at)`,
    values
  );
}

async function main() {
  try {
    const users = await getAllUsers();
    if (users.length === 0) {
      console.log('[INFO] No users found in the database.');
      return;
    }

    for (const user of users) {
      const { id: userId, spotify_user_id: spotifyUserId } = user;
      console.log(`\n[USER] Processing user ${spotifyUserId}`);

      // long_term covers multi-year listening history (closest to "past year")
      const artists = await spotifyService.getTopArtists(spotifyUserId, 'long_term', 50);

      if (artists === null) {
        console.error(`  [SKIP] Failed to fetch top artists for user ${spotifyUserId}`);
        continue;
      }

      await upsertTopArtists(userId, artists);
      console.log(`  [SAVED] ${artists.length} artists`);

      const preview = artists.slice(0, 5).map((a) => `    ${a.rank}. ${a.artist_name}`);
      console.log(`  [TOP 5]\n${preview.join('\n')}`);
    }

    console.log('\n[DONE] Top artists fetch completed.');
  } catch (error) {
    console.error('[FATAL ERROR]', error);
  } finally {
    await pool.end();
  }
}

main();
