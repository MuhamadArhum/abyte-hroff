import app from './app';
import { config } from './config';
import { ensureAdmin } from './controllers/authController';
import { startBackupScheduler } from './services/backupScheduler';

async function main() {
  await ensureAdmin();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${config.port} (LAN: http://0.0.0.0:${config.port})`);
  });

  startBackupScheduler();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
