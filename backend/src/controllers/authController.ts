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

// ============================================
// LOGIN
// ============================================

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

// ============================================
// GET CURRENT USER
// ============================================

export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    success: true,
    data: req.user,
  });
};

// ============================================
// FORGOT PASSWORD EMAIL
// Optional public endpoint.
// This can stay for later if email reset is configured.
// ============================================

export const requestPasswordResetEmail = async (req: any, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, is_active')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!profile || !profile.is_active) {
      return res.json({
        success: true,
        message:
          'If an active account exists for this email, a password reset link has been sent.',
      });
    }

    const redirectTo =
      process.env.APP_PASSWORD_RESET_REDIRECT_URL ||
      'bestvehicles://reset-password';

    const { error } = await supabaseAuth.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo,
      }
    );

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to send password reset email',
        code: error.code || null,
      });
    }

    return res.json({
      success: true,
      message:
        'If an active account exists for this email, a password reset link has been sent.',
    });
  } catch (error: any) {
    console.error('Request password reset email error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to request password reset email',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

// ============================================
// UPDATE OWN PASSWORD
// Logged-in user changes temporary/current password.
// ============================================

export const updateOwnPassword = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;

    const userId = req.user?.id;
    const userEmail = req.user?.email;

    if (!userId || !userEmail) {
      return res.status(401).json({
        success: false,
        error: 'User is not authenticated',
      });
    }

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({
        success: false,
        error:
          'Current password, new password, and confirm password are required',
      });
    }

    if (String(new_password).length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters',
      });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({
        success: false,
        error: 'New password and confirm password do not match',
      });
    }

    if (current_password === new_password) {
      return res.status(400).json({
        success: false,
        error: 'New password must be different from current password',
      });
    }

    const { error: verifyError } = await supabaseAuth.auth.signInWithPassword({
      email: normalizeEmail(userEmail),
      password: current_password,
    });

    if (verifyError) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect',
      });
    }

    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: new_password,
      });

    if (updateError) {
      return res.status(400).json({
        success: false,
        error: updateError.message || 'Failed to update password',
        code: updateError.code || null,
      });
    }

    return res.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error: any) {
    console.error('Update own password error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update password',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

// ============================================
// CREATE USER WITH TEMPORARY PASSWORD
// Super admin creates user and assigns first password.
// No email invite required.
// ============================================

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

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Temporary password must be at least 6 characters',
      });
    }

    if (!isValidRole(role)) {
      return res.status(400).json({
        success: false,
        error: 'Role must be super_admin, admin, worker, or store_manager',
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const cleanFullName = String(full_name).trim();

    const { data: createdUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: cleanFullName,
          role,
        },
        app_metadata: {
          role,
        },
      } as any);

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
          full_name: cleanFullName,
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
      return res.status(400).json({
        success: false,
        error: profileError.message,
        details: profileError.details || null,
        hint: profileError.hint || null,
        code: profileError.code || null,
      });
    }

    await supabaseAdmin.auth.admin.updateUserById(createdUser.user.id, {
      app_metadata: {
        role,
      },
      user_metadata: {
        full_name: cleanFullName,
        role,
      },
    } as any);

    return res.json({
      success: true,
      data: profile,
      message:
        'User created successfully. Give the temporary password to the user and ask them to change it after login.',
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

// ============================================
// GET USERS
// ============================================

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

// ============================================
// DELETE USER
// ============================================

export const deleteUser = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!requireSuperAdmin(req, res)) return;

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (req.user?.id === id) {
      return res.status(400).json({
        success: false,
        error: 'You cannot delete your own account',
      });
    }

    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, role, is_active')
      .eq('id', id)
      .maybeSingle();

    if (targetUserError) throw targetUserError;

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    if (targetUser.role === 'super_admin') {
      const { count, error: countError } = await supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'super_admin')
        .eq('is_active', true)
        .neq('id', id);

      if (countError) throw countError;

      if (!count || count < 1) {
        return res.status(400).json({
          success: false,
          error: 'You cannot delete the last active super admin',
        });
      }
    }

    const { error: deleteAuthError } =
      await supabaseAdmin.auth.admin.deleteUser(id);

    if (deleteAuthError) {
      return res.status(400).json({
        success: false,
        error: deleteAuthError.message || 'Failed to delete auth user',
        code: deleteAuthError.code || null,
      });
    }

    await supabaseAdmin.from('profiles').delete().eq('id', id);

    return res.json({
      success: true,
      message: `${targetUser.full_name} deleted successfully`,
    });
  } catch (error: any) {
    console.error('Delete user error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete user',
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    });
  }
};

// ============================================
// UPDATE USER STATUS
// ============================================

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

// ============================================
// UPDATE USER ROLE
// ============================================

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

// ============================================
// SUPER ADMIN RESET USER PASSWORD
// Backup/manual override.
// ============================================

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
      code: error.code || null,
    });
  }
};