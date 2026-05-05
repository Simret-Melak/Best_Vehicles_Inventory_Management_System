import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is missing');
}

if (!supabaseAnonKey) {
  throw new Error('SUPABASE_ANON_KEY is missing');
}

if (!supabaseServiceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing');
}

// Used for normal backend database operations.
// This uses the service role key, so only use it on the backend.
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Used for login and validating user tokens.
export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);

// Used for admin auth actions like creating users.
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);