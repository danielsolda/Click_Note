import 'dotenv/config';
import { query, pool } from '../src/db.js';

async function main() {
  console.log('[seed-demo] Inserindo dados de exemplo...');

  const clientResult = await query(
    `insert into clients (name, engagement, has_kommo_resale, responsible_mode, is_intermediary)
     values ('Agência Alpha', 'recorrente_mensal', true, 'daniel_bruna', true)
     returning id`,
  );

  const clientId = clientResult.rows[0].id;

  const subClientResult = await query(
    `insert into sub_clients (client_id, name, business_context)
     values ($1, 'Clínica Vida', 'Operação comercial com SDR + closer')
     returning id`,
    [clientId],
  );

  const subClientId = subClientResult.rows[0].id;

  const projectResult = await query(
    `insert into projects (client_id, sub_client_id, name, type, status)
     values ($1, $2, 'Reestruturação Funil Kommo', 'implementacao', 'em_andamento')
     returning id`,
    [clientId, subClientId],
  );

  const projectId = projectResult.rows[0].id;

  await query(
    `insert into tasks (project_id, title, description, task_type, status, owner, effort_label, story_points, due_date)
     values
     ($1, 'Mapear pipeline atual', 'Levantar etapas e gargalos', 'diagnostico', 'em_progresso', 'daniel', 'M', 5, current_date + interval '2 day'),
     ($1, 'Ajustar campos obrigatórios', 'Padronizar cadastro de leads', 'implementacao', 'aguardando_cliente', 'bruna', 'P', 3, current_date + interval '5 day')`,
    [projectId],
  );

  await query(
    `insert into kommo_licenses (client_id, plan_name, expires_on, contracted_users, active_users, second_link_payment_status)
     values ($1, 'Kommo Professional', current_date + interval '25 day', 8, 6, 'pendente')`,
    [clientId],
  );

  console.log('[seed-demo] Dados de exemplo inseridos.');
}

main()
  .catch((error) => {
    console.error('[seed-demo] Falha ao inserir seed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
