# Banco de dados na Railway (recomendado)

Este documento define como rodar o banco do sistema na sua VPS/projeto Railway.

## Decisão

Usar **PostgreSQL gerenciado da Railway** como banco principal, com:

- 1 serviço `postgres` (produção)
- 1 serviço `postgres-staging` (homologação, opcional)
- app web conectando via `DATABASE_URL`

O schema atual em `supabase/schema.sql` já é compatível com PostgreSQL padrão e pode ser usado na Railway.

## Arquitetura sugerida

- Serviço A: **web app** (React + API)
- Serviço B: **PostgreSQL** (Railway)
- Serviço C (opcional): **worker/cron** para recorrências e alertas

### Fluxo

1. App grava/consulta tarefas, projetos, clientes
2. Rotina mensal chama a função `generate_monthly_recurring_tasks(...)`
3. Dashboard lê views (`vw_dashboard_global`, `vw_tasks_waiting_followup`)

## Variáveis de ambiente

Defina no serviço da aplicação:

- `DATABASE_URL` (fornecida pela Railway)
- `DATABASE_URL_PUBLIC` (se houver API separada e necessidade de leitura)
- `APP_ENV` (`production` | `staging`)
- `TZ` (`America/Sao_Paulo`)

> Observação: na Railway, prefira conexão interna entre serviços no mesmo projeto para menor latência.

## Segurança mínima

- SSL habilitado (default da Railway)
- Nunca salvar senha de credenciais técnicas no banco; apenas referência
- Criar usuário de banco com permissões mínimas para a aplicação
- Backup automático habilitado + rotina de restore testada mensalmente

## Estratégia de migrações

Recomendação prática:

1. Criar pasta `database/migrations`
2. Versionar SQL incremental (`001_init.sql`, `002_indexes.sql`...)
3. Aplicar migração por pipeline de deploy (staging -> produção)
4. Nunca editar migração já aplicada em produção

No curto prazo, você pode iniciar aplicando diretamente o arquivo base:

- `supabase/schema.sql`

## Operação de banco (runbook)

### Checklist semanal (sexta)

- verificar crescimento de tabelas de log (`activity_logs`)
- revisar tarefas em `aguardando_cliente` há mais de 5 dias
- revisar licenças com vencimento em 30 dias

### Checklist mensal

- validar backup e restore pontual
- revisar índices mais usados
- arquivar logs antigos (se volume crescer)

## Escalabilidade (quando crescer)

- adicionar read-replica para analytics (se necessário)
- separar workload de logs/auditoria
- criar materialized views para dashboards pesados

## Conclusão

Para sua operação atual (consultoria solo + colaboradora), **Railway Postgres é suficiente, simples e robusto**.
Você mantém o controle do modelo relacional sem complexidade operacional de self-hosting.
