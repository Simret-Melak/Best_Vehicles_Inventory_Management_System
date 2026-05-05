import { Router } from 'express';
import {
  getSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  updateOrderStatus,
  workerConfirmFullPayment,
  cancelOrder,
  deleteOrder,
} from '../controllers/salesController';

import {
  requireAuth,
  requireInventoryReadAccess,
  requireSalesRequestAccess,
  requireAdminApprovalAccess,
} from '../middleware/authMiddleware';

const router = Router();

// ============================================
// SALES ORDER ROUTES
// ============================================

// Everyone logged in can read sales orders/details for dashboards/history:
// super_admin, admin, worker, store_manager
router.get('/', requireAuth, requireInventoryReadAccess, getSalesOrders);

router.get('/:id', requireAuth, requireInventoryReadAccess, getSalesOrderById);

// Worker only:
// Workers create sale requests.
router.post('/', requireAuth, requireSalesRequestAccess, createSalesOrder);

// Admin + super_admin only:
// Admin approval changes pending_admin -> confirmed/cancelled/etc.
router.put(
  '/:id/status',
  requireAuth,
  requireAdminApprovalAccess,
  updateOrderStatus
);

// Worker only:
// Kept for compatibility, but your newer backend can auto-move full submitted
// payments to pending_admin. Use only if your frontend still calls it.
router.put(
  '/:id/confirm-full-payment',
  requireAuth,
  requireSalesRequestAccess,
  workerConfirmFullPayment
);

// Admin + super_admin only:
// Cancel order and release reservations.
router.put(
  '/:id/cancel',
  requireAuth,
  requireAdminApprovalAccess,
  cancelOrder
);

// Admin + super_admin only:
// Delete cancelled orders.
router.delete(
  '/:id',
  requireAuth,
  requireAdminApprovalAccess,
  deleteOrder
);

export default router;