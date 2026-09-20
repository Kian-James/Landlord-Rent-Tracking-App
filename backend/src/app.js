import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';

import authRoutes from './routes/authRoutes.js';

import { apiLimiter } from './middleware/rateLimit.js';



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

  return app;
}

export { createApp };
