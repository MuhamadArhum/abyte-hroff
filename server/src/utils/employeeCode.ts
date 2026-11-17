import { prisma } from '../config/prisma';

export async function generateEmployeeCode(): Promise<string> {
  // Find highest numeric suffix among EMP-* codes to avoid collisions/gaps issues
  const employees = await prisma.employee.findMany({ select: { employeeCode: true } });
  let nextNum = 1;
  for (const e of employees) {
    const match = String(e.employeeCode || '').match(/^EMP-(\d+)$/i);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n >= nextNum) nextNum = n + 1;
    }
  }
  let code = `EMP-${String(nextNum).padStart(2, '0')}`;
  while (await prisma.employee.findUnique({ where: { employeeCode: code } })) {
    nextNum++;
    code = `EMP-${String(nextNum).padStart(2, '0')}`;
  }
  return code;
}
