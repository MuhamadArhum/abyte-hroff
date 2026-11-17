import { Router } from 'express';
import { authMiddleware, authorize } from '../middleware/auth';
import { getSettings, getBackupSettings, updateBackupSettings } from '../controllers/settingsController';

const router = Router();
router.use(authMiddleware);
router.get('/', getSettings);
router.get('/backup', authorize('ADMIN'), getBackupSettings);
router.put('/backup', authorize('ADMIN'), updateBackupSettings);
export default router;
