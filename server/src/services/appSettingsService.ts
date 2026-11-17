import fs from 'fs';
import path from 'path';
import { config } from '../config';

export type AppSettings = {
  autoBackupEnabled: boolean;
  autoBackupTime: string; // HH:mm (24h)
  lastAutoBackupDate?: string; // YYYY-MM-DD
};

const defaults: AppSettings = {
  autoBackupEnabled: true,
  autoBackupTime: '02:00',
};

function settingsPath() {
  const dir = path.join(config.storagePath, 'config');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'app-settings.json');
}

export function getAppSettings(): AppSettings {
  try {
    const p = settingsPath();
    if (!fs.existsSync(p)) return { ...defaults };
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return {
      autoBackupEnabled: typeof raw.autoBackupEnabled === 'boolean' ? raw.autoBackupEnabled : defaults.autoBackupEnabled,
      autoBackupTime: typeof raw.autoBackupTime === 'string' && /^\d{2}:\d{2}$/.test(raw.autoBackupTime) ? raw.autoBackupTime : defaults.autoBackupTime,
      lastAutoBackupDate: typeof raw.lastAutoBackupDate === 'string' ? raw.lastAutoBackupDate : undefined,
    };
  } catch {
    return { ...defaults };
  }
}

export function saveAppSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getAppSettings();
  const next: AppSettings = {
    ...current,
    ...patch,
  };
  if (typeof next.autoBackupTime !== 'string' || !/^\d{2}:\d{2}$/.test(next.autoBackupTime)) {
    next.autoBackupTime = defaults.autoBackupTime;
  }
  next.autoBackupEnabled = !!next.autoBackupEnabled;
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}
