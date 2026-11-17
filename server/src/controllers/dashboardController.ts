import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

function buildEmployeeWhere(query: any) {
  const where: any = {};
  if (query.departmentId) where.departmentId = Number(query.departmentId);
  if (query.designationId) where.designationId = Number(query.designationId);
  if (query.employmentStatus) where.employmentStatus = String(query.employmentStatus);
  if (query.jobType) where.jobType = String(query.jobType);
  if (query.joiningFrom || query.joiningTo) {
    const range: any = {};
    if (query.joiningFrom) { const d = new Date(String(query.joiningFrom)); if (!isNaN(d.getTime())) range.gte = d; }
    if (query.joiningTo) { const d = new Date(String(query.joiningTo)); if (!isNaN(d.getTime())) { d.setHours(23,59,59,999); range.lte = d; } }
    if (Object.keys(range).length) where.dateOfJoining = range;
  }
  return where;
}

export async function getDashboardStats(req: Request, res: Response) {
  try {
    const where = buildEmployeeWhere(req.query);
    const filtered = Object.keys(where).length > 0;

    const [totalEmployees, activeEmployees, inactiveEmployees, totalDepartments, totalDesignations, recentAdded, recentUpdated, deptStats, jobTypeStats] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.count({ where: { ...where, employmentStatus: 'ACTIVE' } }),
      prisma.employee.count({ where: { ...where, employmentStatus: 'INACTIVE' } }),
      prisma.department.count(),
      prisma.designation.count(),
      prisma.employee.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true, employeeCode: true, name: true, createdAt: true,
          department: { select: { name: true } },
          designation: { select: { title: true } },
        },
      }),
      prisma.employee.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true, employeeCode: true, name: true, updatedAt: true,
          department: { select: { name: true } },
          designation: { select: { title: true } },
        },
      }),
      prisma.department.findMany({
        take: 12,
        orderBy: { employees: { _count: 'desc' } },
        select: {
          id: true,
          name: true,
          _count: { select: { employees: { where } } },
        },
      }),
      prisma.employee.groupBy({ by: ['jobType'], where, _count: { jobType: true } }),
    ]);

    // Simple trend insights from filtered employees (joining vs resignation by month, last 6 months)
    const trendWhere: any = { ...where };
    const since = new Date(); since.setMonth(since.getMonth() - 5); since.setDate(1); since.setHours(0,0,0,0);
    const trendEmployees = await prisma.employee.findMany({
      where: {
        ...trendWhere,
        OR: [
          { dateOfJoining: { gte: since } },
          { resignationDate: { gte: since } },
          { lastWorkingDate: { gte: since } },
        ],
      },
      select: { dateOfJoining: true, resignationDate: true, lastWorkingDate: true },
      take: 5000,
    });
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = (d: Date) => d.toLocaleString('en-US', { month: 'short' });
    const buckets: Record<string, { month: string; joined: number; resigned: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
      buckets[monthKey(d)] = { month: monthLabel(d), joined: 0, resigned: 0 };
    }
    trendEmployees.forEach((e) => {
      if (e.dateOfJoining) { const k = monthKey(new Date(e.dateOfJoining)); if (buckets[k]) buckets[k].joined += 1; }
      const r = e.resignationDate || e.lastWorkingDate;
      if (r) { const k = monthKey(new Date(r)); if (buckets[k]) buckets[k].resigned += 1; }
    });
    const hiringResignationTrend = Object.keys(buckets).sort().map(k => buckets[k]);

    res.json({
      filtered,
      filtersApplied: {
        departmentId: req.query.departmentId || '',
        designationId: req.query.designationId || '',
        employmentStatus: req.query.employmentStatus || '',
        jobType: req.query.jobType || '',
        joiningFrom: req.query.joiningFrom || '',
        joiningTo: req.query.joiningTo || '',
      },
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      totalDepartments,
      totalDesignations,
      recentAdded,
      recentUpdated,
      departmentStats: deptStats.map(d => ({ id: d.id, name: d.name, count: d._count.employees })),
      jobTypeStats: jobTypeStats.map(j => ({ name: j.jobType || 'Unspecified', count: j._count.jobType })),
      activeInactiveStats: [
        { name: 'Active', count: activeEmployees },
        { name: 'Inactive', count: inactiveEmployees },
      ],
      hiringResignationTrend,
    });
  } catch (e) {
    console.error('Dashboard stats error:', e);
    res.status(500).json({ message: 'Failed to load dashboard stats' });
  }
}
