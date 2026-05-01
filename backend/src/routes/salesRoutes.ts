import { Router } from 'express';
import { 
  getSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  updateOrderStatus,
  workerConfirmFullPayment,
  cancelOrder,
  deleteOrder
} from '../controllers/salesController';

const router = Router();

// GET routes
router.get('/', getSalesOrders);
router.get('/:id', getSalesOrderById);

// POST routes
router.post('/', createSalesOrder);

// PUT routes
router.put('/:id/status', updateOrderStatus);
router.put('/:id/confirm-full-payment', workerConfirmFullPayment);
router.put('/:id/cancel', cancelOrder);

// DELETE routes
router.delete('/:id', deleteOrder);

export default router;