import dotenv from 'dotenv';
import { supabase, supabaseAdmin } from '../config/supabase';

dotenv.config();

const email = process.env.SUPER_ADMIN_EMAIL;
const password = process.env.SUPER_ADMIN_PASSWORD;
const fullName = process.env.SUPER_ADMIN_NAME || 'Super Admin';

const run = async () => {
  if (!email || !password) {
    throw new Error(
      'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required in .env'
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  const { data: createdUser, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'super_admin',
      },
    });

  if (createError || !createdUser.user) {
    throw createError || new Error('Failed to create super admin user');
  }

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: createdUser.user.id,
    full_name: fullName,
    email: normalizedEmail,
    role: 'super_admin',
    is_active: true,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id);
    throw profileError;
  }

  console.log('Super admin created successfully:', normalizedEmail);
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to create super admin:', error);
    process.exit(1);
  });