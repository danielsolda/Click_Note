import express from 'express';
import { query } from '../db.js';
import { asyncRoute } from '../middleware/error-handler.js';

export const projectsRouter = express.Router();

const hasDatabase = Boolean(process.env.DATABASE_URL);

const DEMO_PROJECTS = [
  {
    id: 'demo-proj-1',
    name: 'Reestruturação Funil',
    type: 'implementacao',
    status: 'em_andamento',
    client_id: 'demo-client-1',
    client_name: 'Agência Alpha',
    sub_client_name: null,
    technical_context: {
      access_notes: 'Acesso principal via gestor comercial. Confirmar permissões de administrador.',
      initial_funnels: ['Funil Comercial', 'Funil Pós-venda'],
      whatsapp_channels: ['Grupo Operação - Agência Alpha'],
      service_rules: 'Priorizar chamados de vendas e responder em até 2h úteis.',
      client_team: ['Ana (gestora)', 'Carlos (comercial)'],
      demand_types: ['Implementação Kommo', 'Atualização de etapas'],
      integration_notes: 'Integração com landing pages via webhook.',
      quick_tasks: [],
    },
  },
  {
    id: 'demo-proj-2',
    name: 'Integração n8n + Kommo',
    type: 'integracao',
    status: 'em_andamento',
    client_id: 'demo-client-2',
    client_name: 'Distribuidora Beta',
    sub_client_name: null,
    technical_context: {
      access_notes: 'Conta técnica exclusiva para API com IP liberado.',
      initial_funnels: ['Funil B2B'],
      whatsapp_channels: ['Grupo Integração Beta'],
      service_rules: 'Toda alteração deve ser registrada com rollback descrito.',
      client_team: ['Bianca (TI)', 'Marcos (CRM)'],
      demand_types: ['Integração API aberta', 'Automações de follow-up'],
      integration_notes: 'Webhook Kommo -> n8n -> ERP interno.',
      quick_tasks: [],
    },
  },
  {
    id: 'demo-proj-3',
    name: 'Automação de follow-up',
    type: 'automacao',
    status: 'em_andamento',
    client_id: 'demo-client-1',
    client_name: 'Agência Alpha',
    sub_client_name: null,
    technical_context: {
      access_notes: 'Bot operacional compartilhado com time de atendimento.',
      initial_funnels: ['Funil Consulta'],
      whatsapp_channels: ['Grupo Clínica Vida - Atendimento'],
      service_rules: 'Lembrete automático D-1 e follow-up D+2 em não comparecimento.',
      client_team: ['Renata (recepção)', 'Dr. Paulo (responsável)'],
      demand_types: ['Automações de lembrete'],
      integration_notes: 'Uso de API da agenda externa para sincronismo.',
      quick_tasks: [],
    },
  },
];

const DEMO_QUICK_TASKS = {
  'demo-proj-1': [
    { id: 'qt-1', title: 'Validar briefing com cliente', done: true, created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), completed_at: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString() },
    { id: 'qt-2', title: 'Criar checklist de implantação', done: false, created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), completed_at: null },
  ],
  'demo-proj-2': [
    { id: 'qt-3', title: 'Enviar acesso de integração', done: false, created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), completed_at: null },
  ],
};

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTextList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? '').trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeTechnicalContext(input, fallback = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const fallbackQuickTasks = Array.isArray(fallback.quick_tasks) ? fallback.quick_tasks : [];

  return {
    access_notes: normalizeText(source.access_notes),
    initial_funnels: normalizeTextList(source.initial_funnels),
    whatsapp_channels: normalizeTextList(source.whatsapp_channels),
    service_rules: normalizeText(source.service_rules),
    client_team: normalizeTextList(source.client_team),
    demand_types: normalizeTextList(source.demand_types),
    integration_notes: normalizeText(source.integration_notes),
    quick_tasks: Array.isArray(source.quick_tasks) ? source.quick_tasks : fallbackQuickTasks,
  };
}

function withNormalizedDemoContext(project) {
  return {
    ...project,
    technical_context: normalizeTechnicalContext(project.technical_context, {
      quick_tasks: DEMO_QUICK_TASKS[project.id] ?? [],
    }),
  };
}

function syncDemoQuickTasks(projectId) {
  const project = DEMO_PROJECTS.find((item) => String(item.id) === String(projectId));
  if (!project) return;

  project.technical_context = normalizeTechnicalContext(project.technical_context, {
    quick_tasks: DEMO_QUICK_TASKS[projectId] ?? [],
  });
}

Object.keys(DEMO_QUICK_TASKS).forEach(syncDemoQuickTasks);

