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
import { inventoryApi, salesApi } from '../services/api';
import ItemHistoryModal from '../components/ItemHistoryModal';

// Types based on your database schema
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
  unit_price: number;
  min_stock_alert: number;
}

// Combined inventory item for display
interface DisplayItem {
  id: string;
  type: 'vehicle' | 'part';
  name: string;
  specifications: string;
  quantity: number;
  unit_price: number;
  status?: string;
  chassis_number?: string;
}

// Inventory Card Component (Admin version - no Add Stock button)
const InventoryCard = ({ 
  item, 
  onViewHistory 
}: { 
  item: DisplayItem; 
  onViewHistory: () => void;
}) => {
  const isLowStock = item.type === 'part' && item.quantity < 5;
  const isVehicle = item.type === 'vehicle';
  
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <Text style={styles.itemTypeBadge}>
            {isVehicle ? '🚛 VEHICLE' : '🔧 PART'}
          </Text>
          <Text style={styles.itemName}>{item.name}</Text>
        </View>
        <View style={styles.quantityContainer}>
          <Text style={[
            styles.quantityNumber,
            isLowStock && styles.lowStockQuantity,
            isVehicle && item.quantity === 0 && styles.soldOutQuantity
          ]}>
            {isVehicle ? (item.status === 'available' ? '1' : '0') : item.quantity}
          </Text>
          <Text style={styles.quantityUnit}>
            {isVehicle ? 'unit' : 'in stock'}
          </Text>
        </View>
      </View>
      
      <Text style={styles.itemDescription} numberOfLines={2}>
        {item.specifications}
      </Text>
      
      {isVehicle && item.chassis_number && (
        <Text style={styles.chassisText}>
          Chassis: {item.chassis_number}
        </Text>
      )}
      
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
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  
  // Item history modal state
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Load vehicles from API
  const loadVehicles = async () => {
    try {
      const response = await inventoryApi.getVehicles();
      setVehicles(response.data.data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  // Load parts from API
  const loadParts = async () => {
    try {
      const response = await inventoryApi.getParts();
      setParts(response.data.data || []);
    } catch (error) {
      console.error('Error loading parts:', error);
    }
  };

  // Load pending requests count
  const loadPendingCount = async () => {
    try {
      const response = await salesApi.getSalesOrders({ status: 'pending' });
      setPendingCount(response.data.data?.length || 0);
    } catch (error) {
      console.error('Error loading pending count:', error);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([loadVehicles(), loadParts(), loadPendingCount()]);
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

  // Combine inventory for display
  const inventory: DisplayItem[] = [
    ...vehicles.map(v => ({
      id: v.id,
      type: 'vehicle' as const,
      name: v.model,
      specifications: v.specifications || '',
      quantity: v.status === 'available' ? 1 : 0,
      unit_price: v.unit_price,
      status: v.status,
      chassis_number: v.chassis_number,
    })),
    ...parts.map(p => ({
      id: p.id,
      type: 'part' as const,
      name: p.name,
      specifications: p.specifications || '',
      quantity: p.quantity,
      unit_price: p.unit_price,
    })),
  ];

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.specifications.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getLowStockCount = () => {
    return parts.filter(part => part.quantity < part.min_stock_alert).length;
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
      sku: item.type === 'vehicle' ? item.chassis_number : 'Part',
      current_quantity: item.quantity,
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
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventory</Text>
        <Text style={styles.headerSubtitle}>
          {inventory.length} items • {getLowStockCount()} low stock
        </Text>
      </View>
      
      {/* Action Buttons - Admin only sees History and Pending */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.historyMainButton} onPress={navigateToHistoryReport}>
          <Text style={styles.historyMainButtonText}>📜 History Report</Text>
        </TouchableOpacity>
        
        {pendingCount > 0 && (
          <TouchableOpacity style={styles.pendingButton} onPress={navigateToPendingRequests}>
            <Text style={styles.pendingButtonText}>⚠️ {pendingCount} Pending Requests</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search by name or specifications..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      
      {/* Inventory List */}
      <FlatList
        data={filteredInventory}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={renderInventoryItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ef4444" />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No items found</Text>
          </View>
        }
      />

      {/* Item History Modal */}
      <ItemHistoryModal
        visible={historyModalVisible}
        onClose={() => {
          setHistoryModalVisible(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
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
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  historyMainButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  historyMainButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  pendingButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  pendingButtonText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '500',
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
