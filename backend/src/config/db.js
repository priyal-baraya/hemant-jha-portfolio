/**
 * src/config/db.js
 *
 * MySQL connection pool (AWS RDS). Follows the reference project's config/db.js
 * approach (mysql2), but reads credentials from environment variables instead of
 * hardcoding them, and uses a connection pool for a web server.
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Verify connectivity once at startup (logs, does not crash the app)
export async function verifyConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');
    console.log(`MySQL connected: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
  } finally {
    conn.release();
  }
}

export default pool;
