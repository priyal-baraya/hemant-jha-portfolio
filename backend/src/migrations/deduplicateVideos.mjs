/**
 * Removes duplicate rows from the videos table.
 * Keeps the row with the lowest id for each external_id.
 * Also removes rows with NULL external_id that are exact title duplicates.
 */
import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function run() {
  const conn = await pool.getConnection();
  try {
    // 1. Count before
    const [[{ total }]] = await conn.query('SELECT COUNT(*) total FROM videos');
    console.log(`Total rows before: ${total}`);

    // 2. Show duplicates
    const [dupes] = await conn.query(`
      SELECT external_id, COUNT(*) cnt
      FROM videos
      WHERE external_id IS NOT NULL
      GROUP BY external_id
      HAVING cnt > 1
    `);
    console.log(`Duplicate external_ids: ${dupes.length}`);
    dupes.forEach(d => console.log(`  external_id=${d.external_id} → ${d.cnt} copies`));

    // 3. Delete duplicates — keep lowest id per external_id
    const [res1] = await conn.query(`
      DELETE v1 FROM videos v1
      INNER JOIN videos v2
        ON v1.external_id = v2.external_id
        AND v1.id > v2.id
    `);
    console.log(`Deleted ${res1.affectedRows} duplicate rows (kept lowest id per external_id)`);

    // 4. Delete NULL external_id rows with duplicate names
    const [res2] = await conn.query(`
      DELETE v1 FROM videos v1
      INNER JOIN videos v2
        ON v1.name = v2.name
        AND v1.id > v2.id
        AND v1.external_id IS NULL
    `);
    console.log(`Deleted ${res2.affectedRows} NULL-external_id name-duplicate rows`);

    // 5. Count after
    const [[{ total: after }]] = await conn.query('SELECT COUNT(*) total FROM videos');
    console.log(`Total rows after: ${after}`);
  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
