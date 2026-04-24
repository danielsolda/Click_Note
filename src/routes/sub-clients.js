import express from 'express';
import { query } from '../db.js';
import { asyncRoute } from '../middleware/error-handler.js';

export const subClientsRouter = express.Router();

subClientsRouter.get('/', asyncRoute(async (req, res) => {
  const { clientId } = req.query;
  const params = [];
  let sql = `select * from sub_clients where active = true`;
  if (clientId) {
    params.push(clientId);
    sql += ` and client_id = $${params.length}`;
  }
  sql += ' order by name asc';
  const result = await query(sql, params);
  res.json({ items: result.rows });
}));

subClientsRouter.post('/', asyncRoute(async (req, res) => {
  const { client_id, name, business_context } = req.body;
  if (!client_id || !name) {
    return res.status(400).json({ error: 'Campos "client_id" e "name" são obrigatórios' });
  }
  const result = await query(
    `insert into sub_clients (client_id, name, business_context)
     values ($1, $2, $3)
     returning *`,
    [client_id, name, business_context],
  );
  res.status(201).json(result.rows[0]);
}));

subClientsRouter.put('/:id', asyncRoute(async (req, res) => {
  const { id } = req.params;
  const { name, business_context } = req.body;
  const result = await query(
    `update sub_clients
     set name             = coalesce($1, name),
         business_context = coalesce($2, business_context)
     where id = $3
     returning *`,
    [name, business_context, id],
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Sub-cliente não encontrado' });
  res.json(result.rows[0]);
}));

subClientsRouter.delete('/:id', asyncRoute(async (req, res) => {
  const { id } = req.params;
  await query(`update sub_clients set active = false where id = $1`, [id]);
  res.status(204).send();
}));
