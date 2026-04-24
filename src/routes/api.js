import express from 'express';
import { dbHealth, query } from '../db.js';
import { calculatePriority } from '../domain/prioritization.js';

export const apiRouter = express.Router();
const hasDatabase = Boolean(process.env.DATABASE_URL);

const demoDashboard = [
  {
    client_id: 'demo-client-1',
    client_name: 'Agência Alpha',
    tasks_in_progress: 2,
    tasks_waiting_client: 1,
    blocked_tasks: 0,
  },
  {
    client_id: 'demo-client-2',
    client_name: 'Distribuidora Beta',
    tasks_in_progress: 1,
    tasks_waiting_client: 2,
    blocked_tasks: 1,
  },
];

const demoWaitingTasks = [
  {
    task_id: 'demo-task-1',
    title: 'Validar novo estágio de qualificação',
    owner: 'daniel',
    client_name: 'Agência Alpha',
    waiting_since: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
  {
    task_id: 'demo-task-2',
    title: 'Enviar acesso da API Kommo',
    owner: 'bruna',
    client_name: 'Distribuidora Beta',
    waiting_since: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
];

const demoKanbanTasks = [
  {
    id: 'k-1',
    title: 'Mapear pipeline atual',
    status: 'backlog',
    owner: 'daniel',
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6).toISOString(),
    project_name: 'Reestruturação Funil Kommo',
    client_name: 'Agência Alpha',
    sub_client_name: 'Clínica Vida',
  },
  {
    id: 'k-2',
    title: 'Definir campos obrigatórios',
    status: 'a_fazer_sprint',
    owner: 'bruna',
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    project_name: 'Reestruturação Funil Kommo',
    client_name: 'Agência Alpha',
    sub_client_name: 'Clínica Vida',
  },
  {
    id: 'k-3',
    title: 'Implementar webhook de lead',
    status: 'em_progresso',
    owner: 'daniel',
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
    project_name: 'Integração n8n + Kommo',
    client_name: 'Distribuidora Beta',
    sub_client_name: null,
  },
  {
    id: 'k-4',
    title: 'Enviar acessos API para cliente',
    status: 'aguardando_cliente',
    owner: 'bruna',
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1).toISOString(),
    project_name: 'Integração n8n + Kommo',
    client_name: 'Distribuidora Beta',
    sub_client_name: null,
  },
  {
    id: 'k-5',
    title: 'Revisar QA de automação',
    status: 'em_revisao',
    owner: 'daniel',
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4).toISOString(),
    project_name: 'Automação de follow-up',
    client_name: 'Agência Alpha',
    sub_client_name: 'Clínica Vida',
  },
  {
    id: 'k-6',
    title: 'Entregar dashboard comercial',
    status: 'concluido',
    owner: 'bruna',
    due_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    project_name: 'Dashboard BI',
    client_name: 'Distribuidora Beta',
    sub_client_name: null,
  },
];

apiRouter.get('/health', async (_req, res) => {
  const database = await dbHealth();

  const statusCode = database.ok ? 200 : 503;
  res.status(statusCode).json({
    service: 'clicknote-mvp',
    date: new Date().toISOString(),
    database,
  });
});

