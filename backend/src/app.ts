import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import authRoutes from './routes/auth';
import dischargeRoutes from './routes/discharge';
import checkinRoutes from './routes/checkin';
import medicationRoutes from './routes/medications';

const app = express();

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:8081'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // 10mb for base64 images

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/discharge', dischargeRoutes);
app.use('/checkin', checkinRoutes);
app.use('/medications', medicationRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

export default app;
