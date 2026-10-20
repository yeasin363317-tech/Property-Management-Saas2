import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { allowedOrigins, env, isTest } from './config/env';
import { csrfGuard } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { api } from './routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(helmet());
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(
    rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false, skip: () => isTest }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api/v1', csrfGuard, api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