apiRouter.get('/dashboard/global', async (_req, res) => {
  if (!hasDatabase) {
    return res.json({ items: demoDashboard, source: 'demo' });
  }

  try {
    const result = await query(`
      select *
      from vw_dashboard_global
      order by client_name asc
    `);

    res.json({ items: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao consultar dashboard global', details: error.message });
  }
});

apiRouter.get('/tasks/waiting', async (_req, res) => {
  if (!hasDatabase) {
    return res.json({ items: demoWaitingTasks, source: 'demo' });
  }

  try {
    const result = await query(`
      select *
      from vw_tasks_waiting_followup
      order by waiting_since asc
    `);

    res.json({ items: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao consultar tarefas aguardando cliente', details: error.message });
  }
});

apiRouter.get('/clients', async (_req, res) => {
  if (!hasDatabase) {
    return res.json({
      items: [
        {
          id: 'demo-client-1',
          name: 'Agência Alpha',
          engagement: 'recorrente_mensal',
          is_intermediary: true,
          responsible_mode: 'daniel_bruna',
          has_kommo_resale: true,
          active: true,
        },
      ],
      source: 'demo',
    });
  }

  try {
    const result = await query(`
      select id, name, engagement, is_intermediary, responsible_mode, has_kommo_resale, active
      from clients
      where active = true
      order by name asc
    `);

    res.json({ items: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao consultar clientes', details: error.message });
  }
});

apiRouter.get('/projects', async (req, res) => {
  const { clientId } = req.query;

  if (!hasDatabase) {
    return res.json({
      items: [
        {
          id: 'demo-project-1',
          name: 'Reestruturação Funil Kommo',
          type: 'implementacao',
          status: 'em_andamento',
          client_id: clientId ?? 'demo-client-1',
          client_name: 'Agência Alpha',
          sub_client_name: 'Clínica Vida',
        },
      ],
      source: 'demo',
    });
  }

  try {
    const params = [];
    let sql = `
      select p.id, p.name, p.type, p.status, p.client_id, c.name as client_name, sc.name as sub_client_name
      from projects p
      join clients c on c.id = p.client_id
      left join sub_clients sc on sc.id = p.sub_client_id
    `;

    if (clientId) {
      params.push(clientId);
      sql += ` where p.client_id = $1 `;
    }

    sql += ' order by c.name asc, p.name asc';

    const result = await query(sql, params);
    res.json({ items: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao consultar projetos', details: error.message });
  }
});

apiRouter.get('/kanban/tasks', async (req, res) => {
  const { projectId, owner } = req.query;

  if (!hasDatabase) {
    const filtered = demoKanbanTasks.filter((task) => {
      if (owner && task.owner !== owner) return false;
      return true;
    });
    return res.json({ items: filtered, source: 'demo' });
  }

  try {
    const params = [];
    const where = [];

    if (projectId) {
      params.push(projectId);
      where.push(`t.project_id = $${params.length}`);
    }

    if (owner) {
      params.push(owner);
      where.push(`t.owner = $${params.length}`);
    }

    const whereClause = where.length ? `where ${where.join(' and ')}` : '';

    const result = await query(
      `
      select
        t.id,
        t.title,
        t.status,
        t.owner,
        t.due_date,
        p.id as project_id,
        p.name as project_name,
        c.name as client_name,
        sc.name as sub_client_name
      from tasks t
      join projects p on p.id = t.project_id
      join clients c on c.id = p.client_id
      left join sub_clients sc on sc.id = p.sub_client_id
      ${whereClause}
      order by t.created_at asc
      `,
      params,
    );

    res.json({ items: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao consultar kanban', details: error.message });
  }
});

apiRouter.post('/backlog/priority', (req, res) => {
  const { impacto, urgencia, risco } = req.body ?? {};

  try {
    const score = calculatePriority({ impacto, urgencia, risco });
    res.json({ score });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

apiRouter.post('/tasks', async (req, res) => {
  if (!hasDatabase) {
    return res.status(201).json({ source: 'demo', message: 'Read-only demo mode' });
  }
  try {
    const { title, status, owner, project_id, task_type } = req.body;
    const result = await query(
      `insert into tasks (title, status, owner, project_id, task_type) 
       values ($1, $2, $3, coalesce($4, (select min(id) from projects)), coalesce($5, 'implementacao')) 
       returning *`,
      [title, status, owner, project_id, task_type]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Falha ao criar tarefa', details: error.message });
  }
});

apiRouter.put('/tasks/:id', async (req, res) => {
  if (!hasDatabase) {
    return res.status(200).json({ source: 'demo', message: 'Read-only demo mode' });
  }
  try {
    const { id } = req.params;
    const { title, status, owner } = req.body;
    const result = await query(
      `update tasks set title = $1, status = $2, owner = $3, updated_at = now() 
       where id = $4 
       returning *`,
      [title, status, owner, id]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Falha ao atualizar tarefa', details: error.message });
  }
});
