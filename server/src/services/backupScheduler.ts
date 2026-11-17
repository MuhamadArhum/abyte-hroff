import { runBackup } from '../controllers/backupController';
import { getAppSettings, saveAppSettings } from './appSettingsService';

let started = false;
let running = false;

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nowHHmm() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isDue(now: string, scheduled: string) {
  // run at or after scheduled time (catch-up if server was down at exact minute)
  return now >= scheduled;
}

export function startBackupScheduler() {
  if (started) return;
  started = true;

  const tick = async () => {
    if (running) return;
    let claimedToday = false;
    try {
      const now = nowHHmm();
      const today = todayStr();
      const s = getAppSettings();
      if (!s.autoBackupEnabled) return;
      if (s.lastAutoBackupDate === today) return;
      if (!isDue(now, s.autoBackupTime)) return;

      // claim immediately to reduce duplicates across ticks/process races
      running = true;
      claimedToday = true;
      saveAppSettings({ lastAutoBackupDate: today });
      const recheck = getAppSettings();
      if (recheck.lastAutoBackupDate !== today) return;

      await runBackup('AUTOMATIC');
      console.log(`Automatic backup completed (scheduled ${s.autoBackupTime}, at ${now})`);
    } catch (e) {
      console.error('Automatic backup scheduler failed', e);
      // allow retry later same day on failure
      if (claimedToday) {
        try { saveAppSettings({ lastAutoBackupDate: undefined }); } catch {}
      }
    } finally {
      running = false;
    }
  };

  // check every minute + initial catch-up shortly after start
  setInterval(tick, 60 * 1000);
  setTimeout(() => { tick().catch(() => {}); }, 5000);
}
