import { Router } from 'express';
import { authMiddleware, authorize } from '../middleware/auth';
import { exportExcel, exportPdf, previewReport } from '../controllers/reportController';

const router = Router();
router.use(authMiddleware);
router.get('/preview', previewReport);
// Full exports contain CNIC / salary / contact data: privileged roles only.
router.get('/excel', authorize('ADMIN', 'MANAGER', 'HR'), exportExcel);
router.get('/pdf', authorize('ADMIN', 'MANAGER', 'HR'), exportPdf);
export default router;
