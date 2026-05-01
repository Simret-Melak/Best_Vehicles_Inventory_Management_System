import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RoleSelectScreen from './src/screens/RoleSelectScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import WorkerDashboardScreen from './src/screens/WorkerDashboardScreen';
import WorkerPendingRequestsScreen from './src/screens/WorkerPendingRequestsScreen';
import PendingRequestsScreen from './src/screens/PendingRequestsScreen';
import HistoryReportScreen from './src/screens/HistoryReportScreen';
import CustomersScreen from './src/screens/CustomersScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        <Stack.Screen name="WorkerDashboard" component={WorkerDashboardScreen} />
        <Stack.Screen name="WorkerPendingRequests" component={WorkerPendingRequestsScreen} />
        <Stack.Screen name="PendingRequests" component={PendingRequestsScreen} />
        <Stack.Screen name="HistoryReport" component={HistoryReportScreen} />
        <Stack.Screen name="Customers" component={CustomersScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}