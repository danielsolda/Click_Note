import express from 'express';
import { query } from '../db.js';
import { asyncRoute } from '../middleware/error-handler.js';

export const tasksRouter = express.Router();

const hasDatabase = Boolean(process.env.DATABASE_URL);

const DEMO_TASKS = [
  { id: 'k-1', title: 'Mapear pipeline atual', status: 'backlog', owner: 'daniel', due_date: null, project_id: 'demo-proj-1', project_name: 'Reestruturação Funil', client_id: 'demo-client-1', client_name: 'Agência Alpha', sub_client_name: 'Clínica Vida', active_since: null },
  { id: 'k-2', title: 'Definir campos obrigatórios', status: 'a_fazer_sprint', owner: 'bruna', due_date: null, project_id: 'demo-proj-1', project_name: 'Reestruturação Funil', client_id: 'demo-client-1', client_name: 'Agência Alpha', sub_client_name: null, active_since: null },
  { id: 'k-3', title: 'Implementar webhook de lead', status: 'em_progresso', owner: 'daniel', due_date: null, project_id: 'demo-proj-2', project_name: 'Integração n8n + Kommo', client_id: 'demo-client-2', client_name: 'Distribuidora Beta', sub_client_name: null, active_since: new Date(Date.now() - 1000 * 60 * 95).toISOString() },
  { id: 'k-4', title: 'Enviar acessos API para cliente', status: 'aguardando_cliente', owner: 'bruna', due_date: null, project_id: 'demo-proj-2', project_name: 'Integração n8n + Kommo', client_id: 'demo-client-2', client_name: 'Distribuidora Beta', sub_client_name: null, active_since: null },
  { id: 'k-5', title: 'Revisar QA de automação', status: 'em_revisao', owner: 'daniel', due_date: null, project_id: 'demo-proj-3', project_name: 'Automação de follow-up', client_id: 'demo-client-1', client_name: 'Agência Alpha', sub_client_name: null, active_since: null },
  { id: 'k-6', title: 'Entregar dashboard comercial', status: 'concluido', owner: 'bruna', due_date: null, project_id: 'demo-proj-2', project_name: 'Integração n8n + Kommo', client_id: 'demo-client-2', client_name: 'Distribuidora Beta', sub_client_name: null, active_since: null },
];

function withActiveMetrics(task) {
  if (task.status !== 'em_progresso' || !task.active_since) {
    return { ...task, active_since: null, active_seconds: 0 };
  }

  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(task.active_since).getTime()) / 1000));
  return {
    ...task,
    active_seconds: elapsed,
  };
}

function applyStatusTransition(task, nextStatus) {
  if (nextStatus === 'em_progresso' && task.status !== 'em_progresso') {
    task.active_since = new Date().toISOString();
  }
  if (nextStatus !== 'em_progresso') {
    task.active_since = null;
  }
  task.status = nextStatus;
}

// Kanban: listar tarefas com filtros
tasksRouter.get('/kanban', asyncRoute(async (req, res) => {
  if (!hasDatabase) {
    let tasks = [...DEMO_TASKS];
    const { projectId, owner } = req.query;

    if (projectId) {
      tasks = tasks.filter(t => String(t.project_id) === String(projectId));
    }

    if (req.user?.role === 'client') {
      tasks = tasks.filter(t => t.client_id === req.user.clientId);
    } else {
      if (owner) tasks = tasks.filter(t => t.owner === owner);
    }
    return res.json({ items: tasks.map(withActiveMetrics), source: 'demo' });
  }

  const { projectId, owner } = req.query;
  const params = [];
  const where = [];

  // Client role: restrict to their own client
  if (req.user?.role === 'client' && req.user?.clientId) {
    params.push(req.user.clientId);
    where.push(`p.client_id = $${params.length}`);
  }

  if (projectId) {
    params.push(projectId);
    where.push(`t.project_id = $${params.length}`);
  }
  if (owner && req.user?.role === 'admin') {
    params.push(owner);
    where.push(`t.owner = $${params.length}`);
  }

  const whereClause = where.length ? `where ${where.join(' and ')}` : '';

  const result = await query(
    `select
       t.id, t.title, t.status, t.owner, t.due_date, t.effort_label,
       t.story_points, t.description, t.task_type, t.is_recurring,
       t.waiting_since, t.followup_channel,
      case when t.status = 'em_progresso' then t.updated_at else null end as active_since,
      case when t.status = 'em_progresso' then extract(epoch from (now() - t.updated_at))::int else 0 end as active_seconds,
       p.id as project_id, p.name as project_name,
       c.id as client_id, c.name as client_name,
       sc.name as sub_client_name
     from tasks t
     join projects p  on p.id = t.project_id
     join clients c   on c.id = p.client_id
     left join sub_clients sc on sc.id = p.sub_client_id
     ${whereClause}
     order by t.created_at asc`,
    params,
  );
  res.json({ items: result.rows });
}));

