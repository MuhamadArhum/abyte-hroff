import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { generateEmployeeCode } from '../utils/employeeCode';
import { deleteAllEmployeeImages, renameEmployeeImages } from '../services/imageService';
import { AuthRequest } from '../middleware/auth';
import { validateEmployeePayload, formatCnic } from '../utils/validation';

function actor(req: Request) {
  const u = (req as AuthRequest).user;
  return { performedByUserId: u?.id ?? null, performedByUsername: u?.username ?? null };
}

function calcAge(dob?: Date | string | null) {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function parseDate(v: any) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function parseIntNullable(v: any) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : Math.trunc(n);
}

function strOrNull(v: any) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

export async function listEmployees(req: Request, res: Response) {
  const {
    search = '', departmentId, designationId, jobType, employmentStatus,
    dateOfJoining, joiningFrom, joiningTo,
    page = '1', limit = '10', sortBy = 'createdAt', sortOrder = 'desc'
  } = req.query as any;

  const where: any = {};
  if (search) {
    where.OR = [
      { employeeCode: { contains: search } },
      { name: { contains: search } },
      { cnic: { contains: search } },
      { mobileNumber: { contains: search } },
      { personalEmail: { contains: search } },
    ];
  }
  if (departmentId) where.departmentId = Number(departmentId);
  if (designationId) where.designationId = Number(designationId);
  if (jobType) where.jobType = jobType;
  if (employmentStatus) where.employmentStatus = employmentStatus;
  if (dateOfJoining) {
    const d = new Date(dateOfJoining);
    if (!isNaN(d.getTime())) {
      const next = new Date(d); next.setDate(next.getDate() + 1);
      where.dateOfJoining = { gte: d, lt: next };
    }
  }
  if (joiningFrom || joiningTo) {
    const range: any = {};
    if (joiningFrom) { const d = new Date(joiningFrom); if (!isNaN(d.getTime())) range.gte = d; }
    if (joiningTo) { const d = new Date(joiningTo); if (!isNaN(d.getTime())) { d.setHours(23,59,59,999); range.lte = d; } }
    if (Object.keys(range).length) where.dateOfJoining = { ...(where.dateOfJoining || {}), ...range };
  }

  const pageNum = Math.max(1, parseInt(page));
  const rawLimit = String(limit ?? '10');
  const maxTake = 1000;
  const isAll = rawLimit === 'all';
  const take = isAll ? maxTake : Math.max(1, Math.min(maxTake, parseInt(rawLimit) || 10));
  const skip = isAll ? 0 : (pageNum - 1) * take;
  const allowedSort = ['employeeCode', 'name', 'createdAt', 'updatedAt', 'dateOfJoining', 'employmentStatus'];
  const orderField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
  const orderDir = sortOrder === 'asc' ? 'asc' : 'desc';

  const [total, items] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where, skip, take,
      orderBy: { [orderField]: orderDir },
      include: { department: true, designation: true, images: { where: { imageCategory: 'PROFILE' }, take: 1 } },
    })
  ]);

  const effectivePage = isAll ? 1 : pageNum;
  const effectiveLimit = isAll ? items.length : take;
  const capped = isAll && total > maxTake;
  res.json({
    items: items.map(e => ({ ...e, age: calcAge(e.dateOfBirth) })),
    total,
    page: effectivePage,
    limit: effectiveLimit,
    totalPages: isAll ? 1 : Math.ceil(total / take),
    ...(capped ? { capped: true, cap: maxTake } : {}),
  });
}

