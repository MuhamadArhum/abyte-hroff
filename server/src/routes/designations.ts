import { Router } from 'express';
import { authMiddleware, authorize } from '../middleware/auth';
import * as c from '../controllers/designationController';

const router = Router();
const canWrite = authorize('ADMIN', 'MANAGER', 'HR');
router.use(authMiddleware);
router.get('/', c.listDesignations);
router.post('/', canWrite, c.createDesignation);
router.put('/:id', canWrite, c.updateDesignation);
router.delete('/:id', canWrite, c.deleteDesignation);
export default router;
