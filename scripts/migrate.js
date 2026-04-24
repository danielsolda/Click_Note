import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '..', 'database', 'migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists schema_migrations (
      filename   text        primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query(
    'select filename from schema_migrations order by filename asc',
  );
  return new Set(result.rows.map((r) => r.filename));
}

async function getPendingMigrations(applied) {
  const files = await fs.readdir(migrationsDir);
  return files
    .filter((f) => f.endsWith('.sql') && !applied.has(f))
    .sort();
}

async function applyMigration(client, filename) {
  const filePath = path.join(migrationsDir, filename);
  const sql = await fs.readFile(filePath, 'utf8');

  console.log(`[migrate] Aplicando ${filename}...`);
  await client.query(sql);
  await client.query(
    'insert into schema_migrations (filename) values ($1)',
    [filename],
  );
  console.log(`[migrate] ${filename} aplicado com sucesso.`);
}

async function main() {
  const client = await pool.connect();

  try {
    await client.query('begin');
    await ensureMigrationsTable(client);

    const applied = await getAppliedMigrations(client);
    const pending = await getPendingMigrations(applied);

    if (pending.length === 0) {
      console.log('[migrate] Nenhuma migração pendente. Banco atualizado.');
      await client.query('commit');
      return;
    }

    for (const filename of pending) {
      await applyMigration(client, filename);
    }

    await client.query('commit');
    console.log(`[migrate] ${pending.length} migração(ões) aplicada(s).`);
  } catch (error) {
    await client.query('rollback');
    console.error('[migrate] Erro — rollback executado:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
