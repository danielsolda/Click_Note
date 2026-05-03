import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '..', 'database', 'migrations');

// Cada chamada usa uma conexão nova para garantir cache de catálogo limpo
// (necessário para ALTER TYPE ADD VALUE seguido de uso do novo valor)
async function withClient(pool, fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function ensureMigrationsTable(pool) {
  await withClient(pool, async (client) => {
    await client.query('begin');
    await client.query(`
      create table if not exists schema_migrations (
        filename   text        primary key,
        applied_at timestamptz not null default now()
      )
    `);
    await client.query('commit');
  });
}

async function getAppliedMigrations(pool) {
  return withClient(pool, async (client) => {
    const result = await client.query(
      'select filename from schema_migrations order by filename asc',
    );
    return new Set(result.rows.map((r) => r.filename));
  });
}

async function getPendingMigrations(applied) {
  const files = await fs.readdir(migrationsDir);
  return files
    .filter((f) => f.endsWith('.sql') && !applied.has(f))
    .sort();
}

// Cada migration roda em sua própria conexão + transação
async function applyMigration(pool, filename) {
  await withClient(pool, async (client) => {
    const filePath = path.join(migrationsDir, filename);
    const sql = await fs.readFile(filePath, 'utf8');

    console.log(`[migrate] Aplicando ${filename}...`);
    await client.query('begin');
    await client.query(sql);
    await client.query(
      'insert into schema_migrations (filename) values ($1)',
      [filename],
    );
    await client.query('commit');
    console.log(`[migrate] ${filename} aplicado com sucesso.`);
  });
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: 3,
  });

  try {
    await ensureMigrationsTable(pool);

    const applied = await getAppliedMigrations(pool);
    const pending = await getPendingMigrations(applied);

    if (pending.length === 0) {
      console.log('[migrate] Nenhuma migração pendente. Banco atualizado.');
      return;
    }

    for (const filename of pending) {
      try {
        await applyMigration(pool, filename);
      } catch (error) {
        console.error(`[migrate] Erro em ${filename} — rollback executado:`, error.message);
        process.exitCode = 1;
        return;
      }
    }

    console.log(`[migrate] ${pending.length} migração(ões) aplicada(s).`);
  } finally {
    await pool.end();
  }
}

main();
