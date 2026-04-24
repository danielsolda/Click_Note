import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requireAuth, requireAdmin, JWT_SECRET } from '../middleware/auth.js';

export const authRouter = express.Router();

const hasDatabase = Boolean(process.env.DATABASE_URL);

// Demo users (plain-text passwords for local testing only)
const DEMO_USERS = [
  {
    id: 'admin-1',
    name: 'Daniel (Admin)',
    email: 'admin@clicknote.app',
    password: 'admin123',
    role: 'admin',
    client_id: null,
  },
  {
    id: 'client-alpha',
    name: 'Agência Alpha',
    email: 'alpha@demo.com',
    password: 'demo123',
    role: 'client',
    client_id: 'demo-client-1',
  },
  {
    id: 'client-beta',
    name: 'Distribuidora Beta',
    email: 'beta@demo.com',
    password: 'demo123',
    role: 'client',
    client_id: 'demo-client-2',
  },
];

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
  }

  try {
    let user = null;

    if (!hasDatabase) {
      user = DEMO_USERS.find(u => u.email === email && u.password === password) ?? null;
    } else {
      const { rows } = await query(
        `SELECT id, name, email, password_hash, role, client_id
         FROM users WHERE email = $1 AND active = true LIMIT 1`,
        [email],
      );
      if (rows.length) {
        const match = await bcrypt.compare(password, rows[0].password_hash);
        if (match) user = rows[0];
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const payload = {
      userId: user.id,
      name: user.name,
      role: user.role,
      clientId: user.client_id,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

    res.json({ token, user: payload });
  } catch (error) {
    res.status(500).json({ error: 'Falha na autenticação', details: error.message });
  }
});

// Validate token and return current user
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// List client users (admin only)
authRouter.get('/users', requireAuth, requireAdmin, async (_req, res) => {
  try {
    if (!hasDatabase) {
      const items = DEMO_USERS
        .filter((u) => u.role === 'client')
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          client_id: u.client_id,
        }));

      return res.json({ items, source: 'demo' });
    }

    await query(`
      create table if not exists users (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        email text not null unique,
        password_hash text not null,
        role text not null check (role in ('admin', 'client')),
        client_id uuid references clients(id) on delete set null,
        active boolean not null default true,
        created_at timestamptz not null default now()
      )
    `);

    const result = await query(
      `select id, name, email, role, client_id
       from users
       where active = true and role = 'client'
       order by created_at desc`,
    );

    return res.json({ items: result.rows });
  } catch (error) {
    return res.status(500).json({ error: 'Falha ao listar usuários', details: error.message });
  }
});

// Create client user (admin only)
authRouter.post('/users', requireAuth, requireAdmin, async (req, res) => {
  const { name, email, password, client_id } = req.body ?? {};

  if (!name || !email || !password || !client_id) {
    return res.status(400).json({ error: 'Campos "name", "email", "password" e "client_id" são obrigatórios' });
  }

  try {
    if (!hasDatabase) {
      const exists = DEMO_USERS.some((u) => u.email.toLowerCase() === String(email).toLowerCase());
      if (exists) return res.status(409).json({ error: 'E-mail já cadastrado' });

      const demoUser = {
        id: `client-${Date.now()}`,
        name,
        email,
        password,
        role: 'client',
        client_id,
      };

      DEMO_USERS.push(demoUser);

      return res.status(201).json({
        id: demoUser.id,
        name: demoUser.name,
        email: demoUser.email,
        role: demoUser.role,
        client_id: demoUser.client_id,
        source: 'demo',
      });
    }

    await query(`
      create table if not exists users (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        email text not null unique,
        password_hash text not null,
        role text not null check (role in ('admin', 'client')),
        client_id uuid references clients(id) on delete set null,
        active boolean not null default true,
        created_at timestamptz not null default now()
      )
    `);

    const dup = await query(`select id from users where lower(email) = lower($1) limit 1`, [email]);
    if (dup.rows[0]) return res.status(409).json({ error: 'E-mail já cadastrado' });

    const password_hash = await bcrypt.hash(password, 10);
    const created = await query(
      `insert into users (name, email, password_hash, role, client_id)
       values ($1, $2, $3, 'client', $4)
       returning id, name, email, role, client_id`,
      [name, email, password_hash, client_id],
    );

    return res.status(201).json(created.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: 'Falha ao criar usuário', details: error.message });
  }
});
