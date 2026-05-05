import { Router } from 'express';
import {
  recordDeposit,
  getPendingDeposits,
  confirmDeposit,
  rejectDeposit,
  getOrderPaymentHistory,
  cancelOrderAndReleaseReservations,
} from '../controllers/paymentController';

import {
  requireAuth,
  requireSalesRequestAccess,
  requireAdminApprovalAccess,
  requireInventoryReadAccess,
} from '../middleware/authMiddleware';

const router = Router();

// ============================================
// PAYMENT ROUTES
// ============================================

// Worker only:
// Workers submit payments/deposits for sale requests.
router.post('/', requireAuth, requireSalesRequestAccess, recordDeposit);

// Admin + super_admin only:
// Admin approval/payment verification screens.
router.get(
  '/pending',
  requireAuth,
  requireAdminApprovalAccess,
  getPendingDeposits
);

router.put(
  '/:id/confirm',
  requireAuth,
  requireAdminApprovalAccess,
  confirmDeposit
);

router.put(
  '/:id/reject',
  requireAuth,
  requireAdminApprovalAccess,
  rejectDeposit
);

// Everyone logged in can read payment history for inventory/history screens:
// super_admin, admin, worker, store_manager
router.get(
  '/order/:orderId',
  requireAuth,
  requireInventoryReadAccess,
  getOrderPaymentHistory
);

// Admin + super_admin only:
// Cancelling an order releases reserved inventory.
router.put(
  '/cancel-order/:orderId',
  requireAuth,
  requireAdminApprovalAccess,
  cancelOrderAndReleaseReservations
);

export default router;