import express from 'express';
import { dbHealth } from '../db.js';

export const healthRouter = express.Router();

healthRouter.get('/', async (_req, res) => {
  const database = await dbHealth();
  res.status(database.ok ? 200 : 503).json({
    service: 'clicknote-mvp',
    date: new Date().toISOString(),
    database,
  });
});
