import { Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middleware/auth';

function calcAge(dob?: Date | null) {
  if (!dob) return '';
  const d = new Date(dob);
  const t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--;
  return age;
}

function fmtDate(d?: Date | null) {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
}

function buildReportWhere(query: any) {
  const where: any = {};
  if (query.departmentId) where.departmentId = Number(query.departmentId);
  if (query.designationId) where.designationId = Number(query.designationId);
  if (query.employmentStatus) where.employmentStatus = query.employmentStatus;
  if (query.jobType) where.jobType = query.jobType;
  if (query.joiningFrom || query.joiningTo) {
    const range: any = {};
    if (query.joiningFrom) { const d = new Date(query.joiningFrom as string); if (!isNaN(d.getTime())) range.gte = d; }
    if (query.joiningTo) { const d = new Date(query.joiningTo as string); if (!isNaN(d.getTime())) { d.setHours(23,59,59,999); range.lte = d; } }
    if (Object.keys(range).length) where.dateOfJoining = range;
  }
  // Explicit Status wins; reportType is only a shortcut and never silently overrides it.
  if (!query.employmentStatus && query.reportType === 'ACTIVE') where.employmentStatus = 'ACTIVE';
  if (!query.employmentStatus && query.reportType === 'INACTIVE') where.employmentStatus = 'INACTIVE';
  return where;
}

async function getEmployeesForReport(query: any) {
  const where = buildReportWhere(query);
  return prisma.employee.findMany({ where, include: { department: true, designation: true }, orderBy: { employeeCode: 'asc' } });
}

function mapReportItem(e: any, restricted = false) {
  const item: any = {
    id: e.id,
    employeeCode: e.employeeCode,
    name: e.name,
    city: e.city || '',
    department: e.department?.name || '',
    designation: e.designation?.title || '',
    jobType: e.jobType || '',
    dateOfJoining: fmtDate(e.dateOfJoining),
    employmentStatus: e.employmentStatus || '',
  };
  if (!restricted) {
    Object.assign(item, {
      fatherName: e.fatherName || '',
      cnic: e.cnic || '',
      dateOfBirth: fmtDate(e.dateOfBirth),
      age: calcAge(e.dateOfBirth),
      gender: e.gender || '',
      mobileNumber: e.mobileNumber || '',
      email: e.personalEmail || '',
      salary: e.salary ?? '',
    });
  }
  return item;
}

function filterSummary(query: any) {
  const parts: string[] = [];
  if (query.reportType) parts.push(`Type: ${query.reportType}`);
  if (query.employmentStatus) parts.push(`Status: ${query.employmentStatus}`);
  if (query.jobType) parts.push(`Job: ${query.jobType}`);
  if (query.departmentId) parts.push(`Dept ID: ${query.departmentId}`);
  if (query.designationId) parts.push(`Desig ID: ${query.designationId}`);
  if (query.joiningFrom || query.joiningTo) parts.push(`Joining: ${query.joiningFrom || '...'} to ${query.joiningTo || '...'}`);
  return parts.length ? parts.join(' | ') : 'All employees';
}

export async function previewReport(req: AuthRequest, res: Response) {
  const where = buildReportWhere(req.query);
  const page = Math.max(1, parseInt(String(req.query.page || '1')));
  const rawLimit = String(req.query.limit || '50');
  const limit = rawLimit === 'all' ? 1000 : Math.max(1, Math.min(1000, parseInt(rawLimit) || 50));
  const skip = rawLimit === 'all' ? 0 : (page - 1) * limit;

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: { department: { select: { name: true } }, designation: { select: { title: true } } },
      orderBy: { employeeCode: 'asc' },
      skip,
      take: limit,
    }),
  ]);

  const restricted = !req.user || !['ADMIN', 'MANAGER', 'HR'].includes(req.user.role);
  const items = employees.map((e: any) => mapReportItem(e, restricted));
  const totalPages = rawLimit === 'all' ? 1 : Math.max(1, Math.ceil(total / limit));
  const capped = rawLimit === 'all' && total > limit;
  res.json({ total, items, page: rawLimit === 'all' ? 1 : page, limit, totalPages, ...(capped ? { capped: true, cap: limit } : {}) });
}

