import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { seedAdmin } from './seed-admin.js';
import { generateDailyReports } from './routes/reports.js';
import cron from 'node-cron';

const app = express();
const port = Number(process.env.PORT ?? 3000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '..', 'public');

app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);
app.use(express.static(publicDir));

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use(errorHandler);

app.listen(port, async () => {
  console.log(`[clicknote] MVP rodando na porta ${port}`);
  await seedAdmin().catch((err) =>
    console.error('[seed-admin] Erro ao criar admin:', err.message),
  );

  // Gera relatório diário todo dia às 23h (horário de SP)
  if (process.env.DATABASE_URL) {
    cron.schedule('0 23 * * *', () => {
      generateDailyReports().catch((err) =>
        console.error('[reports] Erro no cron:', err.message),
      );
    }, { timezone: 'America/Sao_Paulo' });
    console.log('[reports] Cron de relatório diário agendado para 23h.');
  }
});
