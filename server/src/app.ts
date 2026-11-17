import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { ensureStorageDirs } from './utils/paths';
import authRoutes from './routes/auth';
import departmentRoutes from './routes/departments';
import designationRoutes from './routes/designations';
import employeeRoutes from './routes/employees';
import dashboardRoutes from './routes/dashboard';
import reportRoutes from './routes/reports';
import backupRoutes from './routes/backup';
import settingsRoutes from './routes/settings';
import { authMiddleware } from './middleware/auth';

ensureStorageDirs();

const app = express();
app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', config.trustProxy);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
}));

// Strict allowlist: no blanket localhost / private-LAN patterns.
const allowedOrigins = new Set(
  (config.clientUrl || '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)
);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    return cb(null, allowedOrigins.has(origin.replace(/\/$/, '')));
  },
  credentials: true,
}));

// Never log query-string tokens (media URLs no longer carry them, but be defensive).
morgan.token('safe-url', (req) => {
  const target = (req as express.Request).originalUrl || req.url;
  try {
    const parsed = new URL(target, 'http://localhost');
    parsed.searchParams.delete('token');
    return parsed.pathname + parsed.search;
  } catch {
    return target.split('?')[0];
  }
});
app.use(morgan(config.isProd
  ? ':remote-addr [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length]'
  : 'dev'));
app.use(express.json({ limit: config.jsonLimit }));
app.use(express.urlencoded({ extended: true, limit: config.jsonLimit }));

// Stored files are authenticated by the HttpOnly session cookie.
app.use('/storage', authMiddleware, (req, res) => {
  const base = path.resolve(config.storagePath);
  let rel: string;
  try {
    rel = decodeURIComponent(req.path || '').replace(/^\/+/, '').replace(/\\/g, '/');
  } catch {
    return res.status(400).json({ message: 'Invalid path' });
  }
  const full = path.resolve(base, rel);
  const relative = path.relative(base, full);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  let stats: fs.Stats;
  try { stats = fs.statSync(full); } catch { return res.status(404).json({ message: 'Not found' }); }
  if (!stats.isFile()) return res.status(404).json({ message: 'Not found' });
  res.sendFile(full);
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/designations', designationRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/settings', settingsRoutes);

if (fs.existsSync(config.clientDistPath)) {
  app.use(express.static(config.clientDistPath, { dotfiles: 'ignore' }));
  app.get(/^\/(?!api\/|storage\/).*/, (_req, res) => {
    res.sendFile(path.join(config.clientDistPath, 'index.html'));
  });
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const status = typeof err?.status === 'number' ? err.status : 500;
  const message = status >= 500 && config.isProd
    ? 'Internal server error'
    : (status >= 500 ? 'Internal server error' : (err?.message || 'Request failed'));
  res.status(status).json({ message });
});

export default app;
