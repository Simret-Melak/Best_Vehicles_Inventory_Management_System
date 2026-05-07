import { Response } from 'express';
import { supabaseAdmin, supabaseAuth } from '../config/supabase';
import { AuthenticatedRequest, UserRole } from '../middleware/authMiddleware';

const VALID_ROLES: UserRole[] = [
  'super_admin',
  'admin',
  'worker',
  'store_manager',
];

const normalizeEmail = (email: string) => String(email).trim().toLowerCase();

const isValidRole = (role: any): role is UserRole => {
  return VALID_ROLES.includes(role);
};

const requireSuperAdmin = (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({
      success: false,
      error: 'Only super admins can manage users',
    });

    return false;
  }

  return true;
};

export const login = async (req: any, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });

    if (error || !data.user || !data.session) {
      return res.status(401).json({
        success: false,
        error: error?.message || 'Invalid login credentials',
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, role, is_active, created_at, updated_at')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({
        success: false,
        error:
          'User profile not found. The auth user exists, but public.profiles is missing. Ask the super admin to recreate or repair the profile.',
      });
    }

    if (!profile.is_active) {
      return res.status(403).json({
        success: false,
        error: 'This user account is disabled',
      });
    }

    return res.json({
      success: true,
      data: {
        user: profile,
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
      },
      message: 'Logged in successfully',
    });
  } catch (error: any) {
    console.error('Login error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Login failed',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    success: true,
    data: req.user,
  });
};

export const createUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!requireSuperAdmin(req, res)) return;

    const { full_name, email, password, role } = req.body;

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        error: 'full_name, email, password, and role are required',
      });
    }

    if (!isValidRole(role)) {
      return res.status(400).json({
        success: false,
        error: 'Role must be super_admin, admin, worker, or store_manager',
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const { data: createdUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: String(full_name).trim(),
          role,
        },
        app_metadata: {
          role,
        },
      });

    if (createError || !createdUser.user) {
      return res.status(400).json({
        success: false,
        error: createError?.message || 'Failed to create user',
        code: createError?.code || null,
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: createdUser.user.id,
          full_name: String(full_name).trim(),
          email: normalizedEmail,
          role,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'id',
        }
      )
      .select('id, full_name, email, role, is_active, created_at, updated_at')
      .single();

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id);

      return res.status(400).json({
        success: false,
        error: profileError.message,
        details: profileError.details || null,
        hint: profileError.hint || null,
        code: profileError.code || null,
      });
    }

    return res.json({
      success: true,
      data: profile,
      message: 'User created successfully',
    });
  } catch (error: any) {
    console.error('Create user error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create user',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!requireSuperAdmin(req, res)) return;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, role, is_active, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({
      success: true,
      data: data || [],
      message: 'Users fetched successfully',
    });
  } catch (error: any) {
    console.error('Get users error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch users',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

export const updateUserStatus = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!requireSuperAdmin(req, res)) return;

    const { id } = req.params;
    const { is_active } = req.body as { is_active: boolean };

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'is_active must be true or false',
      });
    }

    if (req.user?.id === id && is_active === false) {
      return res.status(400).json({
        success: false,
        error: 'You cannot disable your own account',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, full_name, email, role, is_active, created_at, updated_at')
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      data,
      message: is_active
        ? 'User enabled successfully'
        : 'User disabled successfully',
    });
  } catch (error: any) {
    console.error('Update user status error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update user status',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

export const updateUserRole = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!requireSuperAdmin(req, res)) return;

    const { id } = req.params;
    const { role } = req.body;

    if (!isValidRole(role)) {
      return res.status(400).json({
        success: false,
        error: 'Role must be super_admin, admin, worker, or store_manager',
      });
    }

    if (req.user?.id === id && role !== 'super_admin') {
      return res.status(400).json({
        success: false,
        error: 'You cannot remove your own super admin role',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, full_name, email, role, is_active, created_at, updated_at')
      .single();

    if (error) throw error;

    await supabaseAdmin.auth.admin.updateUserById(id, {
      app_metadata: {
        role,
      },
      user_metadata: {
        role,
      },
    } as any);

    return res.json({
      success: true,
      data,
      message: 'User role updated successfully',
    });
  } catch (error: any) {
    console.error('Update user role error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update user role',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

export const resetUserPassword = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!requireSuperAdmin(req, res)) return;

    const { id } = req.params;
    const { password } = req.body;

    if (!password || String(password).length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
      });
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code || null,
      });
    }

    return res.json({
      success: true,
      data: {
        id: data.user.id,
        email: data.user.email,
      },
      message: 'Password reset successfully',
    });
  } catch (error: any) {
    console.error('Reset password error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to reset password',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};