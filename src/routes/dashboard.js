import express from 'express';
import { query } from '../db.js';
import { asyncRoute } from '../middleware/error-handler.js';

export const dashboardRouter = express.Router();

const hasDatabase = Boolean(process.env.DATABASE_URL);

const DEMO_DASHBOARD = [
  { client_id: 'demo-client-1', client_name: 'Agência Alpha', tasks_in_progress: 2, tasks_waiting_client: 1, blocked_tasks: 0 },
  { client_id: 'demo-client-2', client_name: 'Distribuidora Beta', tasks_in_progress: 1, tasks_waiting_client: 1, blocked_tasks: 0 },
];

const DEMO_WAITING = [
  { task_id: 'k-4', title: 'Enviar acessos API para cliente', owner: 'bruna', client_name: 'Distribuidora Beta', waiting_since: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString() },
];

dashboardRouter.get('/global', asyncRoute(async (_req, res) => {
  if (!hasDatabase) return res.json({ items: DEMO_DASHBOARD, source: 'demo' });
  const result = await query(`
    select *
    from vw_dashboard_global
    order by client_name asc
  `);
  res.json({ items: result.rows });
}));

dashboardRouter.get('/tasks/waiting', asyncRoute(async (_req, res) => {
  if (!hasDatabase) return res.json({ items: DEMO_WAITING, source: 'demo' });
  const result = await query(`
    select *
    from vw_tasks_waiting_followup
    order by waiting_since asc
  `);
  res.json({ items: result.rows });
}));
