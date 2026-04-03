import { Router } from 'express';
import { getVehicles, createVehicle } from '../controllers/inventoryController';

const router = Router();

router.get('/vehicles', getVehicles);
router.post('/vehicles', createVehicle);

export default router;