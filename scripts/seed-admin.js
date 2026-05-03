/**
 * Cria (ou reseta a senha do) usuário admin inicial no banco.
 *
 * Uso:
 *   node scripts/seed-admin.js
 *
 * Variáveis de ambiente necessárias:
 *   DATABASE_URL  — string de conexão PostgreSQL
 *   ADMIN_EMAIL   — e-mail do admin (padrão: admin@clicknote.app)
 *   ADMIN_PASSWORD — senha do admin (padrão: mude-em-producao!)
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    ?? 'admin@clicknote.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'mude-em-producao!';
const ADMIN_NAME     = process.env.ADMIN_NAME     ?? 'Admin';

if (!process.env.DATABASE_URL) {
  console.error('❌  DATABASE_URL não definido. Configure o arquivo .env antes de continuar.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    const password_hash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    const { rows } = await client.query(
      `insert into users (name, email, password_hash, role, active)
       values ($1, $2, $3, 'admin', true)
       on conflict (email) do update
         set password_hash = excluded.password_hash,
             name          = excluded.name,
             active        = true,
             updated_at    = now()
       returning id, name, email, role`,
      [ADMIN_NAME, ADMIN_EMAIL, password_hash],
    );

    const u = rows[0];
    console.log('✅  Usuário admin criado/atualizado:');
    console.log(`    id:    ${u.id}`);
    console.log(`    email: ${u.email}`);
    console.log(`    role:  ${u.role}`);
    console.log('');
    console.log('⚠️   Lembre-se de trocar a senha após o primeiro login em produção!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('❌  Erro ao criar admin:', err.message);
  process.exit(1);
});
