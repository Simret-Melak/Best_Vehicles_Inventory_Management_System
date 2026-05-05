import * as SecureStore from 'expo-secure-store';
import { setAuthToken } from './api';

const TOKEN_KEY = 'access_token';
const USER_KEY = 'auth_user';

export type UserRole = 'super_admin' | 'admin' | 'worker' | 'store_manager';

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
}

export const saveAuthSession = async (token: string, user: AuthUser) => {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));

  setAuthToken(token);
};

export const loadAuthSession = async () => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const userString = await SecureStore.getItemAsync(USER_KEY);

  if (token) {
    setAuthToken(token);
  }

  return {
    token,
    user: userString ? (JSON.parse(userString) as AuthUser) : null,
  };
};

export const clearAuthSession = async () => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);

  setAuthToken(null);
};