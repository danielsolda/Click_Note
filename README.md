# ClickNote MVP — Gestão de Projetos CRM (Kommo)

MVP técnico para operação de consultoria CRM com foco em:

- hierarquia `cliente direto > cliente final > projeto > tarefa`
- Scrum semanal + Kanban por projeto
- controle de licenças Kommo
- separação de responsável (`daniel` / `bruna`)
- visão global de gargalos e follow-ups

## Stack atual do MVP

- Backend: Node.js + Express
- Banco: PostgreSQL (Railway)
- Frontend: painel web inicial em `public/index.html`

## Estrutura de pastas

- `src/server.js`: servidor HTTP
- `src/routes/api.js`: endpoints do MVP
- `src/db.js`: conexão PostgreSQL via `DATABASE_URL`
- `src/domain/prioritization.js`: regra de priorização do backlog
- `public/index.html`: dashboard inicial
- `supabase/schema.sql`: schema base (PostgreSQL)
- `scripts/bootstrap-db.js`: aplica schema no banco
- `scripts/seed-demo.js`: insere dados de demonstração
- `tests/prioritization.test.js`: teste automatizado da regra de prioridade
- `docs/arquitetura.md`: arquitetura funcional
- `docs/operacao.md`: operação Scrum + Kanban
- `docs/banco-railway.md`: guia de banco na Railway

## Endpoints já disponíveis

- `GET /api/health`
- `GET /api/dashboard/global`
- `GET /api/tasks/waiting`
- `GET /api/clients`
- `GET /api/projects?clientId=<uuid>`
- `POST /api/backlog/priority`

## Setup rápido (local)

1. Copie `.env.example` para `.env` e ajuste `DATABASE_URL`.
2. Instale dependências.
3. Aplique schema no banco.
4. (Opcional) adicione dados de exemplo.
5. Rode o app.

## Comandos

```powershell
npm install
npm run db:bootstrap
npm run db:seed
npm run dev
```

Para rodar testes:

```powershell
npm test
```

## Deploy na Railway

No serviço da aplicação, configure:

- `DATABASE_URL` (conexão do PostgreSQL Railway)
- `PORT` (Railway injeta automaticamente, app já suporta)
- `DB_SSL=true`

Start command:

```powershell
npm start
```

## Próximas evoluções (Sprint 2)

1. Board Kanban com drag-and-drop por projeto
2. Tela de licenças Kommo com alertas por vencimento
3. CRUD de tarefas com filtros por responsável
4. Job mensal para recorrências (`generate_monthly_recurring_tasks`)
