import express from 'express';
import {
  login,
  getMe,
  createUser,
  getUsers,
  updateUserStatus,
  updateUserRole,
  resetUserPassword,
  requestPasswordResetEmail,
  updateOwnPassword,
  deleteUser,
} from '../controllers/authController';
import {
  requireAuth,
  requireSuperAdmin,
} from '../middleware/authMiddleware';

const router = express.Router();

// Public auth routes
router.post('/login', login);

// Optional: keep this only if you still want email-based forgot password later.
// It is not required for the temporary-password workflow.
router.post('/forgot-password', requestPasswordResetEmail);

// Logged-in user routes
router.get('/me', requireAuth, getMe);
router.put('/me/password', requireAuth, updateOwnPassword);

// Super admin only
router.post('/users', requireAuth, requireSuperAdmin, createUser);
router.get('/users', requireAuth, requireSuperAdmin, getUsers);
router.put('/users/:id/status', requireAuth, requireSuperAdmin, updateUserStatus);
router.put('/users/:id/role', requireAuth, requireSuperAdmin, updateUserRole);
router.put('/users/:id/password', requireAuth, requireSuperAdmin, resetUserPassword);
router.delete('/users/:id', requireAuth, requireSuperAdmin, deleteUser);

export default router;