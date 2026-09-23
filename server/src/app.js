import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';

import { supabase } from './config/supabase.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import propertyRoutes from './routes/propertyRoutes.js';
import unitRoutes from './routes/unitRoutes.js';
import tenantRoutes from './routes/tenantRoutes.js';
import contractRoutes from './routes/contractRoutes.js';
import rentRoutes from './routes/rentRoutes.js';
import utilityBillRoutes from './routes/utilityBillRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: '1mb' }));
  app.use(hpp());

  app.get('/healthz', (req, res) => res.json({ ok: true }));

  app.get('/readyz', async (req, res) => {
    const { error } = await supabase.from('landlords').select('id').limit(1);
    if (error) {
      console.error('readyz failed:', error.message);
      return res.status(503).json({ ok: false, db: 'down' });
    }
    res.json({ ok: true, db: 'up' });
  });

  app.use(apiLimiter);

  app.use('/api/auth', authRoutes);
  app.use('/api/properties', propertyRoutes);
  app.use('/api/units', unitRoutes);
  app.use('/api/tenants', tenantRoutes);
  app.use('/api/contracts', contractRoutes);
  app.use('/api/rent-records', rentRoutes);
  app.use('/api/utility-bills', utilityBillRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/settings', settingsRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export { createApp };
