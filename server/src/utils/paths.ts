import path from 'path';
import fs from 'fs';
import { config } from '../config';

export const imageCategoryFolders: Record<string, string> = {
  PROFILE: 'profile-pictures',
  CNIC_FRONT: 'cnic-front',
  CNIC_BACK: 'cnic-back',
  FATHER: 'father-pictures',
  OTHER: 'other-pictures',
};

export function ensureStorageDirs() {
  const dirs = [
    config.storagePath,
    path.join(config.storagePath, 'profile-pictures'),
    path.join(config.storagePath, 'cnic-front'),
    path.join(config.storagePath, 'cnic-back'),
    path.join(config.storagePath, 'father-pictures'),
    path.join(config.storagePath, 'other-pictures'),
    path.join(config.storagePath, 'documents'),
    config.backupPath,
  ];
  for (const d of dirs) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

export function getCategoryDir(category: string) {
  const folder = imageCategoryFolders[category];
  if (!folder) throw new Error('Invalid image category');
  return path.join(config.storagePath, folder);
}

export function safeJoin(base: string, target: string) {
  const resolved = path.resolve(base, target);
  if (!resolved.startsWith(path.resolve(base))) {
    throw new Error('Invalid path');
  }
  return resolved;
}
