import fs from 'fs';
import path from 'path';
import { prisma } from '../config/prisma';
import { getCategoryDir, imageCategoryFolders, safeJoin } from '../utils/paths';

const allowedExt = ['.jpg', '.jpeg', '.png', '.webp'];

export function validateImage(file: Express.Multer.File) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExt.includes(ext)) throw new Error('Unsupported file type');
  const max = 10 * 1024 * 1024; // 10MB
  if (file.size > max) throw new Error('File too large (max 10MB)');
  return ext;
}

export function buildStoredFilename(employeeCode: string, category: string, ext: string, seq?: number) {
  const normalizedExt = ext.toLowerCase() === '.jpeg' ? '.jpg' : ext.toLowerCase();
  switch (category) {
    case 'PROFILE':
      return `${employeeCode}_Profile${normalizedExt}`;
    case 'CNIC_FRONT':
      return `${employeeCode}_CNIC_Front${normalizedExt}`;
    case 'CNIC_BACK':
      return `${employeeCode}_CNIC_Back${normalizedExt}`;
    case 'FATHER':
      return `${employeeCode}_Father${normalizedExt}`;
    case 'OTHER':
      return `${employeeCode}_Other_${String(seq || 1).padStart(2, '0')}${normalizedExt}`;
    default:
      throw new Error('Invalid category');
  }
}

