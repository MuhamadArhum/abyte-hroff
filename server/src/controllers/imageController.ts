import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { saveEmployeeImage, deleteImageById } from '../services/imageService';
import { validateUploadFile } from '../utils/validation';

export async function uploadImages(req: AuthRequest, res: Response) {
  try {
    const employeeId = Number(req.params.id);
    const category = (req.body.category || req.query.category || '').toString().toUpperCase();
    let replaceId = req.body.replaceId ? Number(req.body.replaceId) : undefined;
    if (replaceId !== undefined && !Number.isInteger(replaceId)) replaceId = undefined;
    const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) return res.status(404).json({ message: 'Employee not found' });
    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) return res.status(400).json({ message: 'No files uploaded' });

    const validCats = ['PROFILE', 'CNIC_FRONT', 'CNIC_BACK', 'FATHER', 'OTHER'];
    if (!validCats.includes(category)) return res.status(400).json({ message: 'Invalid image category', issues: [{ field: 'category', message: 'Invalid image category' }] });
    if (category !== 'OTHER' && files.length > 1) return res.status(400).json({ message: 'Only one file allowed for this category' });
    if (replaceId !== undefined) {
      const target = await prisma.employeeImage.findFirst({
        where: { id: replaceId, employeeId, imageCategory: category },
        select: { id: true },
      });
      if (!target) return res.status(400).json({ message: 'Invalid image to replace' });
    }
    for (const file of files) {
      const err = validateUploadFile(file, 'image', 10 * 1024 * 1024);
      if (err) return res.status(400).json({ message: err });
    }

    const actor = { performedByUserId: req.user?.id ?? null, performedByUsername: req.user?.username ?? null };
    const saved = [];
    for (const file of files) {
      const img = await saveEmployeeImage(employeeId, emp.employeeCode, category, file, { replaceId, actor });
      saved.push(img);
    }
    res.status(201).json({ images: saved });
  } catch (e: any) {
    console.error(e);
    console.error('Image upload failed:', e);
    res.status(400).json({ message: 'Upload failed' });
  }
}

export async function deleteImage(req: AuthRequest, res: Response) {
  try {
    const imageId = Number(req.params.imageId);
    const actor = { performedByUserId: req.user?.id ?? null, performedByUsername: req.user?.username ?? null };
    await deleteImageById(imageId, actor);
    res.json({ message: 'Image deleted' });
  } catch (e: any) {
    console.error('Image delete failed:', e);
    res.status(400).json({ message: 'Delete failed' });
  }
}
