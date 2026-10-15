import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initializeDatabase, pool } from './db.js';
import authRouter from './routes/auth.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigins = new Set([
  'https://localhost',
  'capacitor://localhost',
  'http://localhost:5173',
  'http://localhost:4173',
  ...(process.env.FRONTEND_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean),
]);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));
app.use(express.json({ limit: '16kb', strict: true }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
}));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.status(200).json({ ok: true, service: 'kingshall-auth-api', database: 'connected' });
  } catch {
    return res.status(503).json({ ok: false, service: 'kingshall-auth-api', database: 'disconnected' });
  }
});

app.use('/api/auth', authRouter);
app.use((req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use((error, _req, res, _next) => {
  if (error?.message === 'Origin is not allowed by CORS') {
    return res.status(403).json({ error: 'This app origin is not allowed.' });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Invalid JSON request body.' });
  }
  console.error('Unhandled request error:', error?.message || 'Unknown error');
  return res.status(500).json({ error: 'Unexpected server error.' });
});

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters.');
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error('RESEND_API_KEY and EMAIL_FROM are required.');
  }
  await initializeDatabase();
  app.listen(port, '0.0.0.0', () => console.log(`KingsHall auth API listening on port ${port}`));
}

start().catch((error) => {
  console.error('KingsHall auth API failed to start:', error.message);
  process.exit(1);
});
