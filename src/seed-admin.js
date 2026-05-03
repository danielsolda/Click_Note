import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const email    = process.env.ADMIN_EMAIL    ?? 'admin@clicknote.app';
const password = process.env.ADMIN_PASSWORD ?? 'mude-em-producao!';
const name     = process.env.ADMIN_NAME     ?? 'Admin';

async function seedAdmin() {
  if (!process.env.DATABASE_URL) return;

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `select id from users where role = 'admin' and active = true limit 1`,
    );

    if (rows.length > 0) {
      console.log('[seed-admin] Admin já existe. Nenhuma ação necessária.');
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);
    const { rows: created } = await client.query(
      `insert into users (name, email, password_hash, role, active)
       values ($1, $2, $3, 'admin', true)
       on conflict (email) do nothing
       returning id, email`,
      [name, email, password_hash],
    );

    if (created.length > 0) {
      console.log(`[seed-admin] Admin criado: ${created[0].email}`);
    }
  } finally {
    client.release();
  }
}

export { seedAdmin };
