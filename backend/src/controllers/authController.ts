import { Response } from 'express';
import { supabase, supabaseAuth, supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest, UserRole } from '../middleware/authMiddleware';

const VALID_ROLES: UserRole[] = [
  'super_admin',
  'admin',
  'worker',
  'store_manager',
];

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
      email: String(email).trim().toLowerCase(),
      password,
    });

    if (error || !data.user || !data.session) {
      return res.status(401).json({
        success: false,
        error: error?.message || 'Invalid login credentials',
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, is_active')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({
        success: false,
        error: 'User profile not found',
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
  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      success: false,
      error: 'Login failed',
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
    const { full_name, email, password, role } = req.body;

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        error: 'full_name, email, password, and role are required',
      });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Role must be super_admin, admin, worker, or store_manager',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: createdUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
          role,
        },
      });

    if (createError || !createdUser.user) {
      return res.status(400).json({
        success: false,
        error: createError?.message || 'Failed to create user',
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: createdUser.user.id,
          full_name: String(full_name).trim(),
          email: normalizedEmail,
          role,
          is_active: true,
        },
      ])
      .select('id, full_name, email, role, is_active, created_at')
      .single();

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id);

      return res.status(400).json({
        success: false,
        error: profileError.message,
      });
    }

    return res.json({
      success: true,
      data: profile,
      message: 'User created successfully',
    });
  } catch (error) {
    console.error('Create user error:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to create user',
    });
  }
};

export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, is_active, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({
      success: true,
      data: data || [],
      message: 'Users fetched successfully',
    });
  } catch (error) {
    console.error('Get users error:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
    });
  }
};

export const updateUserStatus = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body as unknown as { is_active: boolean };

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

    const { data, error } = await supabase
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
      message: is_active ? 'User enabled successfully' : 'User disabled successfully',
    });
  } catch (error) {
    console.error('Update user status error:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to update user status',
    });
  }
};

export const updateUserRole = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!VALID_ROLES.includes(role)) {
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

    const { data, error } = await supabase
      .from('profiles')
      .update({
        role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, full_name, email, role, is_active, created_at, updated_at')
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      data,
      message: 'User role updated successfully',
    });
  } catch (error) {
    console.error('Update user role error:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to update user role',
    });
  }
};

export const resetUserPassword = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
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
  } catch (error) {
    console.error('Reset password error:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to reset password',
    });
  }
};