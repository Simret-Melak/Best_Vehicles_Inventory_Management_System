import { Router } from 'express';
import { 
  recordDeposit,
  getPendingDeposits,
  confirmDeposit,
  rejectDeposit,
  getOrderPaymentHistory,
  cancelOrderAndReleaseReservations
} from '../controllers/paymentController';

const router = Router();

// POST routes
router.post('/', recordDeposit);

// GET routes
router.get('/pending', getPendingDeposits);
router.get('/order/:orderId', getOrderPaymentHistory);

// PUT routes
router.put('/:id/confirm', confirmDeposit);
router.put('/:id/reject', rejectDeposit);
router.put('/cancel-order/:orderId', cancelOrderAndReleaseReservations);

export default router;