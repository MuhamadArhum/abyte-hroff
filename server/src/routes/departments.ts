import { Router } from 'express';
import { authMiddleware, authorize } from '../middleware/auth';
import * as c from '../controllers/departmentController';

const router = Router();
const canWrite = authorize('ADMIN', 'MANAGER', 'HR');
router.use(authMiddleware);
router.get('/', c.listDepartments);
router.get('/:id', c.getDepartment);
router.post('/', canWrite, c.createDepartment);
router.put('/:id', canWrite, c.updateDepartment);
router.delete('/:id', canWrite, c.deleteDepartment);
export default router;
