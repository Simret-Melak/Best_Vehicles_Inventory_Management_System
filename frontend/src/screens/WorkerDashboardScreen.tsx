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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AddStockModal from '../components/AddStockModal';
import RequestSaleModal from '../components/RequestSaleModal';
import { inventoryApi } from '../services/api';

interface InventoryItem {
  id: string;
  name: string;
  specifications: string;
  quantity: number;
  unit_price: number;
  chassis_number?: string;
  part_number?: string;
  status?: string;
  available_quantity?: number;
  reserved_quantity?: number;
}

const InventoryCard = ({
  item,
  onAddStock,
  onRequestSale,
  onViewHistory,
}: {
  item: InventoryItem;
  onAddStock: () => void;
  onRequestSale: () => void;
  onViewHistory: () => void;
}) => {
  const isVehicle = !!item.chassis_number;
  const isSoldOut = isVehicle && item.status === 'sold';
  const isReserved = isVehicle && item.status === 'reserved';

  const availableQty = !isVehicle
    ? item.available_quantity !== undefined
      ? item.available_quantity
      : item.quantity
    : item.status === 'available'
      ? 1
      : 0;

  const reservedQty = !isVehicle
    ? item.reserved_quantity || 0
    : isReserved
      ? 1
      : 0;

  const hasReserved = reservedQty > 0;
  const isLowStock = !isVehicle && availableQty < 5;

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
              isSoldOut && styles.soldOutQuantity,
            ]}
          >
            {availableQty}
          </Text>

          <Text style={styles.quantityUnit}>available</Text>
        </View>
      </View>

      {hasReserved && !isSoldOut ? (
        <View style={styles.reservedContainer}>
          <Text style={styles.reservedText}>🔒 {reservedQty} reserved</Text>
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
        <TouchableOpacity style={styles.addStockButton} onPress={onAddStock}>
          <Text style={styles.addStockButtonText}>+ Add Stock</Text>
        </TouchableOpacity>

        {!isSoldOut && !isReserved && availableQty > 0 ? (
          <TouchableOpacity style={styles.requestSaleButton} onPress={onRequestSale}>
            <Text style={styles.requestSaleButtonText}>Request Sale</Text>
          </TouchableOpacity>
        ) : null}

        {isReserved ? (
          <View style={styles.reservedBadge}>
            <Text style={styles.reservedBadgeText}>Reserved</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.historyButton} onPress={onViewHistory}>
          <Text style={styles.historyButtonText}>📂 History</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function WorkerDashboardScreen() {
  const navigation = useNavigation();

  const [searchQuery, setSearchQuery] = useState('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [addStockModalVisible, setAddStockModalVisible] = useState(false);
  const [requestSaleModalVisible, setRequestSaleModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const loadInventory = async () => {
    try {
      const vehiclesRes = await inventoryApi.getVehicles();

      const vehicles = (vehiclesRes.data.data || []).map((v: any) => ({
        id: v.id,
        name: v.model,
        specifications: v.specifications || '',
        quantity: v.status === 'available' ? 1 : 0,
        unit_price: Number(v.unit_price || 0),
        chassis_number: v.chassis_number,
        status: v.status,
      }));

      const partsRes = await inventoryApi.getParts();

      const parts = (partsRes.data.data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        specifications: p.specifications || '',
        quantity: Number(p.quantity || 0),
        unit_price: Number(p.unit_price || 0),
        part_number: p.part_number,
        available_quantity:
          Number(p.quantity || 0) - Number(p.reserved_quantity || 0),
        reserved_quantity: Number(p.reserved_quantity || 0),
      }));

      setInventory([...vehicles, ...parts]);
    } catch (error) {
      console.error('Error loading inventory:', error);
      Alert.alert('Error', 'Failed to load inventory');
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
    await loadAllData();
    setRefreshing(false);
  };

  const handleAddStockSuccess = () => {
    loadInventory();
  };

  const handleRequestSale = (item: InventoryItem) => {
    setSelectedItem(item);
    setRequestSaleModalVisible(true);
  };

  const handleRequestSaleSuccess = () => {
    loadInventory();
    navigation.navigate('WorkerPendingRequests' as never);
  };

  const navigateToHistory = () => {
    navigation.navigate('HistoryReport' as never);
  };

  const navigateToCustomers = () => {
    navigation.navigate('Customers' as never);
  };

  const navigateToWorkerPendingRequests = () => {
    navigation.navigate('WorkerPendingRequests' as never);
  };

  const determineItemType = (item: InventoryItem): 'vehicle' | 'part' => {
    return item.chassis_number ? 'vehicle' : 'part';
  };

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
    return inventory.filter(
      (item) =>
        !item.chassis_number &&
        (item.available_quantity !== undefined ? item.available_quantity : item.quantity) <
          5
    ).length;
  };

  const renderInventoryItem = ({ item }: { item: InventoryItem }) => (
    <InventoryCard
      item={item}
      onAddStock={() => setAddStockModalVisible(true)}
      onRequestSale={() => handleRequestSale(item)}
      onViewHistory={navigateToHistory}
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
        <Text style={styles.headerTitle}>Inventory</Text>

        <Text style={styles.headerSubtitle}>
          {filteredInventory.length} items • {getLowStockCount()} low stock
        </Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, styles.tabActive]}>
          <Text style={[styles.tabText, styles.tabTextActive]}>📦 Inventory</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tab} onPress={navigateToWorkerPendingRequests}>
          <Text style={styles.tabText}>📋 My Requests</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tab} onPress={navigateToCustomers}>
          <Text style={styles.tabText}>👥 Customers</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionBar}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Search inventory..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <TouchableOpacity
          style={styles.addStockTopButton}
          onPress={() => setAddStockModalVisible(true)}
        >
          <Text style={styles.addStockTopButtonText}>+ Add Stock</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.historyHeaderButton} onPress={navigateToHistory}>
          <Text style={styles.historyHeaderButtonText}>📜 History</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredInventory}
        keyExtractor={(item) => `${item.id}-${item.chassis_number || item.part_number || item.name}`}
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

      <AddStockModal
        visible={addStockModalVisible}
        onClose={() => setAddStockModalVisible(false)}
        vehicles={inventory
          .filter((item) => item.chassis_number)
          .map((item) => ({
            id: item.id,
            model: item.name,
            chassis_number: item.chassis_number!,
            specifications: item.specifications,
            status: (item.status || 'available') as 'available' | 'reserved' | 'sold',
            unit_price: item.unit_price,
          }))}
        parts={inventory
          .filter((item) => !item.chassis_number)
          .map((item) => ({
            id: item.id,
            name: item.name,
            specifications: item.specifications,
            quantity: item.quantity,
            unit_price: item.unit_price,
            min_stock_alert: 5,
            part_number: item.part_number,
          }))}
        onSuccess={handleAddStockSuccess}
      />

      <RequestSaleModal
        visible={requestSaleModalVisible}
        onClose={() => {
          setRequestSaleModalVisible(false);
          setSelectedItem(null);
        }}
        item={
          selectedItem
            ? {
                id: selectedItem.id,
                part_id: selectedItem.chassis_number ? undefined : selectedItem.id,
                name: selectedItem.name,
                specifications: selectedItem.specifications,
                quantity: selectedItem.chassis_number
                  ? selectedItem.quantity
                  : selectedItem.available_quantity !== undefined
                    ? selectedItem.available_quantity
                    : selectedItem.quantity,
                unit_price: selectedItem.unit_price,
                ...(selectedItem.chassis_number && {
                  chassis_number: selectedItem.chassis_number,
                }),
                ...(selectedItem.part_number && {
                  part_number: selectedItem.part_number,
                }),
              }
            : null
        }
        itemType={selectedItem ? determineItemType(selectedItem) : 'part'}
        customers={[]}
        onSuccess={handleRequestSaleSuccess}
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
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tab: {
    paddingVertical: 12,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#ef4444',
  },
  tabText: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#ef4444',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    flexWrap: 'wrap',
  },
  searchContainer: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    minWidth: 150,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
    color: '#64748b',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
  },
  addStockTopButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addStockTopButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  historyHeaderButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  historyHeaderButtonText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
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
    gap: 8,
    flexWrap: 'wrap',
  },
  addStockButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  addStockButtonText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '500',
  },
  requestSaleButton: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  requestSaleButtonText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '500',
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
  reservedBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reservedBadgeText: {
    color: '#f97316',
    fontSize: 11,
    fontWeight: '500',
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
    marginBottom: 8,
  },
});