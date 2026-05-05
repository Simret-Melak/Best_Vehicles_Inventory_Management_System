import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { authApi } from '../services/api';
import {
  AuthUser,
  saveAuthSession,
  loadAuthSession,
  clearAuthSession,
} from '../services/authStorage';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;

  isSuperAdmin: boolean;
  isAdmin: boolean;
  isWorker: boolean;
  isStoreManager: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrapAuth = async () => {
    try {
      const session = await loadAuthSession();

      if (session.token && session.user) {
        setToken(session.token);
        setUser(session.user);

        try {
          const response = await authApi.getMe();
          const freshUser = response.data.data as AuthUser;

          setUser(freshUser);
          await saveAuthSession(session.token, freshUser);
        } catch (error) {
          await clearAuthSession();
          setToken(null);
          setUser(null);
        }
      }
    } catch (error) {
      await clearAuthSession();
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    bootstrapAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email.trim().toLowerCase(), password);

    const loggedInUser = response.data.data.user as AuthUser;
    const accessToken = response.data.data.session.access_token as string;

    await saveAuthSession(accessToken, loggedInUser);

    setUser(loggedInUser);
    setToken(accessToken);

    return loggedInUser;
  };

  const logout = async () => {
    await clearAuthSession();

    setUser(null);
    setToken(null);
  };

  const refreshUser = async () => {
    if (!token) return;

    const response = await authApi.getMe();
    const freshUser = response.data.data as AuthUser;

    setUser(freshUser);
    await saveAuthSession(token, freshUser);
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isWorker = user?.role === 'worker';
  const isStoreManager = user?.role === 'store_manager';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        refreshUser,
        isSuperAdmin,
        isAdmin,
        isWorker,
        isStoreManager,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
};