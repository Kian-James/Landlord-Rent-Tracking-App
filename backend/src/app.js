import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';

import { apiLimiter } from './middleware/rateLimit.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import propertyRoutes from './routes/propertyRoutes.js';
import unitRoutes from './routes/unitRoutes.js';
import tenantRoutes from './routes/tenantRoutes.js';
import contractRoutes from './routes/contractRoutes.js';
import rentRoutes from './routes/rentRoutes.js';
import utilityBillRoutes from './routes/utilityBillRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(hpp());
  app.use(apiLimiter);

  app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  app.use('/api/auth', authRoutes);
  app.use('/api/properties', propertyRoutes);
  app.use('/api/units', unitRoutes);
  app.use('/api/tenants', tenantRoutes);
  app.use('/api/contracts', contractRoutes);
  app.use('/api/rent-records', rentRoutes);
  app.use('/api/utility-bills', utilityBillRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export { createApp };
