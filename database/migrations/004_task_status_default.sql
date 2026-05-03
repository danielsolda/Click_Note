-- Migração 004 — Define 'aberto' como status padrão de novos chamados
-- Separado da 003 porque ADD VALUE não pode ser usado como DEFAULT
-- na mesma transação em que o valor foi criado (limitação PostgreSQL).

alter table tasks alter column status set default 'aberto';
