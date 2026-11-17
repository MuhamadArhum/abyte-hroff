import 'dotenv/config';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TOTAL = 10000;
const BATCH = 500;

const firstNames = ['Ali','Ahmed','Usman','Bilal','Hassan','Hamza','Zain','Umar','Fahad','Saad','Ayesha','Fatima','Hira','Mariam','Noor','Sara','Zara','Iqra','Anum','Sana','Imran','Kashif','Noman','Tariq','Rizwan','Asad','Danish','Farhan','Shahid','Waqas','Mehwish','Rabia','Kinza','Nida','Sadia','Rehan','Yasir','Junaid','Kamran','Adnan'];
const lastNames = ['Khan','Ahmed','Raza','Hussain','Malik','Sheikh','Iqbal','Butt','Shah','Chaudhry','Siddiqui','Qureshi','Mirza','Abbasi','Javed','Akhtar','Anwar','Nawaz','Baig','Farooq','Tariq','Saleem','Aslam','Munir','Aziz'];
const cities = ['Lahore','Karachi','Islamabad','Rawalpindi','Faisalabad','Multan','Gujranwala','Sialkot','Peshawar','Hyderabad','Quetta','Bahawalpur','Sargodha','Sukkur','Abbottabad'];
const genders = ['MALE','FEMALE','OTHER'];
const bloodGroups = ['A+','A-','B+','B-','O+','O-','AB+','AB-'];
const marital = ['SINGLE','MARRIED','DIVORCED','WIDOWED'];
const jobTypes = ['PERMANENT','CONTRACT','TEMPORARY','INTERN'];
const statuses = ['ACTIVE','ACTIVE','ACTIVE','INACTIVE'];
const religions = ['Islam','Christianity','Hinduism','Sikhism','Buddhism','Other'];
const shifts = ['Morning','Evening','Night','Rotating','General'];
const relations = ['Father','Mother','Brother','Sister','Spouse','Uncle','Friend'];
const qualifications = ['Matric','Intermediate','Bachelor','Master','MS','PhD','Diploma'];
const skillsList = ['Communication','MS Office','Management','Sales','Accounting','Operations','Technical Support','Quality Control','Teamwork','Customer Service'];
const imgCats = ['PROFILE','CNIC_FRONT','CNIC_BACK','FATHER','OTHER'];
// Demo data must never contain privileged accounts.
const roles = ['MANAGER','HR','VIEWER','OTHER','OTHER'];

const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
const pad = (n: number, w = 2) => String(n).padStart(w, '0');
function randDate(yearBase: number, spread: number, i: number) {
  const year = yearBase + (i % spread);
  const month = (i % 12) + 1;
  const day = ((i * 7) % 28) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}
function cnicFor(i: number) {
  // unique 13-digit based i: 10000-0000001-1 format
  const a = String(10000 + (i % 89999)).padStart(5, '0');
  const b = String(1000000 + (i % 9000000)).padStart(7, '0');
  const c = String((i % 9) + 1);
  return `${a}-${b}-${c}`;
}
function phone(i: number, prefix = '03') {
  const mid = String(10 + (i % 89)).padStart(2, '0');
  const tail = String(1000000 + ((i * 7919) % 8999999)).padStart(7, '0');
  return `${prefix}${mid}${tail}`;
}

