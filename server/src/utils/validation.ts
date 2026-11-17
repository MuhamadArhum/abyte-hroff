export type ValidationIssue = { field: string; message: string };

export function badRequest(message: string, issues?: ValidationIssue[]) {
  return { status: 400, body: { message, ...(issues?.length ? { issues } : {}) } };
}

export function isValidEmail(v?: string | null) {
  if (!v) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

export function isValidPhone(v?: string | null) {
  if (!v) return true;
  const s = v.replace(/[\s\-()]/g, '');
  return /^(\+?\d{10,15}|0\d{10,11})$/.test(s);
}

export function normalizeCnic(v?: string | null) {
  if (!v) return null;
  const digits = v.replace(/\D/g, '');
  return digits.length ? digits : null;
}

export function isValidCnic(v?: string | null) {
  if (!v) return true;
  const digits = normalizeCnic(v);
  if (!digits) return false;
  return digits.length === 13 || /^\d{5}-\d{7}-\d$/.test(v);
}

export function formatCnic(v?: string | null) {
  if (!v) return null;
  const d = normalizeCnic(v);
  if (d && d.length === 13) return `${d.slice(0,5)}-${d.slice(5,12)}-${d.slice(12)}`;
  return v.trim() || null;
}

export function isValidEnum(v: any, allowed: string[]) {
  if (v === undefined || v === null || v === '') return true;
  return allowed.includes(String(v));
}

export function parseDateStrict(v: any) {
  if (v === undefined || v === null || v === '') return { ok: true, value: null as Date | null };
  const d = new Date(v);
  if (isNaN(d.getTime())) return { ok: false, value: null as Date | null };
  return { ok: true, value: d };
}

export function validateEmployeePayload(data: any, opts?: { partial?: boolean }) {
  const issues: ValidationIssue[] = [];
  const partial = !!opts?.partial;
  const req = (field: string, cond: boolean, msg: string) => { if (cond) issues.push({ field, message: msg }); };

  if (!partial || data.name !== undefined) {
    req('name', !String(data.name || '').trim(), 'Employee name is required');
  }
  if (data.employeeCode !== undefined && String(data.employeeCode).trim() !== '') {
    const code = String(data.employeeCode).trim();
    if (code.length < 2 || code.length > 30) {
      issues.push({ field: 'employeeCode', message: 'Employee code must be at least 2 characters (max 30)' });
    } else if (!/^[A-Za-z0-9_-]+$/.test(code)) {
      issues.push({ field: 'employeeCode', message: 'Employee code can contain letters, numbers, hyphen (-) and underscore (_) only' });
    }
  }
  if (data.personalEmail !== undefined && data.personalEmail !== '' && !isValidEmail(String(data.personalEmail))) issues.push({ field: 'personalEmail', message: 'Invalid personal email address' });
  if (data.mobileNumber !== undefined && data.mobileNumber !== '' && !isValidPhone(String(data.mobileNumber))) issues.push({ field: 'mobileNumber', message: 'Invalid mobile number' });
  if (data.alternatePhone !== undefined && data.alternatePhone !== '' && !isValidPhone(String(data.alternatePhone))) issues.push({ field: 'alternatePhone', message: 'Invalid alternate/WhatsApp number' });
  if (data.emergencyContact !== undefined && data.emergencyContact !== '' && !isValidPhone(String(data.emergencyContact))) issues.push({ field: 'emergencyContact', message: 'Invalid emergency contact number' });
  if (data.referenceContact !== undefined && data.referenceContact !== '' && !isValidPhone(String(data.referenceContact))) issues.push({ field: 'referenceContact', message: 'Invalid reference contact number' });
  if (data.cnic !== undefined && data.cnic !== '' && !isValidCnic(String(data.cnic))) issues.push({ field: 'cnic', message: 'Invalid CNIC (expected 13 digits or #####-#######-#)' });
  if (!isValidEnum(data.gender, ['MALE', 'FEMALE', 'OTHER'])) issues.push({ field: 'gender', message: 'Invalid gender' });
  if (!isValidEnum(data.maritalStatus, ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'])) issues.push({ field: 'maritalStatus', message: 'Invalid marital status' });
  if (!isValidEnum(data.jobType, ['PERMANENT', 'CONTRACT', 'TEMPORARY', 'INTERN'])) issues.push({ field: 'jobType', message: 'Invalid job type' });
  if (!isValidEnum(data.employmentStatus, ['ACTIVE', 'INACTIVE'])) issues.push({ field: 'employmentStatus', message: 'Invalid employment status' });
  if (data.salary !== undefined && data.salary !== '' && data.salary !== null) {
    const n = Number(data.salary);
    if (isNaN(n) || n < 0) issues.push({ field: 'salary', message: 'Salary must be a non-negative number' });
  }
  const dob = parseDateStrict(data.dateOfBirth);
  if (!dob.ok) issues.push({ field: 'dateOfBirth', message: 'Invalid date of birth' });
  const doj = parseDateStrict(data.dateOfJoining);
  if (!doj.ok) issues.push({ field: 'dateOfJoining', message: 'Invalid date of joining' });
  for (const f of ['cnicIssueDate','cnicExpiryDate','resignationDate','lastWorkingDate']) {
    if (!parseDateStrict(data[f]).ok) issues.push({ field: f, message: `Invalid ${f}` });
  }
  if (dob.value && doj.value && doj.value < dob.value) issues.push({ field: 'dateOfJoining', message: 'Date of joining cannot be before date of birth' });
  if (dob.value && dob.value > new Date()) issues.push({ field: 'dateOfBirth', message: 'Date of birth cannot be in the future' });

  return { ok: issues.length === 0, issues };
}

export const allowedImageExt = ['.jpg', '.jpeg', '.png', '.webp'];
export const allowedImageMime = ['image/jpeg', 'image/png', 'image/webp'];
export const allowedDocExt = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt'];
export const allowedDocMime = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv', 'text/plain', 'application/csv'
];

function hasValidSignature(file: Express.Multer.File, ext: string) {
  const b = file.buffer;
  if (!b || b.length < 4) return false;
  const hex = b.subarray(0, 8).toString('hex');
  if (ext === '.jpg' || ext === '.jpeg') return hex.startsWith('ffd8ff');
  if (ext === '.png') return hex.startsWith('89504e470d0a1a0a');
  if (ext === '.webp') return b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
  if (ext === '.pdf') return b.toString('ascii', 0, 5) === '%PDF-';
  if (['.doc', '.docx', '.xls', '.xlsx'].includes(ext)) {
    return hex.startsWith('504b0304') || hex.startsWith('d0cf11e0');
  }
  // Plain text formats have no reliable signature.
  return true;
}

export function validateUploadFile(file: Express.Multer.File, kind: 'image' | 'document', maxBytes = 10 * 1024 * 1024) {
  const ext = (file.originalname.match(/\.[^.]+$/)?.[0] || '').toLowerCase();
  if (file.size > maxBytes) return `File "${file.originalname}" is too large (max ${Math.round(maxBytes / (1024*1024))}MB)`;
  if (kind === 'image') {
    if (!allowedImageExt.includes(ext)) return `File "${file.originalname}" has unsupported image type`;
    if (file.mimetype && !allowedImageMime.includes(file.mimetype)) return `File "${file.originalname}" has invalid image format`;
  } else {
    if (!allowedDocExt.includes(ext)) return `File "${file.originalname}" has unsupported document type`;
  }
  if (!hasValidSignature(file, ext)) return `File "${file.originalname}" content does not match its extension`;
  return null;
}