import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { inventoryApi, salesApi } from '../services/api';
import ItemHistoryModal from '../components/ItemHistoryModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { useAuth } from '../context/AuthContext';

interface Vehicle {
  id: string;
  model: string;
  chassis_number: string;
  specifications: string | null;
  status: 'available' | 'reserved' | 'sold';
  unit_price: number;
}

interface Part {
  id: string;
  name: string;
  specifications: string | null;
  quantity: number;
  reserved_quantity?: number;
  unit_price: number;
  min_stock_alert: number;
  part_number?: string;
}

interface DisplayItem {
  id: string;
  type: 'vehicle' | 'part';
  name: string;
  specifications: string;
  quantity: number;
  available_quantity?: number;
  reserved_quantity?: number;
  unit_price: number;
  status?: string;
  chassis_number?: string;
  part_number?: string;
}

const InventoryCard = ({
  item,
  onViewHistory,
}: {
  item: DisplayItem;
  onViewHistory: () => void;
}) => {
  const isVehicle = item.type === 'vehicle';

  const availableQuantity = isVehicle
    ? item.status === 'available'
      ? 1
      : 0
    : item.available_quantity !== undefined
      ? item.available_quantity
      : item.quantity;

  const reservedQuantity = isVehicle
    ? item.status === 'reserved'
      ? 1
      : 0
    : item.reserved_quantity || 0;

  const isLowStock = item.type === 'part' && availableQuantity < 5;
  const isReserved = reservedQuantity > 0;
  const isSoldOut = isVehicle && item.status === 'sold';

  return (
    <View style={[styles.card, isSoldOut && styles.cardSold]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <Text style={styles.itemTypeBadge}>
            {isVehicle ? '🚛 VEHICLE' : '🔧 PART'}
          </Text>

          <Text style={styles.itemName}>{item.name}</Text>
        </View>

        <View style={styles.quantityContainer}>
          <Text
            style={[
              styles.quantityNumber,
              isLowStock && styles.lowStockQuantity,
              availableQuantity === 0 && styles.soldOutQuantity,
            ]}
          >
            {availableQuantity}
          </Text>

          <Text style={styles.quantityUnit}>available</Text>
        </View>
      </View>

      {isReserved ? (
        <View style={styles.reservedContainer}>
          <Text style={styles.reservedText}>🔒 {reservedQuantity} reserved</Text>
        </View>
      ) : null}

      <Text style={styles.itemDescription} numberOfLines={2}>
        {item.specifications}
      </Text>

      {isVehicle && item.chassis_number ? (
        <Text style={styles.chassisText}>Chassis: {item.chassis_number}</Text>
      ) : null}

      {!isVehicle && item.part_number ? (
        <Text style={styles.chassisText}>Part #: {item.part_number}</Text>
      ) : null}

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.historyButton} onPress={onViewHistory}>
          <Text style={styles.historyButtonText}>📂 View History</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [pendingCount, setPendingCount] = useState(0);

  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);

  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const loadVehicles = async () => {
    try {
      const response = await inventoryApi.getVehicles();
      setVehicles(response.data.data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const loadParts = async () => {
    try {
      const response = await inventoryApi.getParts();
      setParts(response.data.data || []);
    } catch (error) {
      console.error('Error loading parts:', error);
    }
  };

  const loadPendingCount = async () => {
    try {
      const response = await salesApi.getSalesOrders({
        status: 'pending_admin',
      });

      const totalFromPagination = response.data?.pagination?.total;
      const totalFromData = response.data?.data?.length || 0;

      setPendingCount(
        typeof totalFromPagination === 'number'
          ? totalFromPagination
          : totalFromData
      );
    } catch (error) {
      console.error('Error loading pending approval count:', error);
      setPendingCount(0);
    }
  };

  const loadAllData = async () => {
    setLoading(true);

    await Promise.all([
      loadVehicles(),
      loadParts(),
      loadPendingCount(),
    ]);

    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

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

  const handleOpenChangePassword = () => {
    setProfileMenuVisible(false);
    setChangePasswordVisible(true);
  };

  const inventory: DisplayItem[] = [
    ...vehicles.map((vehicle) => ({
      id: vehicle.id,
      type: 'vehicle' as const,
      name: vehicle.model,
      specifications: vehicle.specifications || '',
      quantity: vehicle.status === 'available' ? 1 : 0,
      available_quantity: vehicle.status === 'available' ? 1 : 0,
      reserved_quantity: vehicle.status === 'reserved' ? 1 : 0,
      unit_price: Number(vehicle.unit_price || 0),
      status: vehicle.status,
      chassis_number: vehicle.chassis_number,
    })),

    ...parts.map((part) => {
      const totalQuantity = Number(part.quantity || 0);
      const reservedQuantity = Number(part.reserved_quantity || 0);

      return {
        id: part.id,
        type: 'part' as const,
        name: part.name,
        specifications: part.specifications || '',
        quantity: totalQuantity,
        available_quantity: Math.max(0, totalQuantity - reservedQuantity),
        reserved_quantity: reservedQuantity,
        unit_price: Number(part.unit_price || 0),
        part_number: part.part_number,
      };
    }),
  ];

  const filteredInventory = inventory.filter((item) => {
    const query = searchQuery.toLowerCase();

    return (
      item.name.toLowerCase().includes(query) ||
      item.specifications.toLowerCase().includes(query) ||
      item.chassis_number?.toLowerCase().includes(query) ||
      item.part_number?.toLowerCase().includes(query)
    );
  });

  const getLowStockCount = () => {
    return parts.filter((part) => {
      const totalQuantity = Number(part.quantity || 0);
      const reservedQuantity = Number(part.reserved_quantity || 0);
      const availableQuantity = totalQuantity - reservedQuantity;

      return availableQuantity < Number(part.min_stock_alert || 5);
    }).length;
  };

  const navigateToPendingRequests = () => {
    navigation.navigate('PendingRequests' as never);
  };

  const navigateToHistoryReport = () => {
    navigation.navigate('HistoryReport' as never);
  };

  const handleViewHistory = (item: DisplayItem) => {
    setSelectedItem({
      id: item.id,
      name: item.name,
      type: item.type,
      sku:
        item.type === 'vehicle'
          ? item.chassis_number
          : item.part_number || 'Part',
      current_quantity:
        item.available_quantity !== undefined
          ? item.available_quantity
          : item.quantity,
      unit_price: item.unit_price,
    });

    setHistoryModalVisible(true);
  };

  const renderInventoryItem = ({ item }: { item: DisplayItem }) => (
    <InventoryCard
      item={item}
      onViewHistory={() => handleViewHistory(item)}
    />
  );

  if (loading && inventory.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ef4444" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Inventory</Text>

            <Text style={styles.headerSubtitle}>
              {inventory.length} items • {getLowStockCount()} low stock
            </Text>

            <Text style={styles.userText} numberOfLines={1}>
              {user?.full_name || 'Admin'} • {user?.email}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => setProfileMenuVisible(true)}
          >
            <Text style={styles.profileButtonText}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.historyMainButton}
          onPress={navigateToHistoryReport}
        >
          <Text style={styles.historyMainButtonText}>📜 History Report</Text>
        </TouchableOpacity>

        {pendingCount > 0 ? (
          <TouchableOpacity
            style={styles.pendingButton}
            onPress={navigateToPendingRequests}
          >
            <Text style={styles.pendingButtonText}>
              ⚠️ {pendingCount} Pending Approvals
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.noPendingButton}
            onPress={navigateToPendingRequests}
          >
            <Text style={styles.noPendingButtonText}>✓ No Pending</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search by name, specs, chassis, or part number..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredInventory}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={renderInventoryItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ef4444"
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No items found</Text>
          </View>
        }
      />

      <ItemHistoryModal
        visible={historyModalVisible}
        onClose={() => {
          setHistoryModalVisible(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
      />

      <Modal
        visible={profileMenuVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setProfileMenuVisible(false)}
      >
        <View style={styles.profileOverlay}>
          <TouchableOpacity
            style={styles.profileBackdrop}
            activeOpacity={1}
            onPress={() => setProfileMenuVisible(false)}
          />

          <View style={styles.profileMenu}>
            <View style={styles.profileHeader}>
              <Text style={styles.profileName}>{user?.full_name || 'User'}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              <Text style={styles.profileRole}>{user?.role}</Text>
            </View>

            <TouchableOpacity
              style={styles.profileMenuItem}
              onPress={handleOpenChangePassword}
            >
              <Text style={styles.profileMenuItemText}>🔐 Change Password</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.profileMenuItem, styles.profileLogoutItem]}
              onPress={() => {
                setProfileMenuVisible(false);
                handleLogout();
              }}
            >
              <Text style={styles.profileLogoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ChangePasswordModal
        visible={changePasswordVisible}
        onClose={() => setChangePasswordVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  header: {
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  userText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    maxWidth: 240,
  },
  profileButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  profileButtonText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '700',
  },
  profileOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'flex-end',
    paddingTop: 88,
    paddingRight: 20,
  },
  profileBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  profileMenu: {
    width: 260,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
  },
  profileHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 12,
    marginBottom: 8,
  },
  profileName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  profileEmail: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 3,
  },
  profileRole: {
    color: '#64748b',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  profileMenuItem: {
    paddingVertical: 12,
    borderRadius: 8,
  },
  profileMenuItemText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  profileLogoutItem: {
    marginTop: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  profileLogoutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  historyMainButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  historyMainButtonText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  pendingButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  pendingButtonText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '700',
  },
  noPendingButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  noPendingButtonText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardSold: {
    opacity: 0.6,
    backgroundColor: '#1a1a2e',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  itemTypeBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  quantityContainer: {
    alignItems: 'flex-end',
  },
  quantityNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ef4444',
    marginRight: 4,
  },
  lowStockQuantity: {
    color: '#fbbf24',
  },
  soldOutQuantity: {
    color: '#64748b',
  },
  quantityUnit: {
    fontSize: 10,
    color: '#64748b',
  },
  reservedContainer: {
    marginBottom: 4,
  },
  reservedText: {
    fontSize: 11,
    color: '#f97316',
  },
  itemDescription: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 8,
    lineHeight: 18,
  },
  chassisText: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: 4,
  },
  historyButton: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  historyButtonText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
  },
});