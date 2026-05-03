-- Migração 003 — Reestruturação para modelo de chamados
-- Adequa os enums ao negócio real: serviços Kommo + chamados de suporte/IA

-- ---------------------------------------------------------------------------
-- Novos enums de negócio
-- ---------------------------------------------------------------------------
do $$ begin
  create type service_type as enum (
    'conta_kommo',
    'automacao',
    'ia',
    'integracao',
    'whatsapp_api',
    'dashboard',
    'manutencao'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_type as enum (
    'ajuste_ia',
    'ajuste_automacao',
    'criacao_ia',
    'criacao_automacao',
    'criacao_conta_kommo',
    'integracao',
    'suporte',
    'manutencao'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Migra projects.type de project_type → service_type
-- ---------------------------------------------------------------------------
alter table projects alter column type drop default;
alter table projects
  alter column type type service_type using 'conta_kommo'::service_type;
alter table projects alter column type set default 'conta_kommo';

drop type if exists project_type;

-- ---------------------------------------------------------------------------
-- Migra tasks.task_type de task_type → ticket_type
-- ---------------------------------------------------------------------------
alter table tasks alter column task_type drop default;
alter table tasks
  alter column task_type type ticket_type using 'suporte'::ticket_type;
alter table tasks alter column task_type set default 'suporte';

drop type if exists task_type;

-- ---------------------------------------------------------------------------
-- Adiciona novos valores ao task_status
-- ---------------------------------------------------------------------------
alter type task_status add value if not exists 'aberto' before 'backlog';
alter type task_status add value if not exists 'cancelado';

-- Novo padrão: chamado começa como 'aberto'
alter table tasks alter column status set default 'aberto';

-- ---------------------------------------------------------------------------
-- Tabela de relatórios diários
-- ---------------------------------------------------------------------------
create table if not exists daily_reports (
  id            uuid        primary key default gen_random_uuid(),
  client_id     uuid        not null references clients(id) on delete cascade,
  report_date   date        not null default current_date,
  summary       jsonb       not null default '{}',
  generated_at  timestamptz not null default now(),
  unique (client_id, report_date)
);

create index if not exists idx_daily_reports_client_date
  on daily_reports(client_id, report_date desc);
