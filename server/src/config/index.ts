import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const rootDir = path.resolve(__dirname, '../../..');
const isProd = process.env.NODE_ENV === 'production';
const jwtSecret = (process.env.JWT_SECRET || '').trim();

// Fail closed: never sign tokens with a guessable key. There is deliberately no fallback.
const weakPatterns = [/^change-this/i, /^replace-with/i, /^dev-/i, /^test/i, /^your-/i, /^secret$/i, /^password/i];
const isWeakSecret = jwtSecret.length < 32 || weakPatterns.some((re) => re.test(jwtSecret));
if (isWeakSecret) {
  throw new Error(
    'JWT_SECRET is missing or weak. Set a random secret of at least 32 characters in server/.env (see server/.env.example).'
  );
}

// Prisma resolves a relative SQLite path against prisma/schema.prisma, not process.cwd().
function resolveDbPath(): string {
  const raw = (process.env.DATABASE_URL || 'file:./dev.db').trim();
  const file = raw.startsWith('file:') ? raw.slice(5) : raw;
  if (path.isAbsolute(file)) return path.resolve(file);
  return path.resolve(__dirname, '../../prisma', file);
}

const trustProxyRaw = (process.env.TRUST_PROXY || '').trim().toLowerCase();
const trustProxy = trustProxyRaw === 'true' ? 1 : (!trustProxyRaw || trustProxyRaw === 'false' ? false : trustProxyRaw);

export const config = {
  isProd,
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret,
  accessTtl: '15m',
  refreshTtl: '7d',
  accessCookie: 'ems_access',
  refreshCookie: 'ems_refresh',
  refreshPath: '/api/auth/refresh',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:4000',
  rootDir,
  storagePath: path.resolve(__dirname, '../../', process.env.STORAGE_PATH || '../storage'),
  backupPath: path.resolve(__dirname, '../../', process.env.BACKUP_PATH || '../storage/backups'),
  dbPath: resolveDbPath(),
  clientDistPath: path.resolve(__dirname, '../../../client/dist'),
  trustProxy,
  jsonLimit: '2mb',
  maxUploadBytes: 10 * 1024 * 1024,
};