export async function getEmployee(req: Request, res: Response) {
  const idNum = Number(req.params.id);
  if (!Number.isFinite(idNum) || idNum <= 0) {
    return res.status(400).json({ message: 'Invalid employee id' });
  }
  try {
    const emp = await prisma.employee.findUnique({
      where: { id: idNum },
      include: {
        department: true, designation: true,
        images: { orderBy: [{ imageCategory: 'asc' }, { uploadDate: 'asc' }] },
        documents: { orderBy: { uploadDate: 'desc' } },
        history: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
    if (!emp) return res.status(404).json({ message: 'Employee not found' });
    res.json({ ...emp, age: calcAge(emp.dateOfBirth) });
  } catch (e) {
    console.error('getEmployee error:', e);
    return res.status(500).json({ message: 'Failed to load employee' });
  }
}

export async function createEmployee(req: Request, res: Response) {
  try {
    const data = req.body;
    const v = validateEmployeePayload(data);
    if (!v.ok) return res.status(400).json({ message: 'Validation failed', issues: v.issues });
    const employeeCode = (data.employeeCode?.trim() || await generateEmployeeCode());
    const cnic = formatCnic(data.cnic);
    const exists = await prisma.employee.findUnique({ where: { employeeCode } });
    if (exists) return res.status(400).json({ message: 'Employee code already exists', issues: [{ field: 'employeeCode', message: 'Employee code already exists' }] });
    if (cnic) {
      const cnicDup = await prisma.employee.findFirst({ where: { cnic } });
      if (cnicDup) return res.status(400).json({ message: 'CNIC already exists', issues: [{ field: 'cnic', message: 'CNIC already exists' }] });
    }

    const emp = await prisma.employee.create({
      data: {
        employeeCode,
        name: String(data.name).trim(),
        fatherName: strOrNull(data.fatherName),
        cnic,
        cnicIssueDate: parseDate(data.cnicIssueDate),
        cnicExpiryDate: parseDate(data.cnicExpiryDate),
        dateOfBirth: parseDate(data.dateOfBirth),
        gender: data.gender || null,
        bloodGroup: strOrNull(data.bloodGroup),
        maritalStatus: data.maritalStatus || null,
        religion: strOrNull(data.religion),
        mobileNumber: strOrNull(data.mobileNumber),
        alternatePhone: strOrNull(data.alternatePhone),
        personalEmail: strOrNull(data.personalEmail),
        address: strOrNull(data.address),
        permanentAddress: strOrNull(data.permanentAddress),
        city: strOrNull(data.city),
        emergencyContact: strOrNull(data.emergencyContact),
        emergencyContactName: strOrNull(data.emergencyContactName),
        emergencyContactRelation: strOrNull(data.emergencyContactRelation),
        emergencyContactAddress: strOrNull(data.emergencyContactAddress),
        qualification: strOrNull(data.qualification),
        skills: strOrNull(data.skills),
        departmentId: data.departmentId ? Number(data.departmentId) : null,
        designationId: data.designationId ? Number(data.designationId) : null,
        reportingManager: strOrNull(data.reportingManager),
        shiftTimings: strOrNull(data.shiftTimings),
        jobType: data.jobType || null,
        dateOfJoining: parseDate(data.dateOfJoining),
        resignationDate: parseDate(data.resignationDate),
        lastWorkingDate: parseDate(data.lastWorkingDate),
        salary: data.salary !== undefined && data.salary !== '' && data.salary !== null ? Number(data.salary) : null,
        employmentStatus: data.employmentStatus || 'ACTIVE',
        employeeCardNumber: strOrNull(data.employeeCardNumber),
        eobiNumber: strOrNull(data.eobiNumber),
        socialSecurityNumber: strOrNull(data.socialSecurityNumber),
        referenceName: strOrNull(data.referenceName),
        referenceContact: strOrNull(data.referenceContact),
        referenceRelation: strOrNull(data.referenceRelation),
        notes: strOrNull(data.notes),
      },
    });
    await prisma.employeeHistory.create({ data: { employeeId: emp.id, action: 'EMPLOYEE_CREATED', details: `Employee ${emp.employeeCode} created`, ...actor(req) } });
    res.status(201).json(emp);
  } catch (e: any) {
    if (e.code === 'P2002') {
      const target = Array.isArray(e.meta?.target) ? e.meta.target.join(',') : String(e.meta?.target || '');
      if (target.includes('cnic')) return res.status(400).json({ message: 'CNIC already exists', issues: [{ field: 'cnic', message: 'CNIC already exists' }] });
      if (target.includes('employeeCode')) return res.status(400).json({ message: 'Employee code already exists', issues: [{ field: 'employeeCode', message: 'Employee code already exists' }] });
      return res.status(400).json({ message: 'Duplicate value (CNIC or Employee Code)' });
    }
    console.error(e);
    res.status(500).json({ message: 'Failed to create employee' });
  }
}

export async function updateEmployee(req: Request, res: Response) {
  const id = Number(req.params.id);
  try {
    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Employee not found' });
    const data = req.body;
    const v = validateEmployeePayload(data, { partial: true });
    if (!v.ok) return res.status(400).json({ message: 'Validation failed', issues: v.issues });
    const newCode = data.employeeCode !== undefined ? (String(data.employeeCode).trim() || existing.employeeCode) : existing.employeeCode;
    const cnic = data.cnic !== undefined ? formatCnic(data.cnic) : existing.cnic;

    if (newCode !== existing.employeeCode) {
      const dup = await prisma.employee.findUnique({ where: { employeeCode: newCode } });
      if (dup) return res.status(400).json({ message: 'Employee code already exists', issues: [{ field: 'employeeCode', message: 'Employee code already exists' }] });
    }
    if (cnic && cnic !== existing.cnic) {
      const cnicDup = await prisma.employee.findFirst({ where: { cnic, NOT: { id } } });
      if (cnicDup) return res.status(400).json({ message: 'CNIC already exists', issues: [{ field: 'cnic', message: 'CNIC already exists' }] });
    }

    const act = actor(req);
    const updated = await prisma.$transaction(async (tx) => {
      const u = (key: string, val: any) => (data[key] !== undefined ? val : (existing as any)[key]);
      const emp = await tx.employee.update({
        where: { id },
        data: {
          employeeCode: newCode,
          name: data.name !== undefined ? String(data.name).trim() : existing.name,
          fatherName: data.fatherName !== undefined ? strOrNull(data.fatherName) : existing.fatherName,
          cnic,
          cnicIssueDate: data.cnicIssueDate !== undefined ? parseDate(data.cnicIssueDate) : (existing as any).cnicIssueDate,
          cnicExpiryDate: data.cnicExpiryDate !== undefined ? parseDate(data.cnicExpiryDate) : (existing as any).cnicExpiryDate,
          dateOfBirth: data.dateOfBirth !== undefined ? parseDate(data.dateOfBirth) : existing.dateOfBirth,
          gender: data.gender !== undefined ? (data.gender || null) : existing.gender,
          bloodGroup: data.bloodGroup !== undefined ? strOrNull(data.bloodGroup) : existing.bloodGroup,
          maritalStatus: data.maritalStatus !== undefined ? (data.maritalStatus || null) : existing.maritalStatus,
          religion: u('religion', strOrNull(data.religion)),
          mobileNumber: data.mobileNumber !== undefined ? strOrNull(data.mobileNumber) : existing.mobileNumber,
          alternatePhone: u('alternatePhone', strOrNull(data.alternatePhone)),
          personalEmail: u('personalEmail', strOrNull(data.personalEmail)),
          address: data.address !== undefined ? strOrNull(data.address) : existing.address,
          permanentAddress: u('permanentAddress', strOrNull(data.permanentAddress)),
          city: data.city !== undefined ? strOrNull(data.city) : existing.city,
          emergencyContact: data.emergencyContact !== undefined ? strOrNull(data.emergencyContact) : existing.emergencyContact,
          emergencyContactName: u('emergencyContactName', strOrNull(data.emergencyContactName)),
          emergencyContactRelation: u('emergencyContactRelation', strOrNull(data.emergencyContactRelation)),
          emergencyContactAddress: u('emergencyContactAddress', strOrNull(data.emergencyContactAddress)),
          qualification: u('qualification', strOrNull(data.qualification)),
          skills: u('skills', strOrNull(data.skills)),
          departmentId: data.departmentId !== undefined ? (data.departmentId ? Number(data.departmentId) : null) : existing.departmentId,
          designationId: data.designationId !== undefined ? (data.designationId ? Number(data.designationId) : null) : existing.designationId,
          reportingManager: u('reportingManager', strOrNull(data.reportingManager)),
          shiftTimings: u('shiftTimings', strOrNull(data.shiftTimings)),
          jobType: data.jobType !== undefined ? (data.jobType || null) : existing.jobType,
          dateOfJoining: data.dateOfJoining !== undefined ? parseDate(data.dateOfJoining) : existing.dateOfJoining,
          resignationDate: data.resignationDate !== undefined ? parseDate(data.resignationDate) : (existing as any).resignationDate,
          lastWorkingDate: data.lastWorkingDate !== undefined ? parseDate(data.lastWorkingDate) : (existing as any).lastWorkingDate,
          salary: data.salary !== undefined ? (data.salary === '' || data.salary === null ? null : Number(data.salary)) : existing.salary,
          employmentStatus: data.employmentStatus !== undefined ? (data.employmentStatus || existing.employmentStatus) : existing.employmentStatus,
          employeeCardNumber: u('employeeCardNumber', strOrNull(data.employeeCardNumber)),
          eobiNumber: u('eobiNumber', strOrNull(data.eobiNumber)),
          socialSecurityNumber: u('socialSecurityNumber', strOrNull(data.socialSecurityNumber)),
          referenceName: u('referenceName', strOrNull(data.referenceName)),
          referenceContact: u('referenceContact', strOrNull(data.referenceContact)),
          referenceRelation: u('referenceRelation', strOrNull(data.referenceRelation)),
          notes: data.notes !== undefined ? strOrNull(data.notes) : existing.notes,
        },
      });
      await tx.employeeHistory.create({ data: { employeeId: id, action: 'EMPLOYEE_UPDATED', details: `Employee updated`, ...act } });
      if (newCode !== existing.employeeCode) {
        await tx.employeeHistory.create({ data: { employeeId: id, action: 'EMPLOYEE_CODE_CHANGED', details: `${existing.employeeCode} -> ${newCode}`, ...act } });
      }
      return emp;
    });

    if (newCode !== existing.employeeCode) {
      await renameEmployeeImages(id, existing.employeeCode, newCode);
    }

    res.json(updated);
  } catch (e: any) {
    if (e.code === 'P2002') {
      const target = Array.isArray(e.meta?.target) ? e.meta.target.join(',') : String(e.meta?.target || '');
      if (target.includes('cnic')) return res.status(400).json({ message: 'CNIC already exists', issues: [{ field: 'cnic', message: 'CNIC already exists' }] });
      if (target.includes('employeeCode')) return res.status(400).json({ message: 'Employee code already exists', issues: [{ field: 'employeeCode', message: 'Employee code already exists' }] });
      return res.status(400).json({ message: 'Duplicate value (CNIC or Employee Code)' });
    }
    console.error(e);
    res.status(500).json({ message: 'Failed to update employee' });
  }
}

export async function deleteEmployee(req: Request, res: Response) {
  const id = Number(req.params.id);
  try {
    const emp = await prisma.employee.findUnique({ where: { id }, include: { documents: true } });
    if (!emp) return res.status(404).json({ message: 'Employee not found' });
    await deleteAllEmployeeImages(id);
    // delete document files
    const pathMod = await import('path');
    const fsMod = await import('fs');
    const { config } = await import('../config');
    for (const d of emp.documents || []) {
      const full = pathMod.join(config.storagePath, d.relativePath);
      if (fsMod.existsSync(full)) try { fsMod.unlinkSync(full); } catch {}
    }
    await prisma.employee.delete({ where: { id } });
    res.json({ message: 'Employee deleted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to delete employee' });
  }
}

export async function toggleStatus(req: Request, res: Response) {
  const id = Number(req.params.id);
  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) return res.status(404).json({ message: 'Employee not found' });
  const newStatus = emp.employmentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  const updated = await prisma.employee.update({ where: { id }, data: { employmentStatus: newStatus } });
  await prisma.employeeHistory.create({ data: { employeeId: id, action: newStatus === 'ACTIVE' ? 'EMPLOYEE_ACTIVATED' : 'EMPLOYEE_DEACTIVATED', details: `Status changed to ${newStatus}`, ...actor(req) } });
  res.json(updated);
}
