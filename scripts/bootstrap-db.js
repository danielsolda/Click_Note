import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, pool } from '../src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '..', 'supabase', 'schema.sql');

async function main() {
  console.log('[bootstrap-db] Lendo schema...');
  const sql = await fs.readFile(schemaPath, 'utf8');

  console.log('[bootstrap-db] Aplicando schema no banco...');
  await query(sql);

  console.log('[bootstrap-db] Schema aplicado com sucesso.');
}

main()
  .catch((error) => {
    console.error('[bootstrap-db] Falha ao aplicar schema:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
