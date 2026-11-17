import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

export async function listDesignations(req: Request, res: Response) {
  const search = String(req.query.search || '').trim();
  const idsParam = req.query.ids;
  const qLimit = req.query.limit;
  const limitNum = qLimit === undefined ? 300 : (qLimit === 'all' ? 2000 : Math.max(1, Math.min(2000, parseInt(String(qLimit)) || 300)));
  const where: any = {};
  if (search) where.title = { contains: search };
  if (idsParam) {
    const ids = String(idsParam).split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    if (ids.length) where.id = { in: ids };
  }
  const items = await prisma.designation.findMany({
    where,
    include: { _count: { select: { employees: true } } },
    orderBy: { title: 'asc' },
    take: limitNum,
  });
  res.json(items);
}

export async function createDesignation(req: Request, res: Response) {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ message: 'Title required' });
  try {
    const item = await prisma.designation.create({ data: { title, description } });
    res.status(201).json(item);
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(400).json({ message: 'Designation already exists' });
    res.status(500).json({ message: 'Failed to create designation' });
  }
}

export async function updateDesignation(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { title, description } = req.body;
  try {
    const item = await prisma.designation.update({ where: { id }, data: { title, description } });
    res.json(item);
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(400).json({ message: 'Designation already exists' });
    res.status(500).json({ message: 'Failed to update designation' });
  }
}

export async function deleteDesignation(req: Request, res: Response) {
  const id = Number(req.params.id);
  try {
    await prisma.designation.delete({ where: { id } });
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ message: 'Failed to delete designation' });
  }
}
