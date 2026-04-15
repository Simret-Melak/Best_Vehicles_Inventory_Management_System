import { Router } from 'express';
import { 
  getVehicles, 
  createVehicle, 
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  getVehicleHistory
} from '../controllers/inventoryController';

const router = Router();

// Existing routes
router.get('/vehicles', getVehicles);
router.post('/vehicles', createVehicle);

// New routes
router.get('/vehicles/:id', getVehicleById);
router.put('/vehicles/:id', updateVehicle);
router.delete('/vehicles/:id', deleteVehicle);
router.get('/vehicles/:id/history', getVehicleHistory);

export default router;