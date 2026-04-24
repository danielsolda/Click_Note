-- Migração 001 — Schema inicial do ClickNote MVP
-- Aplicar via: npm run db:migrate
-- Este arquivo é a fonte oficial do schema. O supabase/schema.sql é idêntico.

-- ---------------------------------------------------------------------------
-- Extensões
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tipos enum
-- ---------------------------------------------------------------------------
do $$ begin
  create type client_type      as enum ('setup', 'recorrente', 'projeto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type responsible_mode as enum ('daniel', 'bruna', 'daniel_bruna');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_type as enum ('implementacao', 'suporte', 'diagnostico', 'treinamento', 'automacao', 'integracao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum ('ativo', 'pausado', 'concluido', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum (
    'backlog',
    'a_fazer_sprint',
    'em_progresso',
    'aguardando_cliente',
    'em_revisao',
    'concluido'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_type as enum ('implementacao', 'suporte', 'diagnostico', 'treinamento', 'recorrente', 'automacao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type effort_label as enum ('P', 'M', 'G', 'GG');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sprint_status as enum ('planejamento', 'ativo', 'concluido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('ok', 'pendente', 'atrasado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type log_type as enum ('entrega', 'reuniao', 'decisao_tecnica', 'bloqueio', 'resolucao', 'nota');
exception when duplicate_object then null; end $$;

do $$ begin
  create type owner_name as enum ('daniel', 'bruna');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Funções auxiliares de trigger
-- ---------------------------------------------------------------------------
create or replace function trg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function trg_set_waiting_since()
returns trigger language plpgsql as $$
begin
  if new.status = 'aguardando_cliente' and (old.status is null or old.status <> 'aguardando_cliente') then
    new.waiting_since := now();
  elsif new.status <> 'aguardando_cliente' then
    new.waiting_since := null;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table if not exists clients (
  id               uuid        primary key default gen_random_uuid(),
  name             text        not null,
  type             client_type not null default 'recorrente',
  responsible_mode responsible_mode not null default 'daniel_bruna',
  is_intermediary  boolean     not null default false,
  has_kommo_resale boolean     not null default false,
  engagement       text,
  active           boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists set_updated_at_clients on clients;
create trigger set_updated_at_clients
  before update on clients
  for each row execute function trg_set_updated_at();

create table if not exists sub_clients (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references clients(id) on delete cascade,
  name             text not null,
  business_context text,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists set_updated_at_sub_clients on sub_clients;
create trigger set_updated_at_sub_clients
  before update on sub_clients
  for each row execute function trg_set_updated_at();

create table if not exists sprints (
  id         uuid          primary key default gen_random_uuid(),
  start_date date          not null,
  end_date   date          not null,
  status     sprint_status not null default 'planejamento',
  notes      text,
  created_at timestamptz   not null default now()
);

create table if not exists projects (
  id                uuid           primary key default gen_random_uuid(),
  client_id         uuid           not null references clients(id) on delete cascade,
  sub_client_id     uuid           references sub_clients(id) on delete set null,
  name              text           not null,
  type              project_type   not null default 'implementacao',
  status            project_status not null default 'ativo',
  technical_context jsonb,
  created_at        timestamptz    not null default now(),
  updated_at        timestamptz    not null default now()
);

drop trigger if exists set_updated_at_projects on projects;
create trigger set_updated_at_projects
  before update on projects
  for each row execute function trg_set_updated_at();

create table if not exists tasks (
  id                  uuid         primary key default gen_random_uuid(),
  project_id          uuid         not null references projects(id) on delete cascade,
  title               text         not null,
  description         text,
  task_type           task_type    not null default 'implementacao',
  status              task_status  not null default 'backlog',
  owner               owner_name   not null default 'daniel',
  effort_label        effort_label,
  story_points        smallint     check (story_points >= 0),
  due_date            date,
  is_recurring        boolean      not null default false,
  recurrence_interval text,
  waiting_since       timestamptz,
  followup_channel    text,
  followup_note       text,
  created_at          timestamptz  not null default now(),
  updated_at          timestamptz  not null default now()
);

drop trigger if exists set_updated_at_tasks on tasks;
create trigger set_updated_at_tasks
  before update on tasks
  for each row execute function trg_set_updated_at();

drop trigger if exists set_waiting_since on tasks;
create trigger set_waiting_since
  before update on tasks
  for each row execute function trg_set_waiting_since();

create table if not exists sprint_tasks (
  sprint_id uuid not null references sprints(id) on delete cascade,
  task_id   uuid not null references tasks(id) on delete cascade,
  primary key (sprint_id, task_id)
);

create table if not exists kommo_licenses (
  id                         uuid           primary key default gen_random_uuid(),
  client_id                  uuid           not null references clients(id) on delete cascade,
  plan_name                  text           not null,
  expires_on                 date           not null,
  contracted_users           smallint       not null default 0,
  active_users               smallint       not null default 0,
  second_link_payment_status payment_status not null default 'ok',
  notes                      text,
  created_at                 timestamptz    not null default now(),
  updated_at                 timestamptz    not null default now()
);

drop trigger if exists set_updated_at_licenses on kommo_licenses;
create trigger set_updated_at_licenses
  before update on kommo_licenses
  for each row execute function trg_set_updated_at();

create table if not exists activity_logs (
  id          uuid       primary key default gen_random_uuid(),
  client_id   uuid       references clients(id) on delete set null,
  project_id  uuid       references projects(id) on delete set null,
  task_id     uuid       references tasks(id) on delete set null,
  log_type    log_type   not null,
  description text       not null,
  logged_by   owner_name not null,
  logged_at   timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists recurring_generated (
  template_task_id  uuid not null references tasks(id) on delete cascade,
  target_month      date not null,
  generated_task_id uuid not null references tasks(id) on delete cascade,
  primary key (template_task_id, target_month)
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
create index if not exists idx_tasks_project_id        on tasks(project_id);
create index if not exists idx_tasks_status            on tasks(status);
create index if not exists idx_tasks_owner             on tasks(owner);
create index if not exists idx_tasks_due_date          on tasks(due_date);
create index if not exists idx_tasks_is_recurring      on tasks(is_recurring) where is_recurring = true;
create index if not exists idx_projects_client_id      on projects(client_id);
create index if not exists idx_sub_clients_client_id   on sub_clients(client_id);
create index if not exists idx_activity_client_id      on activity_logs(client_id);
create index if not exists idx_activity_project_id     on activity_logs(project_id);
create index if not exists idx_kommo_expires_on        on kommo_licenses(expires_on);
create index if not exists idx_sprint_tasks_task_id    on sprint_tasks(task_id);

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------
create or replace view vw_dashboard_global as
select
  c.id   as client_id,
  c.name as client_name,
  c.type as client_type,
  c.responsible_mode,
  count(*) filter (where t.status = 'em_progresso')       as tasks_in_progress,
  count(*) filter (where t.status = 'aguardando_cliente') as tasks_waiting_client,
  count(*) filter (where t.status = 'em_revisao')         as tasks_in_review,
  count(*) filter (where t.status = 'backlog')            as tasks_backlog,
  count(*) filter (where t.status = 'a_fazer_sprint')     as tasks_sprint,
  0 as blocked_tasks
from clients c
left join projects p  on p.client_id = c.id
left join tasks t     on t.project_id = p.id
where c.active = true
group by c.id, c.name, c.type, c.responsible_mode;

create or replace view vw_tasks_waiting_followup as
select
  t.id              as task_id,
  t.title,
  t.owner,
  t.waiting_since,
  t.followup_channel,
  t.followup_note,
  extract(day from now() - t.waiting_since)::int as days_waiting,
  case
    when extract(day from now() - t.waiting_since) >= 7 then 'escalation'
    when extract(day from now() - t.waiting_since) >= 5 then 'second_contact'
    when extract(day from now() - t.waiting_since) >= 2 then 'reminder'
    else 'ok'
  end as followup_urgency,
  c.name  as client_name,
  sc.name as sub_client_name,
  p.name  as project_name,
  p.id    as project_id
from tasks t
join projects p    on p.id = t.project_id
join clients c     on c.id = p.client_id
left join sub_clients sc on sc.id = p.sub_client_id
where t.status = 'aguardando_cliente'
order by t.waiting_since asc nulls last;

create or replace view vw_kommo_expiry_alerts as
select
  k.id,
  c.id                                 as client_id,
  c.name                               as client_name,
  k.plan_name,
  k.expires_on,
  (k.expires_on - current_date)::int   as days_until_expiry,
  k.contracted_users,
  k.active_users,
  k.second_link_payment_status,
  k.notes,
  case
    when k.expires_on - current_date <= 7  then 'danger'
    when k.expires_on - current_date <= 30 then 'warning'
    else 'ok'
  end as risk_level
from kommo_licenses k
join clients c on c.id = k.client_id
where c.active = true
order by k.expires_on asc;
