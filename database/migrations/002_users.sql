-- Migração 002 — Tabela de usuários (autenticação)
-- Aplicar via: npm run db:migrate

create table if not exists users (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null,
  email         text        not null unique,
  password_hash text        not null,
  role          text        not null check (role in ('admin', 'client')),
  client_id     uuid        references clients(id) on delete set null,
  active        boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists set_updated_at_users on users;
create trigger set_updated_at_users
  before update on users
  for each row execute function trg_set_updated_at();

create index if not exists idx_users_email     on users(lower(email));
create index if not exists idx_users_client_id on users(client_id);
create index if not exists idx_users_role      on users(role);