async function batchCreate<T>(label: string, total: number, make: (i: number) => T, createMany: (data: T[]) => Promise<any>) {
  const existing = await (prisma as any)[label].count?.();
  // generic count not used; caller handles; keep simple
  for (let start = 0; start < total; start += BATCH) {
    const end = Math.min(total, start + BATCH);
    const data: T[] = [];
    for (let i = start; i < end; i++) data.push(make(i));
    if (data.length) await createMany(data);
    if ((end % 2000 === 0) || end === total) console.log(`  ${label}: ${end}/${total}`);
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed demo data into a production database.');
    process.exit(1);
  }
  if (process.env.ALLOW_LARGE_SEED !== 'true') {
    console.error('Refusing to run large seed. This script inserts massive demo data (~10k records per table).');
    console.error('Set ALLOW_LARGE_SEED=true only if you intentionally want demo data on a disposable database.');
    process.exit(1);
  }
  console.log(`Seeding ~${TOTAL} records per table...`);

  // Departments (unique name)
  console.log('Seeding departments...');
  const deptCount = await prisma.department.count();
  if (deptCount < TOTAL) {
    for (let start = deptCount; start < TOTAL; start += BATCH) {
      const end = Math.min(TOTAL, start + BATCH);
      const data = [] as any[];
      for (let i = start; i < end; i++) data.push({ name: `Department ${pad(i + 1, 5)}`, description: `Auto seeded department ${i + 1}`, status: i % 10 === 0 ? 'INACTIVE' : 'ACTIVE' });
      await prisma.department.createMany({ data });
      if (end % 2000 === 0 || end === TOTAL) console.log(`  departments: ${end}/${TOTAL}`);
    }
  } else console.log(`  departments: already ${deptCount}`);

  // Designations (unique title)
  console.log('Seeding designations...');
  const desigCount = await prisma.designation.count();
  if (desigCount < TOTAL) {
    for (let start = desigCount; start < TOTAL; start += BATCH) {
      const end = Math.min(TOTAL, start + BATCH);
      const data = [] as any[];
      for (let i = start; i < end; i++) data.push({ title: `Designation ${pad(i + 1, 5)}`, description: `Auto seeded designation ${i + 1}` });
      await prisma.designation.createMany({ data });
      if (end % 2000 === 0 || end === TOTAL) console.log(`  designations: ${end}/${TOTAL}`);
    }
  } else console.log(`  designations: already ${desigCount}`);

  // Users (unique username)
  console.log('Seeding users...');
  const userCount = await prisma.user.count();
  if (userCount < TOTAL) {
    for (let start = userCount; start < TOTAL; start += BATCH) {
      const end = Math.min(TOTAL, start + BATCH);
      const data = [] as any[];
      for (let i = start; i < end; i++) {
        const username = `user${pad(i + 1, 5)}`;
        // Unique random password per account; nobody can log in with a known demo password.
        const password = `${crypto.randomBytes(12).toString('base64url')}Aa1!`;
        data.push({
          username,
          passwordHash: bcrypt.hashSync(password, 12),
          fullName: `Seed User ${i + 1}`,
          role: pick(roles, i),
          isActive: i % 12 !== 0,
          mustChangePassword: true,
        });
      }
      await prisma.user.createMany({ data });
      if (end % 2000 === 0 || end === TOTAL) console.log(`  users: ${end}/${TOTAL}`);
    }
  } else console.log(`  users: already ${userCount}`);

  // Need dept/designation ids for employees
  const depts = await prisma.department.findMany({ select: { id: true } });
  const desigs = await prisma.designation.findMany({ select: { id: true } });
  const deptIds = depts.map(d => d.id);
  const desigIds = desigs.map(d => d.id);

  // Employees (unique employeeCode, unique cnic)
  console.log('Seeding employees...');
  const empCount = await prisma.employee.count();
  if (empCount < TOTAL) {
    for (let start = empCount; start < TOTAL; start += BATCH) {
      const end = Math.min(TOTAL, start + BATCH);
      const data = [] as any[];
      for (let i = start; i < end; i++) {
        const n = i + 1;
        const first = pick(firstNames, i);
        const last = pick(lastNames, i * 3);
        const name = `${first} ${last} ${n}`;
        const dob = randDate(1975, 30, i);
        const doj = randDate(2010, 16, i + 11);
        const city = pick(cities, i);
        data.push({
          employeeCode: `EMP-${pad(n, 5)}`,
          name,
          fatherName: `${pick(firstNames, i + 7)} ${last}`,
          cnic: cnicFor(i),
          cnicIssueDate: randDate(2010, 15, i + 3),
          cnicExpiryDate: randDate(2026, 10, i + 5),
          dateOfBirth: dob,
          gender: pick(genders, i),
          bloodGroup: pick(bloodGroups, i),
          maritalStatus: pick(marital, i),
          religion: pick(religions, i),
          mobileNumber: phone(i, '03'),
          alternatePhone: phone(i + 50000, '03'),
          personalEmail: `employee${n}@example.com`,
          address: `House ${10 + (i % 500)}, Street ${1 + (i % 60)}, ${city}`,
          permanentAddress: `Village ${1 + (i % 200)}, ${city}`,
          city,
          emergencyContact: phone(i + 10000, '03'),
          emergencyContactName: `${pick(firstNames, i + 13)} ${last}`,
          emergencyContactRelation: pick(relations, i),
          emergencyContactAddress: `Near Main Road, ${city}`,
          qualification: pick(qualifications, i),
          skills: `${pick(skillsList, i)}, ${pick(skillsList, i + 3)}, ${pick(skillsList, i + 5)}`,
          departmentId: deptIds.length ? deptIds[i % deptIds.length] : null,
          designationId: desigIds.length ? desigIds[i % desigIds.length] : null,
          reportingManager: `Manager ${pick(lastNames, i)}`,
          shiftTimings: pick(shifts, i),
          jobType: pick(jobTypes, i),
          dateOfJoining: doj,
          resignationDate: i % 17 === 0 ? randDate(2024, 2, i) : null,
          lastWorkingDate: i % 17 === 0 ? randDate(2024, 2, i + 1) : null,
          salary: 30000 + (i % 50) * 2000,
          employmentStatus: pick(statuses, i),
          employeeCardNumber: `CARD-${pad(n, 5)}`,
          eobiNumber: `EOBI-${pad(n, 6)}`,
          socialSecurityNumber: `SSN-${pad(n, 6)}`,
          referenceName: `${pick(firstNames, i + 19)} ${pick(lastNames, i + 9)}`,
          referenceContact: phone(i + 20000, '03'),
          referenceRelation: pick(relations, i + 2),
          notes: `Seeded employee record ${n}`,
        });
      }
      await prisma.employee.createMany({ data });
      if (end % 2000 === 0 || end === TOTAL) console.log(`  employees: ${end}/${TOTAL}`);
    }
  } else console.log(`  employees: already ${empCount}`);

  // Get employee ids for child tables
  const employees = await prisma.employee.findMany({ select: { id: true, employeeCode: true } });
  const empIds = employees.map(e => ({ id: e.id, code: e.employeeCode }));
  if (empIds.length === 0) { console.log('No employees found, skipping child tables.'); return; }

  // EmployeeHistory ~TOTAL
  console.log('Seeding employee history...');
  const histCount = await prisma.employeeHistory.count();
  if (histCount < TOTAL) {
    const actions = ['EMPLOYEE_CREATED','EMPLOYEE_UPDATED','EMPLOYEE_ACTIVATED','EMPLOYEE_DEACTIVATED','NOTE_ADDED'];
    for (let start = histCount; start < TOTAL; start += BATCH) {
      const end = Math.min(TOTAL, start + BATCH);
      const data = [] as any[];
      for (let i = start; i < end; i++) {
        const emp = empIds[i % empIds.length];
        data.push({
          employeeId: emp.id,
          action: pick(actions, i),
          details: `Seeded history event ${i + 1} for ${emp.code}`,
          performedByUsername: `user${pad((i % 10000) + 1, 5)}`,
        });
      }
      await prisma.employeeHistory.createMany({ data });
      if (end % 2000 === 0 || end === TOTAL) console.log(`  history: ${end}/${TOTAL}`);
    }
  } else console.log(`  history: already ${histCount}`);

  // EmployeeImage ~TOTAL (DB records; files may not exist on disk)
  console.log('Seeding employee images...');
  const imgCount = await prisma.employeeImage.count();
  if (imgCount < TOTAL) {
    for (let start = imgCount; start < TOTAL; start += BATCH) {
      const end = Math.min(TOTAL, start + BATCH);
      const data = [] as any[];
      for (let i = start; i < end; i++) {
        const emp = empIds[i % empIds.length];
        const cat = pick(imgCats, i);
        const ext = i % 3 === 0 ? '.png' : '.jpg';
        const stored = `${emp.code}_${cat}_${pad((i % 999) + 1, 3)}${ext}`;
        const folder = cat === 'PROFILE' ? 'profile-pictures' : cat === 'CNIC_FRONT' ? 'cnic-front' : cat === 'CNIC_BACK' ? 'cnic-back' : cat === 'FATHER' ? 'father-pictures' : 'other-pictures';
        data.push({
          employeeId: emp.id,
          imageCategory: cat,
          originalFilename: stored,
          storedFilename: stored,
          relativePath: `${folder}/${stored}`,
          fileExtension: ext,
          fileSize: 1024 + (i % 500000),
        });
      }
      await prisma.employeeImage.createMany({ data });
      if (end % 2000 === 0 || end === TOTAL) console.log(`  images: ${end}/${TOTAL}`);
    }
  } else console.log(`  images: already ${imgCount}`);

  // EmployeeDocument ~TOTAL
  console.log('Seeding employee documents...');
  const docCount = await prisma.employeeDocument.count();
  if (docCount < TOTAL) {
    const docExts = ['.pdf','.jpg','.png','.docx','.xlsx','.txt'];
    for (let start = docCount; start < TOTAL; start += BATCH) {
      const end = Math.min(TOTAL, start + BATCH);
      const data = [] as any[];
      for (let i = start; i < end; i++) {
        const emp = empIds[i % empIds.length];
        const ext = pick(docExts, i);
        const stored = `${emp.code}_DOC_${pad((i % 9999) + 1, 4)}${ext}`;
        data.push({
          employeeId: emp.id,
          originalFilename: stored,
          storedFilename: stored,
          relativePath: `documents/${stored}`,
          fileExtension: ext,
          fileSize: 2048 + (i % 800000),
        });
      }
      await prisma.employeeDocument.createMany({ data });
      if (end % 2000 === 0 || end === TOTAL) console.log(`  documents: ${end}/${TOTAL}`);
    }
  } else console.log(`  documents: already ${docCount}`);

  // BackupLog ~TOTAL
  console.log('Seeding backup logs...');
  const backupCount = await prisma.backupLog.count();
  if (backupCount < TOTAL) {
    const types = ['MANUAL','AUTO'];
    const st = ['SUCCESS','SUCCESS','SUCCESS','FAILED'];
    for (let start = backupCount; start < TOTAL; start += BATCH) {
      const end = Math.min(TOTAL, start + BATCH);
      const data = [] as any[];
      for (let i = start; i < end; i++) {
        const status = pick(st, i);
        data.push({
          type: pick(types, i),
          filePath: `storage/backups/seed-backup-${pad(i + 1, 6)}.zip`,
          status,
          message: status === 'SUCCESS' ? 'Seeded backup record' : 'Seeded failed backup record',
        });
      }
      await prisma.backupLog.createMany({ data });
      if (end % 2000 === 0 || end === TOTAL) console.log(`  backup logs: ${end}/${TOTAL}`);
    }
  } else console.log(`  backup logs: already ${backupCount}`);

  const counts = {
    users: await prisma.user.count(),
    departments: await prisma.department.count(),
    designations: await prisma.designation.count(),
    employees: await prisma.employee.count(),
    employeeHistory: await prisma.employeeHistory.count(),
    employeeImages: await prisma.employeeImage.count(),
    employeeDocuments: await prisma.employeeDocument.count(),
    backupLogs: await prisma.backupLog.count(),
  };
  console.log('Seed complete. Totals:', counts);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
