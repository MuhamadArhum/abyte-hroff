import { Router } from 'express';
import { authMiddleware, authorize } from '../middleware/auth';
import { createBackup, listBackups, restoreBackup, deleteBackup } from '../controllers/backupController';

const router = Router();
router.use(authMiddleware);
router.use(authorize('ADMIN'));
router.post('/create', createBackup);
router.get('/history', listBackups);
router.post('/restore', restoreBackup);
router.delete('/:filename', deleteBackup);
export default router;