function normalizeStatusToDb(status) {
  if (!status || status === 'em_andamento') return 'ativo';
  return status;
}

function normalizeStatusFromDb(status) {
  if (status === 'ativo') return 'em_andamento';
  return status;
}

projectsRouter.get('/', asyncRoute(async (req, res) => {
  if (!hasDatabase) {
    let projects = DEMO_PROJECTS.map(withNormalizedDemoContext);
    if (req.user?.role === 'client' && req.user?.clientId) {
      projects = projects.filter(p => p.client_id === req.user.clientId);
    }
    return res.json({ items: projects, source: 'demo' });
  }

  const params = [];
  let sql = `
    select p.id, p.name, p.type, p.status, p.client_id, p.sub_client_id, p.technical_context,
           c.name as client_name, sc.name as sub_client_name, p.created_at
    from projects p
    join clients c on c.id = p.client_id
    left join sub_clients sc on sc.id = p.sub_client_id
  `;

  const where = [];

  // Client role: only see their own projects
  if (req.user?.role === 'client' && req.user?.clientId) {
    params.push(req.user.clientId);
    where.push(`p.client_id = $${params.length}`);
  } else {
    const { clientId } = req.query;
    if (clientId) {
      params.push(clientId);
      where.push(`p.client_id = $${params.length}`);
    }
  }

  if (where.length) sql += ` where ${where.join(' and ')}`;
  sql += ' order by c.name asc, p.name asc';
  const result = await query(sql, params);
  res.json({
    items: result.rows.map((row) => ({
      ...row,
      status: normalizeStatusFromDb(row.status),
      technical_context: normalizeTechnicalContext(row.technical_context),
    })),
  });
}));

projectsRouter.get('/:id', asyncRoute(async (req, res) => {
  const { id } = req.params;

  if (!hasDatabase) {
    const project = DEMO_PROJECTS.find((item) => String(item.id) === String(id));
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });
    return res.json(withNormalizedDemoContext(project));
  }

  const result = await query(
    `select p.*, c.name as client_name, sc.name as sub_client_name
     from projects p
     join clients c on c.id = p.client_id
     left join sub_clients sc on sc.id = p.sub_client_id
     where p.id = $1`,
    [id],
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Projeto não encontrado' });
  res.json({
    ...result.rows[0],
    status: normalizeStatusFromDb(result.rows[0].status),
    technical_context: normalizeTechnicalContext(result.rows[0].technical_context),
  });
}));

projectsRouter.post('/', asyncRoute(async (req, res) => {
  const { client_id, sub_client_id, name, type, technical_context, client_name, status } = req.body;
  const normalizedContext = technical_context ? normalizeTechnicalContext(technical_context) : normalizeTechnicalContext();

  if (!hasDatabase) {
    if (!name) return res.status(400).json({ error: 'Campo "name" é obrigatório' });
    const demoProject = {
      id: `demo-proj-${Date.now()}`,
      name,
      type: type ?? 'implementacao',
      status: status ?? 'em_andamento',
      client_id: `demo-${Date.now()}`,
      client_name: client_name ?? 'Novo Cliente',
      sub_client_name: null,
      technical_context: normalizedContext,
    };
    DEMO_PROJECTS.push(demoProject);
    DEMO_QUICK_TASKS[demoProject.id] = [];
    syncDemoQuickTasks(demoProject.id);
    return res.status(201).json({
      ...withNormalizedDemoContext(demoProject),
      source: 'demo',
    });
  }

  if (!client_id || !name) {
    return res.status(400).json({ error: 'Campos "client_id" e "name" são obrigatórios' });
  }
  const result = await query(
    `insert into projects (client_id, sub_client_id, name, type, technical_context, status)
     values ($1, $2, $3, coalesce($4, 'implementacao'), $5, coalesce($6, 'ativo'))
     returning *`,
    [client_id, sub_client_id ?? null, name, type, JSON.stringify(normalizedContext), status ? normalizeStatusToDb(status) : null],
  );
  res.status(201).json({
    ...result.rows[0],
    status: normalizeStatusFromDb(result.rows[0].status),
    technical_context: normalizeTechnicalContext(result.rows[0].technical_context),
  });
}));

