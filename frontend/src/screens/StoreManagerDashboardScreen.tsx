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
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { inventoryApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AddStockModal from '../components/AddStockModal';
import ItemHistoryModal from '../components/ItemHistoryModal';

interface InventoryItem {
  id: string;
  type: 'vehicle' | 'part';
  name: string;
  specifications: string;
  quantity: number;
  available_quantity?: number;
  reserved_quantity?: number;
  unit_price: number;
  status?: 'available' | 'reserved' | 'sold';
  chassis_number?: string;
  part_number?: string;
  min_stock_alert?: number;
}

const toNumber = (value: any) => {
  const numberValue = Number(value || 0);
  return Number.isNaN(numberValue) ? 0 : numberValue;
};

const formatMoney = (value: any) => {
  return `Br ${toNumber(value).toLocaleString()}`;
};

const InventoryCard = ({
  item,
  onViewHistory,
}: {
  item: InventoryItem;
  onViewHistory: () => void;
}) => {
  const isVehicle = item.type === 'vehicle';

  const totalQuantity = isVehicle ? 1 : toNumber(item.quantity);
  const reservedQuantity = isVehicle
    ? item.status === 'reserved'
      ? 1
      : 0
    : toNumber(item.reserved_quantity);

  const availableQuantity = isVehicle
    ? item.status === 'available'
      ? 1
      : 0
    : item.available_quantity !== undefined
      ? toNumber(item.available_quantity)
      : Math.max(0, totalQuantity - reservedQuantity);

  const isSold = isVehicle && item.status === 'sold';
  const isReserved = reservedQuantity > 0;
  const isLowStock =
    !isVehicle && availableQuantity < toNumber(item.min_stock_alert || 5);

  return (
    <View style={[styles.card, isSold && styles.cardDisabled]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <Text style={styles.itemTypeBadge}>
            {isVehicle ? '🚛 VEHICLE' : '🔧 PART'}
          </Text>

          <Text style={styles.itemName}>{item.name}</Text>

          {item.specifications ? (
            <Text style={styles.itemDescription} numberOfLines={2}>
              {item.specifications}
            </Text>
          ) : null}
        </View>

        <View style={styles.quantityContainer}>
          <Text
            style={[
              styles.quantityNumber,
              isLowStock && styles.lowStockQuantity,
              availableQuantity === 0 && styles.zeroQuantity,
            ]}
          >
            {availableQuantity}
          </Text>
          <Text style={styles.quantityUnit}>available</Text>
        </View>
      </View>

      <View style={styles.stockDetails}>
        {!isVehicle ? (
          <>
            <View style={styles.stockPill}>
              <Text style={styles.stockPillLabel}>Total</Text>
              <Text style={styles.stockPillValue}>{totalQuantity}</Text>
            </View>

            <View style={styles.stockPill}>
              <Text style={styles.stockPillLabel}>Reserved</Text>
              <Text style={styles.stockPillValue}>{reservedQuantity}</Text>
            </View>
          </>
        ) : (
          <View style={styles.statusPill}>
            <Text
              style={[
                styles.statusText,
                item.status === 'available' && styles.availableText,
                item.status === 'reserved' && styles.reservedText,
                item.status === 'sold' && styles.soldText,
              ]}
            >
              {item.status || 'unknown'}
            </Text>
          </View>
        )}

        <View style={styles.stockPill}>
          <Text style={styles.stockPillLabel}>Price</Text>
          <Text style={styles.stockPillValue}>{formatMoney(item.unit_price)}</Text>
        </View>
      </View>

      {isReserved ? (
        <View style={styles.reservedContainer}>
          <Text style={styles.reservedMessage}>
            🔒 {reservedQuantity} {isVehicle ? 'vehicle' : 'unit'}
            {reservedQuantity === 1 ? '' : 's'} reserved
          </Text>
        </View>
      ) : null}

      {isLowStock ? (
        <View style={styles.lowStockBox}>
          <Text style={styles.lowStockText}>⚠️ Low available stock</Text>
        </View>
      ) : null}

      {item.chassis_number ? (
        <Text style={styles.identifierText}>Chassis: {item.chassis_number}</Text>
      ) : null}

      {item.part_number ? (
        <Text style={styles.identifierText}>Part #: {item.part_number}</Text>
      ) : null}

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.historyButton} onPress={onViewHistory}>
          <Text style={styles.historyButtonText}>📂 Stock History</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function StoreManagerDashboardScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [addStockModalVisible, setAddStockModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);

  const loadInventory = async () => {
    try {
      const [vehiclesRes, partsRes] = await Promise.all([
        inventoryApi.getVehicles(),
        inventoryApi.getParts(),
      ]);

      const vehicles: InventoryItem[] = (vehiclesRes.data.data || []).map(
        (vehicle: any) => ({
          id: vehicle.id,
          type: 'vehicle',
          name: vehicle.model,
          specifications: vehicle.specifications || '',
          quantity: vehicle.status === 'available' ? 1 : 0,
          available_quantity: vehicle.status === 'available' ? 1 : 0,
          reserved_quantity: vehicle.status === 'reserved' ? 1 : 0,
          unit_price: toNumber(vehicle.unit_price),
          status: vehicle.status,
          chassis_number: vehicle.chassis_number,
        })
      );

      const parts: InventoryItem[] = (partsRes.data.data || []).map(
        (part: any) => {
          const totalQuantity = toNumber(part.quantity);
          const reservedQuantity = toNumber(part.reserved_quantity);
          const availableQuantity = Math.max(
            0,
            totalQuantity - reservedQuantity
          );

          return {
            id: part.id,
            type: 'part',
            name: part.name,
            specifications: part.specifications || '',
            quantity: totalQuantity,
            available_quantity: availableQuantity,
            reserved_quantity: reservedQuantity,
            unit_price: toNumber(part.unit_price),
            part_number: part.part_number,
            min_stock_alert: toNumber(part.min_stock_alert || 5),
          };
        }
      );

      setInventory([...vehicles, ...parts]);
    } catch (error: any) {
      console.error('Error loading inventory:', {
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
      });

      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to load inventory'
      );
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await loadInventory();
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
    await loadInventory();
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

  const handleAddStockSuccess = async () => {
    await loadInventory();
  };

  const handleViewItemHistory = (item: InventoryItem) => {
    setSelectedHistoryItem({
      id: item.id,
      name: item.name,
      type: item.type,
      sku: item.type === 'vehicle'
        ? item.chassis_number || item.id
        : item.part_number || item.id,
      current_quantity:
        item.type === 'vehicle'
          ? item.status === 'available'
            ? 1
            : 0
          : item.available_quantity !== undefined
            ? item.available_quantity
            : item.quantity,
      unit_price: item.unit_price,
    });

    setHistoryModalVisible(true);
  };

  const navigateToHistoryReport = () => {
    navigation.navigate('HistoryReport' as never);
  };

  const filteredInventory = inventory.filter((item) => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return true;

    return (
      item.name.toLowerCase().includes(query) ||
      item.specifications.toLowerCase().includes(query) ||
      item.chassis_number?.toLowerCase().includes(query) ||
      item.part_number?.toLowerCase().includes(query) ||
      item.status?.toLowerCase().includes(query)
    );
  });

  const totalParts = inventory.filter((item) => item.type === 'part').length;
  const totalVehicles = inventory.filter((item) => item.type === 'vehicle').length;

  const lowStockCount = inventory.filter((item) => {
    if (item.type !== 'part') return false;

    const availableQuantity =
      item.available_quantity !== undefined
        ? item.available_quantity
        : Math.max(0, item.quantity - toNumber(item.reserved_quantity));

    return availableQuantity < toNumber(item.min_stock_alert || 5);
  }).length;

  const reservedCount = inventory.filter((item) => {
    return toNumber(item.reserved_quantity) > 0 || item.status === 'reserved';
  }).length;

  const vehiclesForModal = inventory
    .filter((item) => item.type === 'vehicle')
    .map((item) => ({
      id: item.id,
      model: item.name,
      chassis_number: item.chassis_number || '',
      specifications: item.specifications,
      status: (item.status || 'available') as 'available' | 'reserved' | 'sold',
      unit_price: item.unit_price,
    }));

  const partsForModal = inventory
    .filter((item) => item.type === 'part')
    .map((item) => ({
      id: item.id,
      name: item.name,
      specifications: item.specifications,
      quantity: item.quantity,
      unit_price: item.unit_price,
      min_stock_alert: item.min_stock_alert || 5,
      part_number: item.part_number,
    }));

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
          <View>
            <Text style={styles.headerTitle}>Store Manager</Text>
            <Text style={styles.headerSubtitle}>
              {user?.full_name || 'Store Manager'} • Stock Control
            </Text>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalParts}</Text>
            <Text style={styles.summaryLabel}>Parts</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalVehicles}</Text>
            <Text style={styles.summaryLabel}>Vehicles</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryValueWarning}>{lowStockCount}</Text>
            <Text style={styles.summaryLabel}>Low Stock</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryValueReserved}>{reservedCount}</Text>
            <Text style={styles.summaryLabel}>Reserved</Text>
          </View>
        </View>
      </View>

      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.addStockButton}
          onPress={() => setAddStockModalVisible(true)}
        >
          <Text style={styles.addStockButtonText}>+ Add Stock</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.historyReportButton}
          onPress={navigateToHistoryReport}
        >
          <Text style={styles.historyReportButtonText}>📜 History Report</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>

        <TextInput
          style={styles.searchInput}
          placeholder="Search inventory, chassis, part number..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={filteredInventory}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={({ item }) => (
          <InventoryCard
            item={item}
            onViewHistory={() => handleViewItemHistory(item)}
          />
        )}
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
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No inventory found</Text>
            <Text style={styles.emptySubtitle}>
              Try refreshing or changing your search.
            </Text>
          </View>
        }
      />

      <AddStockModal
        visible={addStockModalVisible}
        onClose={() => setAddStockModalVisible(false)}
        vehicles={vehiclesForModal}
        parts={partsForModal}
        onSuccess={handleAddStockSuccess}
      />

      <ItemHistoryModal
        visible={historyModalVisible}
        onClose={() => {
          setHistoryModalVisible(false);
          setSelectedHistoryItem(null);
        }}
        item={selectedHistoryItem}
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
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
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
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryValue: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryValueWarning: {
    color: '#fbbf24',
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryValueReserved: {
    color: '#f97316',
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryLabel: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  addStockButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addStockButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  historyReportButton: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  historyReportButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  searchContainer: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
    color: '#64748b',
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    paddingVertical: 11,
  },
  clearIcon: {
    color: '#64748b',
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardDisabled: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  cardTitleContainer: {
    flex: 1,
  },
  itemTypeBadge: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  itemName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemDescription: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  quantityContainer: {
    alignItems: 'flex-end',
  },
  quantityNumber: {
    color: '#22c55e',
    fontSize: 22,
    fontWeight: 'bold',
  },
  lowStockQuantity: {
    color: '#fbbf24',
  },
  zeroQuantity: {
    color: '#ef4444',
  },
  quantityUnit: {
    color: '#64748b',
    fontSize: 10,
  },
  stockDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  stockPill: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stockPillLabel: {
    color: '#64748b',
    fontSize: 10,
    marginBottom: 2,
  },
  stockPillValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  statusPill: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  availableText: {
    color: '#22c55e',
  },
  reservedText: {
    color: '#f97316',
  },
  soldText: {
    color: '#ef4444',
  },
  reservedContainer: {
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  reservedMessage: {
    color: '#f97316',
    fontSize: 12,
    fontWeight: '600',
  },
  lowStockBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  lowStockText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
  },
  identifierText: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 10,
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: 4,
  },
  historyButton: {
    backgroundColor: 'rgba(100, 116, 139, 0.24)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  historyButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
});