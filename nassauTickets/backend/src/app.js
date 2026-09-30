import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.js';
import atendimentoRoutes from './routes/atendimentoRoutes.js';
import authRoutes from './routes/authRoutes.js';
import gestorRoutes from './routes/gestorRoutes.js';
import publicoRoutes from './routes/publicoRoutes.js';

export function criarApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(cors({ origin: env.corsOrigin.split(',').map((o) => o.trim()) }));
  app.use(express.json({ limit: '100kb' }));
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });

  app.use('/api', publicoRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/atendimento', atendimentoRoutes);
  app.use('/api/gestor', gestorRoutes);

  app.use(rotaNaoEncontrada);
  app.use(tratarErros);
  return app;
}
