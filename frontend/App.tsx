import React, { useEffect } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from 'react-native';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { supabaseClient } from './src/services/supabaseClient';

import LoginScreen from './src/screens/LoginScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import AcceptInviteScreen from './src/screens/AcceptInviteScreen';

import SuperAdminDashboardScreen from './src/screens/SuperAdminDashboardScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import WorkerDashboardScreen from './src/screens/WorkerDashboardScreen';
import StoreManagerDashboardScreen from './src/screens/StoreManagerDashboardScreen';

import UserManagementScreen from './src/screens/UserManagementScreen';
import WorkerPendingRequestsScreen from './src/screens/WorkerPendingRequestsScreen';
import PendingRequestsScreen from './src/screens/PendingRequestsScreen';
import HistoryReportScreen from './src/screens/HistoryReportScreen';
import CustomersScreen from './src/screens/CustomersScreen';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef<any>();

const LoadingScreen = () => {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#ef4444" />
    </View>
  );
};

const parseDeepLinkParams = (url: string) => {
  const params: Record<string, string> = {};

  const queryString = url.includes('?')
    ? url.split('?')[1].split('#')[0]
    : '';

  const hashString = url.includes('#') ? url.split('#')[1] : '';

  const combined = [queryString, hashString].filter(Boolean).join('&');

  combined.split('&').forEach((pair) => {
    if (!pair) return;

    const [rawKey, rawValue] = pair.split('=');

    if (!rawKey) return;

    const key = decodeURIComponent(rawKey);
    const value = decodeURIComponent(rawValue || '');

    params[key] = value;
  });

  return params;
};

const navigateWhenReady = (screenName: string, attempt = 0) => {
  if (navigationRef.isReady()) {
    navigationRef.navigate(screenName as never);
    return;
  }

  if (attempt < 10) {
    setTimeout(() => navigateWhenReady(screenName, attempt + 1), 300);
  }
};

const createSupabaseSessionFromLink = async (url: string) => {
  const params = parseDeepLinkParams(url);

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  const code = params.code;

  if (accessToken && refreshToken) {
    const { error } = await supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error('Failed to set Supabase auth session:', error.message);
    }

    return;
  }

  if (code) {
    const { error } = await supabaseClient.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Failed to exchange Supabase auth code:', error.message);
    }
  }
};

const handleAuthDeepLink = async (url: string | null) => {
  if (!url) return;

  const isResetPasswordLink =
    url.includes('reset-password') || url.includes('type=recovery');

  const isAcceptInviteLink =
    url.includes('accept-invite') || url.includes('type=invite');

  if (!isResetPasswordLink && !isAcceptInviteLink) return;

  try {
    await createSupabaseSessionFromLink(url);

    if (isAcceptInviteLink) {
      navigateWhenReady('AcceptInvite');
      return;
    }

    if (isResetPasswordLink) {
      navigateWhenReady('ResetPassword');
    }
  } catch (error: any) {
    console.error('Deep link handling error:', error.message || error);
  }
};

function AppNavigator() {
  const { user, loading } = useAuth();

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleAuthDeepLink(url);
    });

    Linking.getInitialURL().then((url) => {
      handleAuthDeepLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
            />
            <Stack.Screen
              name="AcceptInvite"
              component={AcceptInviteScreen}
            />
          </>
        ) : user.role === 'super_admin' ? (
          <>
            <Stack.Screen
              name="SuperAdminDashboard"
              component={SuperAdminDashboardScreen}
            />
            <Stack.Screen
              name="UserManagement"
              component={UserManagementScreen}
            />
            <Stack.Screen
              name="AdminDashboard"
              component={AdminDashboardScreen}
            />
            <Stack.Screen
              name="PendingRequests"
              component={PendingRequestsScreen}
            />
            <Stack.Screen
              name="HistoryReport"
              component={HistoryReportScreen}
            />
            <Stack.Screen name="Customers" component={CustomersScreen} />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
            />
            <Stack.Screen
              name="AcceptInvite"
              component={AcceptInviteScreen}
            />
          </>
        ) : user.role === 'admin' ? (
          <>
            <Stack.Screen
              name="AdminDashboard"
              component={AdminDashboardScreen}
            />
            <Stack.Screen
              name="PendingRequests"
              component={PendingRequestsScreen}
            />
            <Stack.Screen
              name="HistoryReport"
              component={HistoryReportScreen}
            />
            <Stack.Screen name="Customers" component={CustomersScreen} />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
            />
            <Stack.Screen
              name="AcceptInvite"
              component={AcceptInviteScreen}
            />
          </>
        ) : user.role === 'store_manager' ? (
          <>
            <Stack.Screen
              name="StoreManagerDashboard"
              component={StoreManagerDashboardScreen}
            />
            <Stack.Screen
              name="HistoryReport"
              component={HistoryReportScreen}
            />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
            />
            <Stack.Screen
              name="AcceptInvite"
              component={AcceptInviteScreen}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="WorkerDashboard"
              component={WorkerDashboardScreen}
            />
            <Stack.Screen
              name="WorkerPendingRequests"
              component={WorkerPendingRequestsScreen}
            />
            <Stack.Screen
              name="HistoryReport"
              component={HistoryReportScreen}
            />
            <Stack.Screen name="Customers" component={CustomersScreen} />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
            />
            <Stack.Screen
              name="AcceptInvite"
              component={AcceptInviteScreen}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});