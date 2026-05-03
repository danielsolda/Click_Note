import express from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/error-handler.js';

export const reportsRouter = express.Router();

export async function generateDailyReports() {
  const { rows: clients } = await query(
    `select id, name from clients where active = true`,
  );

  for (const client of clients) {
    const { rows: byStatus } = await query(
      `select t.status, count(*)::int as count
       from tasks t
       join projects p on p.id = t.project_id
       where p.client_id = $1
       group by t.status`,
      [client.id],
    );

    const { rows: subClients } = await query(
      `select id, name from sub_clients where client_id = $1 and active = true`,
      [client.id],
    );

    const subSummaries = [];
    for (const sc of subClients) {
      const { rows: scTasks } = await query(
        `select t.status, count(*)::int as count
         from tasks t
         join projects p on p.id = t.project_id
         where p.sub_client_id = $1
         group by t.status`,
        [sc.id],
      );
      subSummaries.push({
        id: sc.id,
        name: sc.name,
        tasks: Object.fromEntries(scTasks.map((r) => [r.status, r.count])),
        total: scTasks.reduce((s, r) => s + r.count, 0),
      });
    }

    const summary = {
      client_name: client.name,
      tasks: Object.fromEntries(byStatus.map((r) => [r.status, r.count])),
      total: byStatus.reduce((s, r) => s + r.count, 0),
      sub_clients: subSummaries,
    };

    await query(
      `insert into daily_reports (client_id, report_date, summary)
       values ($1, current_date, $2)
       on conflict (client_id, report_date)
       do update set summary = excluded.summary, generated_at = now()`,
      [client.id, JSON.stringify(summary)],
    );
  }

  console.log(`[reports] Relatório gerado para ${clients.length} cliente(s).`);
}

// GET /api/reports/daily — lista relatórios (admin)
reportsRouter.get('/daily', requireAdmin, asyncRoute(async (req, res) => {
  const { clientId, date } = req.query;
  const where = [];
  const params = [];

  if (clientId) { params.push(clientId); where.push(`r.client_id = $${params.length}`); }
  if (date)     { params.push(date);     where.push(`r.report_date = $${params.length}`); }

  const whereClause = where.length ? `where ${where.join(' and ')}` : '';

  const { rows } = await query(
    `select r.id, r.report_date, r.generated_at, r.summary,
            c.name as client_name
     from daily_reports r
     join clients c on c.id = r.client_id
     ${whereClause}
     order by r.report_date desc, c.name asc
     limit 90`,
    params,
  );
  res.json({ items: rows });
}));

// POST /api/reports/daily/generate — gera manualmente (admin)
reportsRouter.post('/daily/generate', requireAdmin, asyncRoute(async (_req, res) => {
  await generateDailyReports();
  res.json({ ok: true, message: 'Relatório gerado com sucesso.' });
}));
