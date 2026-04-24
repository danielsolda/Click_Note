import express from 'express';
import { query } from '../db.js';
import { asyncRoute } from '../middleware/error-handler.js';

export const licensesRouter = express.Router();

licensesRouter.get('/', asyncRoute(async (_req, res) => {
  const result = await query(`select * from vw_kommo_expiry_alerts`);
  res.json({ items: result.rows });
}));

licensesRouter.get('/alerts', asyncRoute(async (_req, res) => {
  const result = await query(
    `select * from vw_kommo_expiry_alerts where risk_level != 'ok'`,
  );
  res.json({ items: result.rows });
}));

licensesRouter.post('/', asyncRoute(async (req, res) => {
  const { client_id, plan_name, expires_on, contracted_users, active_users, second_link_payment_status, notes } = req.body;
  if (!client_id || !plan_name || !expires_on) {
    return res.status(400).json({ error: 'Campos "client_id", "plan_name" e "expires_on" são obrigatórios' });
  }
  const result = await query(
    `insert into kommo_licenses
       (client_id, plan_name, expires_on, contracted_users, active_users, second_link_payment_status, notes)
     values ($1, $2, $3, coalesce($4, 0), coalesce($5, 0), coalesce($6, 'ok'), $7)
     returning *`,
    [client_id, plan_name, expires_on, contracted_users, active_users, second_link_payment_status, notes ?? null],
  );
  res.status(201).json(result.rows[0]);
}));

licensesRouter.put('/:id', asyncRoute(async (req, res) => {
  const { id } = req.params;
  const { plan_name, expires_on, contracted_users, active_users, second_link_payment_status, notes } = req.body;
  const result = await query(
    `update kommo_licenses
     set plan_name                  = coalesce($1, plan_name),
         expires_on                 = coalesce($2, expires_on),
         contracted_users           = coalesce($3, contracted_users),
         active_users               = coalesce($4, active_users),
         second_link_payment_status = coalesce($5::payment_status, second_link_payment_status),
         notes                      = coalesce($6, notes)
     where id = $7
     returning *`,
    [plan_name, expires_on, contracted_users, active_users, second_link_payment_status, notes, id],
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Licença não encontrada' });
  res.json(result.rows[0]);
}));

licensesRouter.delete('/:id', asyncRoute(async (req, res) => {
  const { id } = req.params;
  await query(`delete from kommo_licenses where id = $1`, [id]);
  res.status(204).send();
}));
