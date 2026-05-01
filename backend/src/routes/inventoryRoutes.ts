import { Router } from 'express';
import { 
  getVehicles,
  createVehicle,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  getVehicleHistory,
  getParts,
  getLowStockParts,
  getPartById,
  createPart,
  updatePart,
  addPartStock,
  getPartTransactions,
  deletePart,
  getAvailableVehicles,
  getAvailableParts
} from '../controllers/inventoryController';

const router = Router();

// Vehicle routes
router.get('/vehicles', getVehicles);
router.get('/vehicles/available', getAvailableVehicles);  // NEW
router.post('/vehicles', createVehicle);
router.get('/vehicles/:id', getVehicleById);
router.put('/vehicles/:id', updateVehicle);
router.delete('/vehicles/:id', deleteVehicle);
router.get('/vehicles/:id/history', getVehicleHistory);

// Part routes
router.get('/parts', getParts);
router.get('/parts/available', getAvailableParts);  // NEW
router.get('/parts/low-stock', getLowStockParts);
router.get('/parts/:id', getPartById);
router.post('/parts', createPart);
router.put('/parts/:id', updatePart);
router.post('/parts/:id/add-stock', addPartStock);
router.get('/parts/:id/transactions', getPartTransactions);
router.delete('/parts/:id', deletePart);

export default router;