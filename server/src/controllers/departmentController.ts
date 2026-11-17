import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

export async function listDepartments(req: Request, res: Response) {
  const search = String(req.query.search || '').trim();
  const idsParam = req.query.ids;
  const qLimit = req.query.limit;
  const limitNum = qLimit === undefined ? 300 : (qLimit === 'all' ? 2000 : Math.max(1, Math.min(2000, parseInt(String(qLimit)) || 300)));
  const where: any = {};
  if (search) where.name = { contains: search };
  if (idsParam) {
    const ids = String(idsParam).split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    if (ids.length) where.id = { in: ids };
  }
  const [total, depts] = await Promise.all([
    prisma.department.count({ where }),
    prisma.department.findMany({
      where,
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
      take: limitNum,
    }),
  ]);
  res.json(depts.map(d => ({ ...d, employeeCount: d._count.employees })));
}

export async function getDepartment(req: Request, res: Response) {
  const id = Number(req.params.id);
  const dept = await prisma.department.findUnique({
    where: { id },
    include: { employees: { select: { id: true, employeeCode: true, name: true, employmentStatus: true } }, _count: { select: { employees: true } } },
  });
  if (!dept) return res.status(404).json({ message: 'Not found' });
  res.json(dept);
}

export async function createDepartment(req: Request, res: Response) {
  const { name, description, status } = req.body;
  if (!name) return res.status(400).json({ message: 'Name required' });
  try {
    const dept = await prisma.department.create({ data: { name, description, status: status || 'ACTIVE' } });
    res.status(201).json(dept);
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(400).json({ message: 'Department name already exists' });
    res.status(500).json({ message: 'Failed to create department' });
  }
}

export async function updateDepartment(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { name, description, status } = req.body;
  try {
    const dept = await prisma.department.update({ where: { id }, data: { name, description, status } });
    res.json(dept);
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(400).json({ message: 'Department name already exists' });
    res.status(500).json({ message: 'Failed to update department' });
  }
}

export async function deleteDepartment(req: Request, res: Response) {
  const id = Number(req.params.id);
  try {
    const count = await prisma.employee.count({ where: { departmentId: id } });
    if (count > 0) return res.status(400).json({ message: 'Cannot delete department with assigned employees. Reassign employees first.' });
    await prisma.department.delete({ where: { id } });
    res.json({ message: 'Deleted' });
  } catch (e: any) {
    console.error('Department delete failed:', e);
    res.status(500).json({ message: 'Failed to delete department' });
  }
}