export async function exportExcel(req: AuthRequest, res: Response) {
  const employees = await getEmployeesForReport(req.query);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Abyte-EMS';
  wb.created = new Date();
  const ws = wb.addWorksheet('Employees', { views: [{ state: 'frozen', ySplit: 4 }] });

  ws.mergeCells('A1:P1');
  ws.getCell('A1').value = 'Abyte-EMS — Employee Report';
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF17181A' } };
  ws.mergeCells('A2:P2');
  ws.getCell('A2').value = `Generated: ${new Date().toLocaleString()} | Total Records: ${employees.length}`;
  ws.getCell('A2').font = { size: 10, color: { argb: 'FF555555' } };
  ws.mergeCells('A3:P3');
  ws.getCell('A3').value = `Filters: ${filterSummary(req.query)}`;
  ws.getCell('A3').font = { size: 10, color: { argb: 'FF555555' } };

  const headerRowIndex = 4;
  const headers = ['Employee Code','Name','Father Name','CNIC','DOB','Age','Gender','Mobile','Personal Email','City','Department','Designation','Job Type','Date of Joining','Salary','Status'];
  const headerRow = ws.getRow(headerRowIndex);
  headerRow.values = headers;
  headerRow.font = { bold: true, color: { argb: 'FF2B2F33' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F4EE' } };
  headerRow.alignment = { vertical: 'middle' };
  headerRow.height = 18;

  ws.columns = [
    { key: 'employeeCode', width: 15 }, { key: 'name', width: 22 }, { key: 'fatherName', width: 20 }, { key: 'cnic', width: 18 },
    { key: 'dob', width: 12 }, { key: 'age', width: 8 }, { key: 'gender', width: 10 }, { key: 'mobile', width: 16 },
    { key: 'email', width: 26 }, { key: 'city', width: 14 }, { key: 'department', width: 20 }, { key: 'designation', width: 20 },
    { key: 'jobType', width: 14 }, { key: 'doj', width: 14 }, { key: 'salary', width: 12 }, { key: 'status', width: 12 },
  ];

  employees.forEach((e, idx) => {
    const r = ws.addRow({
      employeeCode: e.employeeCode, name: e.name, fatherName: e.fatherName || '', cnic: e.cnic || '',
      dob: fmtDate(e.dateOfBirth), age: calcAge(e.dateOfBirth),
      gender: e.gender || '', mobile: e.mobileNumber || '', email: (e as any).personalEmail || '', city: e.city || '',
      department: e.department?.name || '', designation: e.designation?.title || '', jobType: e.jobType || '',
      doj: fmtDate(e.dateOfJoining), salary: e.salary ?? '', status: e.employmentStatus || '',
    });
    if (idx % 2 === 1) r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDFCF8' } };
  });

  ws.autoFilter = { from: { row: headerRowIndex, column: 1 }, to: { row: headerRowIndex, column: headers.length } };
  ws.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = { top: { style: 'thin', color: { argb: 'FFE6E1D6' } }, left: { style: 'thin', color: { argb: 'FFE6E1D6' } }, bottom: { style: 'thin', color: { argb: 'FFE6E1D6' } }, right: { style: 'thin', color: { argb: 'FFE6E1D6' } } };
      if (rowNumber <= 3) cell.border = { top: { style: undefined }, left: { style: undefined }, bottom: { style: undefined }, right: { style: undefined } } as any;
    });
  });

  const stamp = new Date().toISOString().slice(0,10);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="Abyte-EMS-Employees-${stamp}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

