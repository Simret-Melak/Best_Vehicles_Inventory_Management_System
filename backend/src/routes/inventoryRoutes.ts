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
  getAvailableParts,
} from '../controllers/inventoryController';

import {
  requireAuth,
  requireInventoryReadAccess,
  requireStockWriteAccess,
  requireAdminApprovalAccess,
} from '../middleware/authMiddleware';

const router = Router();

// ============================================
// VEHICLE ROUTES
// ============================================

// Everyone logged in can view inventory:
// super_admin, admin, worker, store_manager
router.get('/vehicles', requireAuth, requireInventoryReadAccess, getVehicles);

router.get(
  '/vehicles/available',
  requireAuth,
  requireInventoryReadAccess,
  getAvailableVehicles
);

router.get(
  '/vehicles/:id',
  requireAuth,
  requireInventoryReadAccess,
  getVehicleById
);

router.get(
  '/vehicles/:id/history',
  requireAuth,
  requireInventoryReadAccess,
  getVehicleHistory
);

// Stock write access:
// super_admin, admin, store_manager
router.post('/vehicles', requireAuth, requireStockWriteAccess, createVehicle);

router.put(
  '/vehicles/:id',
  requireAuth,
  requireStockWriteAccess,
  updateVehicle
);

// Delete access:
// super_admin/admin only
router.delete(
  '/vehicles/:id',
  requireAuth,
  requireAdminApprovalAccess,
  deleteVehicle
);

// ============================================
// PART ROUTES
// ============================================

// Everyone logged in can view inventory:
router.get('/parts', requireAuth, requireInventoryReadAccess, getParts);

router.get(
  '/parts/available',
  requireAuth,
  requireInventoryReadAccess,
  getAvailableParts
);

router.get(
  '/parts/low-stock',
  requireAuth,
  requireInventoryReadAccess,
  getLowStockParts
);

router.get(
  '/parts/:id',
  requireAuth,
  requireInventoryReadAccess,
  getPartById
);

router.get(
  '/parts/:id/transactions',
  requireAuth,
  requireInventoryReadAccess,
  getPartTransactions
);

// Stock write access:
// super_admin, admin, store_manager
router.post('/parts', requireAuth, requireStockWriteAccess, createPart);

router.put('/parts/:id', requireAuth, requireStockWriteAccess, updatePart);

router.post(
  '/parts/:id/add-stock',
  requireAuth,
  requireStockWriteAccess,
  addPartStock
);

// Delete access:
// super_admin/admin only
router.delete(
  '/parts/:id',
  requireAuth,
  requireAdminApprovalAccess,
  deletePart
);

export default router;