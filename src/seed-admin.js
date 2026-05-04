import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const email    = process.env.ADMIN_EMAIL    ?? 'admin@clicknote.app';
const password = process.env.ADMIN_PASSWORD ?? 'mude-em-producao!';
const name     = process.env.ADMIN_NAME     ?? 'Admin';

async function seedAdmin() {
  if (!process.env.DATABASE_URL) return;

  const client = await pool.connect();
  try {
    const password_hash = await bcrypt.hash(password, 12);
    const { rows } = await client.query(
      `insert into users (name, email, password_hash, role, active)
       values ($1, $2, $3, 'admin', true)
       on conflict (email) do update
         set password_hash = excluded.password_hash,
             name          = excluded.name,
             active        = true,
             updated_at    = now()
       returning id, email, (xmax = 0) as inserted`,
      [name, email, password_hash],
    );

    if (rows[0]?.inserted) {
      console.log(`[seed-admin] Admin criado: ${rows[0].email}`);
    } else {
      console.log(`[seed-admin] Admin atualizado: ${rows[0].email}`);
    }
  } finally {
    client.release();
  }
}

export { seedAdmin };