export async function exportPdf(req: AuthRequest, res: Response) {
  const employees = await getEmployeesForReport(req.query);
  const stamp = new Date().toISOString().slice(0,10);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Abyte-EMS-Employees-${stamp}.pdf"`);

  const doc = new PDFDocument({ margin: 28, size: 'A4', layout: 'landscape', bufferPages: true, info: { Title: 'Abyte-EMS Employee Report', Author: 'Abyte-EMS' } });
  doc.pipe(res);

  const left = () => doc.page.margins.left;
  const top = () => doc.page.margins.top;
  const usableWidth = () => doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 18;

  const cols = [
    { label: 'Code', w: 54 },
    { label: 'Name', w: 100 },
    { label: 'Father Name', w: 90 },
    { label: 'CNIC', w: 82 },
    { label: 'Department', w: 95 },
    { label: 'Designation', w: 95 },
    { label: 'Job Type', w: 58 },
    { label: 'Joining', w: 58 },
    { label: 'Mobile', w: 72 },
    { label: 'Status', w: 48 },
  ];
  const tableWidth = cols.reduce((s, c) => s + c.w, 0);

  const drawPageHeader = () => {
    let y = top();
    const x = left();
    doc.save();
    doc.rect(x, y, usableWidth(), 34).fill('#F6F4EE');
    doc.restore();
    doc.fillColor('#17181A').font('Helvetica-Bold').fontSize(15).text('Abyte-EMS — Employee Report', x + 8, y + 8, { width: usableWidth() - 16 });
    doc.fillColor('#555555').font('Helvetica').fontSize(8.5).text(`Generated: ${new Date().toLocaleString()}    |    Total Records: ${employees.length}`, x + 8, y + 22, { width: usableWidth() - 16 });
    y += 40;
    doc.fillColor('#555555').fontSize(8).text(`Filters: ${filterSummary(req.query)}`, x, y, { width: usableWidth(), ellipsis: true });
    y += 14;
    doc.moveTo(x, y).lineTo(x + tableWidth, y).strokeColor('#D9A441').lineWidth(1.2).stroke();
    y += 6;
    // table header
    doc.save();
    doc.rect(x, y - 2, tableWidth, 16).fill('#2B2F33');
    doc.restore();
    let cx = x + 4;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#F6F4EE');
    cols.forEach(c => { doc.text(c.label, cx, y + 2, { width: c.w - 6, height: 12, ellipsis: true, lineBreak: false }); cx += c.w; });
    y += 16;
    doc.moveTo(x, y).lineTo(x + tableWidth, y).strokeColor('#D9D4C6').lineWidth(0.5).stroke();
    return y + 2;
  };

  let y = drawPageHeader();
  const rowH = 15;
  const val = (v: any) => (v === null || v === undefined || v === '') ? '-' : String(v);

  for (let i = 0; i < employees.length; i++) {
    const e = employees[i];
    if (y + rowH > bottomLimit()) {
      doc.addPage();
      y = drawPageHeader();
    }
    if (i % 2 === 1) {
      doc.save().rect(left(), y - 1, tableWidth, rowH).fill('#FBFAF6').restore();
    }
    const row = [
      val(e.employeeCode), val(e.name), val(e.fatherName), val(e.cnic),
      val(e.department?.name), val(e.designation?.title), val(e.jobType),
      fmtDate(e.dateOfJoining) || '-', val(e.mobileNumber), val(e.employmentStatus),
    ];
    doc.font('Helvetica').fontSize(7.5).fillColor('#17181A');
    let cx = left() + 4;
    row.forEach((text, idx) => {
      doc.text(text, cx, y + 2, { width: cols[idx].w - 6, height: rowH - 2, ellipsis: true, lineBreak: false });
      cx += cols[idx].w;
    });
    // row separator
    doc.moveTo(left(), y + rowH - 1).lineTo(left() + tableWidth, y + rowH - 1).strokeColor('#EEEADF').lineWidth(0.3).stroke();
    y += rowH;
  }

  if (employees.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor('#75797D').text('No records found for selected filters.', left(), y + 12);
  }

  // page numbers
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const px = left();
    const py = doc.page.height - doc.page.margins.bottom + 4;
    doc.font('Helvetica').fontSize(8).fillColor('#777777')
      .text(`Page ${i - range.start + 1} of ${range.count}`, px, py, { width: usableWidth(), align: 'center', lineBreak: false });
    doc.text('Abyte-EMS', px, py, { width: usableWidth(), align: 'left', lineBreak: false });
  }

  doc.end();
}
