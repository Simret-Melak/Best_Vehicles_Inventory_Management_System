import { Router } from 'express';
import { 
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  searchCustomers,
  getCustomerOrders
} from '../controllers/customerController';

const router = Router();

// GET routes
router.get('/', getCustomers);
router.get('/search', searchCustomers);
router.get('/:id', getCustomerById);
router.get('/:id/orders', getCustomerOrders);

// POST routes
router.post('/', createCustomer);

// PUT routes
router.put('/:id', updateCustomer);

// DELETE routes
router.delete('/:id', deleteCustomer);

export default router;