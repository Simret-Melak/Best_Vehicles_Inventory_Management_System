import { Router } from 'express';
import { 
  getParts,
  getLowStockParts,
  getPartById,
  createPart,
  updatePart,
  addPartStock,
  getPartTransactions,
  deletePart
} from '../controllers/PartsController';

const router = Router();

// Public routes
router.get('/', getParts);
router.get('/low-stock', getLowStockParts);
router.get('/:id', getPartById);
router.get('/:id/transactions', getPartTransactions);

// Write operations (protected in production)
router.post('/', createPart);
router.put('/:id', updatePart);
router.post('/:id/add-stock', addPartStock);
router.delete('/:id', deletePart);

export default router;