projectsRouter.put('/:id', asyncRoute(async (req, res) => {
  const { id } = req.params;
  const { name, type, status, sub_client_id, technical_context } = req.body;

  if (!hasDatabase) {
    const project = DEMO_PROJECTS.find((p) => String(p.id) === String(id));
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    if (name !== undefined) project.name = name;
    if (type !== undefined) project.type = type;
    if (status !== undefined) project.status = status;
    if (sub_client_id !== undefined) project.sub_client_id = sub_client_id;
    if (technical_context !== undefined) {
      project.technical_context = normalizeTechnicalContext(
        technical_context,
        withNormalizedDemoContext(project).technical_context,
      );
    }

    syncDemoQuickTasks(id);

    return res.json({
      ...withNormalizedDemoContext(project),
      source: 'demo',
    });
  }

  let contextParam = null;
  if (technical_context !== undefined) {
    const current = await query(`select technical_context from projects where id = $1`, [id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Projeto não encontrado' });

    const normalizedCurrent = normalizeTechnicalContext(current.rows[0].technical_context);
    const merged = {
      ...normalizedCurrent,
      ...technical_context,
      quick_tasks: Array.isArray(technical_context?.quick_tasks)
        ? technical_context.quick_tasks
        : normalizedCurrent.quick_tasks,
    };
    contextParam = JSON.stringify(normalizeTechnicalContext(merged, normalizedCurrent));
  }

  const result = await query(
    `update projects
     set name          = coalesce($1, name),
         type          = coalesce($2::project_type, type),
         status        = coalesce($3::project_status, status),
         sub_client_id = coalesce($4, sub_client_id),
         technical_context = coalesce($5::jsonb, technical_context)
     where id = $6
     returning *`,
    [name, type, status ? normalizeStatusToDb(status) : null, sub_client_id, contextParam, id],
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Projeto não encontrado' });
  res.json({
    ...result.rows[0],
    status: normalizeStatusFromDb(result.rows[0].status),
    technical_context: normalizeTechnicalContext(result.rows[0].technical_context),
  });
}));

projectsRouter.delete('/:id', asyncRoute(async (req, res) => {
  const { id } = req.params;

  if (!hasDatabase) {
    const index = DEMO_PROJECTS.findIndex((p) => String(p.id) === String(id));
    if (index >= 0) DEMO_PROJECTS.splice(index, 1);
    delete DEMO_QUICK_TASKS[id];
    return res.status(204).send();
  }

  await query(`update projects set status = 'cancelado' where id = $1`, [id]);
  res.status(204).send();
}));

// --- Tarefas rápidas por projeto ---
projectsRouter.get('/:id/quick-tasks', asyncRoute(async (req, res) => {
  const { id } = req.params;

  if (!hasDatabase) {
    const projectExists = DEMO_PROJECTS.some((p) => String(p.id) === String(id));
    if (!projectExists) return res.status(404).json({ error: 'Projeto não encontrado' });
    syncDemoQuickTasks(id);
    return res.json({ items: DEMO_QUICK_TASKS[id] ?? [], source: 'demo' });
  }

  const result = await query(`select technical_context from projects where id = $1`, [id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Projeto não encontrado' });

  const context = normalizeTechnicalContext(result.rows[0].technical_context);
  res.json({ items: context.quick_tasks ?? [] });
}));

projectsRouter.post('/:id/quick-tasks', asyncRoute(async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;

  if (!title) return res.status(400).json({ error: 'Campo "title" é obrigatório' });

  const newQuickTask = {
    id: `qt-${Date.now()}`,
    title,
    done: false,
    created_at: new Date().toISOString(),
    completed_at: null,
  };

  if (!hasDatabase) {
    const projectExists = DEMO_PROJECTS.some((p) => String(p.id) === String(id));
    if (!projectExists) return res.status(404).json({ error: 'Projeto não encontrado' });
    DEMO_QUICK_TASKS[id] = DEMO_QUICK_TASKS[id] ?? [];
    DEMO_QUICK_TASKS[id].push(newQuickTask);
    syncDemoQuickTasks(id);
    return res.status(201).json({ item: newQuickTask, source: 'demo' });
  }

  const result = await query(`select technical_context from projects where id = $1`, [id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Projeto não encontrado' });

  const context = normalizeTechnicalContext(result.rows[0].technical_context);
  const quickTasks = Array.isArray(context.quick_tasks) ? context.quick_tasks : [];
  quickTasks.push(newQuickTask);

  await query(
    `update projects
     set technical_context = coalesce(technical_context, '{}'::jsonb) || jsonb_build_object('quick_tasks', $1::jsonb)
     where id = $2`,
    [JSON.stringify(quickTasks), id],
  );

  res.status(201).json({ item: newQuickTask });
}));

projectsRouter.patch('/:id/quick-tasks/:quickTaskId', asyncRoute(async (req, res) => {
  const { id, quickTaskId } = req.params;
  const { done } = req.body;
  if (typeof done !== 'boolean') return res.status(400).json({ error: 'Campo "done" deve ser boolean' });

  if (!hasDatabase) {
    const projectExists = DEMO_PROJECTS.some((p) => String(p.id) === String(id));
    if (!projectExists) return res.status(404).json({ error: 'Projeto não encontrado' });
    const items = DEMO_QUICK_TASKS[id] ?? [];
    const quickTask = items.find((qt) => String(qt.id) === String(quickTaskId));
    if (!quickTask) return res.status(404).json({ error: 'Tarefa rápida não encontrada' });

    quickTask.done = done;
    quickTask.completed_at = done ? new Date().toISOString() : null;
    syncDemoQuickTasks(id);
    return res.json({ item: quickTask, source: 'demo' });
  }

  const result = await query(`select technical_context from projects where id = $1`, [id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Projeto não encontrado' });

  const context = normalizeTechnicalContext(result.rows[0].technical_context);
  const quickTasks = Array.isArray(context.quick_tasks) ? context.quick_tasks : [];
  const index = quickTasks.findIndex((qt) => String(qt.id) === String(quickTaskId));
  if (index === -1) return res.status(404).json({ error: 'Tarefa rápida não encontrada' });

  quickTasks[index] = {
    ...quickTasks[index],
    done,
    completed_at: done ? new Date().toISOString() : null,
  };

  await query(
    `update projects
     set technical_context = coalesce(technical_context, '{}'::jsonb) || jsonb_build_object('quick_tasks', $1::jsonb)
     where id = $2`,
    [JSON.stringify(quickTasks), id],
  );

  res.json({ item: quickTasks[index] });
}));

// --- Contexto técnico ---

projectsRouter.get('/:id/context', asyncRoute(async (req, res) => {
  const { id } = req.params;

  if (!hasDatabase) {
    const project = DEMO_PROJECTS.find((item) => String(item.id) === String(id));
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });
    syncDemoQuickTasks(id);
    return res.json({ technical_context: withNormalizedDemoContext(project).technical_context, source: 'demo' });
  }

  const result = await query(`select technical_context from projects where id = $1`, [id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Projeto não encontrado' });
  res.json({ technical_context: normalizeTechnicalContext(result.rows[0].technical_context) });
}));

projectsRouter.put('/:id/context', asyncRoute(async (req, res) => {
  const { id } = req.params;

  if (!hasDatabase) {
    const project = DEMO_PROJECTS.find((item) => String(item.id) === String(id));
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    const current = withNormalizedDemoContext(project).technical_context;
    project.technical_context = normalizeTechnicalContext(req.body, current);
    syncDemoQuickTasks(id);

    return res.json({ technical_context: withNormalizedDemoContext(project).technical_context, source: 'demo' });
  }

  const current = await query(`select technical_context from projects where id = $1`, [id]);
  if (!current.rows[0]) return res.status(404).json({ error: 'Projeto não encontrado' });

  const currentContext = normalizeTechnicalContext(current.rows[0].technical_context);
  const nextContext = normalizeTechnicalContext(req.body, currentContext);

  const result = await query(
    `update projects set technical_context = $1::jsonb where id = $2 returning technical_context`,
    [JSON.stringify(nextContext), id],
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Projeto não encontrado' });
  res.json({ technical_context: normalizeTechnicalContext(result.rows[0].technical_context, currentContext) });
}));

projectsRouter.patch('/:id/context', asyncRoute(async (req, res) => {
  const { id } = req.params;

  if (!hasDatabase) {
    const project = DEMO_PROJECTS.find((item) => String(item.id) === String(id));
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    const current = withNormalizedDemoContext(project).technical_context;
    const merged = {
      ...current,
      ...(req.body ?? {}),
      quick_tasks: Array.isArray(req.body?.quick_tasks) ? req.body.quick_tasks : current.quick_tasks,
    };

    project.technical_context = normalizeTechnicalContext(merged, current);
    syncDemoQuickTasks(id);

    return res.json({ technical_context: withNormalizedDemoContext(project).technical_context, source: 'demo' });
  }

  const current = await query(`select technical_context from projects where id = $1`, [id]);
  if (!current.rows[0]) return res.status(404).json({ error: 'Projeto não encontrado' });

  const currentContext = normalizeTechnicalContext(current.rows[0].technical_context);
  const mergedContext = {
    ...currentContext,
    ...(req.body ?? {}),
    quick_tasks: Array.isArray(req.body?.quick_tasks) ? req.body.quick_tasks : currentContext.quick_tasks,
  };

  const result = await query(
    `update projects
     set technical_context = $1::jsonb
     where id = $2
     returning technical_context`,
    [JSON.stringify(normalizeTechnicalContext(mergedContext, currentContext)), id],
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Projeto não encontrado' });
  res.json({ technical_context: normalizeTechnicalContext(result.rows[0].technical_context, currentContext) });
}));
