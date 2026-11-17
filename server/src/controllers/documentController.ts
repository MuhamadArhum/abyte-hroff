import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { config } from '../config';
import { validateUploadFile } from '../utils/validation';

export async function uploadDocuments(req: AuthRequest, res: Response) {
  try {
    const employeeId = Number(req.params.id);
    const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) return res.status(404).json({ message: 'Employee not found' });
    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) return res.status(400).json({ message: 'No files uploaded' });
    for (const file of files) {
      const err = validateUploadFile(file, 'document', 10 * 1024 * 1024);
      if (err) return res.status(400).json({ message: err });
    }
    const dir = path.join(config.storagePath, 'documents', emp.employeeCode);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const actor = { performedByUserId: req.user?.id ?? null, performedByUsername: req.user?.username ?? null };
    const saved = [];
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      const storedFilename = `${emp.employeeCode}_${Date.now()}_${safeBase}${ext}`;
      const full = path.join(dir, storedFilename);
      fs.writeFileSync(full, file.buffer);
      const relativePath = path.join('documents', emp.employeeCode, storedFilename).replace(/\\/g, '/');
      const doc = await prisma.employeeDocument.create({ data: { employeeId, originalFilename: file.originalname, storedFilename, relativePath, fileExtension: ext, fileSize: file.size } });
      await prisma.employeeHistory.create({ data: { employeeId, action: 'DOCUMENT_UPLOADED', details: file.originalname, ...actor } });
      saved.push(doc);
    }
    res.status(201).json({ documents: saved });
  } catch (e: any) {
    console.error('Document upload failed:', e);
    res.status(400).json({ message: 'Document upload failed' });
  }
}

export async function deleteDocument(req: AuthRequest, res: Response) {
  try {
    const docId = Number(req.params.docId);
    const doc = await prisma.employeeDocument.findUnique({ where: { id: docId } });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    await prisma.employeeDocument.delete({ where: { id: docId } });
    const full = path.join(config.storagePath, doc.relativePath);
    if (fs.existsSync(full)) try { fs.unlinkSync(full); } catch {}
    const actor = { performedByUserId: req.user?.id ?? null, performedByUsername: req.user?.username ?? null };
    await prisma.employeeHistory.create({ data: { employeeId: doc.employeeId, action: 'DOCUMENT_DELETED', details: doc.originalFilename, ...actor } });
    res.json({ message: 'Document deleted' });
  } catch (e: any) {
    console.error('Document delete failed:', e);
    res.status(400).json({ message: 'Delete failed' });
  }
}
