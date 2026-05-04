import bcrypt from 'bcryptjs';
import { pool } from './db.js';

// Garante que existe pelo menos um cliente (parceiro) no banco
// e cria o usuário cliente se as variáveis estiverem definidas.
// Roda no startup — idempotente (não duplica).

export async function seedInitialData() {
  if (!process.env.DATABASE_URL) return;

  const client = await pool.connect();
  try {
    // 1. Garante que existe um parceiro
    let { rows: clients } = await client.query(
      `select id from clients where active = true order by created_at asc limit 1`,
    );

    let partnerId;
    if (clients.length === 0) {
      const partnerName = process.env.PARTNER_NAME ?? 'Parceiro';
      const { rows: created } = await client.query(
        `insert into clients (name, type, active)
         values ($1, 'recorrente', true)
         returning id`,
        [partnerName],
      );
      partnerId = created[0].id;
      console.log(`[seed-initial] Parceiro criado: ${partnerName} (${partnerId})`);
    } else {
      partnerId = clients[0].id;
    }

    // 2. Cria usuário cliente se CLIENT_EMAIL estiver definido
    const clientEmail    = process.env.CLIENT_EMAIL;
    const clientPassword = process.env.CLIENT_PASSWORD;
    const clientName     = process.env.CLIENT_NAME ?? 'Cliente';

    if (!clientEmail || !clientPassword) return;

    const { rows: existing } = await client.query(
      `select id from users where lower(email) = lower($1) limit 1`,
      [clientEmail],
    );
    if (existing.length > 0) return;

    const password_hash = await bcrypt.hash(clientPassword, 12);
    await client.query(
      `insert into users (name, email, password_hash, role, client_id, active)
       values ($1, $2, $3, 'client', $4, true)
       on conflict (email) do nothing`,
      [clientName, clientEmail, password_hash, partnerId],
    );
    console.log(`[seed-initial] Usuário cliente criado: ${clientEmail}`);
  } finally {
    client.release();
  }
}
