import express from 'express';
import { query } from '../db.js';
import { calculatePriority, sortBacklogByPriority } from '../domain/prioritization.js';
import { asyncRoute } from '../middleware/error-handler.js';

export const backlogRouter = express.Router();

// Calcular score de prioridade avulso (mantém compatibilidade)
backlogRouter.post('/priority', (req, res) => {
  const { impacto, urgencia, risco } = req.body ?? {};
  try {
    const score = calculatePriority({ impacto, urgencia, risco });
    res.json({ score });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Retorna backlog ordenado por prioridade (story_points e due_date como proxy)
backlogRouter.get('/sorted', asyncRoute(async (req, res) => {
  const { projectId, clientId, owner } = req.query;
  const params = [];
  const where = [`t.status in ('backlog', 'a_fazer_sprint')`];

  if (projectId) {
    params.push(projectId);
    where.push(`t.project_id = $${params.length}`);
  }
  if (clientId) {
    params.push(clientId);
    where.push(`p.client_id = $${params.length}`);
  }
  if (owner) {
    params.push(owner);
    where.push(`t.owner = $${params.length}`);
  }

  const result = await query(
    `select
       t.id, t.title, t.status, t.owner, t.due_date, t.effort_label,
       t.story_points, t.task_type,
       p.name as project_name, c.name as client_name
     from tasks t
     join projects p on p.id = t.project_id
     join clients c  on c.id = p.client_id
     where ${where.join(' and ')}
     order by t.due_date asc nulls last, t.story_points desc nulls last`,
    params,
  );

  // Aplica cálculo de prioridade usando story_points e proximidade do due_date como proxies
  const now = Date.now();
  const items = result.rows.map((t) => {
    const daysUntilDue = t.due_date
      ? Math.max(0, (new Date(t.due_date) - now) / (1000 * 60 * 60 * 24))
      : 30;
    const urgencia = daysUntilDue <= 2 ? 5 : daysUntilDue <= 7 ? 4 : daysUntilDue <= 14 ? 3 : daysUntilDue <= 30 ? 2 : 1;
    const impacto = Math.min(5, t.story_points ?? 2);
    const score = calculatePriority({ impacto, urgencia, risco: 2 });
    return { ...t, priority_score: score };
  });

  res.json({ items: sortBacklogByPriority(items) });
}));
