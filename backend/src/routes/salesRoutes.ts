import { Router } from 'express';
import {
  getSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  updateSaleRequest,
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

// Worker creates sale requests
router.post('/', requireAuth, requireSalesRequestAccess, createSalesOrder);

// Worker edits sale request before admin approval
// Backend controller should only allow edit if status is pending or pending_admin
router.put(
  '/:id/request',
  requireAuth,
  requireSalesRequestAccess,
  updateSaleRequest
);

// Admin approval changes pending_admin -> confirmed/cancelled/etc.
router.put(
  '/:id/status',
  requireAuth,
  requireAdminApprovalAccess,
  updateOrderStatus
);

// Worker confirms/updates payment progress
router.put(
  '/:id/confirm-full-payment',
  requireAuth,
  requireSalesRequestAccess,
  workerConfirmFullPayment
);

// Admin cancels order and releases reservations
router.put(
  '/:id/cancel',
  requireAuth,
  requireAdminApprovalAccess,
  cancelOrder
);

// Admin deletes cancelled orders
router.delete(
  '/:id',
  requireAuth,
  requireAdminApprovalAccess,
  deleteOrder
);

export default router;