import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

export default function SuperAdminDashboardScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Super Admin</Text>
          <Text style={styles.headerSubtitle}>
            {user?.full_name || 'Super Admin'} • {user?.email}
          </Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeIcon}>👑</Text>
          <Text style={styles.welcomeTitle}>Welcome, Super Admin</Text>
          <Text style={styles.welcomeText}>
            Manage users, review inventory, approve sales, and view transaction
            history.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Management</Text>

          <TouchableOpacity
            style={styles.mainCard}
            onPress={() => navigation.navigate('UserManagement' as never)}
          >
            <View style={styles.cardIconBox}>
              <Text style={styles.cardIcon}>👥</Text>
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Manage Users</Text>
              <Text style={styles.cardDescription}>
                Create admins, workers, store managers, and other super admins.
              </Text>
            </View>

            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Operations</Text>

          <TouchableOpacity
            style={styles.mainCard}
            onPress={() => navigation.navigate('AdminDashboard' as never)}
          >
            <View style={styles.cardIconBox}>
              <Text style={styles.cardIcon}>📦</Text>
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Inventory & Approvals</Text>
              <Text style={styles.cardDescription}>
                View inventory, check pending approvals, and manage sales.
              </Text>
            </View>

            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mainCard}
            onPress={() => navigation.navigate('HistoryReport' as never)}
          >
            <View style={styles.cardIconBox}>
              <Text style={styles.cardIcon}>📜</Text>
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Transaction History</Text>
              <Text style={styles.cardDescription}>
                Review inventory movements, reservations, sales, and stock changes.
              </Text>
            </View>

            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mainCard}
            onPress={() => navigation.navigate('Customers' as never)}
          >
            <View style={styles.cardIconBox}>
              <Text style={styles.cardIcon}>🧾</Text>
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Customers</Text>
              <Text style={styles.cardDescription}>
                View customer records and order history.
              </Text>
            </View>

            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Role Access</Text>

          <View style={styles.roleRow}>
            <Text style={styles.roleName}>Super Admin</Text>
            <Text style={styles.roleDescription}>Users + admin access</Text>
          </View>

          <View style={styles.roleRow}>
            <Text style={styles.roleName}>Admin</Text>
            <Text style={styles.roleDescription}>Approvals + inventory</Text>
          </View>

          <View style={styles.roleRow}>
            <Text style={styles.roleName}>Worker</Text>
            <Text style={styles.roleDescription}>Sales requests + payments</Text>
          </View>

          <View style={styles.roleRow}>
            <Text style={styles.roleName}>Store Manager</Text>
            <Text style={styles.roleDescription}>Stock + history only</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    maxWidth: 230,
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  logoutButtonText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  welcomeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 22,
  },
  welcomeIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  welcomeTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  welcomeText: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mainCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardIcon: {
    fontSize: 24,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDescription: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
  },
  chevron: {
    color: '#64748b',
    fontSize: 32,
    marginLeft: 8,
  },
  infoBox: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  roleRow: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingVertical: 10,
  },
  roleName: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  roleDescription: {
    color: '#94a3b8',
    fontSize: 12,
  },
});