// Criar tarefa
tasksRouter.post('/', asyncRoute(async (req, res) => {
  const {
    project_id, title, description, task_type, status, owner,
    effort_label, story_points, due_date, is_recurring, recurrence_interval,
  } = req.body;

  if (!project_id || !title) {
    return res.status(400).json({ error: 'Campos "project_id" e "title" são obrigatórios' });
  }

  if (!hasDatabase) {
    const newTask = {
      id: `demo-${Date.now()}`,
      project_id,
      title,
      description: description ?? null,
      status: status ?? 'backlog',
      owner: owner ?? 'daniel',
      active_since: (status ?? 'backlog') === 'em_progresso' ? new Date().toISOString() : null,
      project_name: 'Projeto (demo)',
      client_id: req.user?.clientId ?? 'demo-client-1',
      client_name: 'Conta (demo)',
      sub_client_name: null,
    };
    DEMO_TASKS.push(newTask);
    return res.status(201).json({
      ...withActiveMetrics(newTask),
      source: 'demo',
    });
  }

  const result = await query(
    `insert into tasks
       (project_id, title, description, task_type, status, owner,
        effort_label, story_points, due_date, is_recurring, recurrence_interval)
     values ($1, $2, $3, coalesce($4, 'implementacao'), coalesce($5, 'backlog'),
             coalesce($6, 'daniel'), $7, $8, $9, coalesce($10, false), $11)
     returning *`,
    [
      project_id, title, description ?? null, task_type, status, owner,
      effort_label ?? null, story_points ?? null, due_date ?? null,
      is_recurring, recurrence_interval ?? null,
    ],
  );
  res.status(201).json(result.rows[0]);
}));

// Atualizar tarefa (campos completos)
tasksRouter.put('/:id', asyncRoute(async (req, res) => {
  const { id } = req.params;
  const {
    title, description, task_type, status, owner,
    effort_label, story_points, due_date,
    followup_channel, followup_note,
  } = req.body;

  if (!hasDatabase) {
    const task = DEMO_TASKS.find(t => String(t.id) === String(id));
    if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (owner !== undefined) task.owner = owner;
    if (status !== undefined) applyStatusTransition(task, status);

    return res.json({ ...withActiveMetrics(task), source: 'demo' });
  }

  const result = await query(
    `update tasks
     set title            = coalesce($1, title),
         description      = coalesce($2, description),
         task_type        = coalesce($3::task_type, task_type),
         status           = coalesce($4::task_status, status),
         owner            = coalesce($5::owner_name, owner),
         effort_label     = coalesce($6::effort_label, effort_label),
         story_points     = coalesce($7, story_points),
         due_date         = coalesce($8, due_date),
         followup_channel = coalesce($9, followup_channel),
         followup_note    = coalesce($10, followup_note)
     where id = $11
     returning *`,
    [title, description, task_type, status, owner, effort_label, story_points, due_date, followup_channel, followup_note, id],
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Tarefa não encontrada' });
  res.json(result.rows[0]);
}));

// Atualizar só o status (usado pelo drag-and-drop do Kanban)
tasksRouter.patch('/:id/status', asyncRoute(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Campo "status" é obrigatório' });

  if (!hasDatabase) {
    const task = DEMO_TASKS.find(t => String(t.id) === String(id));
    if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });

    applyStatusTransition(task, status);
    return res.json({
      id: task.id,
      status: task.status,
      active_since: task.active_since,
      active_seconds: withActiveMetrics(task).active_seconds,
      source: 'demo',
    });
  }

  const result = await query(
    `update tasks
     set status = $1::task_status
     where id = $2
     returning
       id,
       status,
       waiting_since,
       case when status = 'em_progresso' then updated_at else null end as active_since,
       case when status = 'em_progresso' then extract(epoch from (now() - updated_at))::int else 0 end as active_seconds`,
    [status, id],
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Tarefa não encontrada' });
  res.json(result.rows[0]);
}));

// Deletar tarefa
tasksRouter.delete('/:id', asyncRoute(async (req, res) => {
  const { id } = req.params;

  if (!hasDatabase) {
    const index = DEMO_TASKS.findIndex(t => String(t.id) === String(id));
    if (index >= 0) DEMO_TASKS.splice(index, 1);
    return res.status(204).send();
  }

  await query(`delete from tasks where id = $1`, [id]);
  res.status(204).send();
}));
