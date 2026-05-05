import { Request, Response, NextFunction, RequestHandler } from 'express';
import { supabase, supabaseAuth } from '../config/supabase';

export type UserRole = 'super_admin' | 'admin' | 'worker' | 'store_manager';

export type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    full_name: string;
    email: string;
    role: UserRole;
    is_active: boolean;
  };
};

export const requireAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Missing authorization token',
      });
      return;
    }

    const token = authHeader.replace('Bearer ', '');

    const { data, error } = await supabaseAuth.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, is_active')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      res.status(401).json({
        success: false,
        error: 'User profile not found',
      });
      return;
    }

    if (!profile.is_active) {
      res.status(403).json({
        success: false,
        error: 'User account is disabled',
      });
      return;
    }

    (req as AuthenticatedRequest).user = profile;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);

    res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

const requireRoles = (allowedRoles: UserRole[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user || !allowedRoles.includes(authReq.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
      });
      return;
    }

    next();
  };
};

// Super admin only:
// create/manage users.
export const requireSuperAdmin = requireRoles(['super_admin']);

// Admin approval access:
// approve/reject sales, confirm/reject payments.
export const requireAdminApprovalAccess = requireRoles([
  'super_admin',
  'admin',
]);

// Inventory read/history access:
// everyone can see inventory and transaction history.
export const requireInventoryReadAccess = requireRoles([
  'super_admin',
  'admin',
  'worker',
  'store_manager',
]);

// Stock write access:
// super_admin, admin, and store_manager can add/update stock.
export const requireStockWriteAccess = requireRoles([
  'super_admin',
  'admin',
  'store_manager',
]);

// Sales request/payment access:
// only worker can create sale request and add payment.
export const requireSalesRequestAccess = requireRoles(['worker']);

// Worker request screen access:
// only worker should see their pending requests.
export const requireWorkerRequestAccess = requireRoles(['worker']);

// Customer access:
// super_admin, admin, and worker can access customer records.
// store_manager should not.
export const requireCustomerAccess = requireRoles([
  'super_admin',
  'admin',
  'worker',
]);

// General admin dashboard access.
export const requireAdminDashboardAccess = requireRoles([
  'super_admin',
  'admin',
]);