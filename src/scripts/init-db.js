import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  try {
    // Get all migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Run each migration
    for (const file of migrationFiles) {
      const migrationName = path.basename(file, '.sql');
      
      // Check if migration has been executed
      const [executed] = await pool.query(
        'SELECT id FROM migrations WHERE name = ?',
        [migrationName]
      );

      if (executed.length === 0) {
        console.log(`Running migration: ${migrationName}`);
        
        // Read and execute migration file
        const migrationPath = path.join(migrationsDir, file);
        const migrationSQL = await fs.readFile(migrationPath, 'utf8');
        
        // Start transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
          // Execute migration
          await connection.query(migrationSQL);
          
          // Record migration
          await connection.query(
            'INSERT INTO migrations (name) VALUES (?)',
            [migrationName]
          );

          await connection.commit();
          console.log(`Successfully executed migration: ${migrationName}`);
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else {
        console.log(`Skipping already executed migration: ${migrationName}`);
      }
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migrations
runMigrations().catch(console.error); 