import express from 'express';
import { healthRouter } from './health.js';
import { dashboardRouter } from './dashboard.js';
import { clientsRouter } from './clients.js';
import { subClientsRouter } from './sub-clients.js';
import { projectsRouter } from './projects.js';
import { tasksRouter } from './tasks.js';
import { backlogRouter } from './backlog.js';
import { authRouter } from './auth.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const apiRouter = express.Router();

// Public routes (no auth required)
apiRouter.use('/auth',    authRouter);
apiRouter.use('/health',  healthRouter);

// Protected routes (JWT required for all routes below)
apiRouter.use(requireAuth);

apiRouter.use('/dashboard',   requireAdmin, dashboardRouter);
apiRouter.use('/clients',     requireAdmin, clientsRouter);
apiRouter.use('/sub-clients', requireAdmin, subClientsRouter);
apiRouter.use('/projects',    projectsRouter);
apiRouter.use('/tasks',       tasksRouter);
apiRouter.use('/backlog',     requireAdmin, backlogRouter);
