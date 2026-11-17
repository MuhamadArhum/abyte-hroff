import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { config } from '../config';
import { AuthRequest } from '../middleware/auth';
import { getCookie } from '../utils/cookies';

const ALLOWED_ROLES = ['ADMIN', 'MANAGER', 'HR', 'VIEWER', 'OTHER'];
const BCRYPT_COST = 12;
// Constant work for missing usernames so login timing cannot enumerate accounts.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-account-password', BCRYPT_COST);

function sanitizeUser(u: any) {
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName || '',
    role: u.role,
    isActive: u.isActive,
    mustChangePassword: !!u.mustChangePassword,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

function isStrongPassword(pw: string) {
  return typeof pw === 'string' &&
    pw.length >= 12 &&
    /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw);
}

function publicUser(u: any) {
  return {
    id: u.id,
    username: u.username,
    role: u.role || 'ADMIN',
    fullName: u.fullName || '',
    mustChangePassword: !!u.mustChangePassword,
  };
}

function issueSession(res: Response, user: any) {
  const claims = { id: user.id, username: user.username, role: user.role || 'ADMIN', ver: user.tokenVersion || 0 };
  const access = jwt.sign(claims, config.jwtSecret, { expiresIn: config.accessTtl as jwt.SignOptions['expiresIn'] });
  const refresh = jwt.sign({ ...claims, typ: 'refresh' }, config.jwtSecret, { expiresIn: config.refreshTtl as jwt.SignOptions['expiresIn'] });
  const base = { httpOnly: true, secure: config.isProd, sameSite: 'lax' as const };
  res.cookie(config.accessCookie, access, { ...base, path: '/' });
  res.cookie(config.refreshCookie, refresh, { ...base, path: config.refreshPath });
}

function clearSession(res: Response) {
  const base = { httpOnly: true, secure: config.isProd, sameSite: 'lax' as const };
  res.clearCookie(config.accessCookie, { ...base, path: '/' });
  res.clearCookie(config.refreshCookie, { ...base, path: config.refreshPath });
}

export async function ensureAdmin() {
  const count = await prisma.user.count();
  if (count === 0) {
    const bootstrap = (process.env.ADMIN_BOOTSTRAP_PASSWORD || '').trim();
    if (config.isProd && !bootstrap) {
      throw new Error('ADMIN_BOOTSTRAP_PASSWORD must be set before first start in production.');
    }
    const generated = !bootstrap;
    // Random, unguessable, and guaranteed to satisfy the complexity policy.
    const password = bootstrap || `${crypto.randomBytes(18).toString('base64url')}Aa1!`;
    if (!isStrongPassword(password)) {
      throw new Error('ADMIN_BOOTSTRAP_PASSWORD must be 12+ characters with upper, lower, digit and symbol.');
    }
    const hash = await bcrypt.hash(password, BCRYPT_COST);
    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: hash,
        role: 'ADMIN',
        fullName: 'Administrator',
        isActive: true,
        mustChangePassword: generated,
      },
    });
    if (generated) {
      console.warn('Initial admin created (username: admin). Generated temporary password (shown once):');
      console.warn(`  ${password}`);
      console.warn('You will be asked to change it on first login.');
    } else {
      console.log('Initial admin created (username: admin) using ADMIN_BOOTSTRAP_PASSWORD.');
    }
  } else {
    const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
    if (admin && !admin.role) {
      await prisma.user.update({ where: { id: admin.id }, data: { role: 'ADMIN', isActive: true } }).catch(() => {});
    }
  }
}

export async function login(req: Request, res: Response) {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
  const user = await prisma.user.findUnique({ where: { username: String(username).trim() } });
  const ok = await bcrypt.compare(String(password), user?.passwordHash || DUMMY_HASH);
  if (!user || !user.isActive || !ok) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  issueSession(res, user);
  res.json({ user: publicUser(user) });
}