export async function getNextOtherSeq(employeeId: number, employeeCode: string) {
  const existing = await prisma.employeeImage.findMany({
    where: { employeeId, imageCategory: 'OTHER' },
    select: { storedFilename: true },
  });
  let max = 0;
  for (const img of existing) {
    const m = img.storedFilename.match(/_Other_(\d+)\./i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

export async function saveEmployeeImage(
  employeeId: number,
  employeeCode: string,
  category: string,
  file: Express.Multer.File,
  opts?: { replaceId?: number; seq?: number; actor?: { performedByUserId?: number | null; performedByUsername?: string | null } }
) {
  const ext = validateImage(file);
  const dir = getCategoryDir(category);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let seq = opts?.seq;
  if (category === 'OTHER' && !seq && !opts?.replaceId) {
    seq = await getNextOtherSeq(employeeId, employeeCode);
  }
  if (category === 'OTHER' && opts?.replaceId) {
    const old = await prisma.employeeImage.findUnique({ where: { id: opts.replaceId } });
    if (old) {
      const m = old.storedFilename.match(/_Other_(\d+)\./i);
      seq = m ? parseInt(m[1], 10) : (seq || await getNextOtherSeq(employeeId, employeeCode));
    } else {
      seq = seq || await getNextOtherSeq(employeeId, employeeCode);
    }
  }

  const storedFilename = buildStoredFilename(employeeCode, category, ext, seq);
  const relativePath = path.join(imageCategoryFolders[category], storedFilename).replace(/\\/g, '/');
  const destPath = path.join(dir, storedFilename);

  // Prevent collision by ensuring unique stored filename if somehow exists for different record
  if (!opts?.replaceId && fs.existsSync(destPath)) {
    // for OTHER bump seq; for single categories will replace via replace flow only
    if (category === 'OTHER') {
      seq = (seq || 1) + 1;
      const retryName = buildStoredFilename(employeeCode, category, ext, seq);
      const retryPath = path.join(dir, retryName);
      fs.writeFileSync(retryPath, file.buffer);
      return finalizeSave(employeeId, category, file, ext, retryName, path.join(imageCategoryFolders[category], retryName).replace(/\\/g, '/'), opts?.replaceId, opts?.actor);
    }
  }

  // Write new file first
  fs.writeFileSync(destPath, file.buffer);

  try {
    return await finalizeSave(employeeId, category, file, ext, storedFilename, relativePath, opts?.replaceId, opts?.actor);
  } catch (e) {
    // cleanup new file if DB fails and not replacing existing target intentionally
    if (fs.existsSync(destPath)) {
      try { fs.unlinkSync(destPath); } catch {}
    }
    throw e;
  }
}

async function finalizeSave(
  employeeId: number,
  category: string,
  file: Express.Multer.File,
  ext: string,
  storedFilename: string,
  relativePath: string,
  replaceId?: number,
  actor?: { performedByUserId?: number | null; performedByUsername?: string | null }
) {
  if (replaceId) {
    const old = await prisma.employeeImage.findUnique({ where: { id: replaceId } });
    const updated = await prisma.employeeImage.update({
      where: { id: replaceId },
      data: {
        originalFilename: file.originalname,
        storedFilename,
        relativePath,
        fileExtension: ext.toLowerCase(),
        fileSize: file.size,
        uploadDate: new Date(),
      },
    });
    // delete old physical file if different
    if (old && old.storedFilename !== storedFilename) {
      const oldPath = path.join(getCategoryDir(category), old.storedFilename);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch {}
      }
    }
    await prisma.employeeHistory.create({ data: { employeeId, action: 'IMAGE_REPLACED', details: `${category} image replaced`, performedByUserId: actor?.performedByUserId ?? null, performedByUsername: actor?.performedByUsername ?? null } });
    return updated;
  } else {
    // for single-image categories, remove existing record/file first logically? keep one
    if (category !== 'OTHER') {
      const existing = await prisma.employeeImage.findFirst({ where: { employeeId, imageCategory: category } });
      if (existing) {
        // replace existing
        return finalizeSave(employeeId, category, file, ext, storedFilename, relativePath, existing.id, actor);
      }
    }
    const created = await prisma.employeeImage.create({
      data: {
        employeeId,
        imageCategory: category,
        originalFilename: file.originalname,
        storedFilename,
        relativePath,
        fileExtension: ext.toLowerCase(),
        fileSize: file.size,
      },
    });
    await prisma.employeeHistory.create({ data: { employeeId, action: 'IMAGE_UPLOADED', details: `${category} image uploaded`, performedByUserId: actor?.performedByUserId ?? null, performedByUsername: actor?.performedByUsername ?? null } });
    return created;
  }
}

export async function deleteImageById(imageId: number, actor?: { performedByUserId?: number | null; performedByUsername?: string | null }) {
  const img = await prisma.employeeImage.findUnique({ where: { id: imageId } });
  if (!img) throw new Error('Image not found');
  const filePath = path.join(getCategoryDir(img.imageCategory), img.storedFilename);
  await prisma.employeeImage.delete({ where: { id: imageId } });
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch {}
  }
  await prisma.employeeHistory.create({ data: { employeeId: img.employeeId, action: 'IMAGE_DELETED', details: `${img.imageCategory} image deleted`, performedByUserId: actor?.performedByUserId ?? null, performedByUsername: actor?.performedByUsername ?? null } });
  return img;
}

export async function deleteAllEmployeeImages(employeeId: number) {
  const imgs = await prisma.employeeImage.findMany({ where: { employeeId } });
  for (const img of imgs) {
    const filePath = path.join(getCategoryDir(img.imageCategory), img.storedFilename);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
  await prisma.employeeImage.deleteMany({ where: { employeeId } });
}

export async function renameEmployeeImages(employeeId: number, oldCode: string, newCode: string) {
  const imgs = await prisma.employeeImage.findMany({ where: { employeeId } });
  for (const img of imgs) {
    const ext = img.fileExtension || path.extname(img.storedFilename);
    let seq: number | undefined;
    if (img.imageCategory === 'OTHER') {
      const m = img.storedFilename.match(/_Other_(\d+)\./i);
      seq = m ? parseInt(m[1], 10) : 1;
    }
    const newStored = buildStoredFilename(newCode, img.imageCategory, ext, seq);
    if (newStored === img.storedFilename) continue;
    const dir = getCategoryDir(img.imageCategory);
    const oldPath = path.join(dir, img.storedFilename);
    const newPath = path.join(dir, newStored);
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
    }
    const newRel = path.join(imageCategoryFolders[img.imageCategory], newStored).replace(/\\/g, '/');
    await prisma.employeeImage.update({ where: { id: img.id }, data: { storedFilename: newStored, relativePath: newRel } });
  }
}
