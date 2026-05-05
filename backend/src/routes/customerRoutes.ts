import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  searchCustomers,
  getCustomerOrders,
} from '../controllers/customerController';

import {
  requireAuth,
  requireAdminApprovalAccess,
  requireSalesRequestAccess,
} from '../middleware/authMiddleware';

const router = Router();

// Customer access rules:
// - super_admin/admin: can view, edit, delete customers
// - worker: can view/search/create customers for sale requests
// - store_manager: no customer access

// GET routes
router.get('/', requireAuth, requireSalesRequestAccess, getCustomers);
router.get('/search', requireAuth, requireSalesRequestAccess, searchCustomers);
router.get('/:id', requireAuth, requireSalesRequestAccess, getCustomerById);
router.get('/:id/orders', requireAuth, requireSalesRequestAccess, getCustomerOrders);

// POST routes
router.post('/', requireAuth, requireSalesRequestAccess, createCustomer);

// PUT routes - admin/super_admin only
router.put('/:id', requireAuth, requireAdminApprovalAccess, updateCustomer);

// DELETE routes - admin/super_admin only
router.delete('/:id', requireAuth, requireAdminApprovalAccess, deleteCustomer);

export default router;