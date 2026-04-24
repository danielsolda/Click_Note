import express from 'express';
import { query } from '../db.js';
import { asyncRoute } from '../middleware/error-handler.js';

export const clientsRouter = express.Router();

clientsRouter.get('/', asyncRoute(async (_req, res) => {
  const result = await query(`
    select id, name, type, engagement, is_intermediary, responsible_mode,
           has_kommo_resale, active, created_at
    from clients
    where active = true
    order by name asc
  `);
  res.json({ items: result.rows });
}));

clientsRouter.get('/:id', asyncRoute(async (req, res) => {
  const { id } = req.params;
  const [clientResult, subResult] = await Promise.all([
    query(`select * from clients where id = $1`, [id]),
    query(`select * from sub_clients where client_id = $1 and active = true order by name asc`, [id]),
  ]);
  if (!clientResult.rows[0]) {
    return res.status(404).json({ error: 'Cliente não encontrado' });
  }
  res.json({ ...clientResult.rows[0], sub_clients: subResult.rows });
}));

clientsRouter.post('/', asyncRoute(async (req, res) => {
  const { name, type, responsible_mode, is_intermediary, has_kommo_resale, engagement } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Campo "name" é obrigatório' });
  }
  const result = await query(
    `insert into clients (name, type, responsible_mode, is_intermediary, has_kommo_resale, engagement)
     values ($1, coalesce($2, 'recorrente'), coalesce($3, 'daniel_bruna'), coalesce($4, false), coalesce($5, false), $6)
     returning *`,
    [name, type, responsible_mode, is_intermediary, has_kommo_resale, engagement],
  );
  res.status(201).json(result.rows[0]);
}));

clientsRouter.put('/:id', asyncRoute(async (req, res) => {
  const { id } = req.params;
  const { name, type, responsible_mode, is_intermediary, has_kommo_resale, engagement } = req.body;
  const result = await query(
    `update clients
     set name             = coalesce($1, name),
         type             = coalesce($2::client_type, type),
         responsible_mode = coalesce($3::responsible_mode, responsible_mode),
         is_intermediary  = coalesce($4, is_intermediary),
         has_kommo_resale = coalesce($5, has_kommo_resale),
         engagement       = coalesce($6, engagement)
     where id = $7
     returning *`,
    [name, type, responsible_mode, is_intermediary, has_kommo_resale, engagement, id],
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Cliente não encontrado' });
  res.json(result.rows[0]);
}));

clientsRouter.delete('/:id', asyncRoute(async (req, res) => {
  const { id } = req.params;
  await query(`update clients set active = false where id = $1`, [id]);
  res.status(204).send();
}));
