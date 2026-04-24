import pg from 'pg';

const { Pool } = pg;

const DEFAULT_MAX_CONNECTIONS = 10;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn('[db] DATABASE_URL não definido. Endpoints que dependem de banco retornarão erro.');
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: Number(process.env.DB_POOL_MAX ?? DEFAULT_MAX_CONNECTIONS),
});

export async function query(text, params = []) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL não configurado');
  }
  return pool.query(text, params);
}

export async function dbHealth() {
  if (!databaseUrl) {
    return { ok: false, reason: 'DATABASE_URL ausente' };
  }

  try {
    const result = await pool.query('select now() as now');
    return { ok: true, now: result.rows[0].now };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}
