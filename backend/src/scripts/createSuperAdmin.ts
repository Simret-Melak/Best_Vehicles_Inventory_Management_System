import dotenv from 'dotenv';
import { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '../config/supabase';

dotenv.config();

const email = process.env.SUPER_ADMIN_EMAIL;
const password = process.env.SUPER_ADMIN_PASSWORD;
const fullName = process.env.SUPER_ADMIN_NAME || 'Super Admin';

const findAuthUserByEmail = async (
  normalizedEmail: string
): Promise<User | null> => {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const foundUser =
      data.users.find(
        (user) => user.email?.trim().toLowerCase() === normalizedEmail
      ) || null;

    if (foundUser) {
      return foundUser;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
};

const upsertSuperAdminProfile = async (userId: string, normalizedEmail: string) => {
  const { error } = await supabaseAdmin.from('profiles').upsert(
    {
      id: userId,
      full_name: fullName,
      email: normalizedEmail,
      role: 'super_admin',
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'id',
    }
  );

  if (error) {
    throw error;
  }
};

const run = async () => {
  if (!email || !password) {
    throw new Error(
      'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required in .env'
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  let authUser = await findAuthUserByEmail(normalizedEmail);

  if (authUser) {
    console.log('Auth user already exists. Updating password and metadata...');

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      {
        password,
        user_metadata: {
          full_name: fullName,
          role: 'super_admin',
        },
        app_metadata: {
          role: 'super_admin',
        },
      } as any
    );

    if (error || !data.user) {
      throw error || new Error('Failed to update existing super admin user');
    }

    authUser = data.user;
  } else {
    console.log('Creating new super admin auth user...');

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'super_admin',
      },
      app_metadata: {
        role: 'super_admin',
      },
    });

    if (error || !data.user) {
      throw error || new Error('Failed to create super admin user');
    }

    authUser = data.user;
  }

  await upsertSuperAdminProfile(authUser.id, normalizedEmail);

  console.log('Super admin is ready.');
  console.log('Email:', normalizedEmail);
  console.log('User ID:', authUser.id);
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to create/update super admin:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      status: error.status,
    });

    process.exit(1);
  });