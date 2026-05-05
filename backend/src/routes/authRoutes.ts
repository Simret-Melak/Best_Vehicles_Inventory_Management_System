import express from 'express';
import {
  login,
  getMe,
  createUser,
  getUsers,
  updateUserStatus,
  updateUserRole,
  resetUserPassword,
} from '../controllers/authController';
import {
  requireAuth,
  requireSuperAdmin,
} from '../middleware/authMiddleware';

const router = express.Router();

router.post('/login', login);

router.get('/me', requireAuth, getMe);

// Super admin only
router.post('/users', requireAuth, requireSuperAdmin, createUser);
router.get('/users', requireAuth, requireSuperAdmin, getUsers);
router.put('/users/:id/status', requireAuth, requireSuperAdmin, updateUserStatus);
router.put('/users/:id/role', requireAuth, requireSuperAdmin, updateUserRole);
router.put('/users/:id/password', requireAuth, requireSuperAdmin, resetUserPassword);

export default router;