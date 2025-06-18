import mysql from 'mysql2/promise';
import { config } from './config.js';

// Create connection pool
const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  waitForConnections: config.database.waitForConnections,
  connectionLimit: config.database.connectionLimit,
  queueLimit: config.database.queueLimit
});

// Test database connection
export const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Database connection successful');
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};

export { pool }; 