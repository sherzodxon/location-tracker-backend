const { Pool } = require('pg');

// PostgreSQL connection pool
// DATABASE_URL environment variable Render'da avtomatik beriladi
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Ulanishni tekshirish
pool.on('connect', () => {
  console.log('✅ PostgreSQL ga ulanildi');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL xatosi:', err);
});

// Ma'lumotlar bazasi va jadval yaratish
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS user_locations (
        id SERIAL PRIMARY KEY,
        user_name TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        device_info TEXT
      )
    `;

    await client.query(createTableQuery);
    console.log('✅ Jadval tayyor');

    // Index yaratish (tezroq qidiruv uchun)
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_timestamp ON user_locations(timestamp)'
    );

    console.log('📁 Database: PostgreSQL');
  } catch (err) {
    console.error('❌ Jadval yaratishda xatolik:', err);
    throw err;
  } finally {
    client.release();
  }
}

// SQLite ? placeholder larini PostgreSQL $1, $2, ... ga o'zgartirish
function convertToPostgres(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

// Query helper functions
const dbQuery = {
  // INSERT, UPDATE, DELETE
  run: async (sql, params = []) => {
    const pgSql = convertToPostgres(sql);
    const result = await pool.query(pgSql, params);
    return {
      insertId: result.rows[0]?.id || null,
      changes: result.rowCount
    };
  },

  // SELECT (bitta qator)
  get: async (sql, params = []) => {
    const pgSql = convertToPostgres(sql);
    const result = await pool.query(pgSql, params);
    return result.rows[0] || null;
  },

  // SELECT (ko'p qator)
  all: async (sql, params = []) => {
    const pgSql = convertToPostgres(sql);
    const result = await pool.query(pgSql, params);
    return result.rows;
  }
};

// Database'ni yopish
async function closeDatabase() {
  await pool.end();
  console.log('Database yopildi');
}

module.exports = { pool, dbQuery, initializeDatabase, closeDatabase };
