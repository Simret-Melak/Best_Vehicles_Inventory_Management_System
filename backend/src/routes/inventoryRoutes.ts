import { Router, Response, NextFunction } from 'express';
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
  AuthenticatedRequest,
} from '../middleware/authMiddleware';

const router = Router();

const requireInventoryWriteAccess = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const allowedRoles = ['worker', 'store_manager'];

  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error:
        'You do not have permission to create, update, delete, or add stock.',
    });
  }

  return next();
};

// ============================================
// VEHICLE ROUTES
// ============================================

// View access:
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

// Write access:
// worker, store_manager only
// admin can only view
// super_admin mainly manages users
router.post(
  '/vehicles',
  requireAuth,
  requireInventoryWriteAccess,
  createVehicle
);

router.put(
  '/vehicles/:id',
  requireAuth,
  requireInventoryWriteAccess,
  updateVehicle
);

router.delete(
  '/vehicles/:id',
  requireAuth,
  requireInventoryWriteAccess,
  deleteVehicle
);

// ============================================
// PART ROUTES
// ============================================

// View access:
// super_admin, admin, worker, store_manager
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

// Write access:
// worker, store_manager only
// admin can only view
router.post(
  '/parts',
  requireAuth,
  requireInventoryWriteAccess,
  createPart
);

router.put(
  '/parts/:id',
  requireAuth,
  requireInventoryWriteAccess,
  updatePart
);

router.post(
  '/parts/:id/add-stock',
  requireAuth,
  requireInventoryWriteAccess,
  addPartStock
);

router.delete(
  '/parts/:id',
  requireAuth,
  requireInventoryWriteAccess,
  deletePart
);

export default router;