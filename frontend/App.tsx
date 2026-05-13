import React from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthProvider, useAuth } from './src/context/AuthContext';

import LoginScreen from './src/screens/LoginScreen';

import SuperAdminDashboardScreen from './src/screens/SuperAdminDashboardScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import WorkerDashboardScreen from './src/screens/WorkerDashboardScreen';
import StoreManagerDashboardScreen from './src/screens/StoreManagerDashboardScreen';

import UserManagementScreen from './src/screens/UserManagementScreen';
import WorkerPendingRequestsScreen from './src/screens/WorkerPendingRequestsScreen';
import PendingRequestsScreen from './src/screens/PendingRequestsScreen';
import HistoryReportScreen from './src/screens/HistoryReportScreen';
import CustomersScreen from './src/screens/CustomersScreen';
import LowStockScreen from './src/screens/LowStockScreen';

const Stack = createNativeStackNavigator();

const LoadingScreen = () => {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#ef4444" />
    </View>
  );
};

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
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

            <Stack.Screen
              name="Customers"
              component={CustomersScreen}
            />

            <Stack.Screen
              name="LowStock"
              component={LowStockScreen}
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

            <Stack.Screen
              name="Customers"
              component={CustomersScreen}
            />

            <Stack.Screen
              name="LowStock"
              component={LowStockScreen}
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
              name="LowStock"
              component={LowStockScreen}
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

            <Stack.Screen
              name="Customers"
              component={CustomersScreen}
            />

            <Stack.Screen
              name="LowStock"
              component={LowStockScreen}
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