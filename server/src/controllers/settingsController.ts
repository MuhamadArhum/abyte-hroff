import { Request, Response } from 'express';
import os from 'os';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth';
import { config } from '../config';
import { prisma } from '../config/prisma';
import { getAppSettings, saveAppSettings } from '../services/appSettingsService';

export async function getSettings(req: AuthRequest, res: Response) {
  const [employeeCount, deptCount, desigCount] = await Promise.all([
    prisma.employee.count(),
    prisma.department.count(),
    prisma.designation.count(),
  ]);
  const app = getAppSettings();
  const base = {
    applicationName: 'Abyte-EMS',
    version: '1.0.0',
    upload: { maxImageSizeMB: 10, allowedImageTypes: ['JPG', 'JPEG', 'PNG', 'WEBP'] },
    backup: {
      automaticEnabled: app.autoBackupEnabled,
      time: app.autoBackupTime,
      interval: app.autoBackupEnabled ? `Daily at ${app.autoBackupTime}` : 'Disabled',
    },
    stats: { employees: employeeCount, departments: deptCount, designations: desigCount },
  };
  // Internal paths and host details are admin-only.
  if (req.user?.role !== 'ADMIN') return res.json(base);

  const [userCount, backupCount] = await Promise.all([
    prisma.user.count(),
    prisma.backupLog.count(),
  ]);
  const dbExists = fs.existsSync(config.dbPath);
  const dbSize = dbExists ? fs.statSync(config.dbPath).size : 0;
  res.json({
    ...base,
    adminUsers: userCount,
    database: { provider: 'SQLite', exists: dbExists, sizeBytes: dbSize },
    storage: { backupPath: config.backupPath },
    backup: { ...base.backup, totalBackups: backupCount },
    system: { platform: process.platform, node: process.version, hostname: os.hostname() },
  });
}

export async function getBackupSettings(req: Request, res: Response) {
  res.json(getAppSettings());
}

export async function updateBackupSettings(req: Request, res: Response) {
  const { autoBackupEnabled, autoBackupTime } = req.body || {};
  if (autoBackupTime && !/^\d{2}:\d{2}$/.test(String(autoBackupTime))) {
    return res.status(400).json({ message: 'Invalid time format. Use HH:mm (24-hour).' });
  }
  const saved = saveAppSettings({
    autoBackupEnabled: typeof autoBackupEnabled === 'boolean' ? autoBackupEnabled : undefined,
    autoBackupTime: autoBackupTime ? String(autoBackupTime) : undefined,
  });
  res.json({ message: 'Backup settings saved', settings: saved });
}
