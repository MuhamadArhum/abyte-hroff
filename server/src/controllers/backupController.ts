import { Request, Response } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { Transform } from 'stream';
import { ZipArchive } from 'archiver';
import unzipper from 'unzipper';
import { config } from '../config';
import { prisma } from '../config/prisma';

const MAX_ENTRY_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const MAX_ENTRIES = 2000;

function safeBackupFilename(input: any) {
  const raw = String(input || '').trim();
  const base = path.basename(raw);
  if (!base || base !== raw) return null;
  if (!/^backup-[\w.-]+\.zip$/i.test(base)) return null;
  const full = path.resolve(config.backupPath, base);
  const dir = path.resolve(config.backupPath);
  if (!full.startsWith(dir + path.sep) && full !== dir) return null;
  return { base, full };
}

/** Take a consistent SQLite snapshot without copying a file that is being written. */
async function createDbSnapshot(): Promise<string> {
  const target = path.join(os.tmpdir(), `ems-db-snapshot-${crypto.randomUUID()}.db`);
  const escaped = target.replace(/'/g, "''");
  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO '${escaped}'`);
  } catch (e) {
    // Fallback for SQLite builds without VACUUM INTO: still avoid archiving through an open handle.
    console.warn('VACUUM INTO unavailable, using file copy snapshot:', e);
    fs.copyFileSync(config.dbPath, target);
  }
  return target;
}

async function extractZipSafe(zipPath: string, destDir: string) {
  const directory = await unzipper.Open.file(zipPath);
  const destRoot = path.resolve(destDir);
  if (directory.files.length > MAX_ENTRIES) throw new Error('Backup archive has too many entries');
  let totalWritten = 0;

  for (const entry of directory.files) {
    const entryPath = entry.path.replace(/\\/g, '/');
    if (!entryPath || entryPath.endsWith('/')) {
      const dirPath = path.resolve(destRoot, entryPath);
      if (!dirPath.startsWith(destRoot + path.sep) && dirPath !== destRoot) throw new Error('Unsafe backup archive (path traversal)');
      fs.mkdirSync(dirPath, { recursive: true });
      continue;
    }
    const outPath = path.resolve(destRoot, entryPath);
    if (!outPath.startsWith(destRoot + path.sep)) throw new Error('Unsafe backup archive (path traversal)');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    let written = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        written += chunk.length;
        if (written > MAX_ENTRY_BYTES || totalWritten + written > MAX_TOTAL_BYTES) {
          return cb(new Error('Backup archive exceeds size limits'));
        }
        cb(null, chunk);
      },
    });
    await new Promise<void>((resolve, reject) => {
      const input = entry.stream();
      const output = fs.createWriteStream(outPath);
      input.on('error', reject);
      output.on('error', reject);
      output.on('finish', () => resolve());
      input.pipe(limiter).pipe(output);
    });
    totalWritten += written;
  }
}

function hasSqliteHeader(file: string) {
  const fd = fs.openSync(file, 'r');
  try {
    const header = Buffer.alloc(16);
    const read = fs.readSync(fd, header, 0, 16, 0);
    return read === 16 && header.toString('utf8', 0, 15) === 'SQLite format 3';
  } finally {
    fs.closeSync(fd);
  }
}

export async function runBackup(type: 'MANUAL' | 'AUTOMATIC' = 'MANUAL') {
  if (!fs.existsSync(config.backupPath)) fs.mkdirSync(config.backupPath, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${ts}.zip`;
  const outPath = path.join(config.backupPath, filename);
  const output = fs.createWriteStream(outPath);
  const archive: any = new ZipArchive({ zlib: { level: 9 } });
  let snapshot = '';

  return await new Promise<{ filename: string }>((resolve, reject) => {
    output.on('close', async () => {
      try {
        if (snapshot && fs.existsSync(snapshot)) fs.unlinkSync(snapshot);
        await prisma.backupLog.create({ data: { type, filePath: filename, status: 'SUCCESS' } });
        resolve({ filename });
      } catch (e) { reject(e); }
    });
    archive.on('error', async (err: Error) => {
      if (snapshot && fs.existsSync(snapshot)) fs.unlinkSync(snapshot);
      try { await prisma.backupLog.create({ data: { type, filePath: filename, status: 'FAILED', message: err.message } }); } catch {}
      reject(err);
    });
    archive.pipe(output);
    (async () => {
      try {
        if (fs.existsSync(config.dbPath)) {
          snapshot = await createDbSnapshot();
          archive.file(snapshot, { name: 'database/dev.db' });
        }
        if (fs.existsSync(config.storagePath)) {
          const dirs = ['profile-pictures', 'cnic-front', 'cnic-back', 'father-pictures', 'other-pictures', 'documents'];
          for (const d of dirs) {
            const p = path.join(config.storagePath, d);
            if (fs.existsSync(p)) archive.directory(p, `storage/${d}`);
          }
        }
        archive.finalize();
      } catch (e) {
        if (snapshot && fs.existsSync(snapshot)) fs.unlinkSync(snapshot);
        reject(e);
      }
    })();
  });
}

export async function createBackup(req: Request, res: Response) {
  try {
    const type = (req.body?.type === 'AUTOMATIC' ? 'AUTOMATIC' : 'MANUAL') as 'MANUAL' | 'AUTOMATIC';
    const result = await runBackup(type);
    res.json({ message: 'Backup created', file: result.filename });
  } catch (e) {
    console.error('Backup failed:', e);
    res.status(500).json({ message: 'Backup failed' });
  }
}

export async function listBackups(req: Request, res: Response) {
  const logs = await prisma.backupLog.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(logs);
}

export async function restoreBackup(req: Request, res: Response) {
  const safe = safeBackupFilename(req.body?.filename);
  if (!safe) return res.status(400).json({ message: 'Invalid backup filename' });
  if (!fs.existsSync(safe.full)) return res.status(404).json({ message: 'Backup file not found' });

  const extractDir = path.join(config.backupPath, '_restore_tmp');
  const snapshot = path.join(os.tmpdir(), `ems-restore-rollback-${crypto.randomUUID()}.db`);
  const swapped: Array<{ dest: string; backup: string }> = [];
  let disconnected = false;

  try {
    try { await runBackup('MANUAL'); } catch (e) { console.warn('Pre-restore backup failed (continuing):', e); }

    if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });
    await extractZipSafe(safe.full, extractDir);

    const restoredDb = path.join(extractDir, 'database', 'dev.db');
    if (!fs.existsSync(restoredDb) || !hasSqliteHeader(restoredDb)) {
      throw new Error('Backup archive does not contain a valid database');
    }

    // Snapshot the live DB so we can roll back if any later step fails.
    const rollbackSource = await createDbSnapshot();
    fs.copyFileSync(rollbackSource, snapshot);
    fs.unlinkSync(rollbackSource);

    await prisma.$disconnect();
    disconnected = true;

    const folders = ['profile-pictures', 'cnic-front', 'cnic-back', 'father-pictures', 'other-pictures', 'documents'];
    for (const f of folders) {
      const src = path.join(extractDir, 'storage', f);
      const dest = path.join(config.storagePath, f);
      if (!fs.existsSync(src)) continue;
      const backup = `${dest}_pre_restore`;
      if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
      if (fs.existsSync(dest)) fs.renameSync(dest, backup);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(src, dest, { recursive: true });
      swapped.push({ dest, backup });
    }

    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
    fs.copyFileSync(restoredDb, config.dbPath);
    await prisma.$connect();
    disconnected = false;
    await prisma.user.count(); // verify the restored DB is readable

    for (const s of swapped) {
      if (fs.existsSync(s.backup)) fs.rmSync(s.backup, { recursive: true, force: true });
    }
    fs.rmSync(extractDir, { recursive: true, force: true });
    if (fs.existsSync(snapshot)) fs.unlinkSync(snapshot);
    await prisma.backupLog.create({ data: { type: 'RESTORE', filePath: safe.base, status: 'SUCCESS' } }).catch(() => {});
    res.json({ message: 'Restore completed. Please restart the server.' });
  } catch (e) {
    console.error('Restore failed:', e);
    if (disconnected) { try { await prisma.$connect(); } catch {} }
    if (fs.existsSync(snapshot)) {
      try {
        await prisma.$disconnect();
        fs.copyFileSync(snapshot, config.dbPath);
        await prisma.$connect();
      } catch (rollbackError) { console.error('DB rollback failed:', rollbackError); }
    }
    for (const s of swapped.reverse()) {
      try {
        if (fs.existsSync(s.dest)) fs.rmSync(s.dest, { recursive: true, force: true });
        if (fs.existsSync(s.backup)) fs.renameSync(s.backup, s.dest);
      } catch (rollbackError) { console.error('Storage rollback failed:', rollbackError); }
    }
    if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
    res.status(500).json({ message: 'Restore failed; previous data was restored where possible.' });
  }
}

export async function deleteBackup(req: Request, res: Response) {
  try {
    const safe = safeBackupFilename(req.params.filename || req.body?.filename);
    if (!safe) return res.status(400).json({ message: 'Invalid backup filename' });
    if (fs.existsSync(safe.full)) fs.unlinkSync(safe.full);
    await prisma.backupLog.deleteMany({ where: { filePath: safe.base } });
    res.json({ message: 'Backup deleted' });
  } catch (e) {
    console.error('Backup delete failed:', e);
    res.status(500).json({ message: 'Failed to delete backup' });
  }
}