export async function refresh(req: Request, res: Response) {
  const token = getCookie(req, config.refreshCookie);
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { id: number; ver?: number; typ?: string };
    if (decoded.typ !== 'refresh') return res.status(401).json({ message: 'Invalid token' });
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.isActive || (user.tokenVersion || 0) !== (decoded.ver || 0)) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    issueSession(res, user);
    res.json({ user: publicUser(user) });
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export async function logout(_req: Request, res: Response) {
  clearSession(res);
  res.json({ message: 'Logged out' });
}

export async function me(req: AuthRequest, res: Response) {
  res.json({ user: req.user });
}

export async function changePassword(req: AuthRequest, res: Response) {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Missing fields' });
  if (!isStrongPassword(String(newPassword))) {
    return res.status(400).json({ message: 'Password must be 12+ characters with upper, lower, digit and symbol' });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const ok = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!ok) return res.status(400).json({ message: 'Current password incorrect' });
  const hash = await bcrypt.hash(String(newPassword), BCRYPT_COST);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hash, mustChangePassword: false, tokenVersion: { increment: 1 } },
  });
  issueSession(res, updated);
  res.json({ message: 'Password changed', user: publicUser(updated) });
}

export async function listUsers(req: AuthRequest, res: Response) {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limitRaw = parseInt(String(req.query.limit || '10'), 10) || 10;
    const limit = Math.min(100, Math.max(1, limitRaw));
    const search = String(req.query.search || '').trim();
    const where: any = {};
    if (search) where.OR = [{ username: { contains: search } }, { fullName: { contains: search } }];
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    res.json({ items: users.map(sanitizeUser), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch {
    res.status(500).json({ message: 'Failed to load users' });
  }
}

export async function createUser(req: AuthRequest, res: Response) {
  try {
    const { username, password, fullName, role, isActive } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });
    if (!isStrongPassword(String(password))) {
      return res.status(400).json({ message: 'Password must be 12+ characters with upper, lower, digit and symbol' });
    }
    const r = ALLOWED_ROLES.includes(role) ? role : 'VIEWER';
    const hash = await bcrypt.hash(String(password), BCRYPT_COST);
    const user = await prisma.user.create({
      data: {
        username: String(username).trim(),
        passwordHash: hash,
        fullName: fullName || null,
        role: r,
        isActive: isActive !== false,
        mustChangePassword: true,
      },
    });
    res.status(201).json(sanitizeUser(user));
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(400).json({ message: 'Username already exists' });
    res.status(500).json({ message: 'Failed to create user' });
  }
}

export async function updateUser(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id);
    const { username, fullName, role, isActive, password } = req.body;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'User not found' });
    if (req.user?.id === id && isActive === false) return res.status(400).json({ message: 'You cannot deactivate your own account' });
    if (req.user?.id === id && role && role !== 'ADMIN') return res.status(400).json({ message: 'You cannot change your own admin role' });
    const data: any = {};
    if (username !== undefined) data.username = String(username).trim();
    if (fullName !== undefined) data.fullName = fullName || null;
    if (role !== undefined && ALLOWED_ROLES.includes(role)) data.role = role;
    if (isActive !== undefined) data.isActive = !!isActive;
    if (password) {
      if (!isStrongPassword(String(password))) {
        return res.status(400).json({ message: 'Password must be 12+ characters with upper, lower, digit and symbol' });
      }
      data.passwordHash = await bcrypt.hash(String(password), BCRYPT_COST);
      data.mustChangePassword = true;
      data.tokenVersion = { increment: 1 };
    }
    const user = await prisma.user.update({ where: { id }, data });
    res.json(sanitizeUser(user));
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(400).json({ message: 'Username already exists' });
    res.status(500).json({ message: 'Failed to update user' });
  }
}

export async function deleteUser(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id);
    if (req.user?.id === id) return res.status(400).json({ message: 'You cannot delete your own account' });
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
      if (adminCount <= 1) return res.status(400).json({ message: 'Cannot delete the last active admin' });
    }
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted' });
  } catch {
    res.status(500).json({ message: 'Failed to delete user' });
  }
}
