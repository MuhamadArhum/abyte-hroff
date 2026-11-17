import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../config/prisma';
import { getCookie } from '../utils/cookies';

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  fullName?: string | null;
  mustChangePassword?: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

const PASSWORD_CHANGE_PATHS = new Set([
  '/api/auth/me',
  '/api/auth/change-password',
  '/api/auth/logout',
  '/api/auth/refresh',
]);

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  // HttpOnly cookie is the primary channel; Bearer is kept for API clients.
  // Query-string tokens are deliberately NOT accepted (they leak into logs).
  let token = getCookie(req, config.accessCookie) || '';
  if (!token && header && header.startsWith('Bearer ')) token = header.substring(7);
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { id: number; ver?: number; typ?: string };
    if (decoded.typ === 'refresh') return res.status(401).json({ message: 'Invalid token' });
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, role: true, fullName: true, isActive: true, tokenVersion: true, mustChangePassword: true },
    });
    if (!dbUser || !dbUser.isActive) return res.status(401).json({ message: 'Unauthorized or inactive user' });
    if ((dbUser.tokenVersion || 0) !== (decoded.ver || 0)) return res.status(401).json({ message: 'Session expired' });

    const pathOnly = (req.originalUrl || req.url || '').split('?')[0];
    if (dbUser.mustChangePassword && !PASSWORD_CHANGE_PATHS.has(pathOnly) && !pathOnly.startsWith('/storage/')) {
      return res.status(403).json({ message: 'You must change your password before continuing.', code: 'PASSWORD_CHANGE_REQUIRED' });
    }

    req.user = {
      id: dbUser.id,
      username: dbUser.username,
      role: dbUser.role || 'ADMIN',
      fullName: dbUser.fullName,
      mustChangePassword: dbUser.mustChangePassword,
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
    }
    next();
  };
}
