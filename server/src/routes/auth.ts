import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, refresh, logout, me, changePassword, listUsers, createUser, updateUser, deleteUser } from '../controllers/authController';
import { authMiddleware, authorize } from '../middleware/auth';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});

router.post('/login', loginLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authMiddleware, me);
router.post('/change-password', authMiddleware, passwordLimiter, changePassword);
router.get('/users', authMiddleware, authorize('ADMIN'), listUsers);
router.post('/users', authMiddleware, authorize('ADMIN'), createUser);
router.put('/users/:id', authMiddleware, authorize('ADMIN'), updateUser);
router.delete('/users/:id', authMiddleware, authorize('ADMIN'), deleteUser);
export default router;
