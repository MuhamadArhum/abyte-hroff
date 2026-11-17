import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, authorize } from '../middleware/auth';
import * as c from '../controllers/employeeController';
import * as img from '../controllers/imageController';
import * as doc from '../controllers/documentController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const canWrite = authorize('ADMIN', 'MANAGER', 'HR');

router.use(authMiddleware);
router.get('/', c.listEmployees);
router.get('/:id', c.getEmployee);
router.post('/', canWrite, c.createEmployee);
router.put('/:id', canWrite, c.updateEmployee);
router.delete('/:id', canWrite, c.deleteEmployee);
router.patch('/:id/status', canWrite, c.toggleStatus);
router.post('/:id/images', canWrite, upload.array('files', 20), img.uploadImages);
router.delete('/images/:imageId', canWrite, img.deleteImage);
router.post('/:id/documents', canWrite, upload.array('files', 20), doc.uploadDocuments);
router.delete('/documents/:docId', canWrite, doc.deleteDocument);

export default router;
