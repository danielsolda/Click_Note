# Arquitetura do Sistema de Gestão — Daniel CRM

## Objetivo do sistema

Centralizar gestão de clientes, projetos e tarefas para uma operação de consultoria CRM com:

- 12+ contas simultâneas
- contextos técnicos distintos
- entregas recorrentes e projetos pontuais
- rastreio de bloqueios e vencimentos críticos

## Avaliação das opções de stack

## Opção A — Notion/Airtable (low-code)

**Prós**
- Entrega muito rápida
- Baixo custo inicial
- Automação nativa para recorrência e alertas

**Contras**
- Escalabilidade de regras complexas limitada
- Menos controle sobre UX e segurança granular
- Hierarquia e dashboards avançados podem ficar frágeis

## Opção B — React + Supabase (código próprio)

**Prós**
- Controle total da hierarquia e das regras do negócio
- Modelo robusto para licenças, alertas e histórico técnico
- Evolução natural para analytics e integrações

**Contras**
- Setup e implementação iniciais maiores
- Exige disciplina de produto para não superengordar escopo

## Opção C — Linear/ClickUp

**Prós**
- Ferramentas prontas e maduras
- Boa execução tática de tarefas

**Contras**
- Fricção com hierarquia cliente direto > cliente final
- Dados técnicos e licenças ficam “adaptados”, não nativos

## Recomendação

**Escolha principal: Opção B (React + Supabase).**

Motivo: você tem necessidades específicas (licenças Kommo, hierarquia multinível, contexto técnico persistente, recorrências e cobrança por tempo em “aguardando cliente”) que ficam melhor modeladas em banco relacional e UI sob medida.

## Contrato funcional (MVP)

- **Entrada:** clientes, projetos, tarefas, dados técnicos, vencimentos, eventos de comunicação
- **Saída:** dashboard global, boards Kanban por projeto, visão por responsável, alertas de vencimento/bloqueio
- **Regras críticas:** recorrência mensal automática, status “aguardando cliente” com timestamp, auditoria de eventos
- **Critério de sucesso:** operar sprint semanal completa sem planilha paralela

## Entidades (alto nível)

1. **Cliente Direto (`clients`)**
2. **Cliente Final (`sub_clients`)**
3. **Projeto (`projects`)**
4. **Tarefa (`tasks`)**
5. **Sprint (`sprints`)**
6. **Licença Kommo (`kommo_licenses`)**
7. **Contexto Técnico (`technical_contexts`)**
8. **Log de Atividade (`activity_logs`)**
9. **Comunicação pendente (`communication_threads`)**
10. **Usuários internos (`profiles`)**

## Views principais (produto)

### 1) Dashboard Global

Widgets:
- sprint ativa (tarefas por status)
- tarefas bloqueadas/aguardando cliente
- próximos vencimentos (Kommo, entregas, reuniões)
- capacidade Daniel x Bruna (em progresso)

### 2) Hierarquia Visual

Árvore:
- Cliente Direto
  - Cliente Final (opcional)
    - Projetos
      - Tarefas

### 3) Board Kanban por Projeto

Colunas fixas:
`Backlog` → `A fazer (sprint)` → `Em progresso` → `Aguardando cliente` → `Em revisão` → `Concluído`

### 4) Visão por Responsável

Filtros rápidos:
- Daniel
- Bruna
- ambos

### 5) Licenças Kommo

- vencimento
- usuários ativos vs contratados
- status do 2º link de pagamento
- indicador de risco (verde/amarelo/vermelho)

## Edge cases que o sistema já cobre

- cliente direto sem cliente final
- cliente intermediário com múltiplos clientes finais
- tarefa recorrente sem data fixa no mês (ex.: 1º dia útil)
- múltiplos bloqueios no mesmo projeto
- projeto pausado mas com licença prestes a vencer

## Segurança mínima

- autenticação simples (Daniel e Bruna)
- RLS por usuário interno (ambos podem ler tudo; cada um foca no próprio filtro)
- credenciais sensíveis nunca em texto plano (somente referência)

## Roadmap curto

- **Fase 1 (MVP):** dados + dashboard + kanban + recorrência
- **Fase 2:** automações de alerta (email/WhatsApp/Slack)
- **Fase 3:** score de saúde por cliente e previsão de carga
