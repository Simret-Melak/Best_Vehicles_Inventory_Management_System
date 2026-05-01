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
  Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AddStockModal from '../components/AddStockModal';
import RequestSaleModal from '../components/RequestSaleModal';
import { inventoryApi, customerApi, salesApi, paymentApi } from '../services/api';

// Types
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

interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  address: string;
  created_at: string;
}

interface WorkerRequest {
  id: string;
  order_number: string;
  customer_name: string;
  sales_type: string;
  quantity: number;
  total_amount: number;
  status: string;
  payment_status: string;
  deposit_amount: number;
  notes: string;
  created_date: string;
}

// My Request Card Component (Updated with new statuses)
const MyRequestCard = ({ 
  request, 
  onAddPayment,
  onConfirmFullPayment,
  onViewDetails,
  isProcessing 
}: { 
  request: WorkerRequest; 
  onAddPayment: () => void;
  onConfirmFullPayment: () => void;
  onViewDetails: () => void;
  isProcessing: boolean;
}) => {
  const isDepositComplete = request.deposit_amount >= request.total_amount;
  const isDraft = request.status === 'draft';
  const isPending = request.status === 'pending';
  const isPendingAdmin = request.status === 'pending_admin';
  const isConfirmed = request.status === 'confirmed';
  const isCancelled = request.status === 'cancelled';
  
  const getStatusColor = () => {
    if (isConfirmed) return '#22c55e';
    if (isPendingAdmin) return '#3b82f6';
    if (isPending) return '#f97316';
    if (isDraft) return '#64748b';
    if (isCancelled) return '#ef4444';
    return '#94a3b8';
  };
  
  const getStatusText = () => {
    if (isConfirmed) return 'Confirmed';
    if (isPendingAdmin) return 'Pending Admin';
    if (isPending) return 'Pending Payment';
    if (isDraft) return 'Draft - No Payment';
    if (isCancelled) return 'Cancelled';
    return request.status;
  };
  
  return (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <Text style={styles.orderNumber}>{request.order_number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor()}20` }]}>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>{getStatusText()}</Text>
        </View>
      </View>
      
      <Text style={styles.customerNameText}>{request.customer_name}</Text>
      <Text style={styles.requestItem}>{request.sales_type} x{request.quantity}</Text>
      
      <View style={styles.requestDetails}>
        <Text style={styles.amount}>Br {request.total_amount.toLocaleString()}</Text>
        <Text style={styles.paidAmount}>
          Paid: Br {request.deposit_amount.toLocaleString()}
          {!isDepositComplete && ` (Due: Br {(request.total_amount - request.deposit_amount).toLocaleString()})`}
        </Text>
      </View>
      
      {request.notes ? (
        <Text style={styles.requestNotes}>📝 {request.notes}</Text>
      ) : null}
      
      <View style={styles.requestActions}>
        <TouchableOpacity style={styles.viewButton} onPress={onViewDetails}>
          <Text style={styles.viewButtonText}>View Details</Text>
        </TouchableOpacity>
        
        {/* Show Add Payment button for pending orders that are not fully paid */}
        {(isPending || isDraft) && !isDepositComplete && (
          <TouchableOpacity 
            style={styles.addPaymentButton} 
            onPress={onAddPayment}
            disabled={isProcessing}
          >
            <Text style={styles.addPaymentButtonText}>+ Add Payment</Text>
          </TouchableOpacity>
        )}
        
        {/* Show Confirm button when fully paid and not yet sent to admin */}
        {(isPending || isDraft) && isDepositComplete && !isPendingAdmin && (
          <TouchableOpacity 
            style={styles.confirmButton} 
            onPress={onConfirmFullPayment}
            disabled={isProcessing}
          >
            <Text style={styles.confirmButtonText}>✓ Confirm & Send to Admin</Text>
          </TouchableOpacity>
        )}
        
        {/* Show waiting badge when pending admin */}
        {isPendingAdmin && (
          <View style={styles.pendingAdminBadge}>
            <Text style={styles.pendingAdminText}>⏳ Waiting for Admin Approval</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// Add Payment Modal
const AddPaymentModal = ({ visible, onClose, order, onSuccess }: any) => {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'check' | 'bank_deposit'>('transfer');
  const [bankName, setBankName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [fullPayment, setFullPayment] = useState(true);

  const totalAmount = order?.total_amount || 0;
  const remainingAmount = totalAmount - (order?.deposit_amount || 0);

  useEffect(() => {
    if (fullPayment && remainingAmount > 0) {
      setAmount(remainingAmount.toString());
    }
  }, [fullPayment, remainingAmount]);

  const handleSubmit = async () => {
    const paymentAmount = parseFloat(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    
    if (paymentAmount > remainingAmount) {
      Alert.alert('Error', `Amount cannot exceed remaining balance of Br ${remainingAmount.toLocaleString()}`);
      return;
    }
    
    if (paymentMethod !== 'cash' && !bankName.trim()) {
      Alert.alert('Error', 'Please enter bank name');
      return;
    }
    
    if ((paymentMethod === 'transfer' || paymentMethod === 'check') && !referenceNumber.trim()) {
      Alert.alert('Error', 'Please enter reference/check number');
      return;
    }

    setLoading(true);
    
    try {
      await paymentApi.recordDeposit({
        sales_order_id: order.id,
        payment_method: paymentMethod,
        bank_name: bankName,
        reference_number: referenceNumber,
        amount: paymentAmount,
      });
      
      Alert.alert('Success', 'Payment recorded! Order updated.');
      onSuccess();
      onClose();
      setAmount('');
      setBankName('');
      setReferenceNumber('');
      setFullPayment(true);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add Payment</Text>
          
          <View style={styles.orderInfoContainer}>
            <Text style={styles.orderInfoText}>Order: {order?.order_number}</Text>
            <Text style={styles.orderInfoText}>Total: Br {totalAmount.toLocaleString()}</Text>
            <Text style={styles.orderInfoText}>Paid: Br {(order?.deposit_amount || 0).toLocaleString()}</Text>
            <Text style={styles.orderInfoTextHighlight}>Remaining: Br {remainingAmount.toLocaleString()}</Text>
          </View>
          
          <Text style={styles.modalLabel}>Payment Method</Text>
          <View style={styles.paymentMethodRow}>
            {(['cash', 'transfer', 'check', 'bank_deposit'] as const).map((method) => (
              <TouchableOpacity
                key={method}
                style={[styles.paymentChip, paymentMethod === method && styles.paymentChipSelected]}
                onPress={() => setPaymentMethod(method)}
              >
                <Text style={[styles.paymentChipText, paymentMethod === method && styles.paymentChipTextSelected]}>
                  {method === 'cash' ? '💰 Cash' : method === 'transfer' ? '🏦 Transfer' : method === 'check' ? '📝 Check' : '🏛️ Deposit'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {paymentMethod !== 'cash' && (
            <>
              <TextInput
                style={styles.modalInput}
                placeholder="Bank Name"
                placeholderTextColor="#64748b"
                value={bankName}
                onChangeText={setBankName}
              />
              <TextInput
                style={styles.modalInput}
                placeholder={paymentMethod === 'check' ? "Check Number" : "Reference Number"}
                placeholderTextColor="#64748b"
                value={referenceNumber}
                onChangeText={setReferenceNumber}
              />
            </>
          )}
          
          <View style={styles.depositRow}>
            <View style={styles.depositOptions}>
              <TouchableOpacity
                style={[styles.depositOption, fullPayment && styles.depositOptionSelected]}
                onPress={() => setFullPayment(true)}
              >
                <Text style={[styles.depositOptionText, fullPayment && styles.depositOptionTextSelected]}>
                  Full Payment
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.depositOption, !fullPayment && styles.depositOptionSelected]}
                onPress={() => setFullPayment(false)}
              >
                <Text style={[styles.depositOptionText, !fullPayment && styles.depositOptionTextSelected]}>
                  Partial
                </Text>
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Amount"
              placeholderTextColor="#64748b"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
          </View>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSubmitButton, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalSubmitButtonText}>Submit Payment</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Inventory Card Component (Updated to show available vs reserved)
const InventoryCard = ({ 
  item, 
  onAddStock, 
  onRequestSale, 
  onViewHistory 
}: { 
  item: InventoryItem; 
  onAddStock: () => void; 
  onRequestSale: () => void; 
  onViewHistory: () => void;
}) => {
  const isVehicle = !!item.chassis_number;
  const isSoldOut = isVehicle && item.status === 'sold';
  const isReserved = isVehicle && item.status === 'reserved';
  
  // For parts, calculate available quantity (total - reserved)
  const availableQty = !isVehicle ? (item.available_quantity !== undefined ? item.available_quantity : item.quantity) : (item.status === 'available' ? 1 : 0);
  const reservedQty = !isVehicle ? (item.reserved_quantity || 0) : (isReserved ? 1 : 0);
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
          <Text style={[
            styles.quantityNumber,
            isLowStock && styles.lowStockQuantity,
            isSoldOut && styles.soldOutQuantity
          ]}>
            {availableQty}
          </Text>
          <Text style={styles.quantityUnit}>
            {isVehicle ? 'available' : 'available'}
          </Text>
        </View>
      </View>
      
      {hasReserved && !isSoldOut && (
        <View style={styles.reservedContainer}>
          <Text style={styles.reservedText}>🔒 {reservedQty} reserved</Text>
        </View>
      )}
      
      <Text style={styles.itemDescription} numberOfLines={2}>
        {item.specifications}
      </Text>
      
      {isVehicle && item.chassis_number && (
        <Text style={styles.chassisText}>
          Chassis: {item.chassis_number}
        </Text>
      )}
      
      {!isVehicle && item.part_number && (
        <Text style={styles.chassisText}>
          Part #: {item.part_number}
        </Text>
      )}
      
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.addStockButton} onPress={onAddStock}>
          <Text style={styles.addStockButtonText}>+ Add Stock</Text>
        </TouchableOpacity>
        {!isSoldOut && !isReserved && (
          <TouchableOpacity style={styles.requestSaleButton} onPress={onRequestSale}>
            <Text style={styles.requestSaleButtonText}>Request Sale</Text>
          </TouchableOpacity>
        )}
        {isReserved && (
          <View style={styles.reservedBadge}>
            <Text style={styles.reservedBadgeText}>Reserved</Text>
          </View>
        )}
        <TouchableOpacity style={styles.historyButton} onPress={onViewHistory}>
          <Text style={styles.historyButtonText}>📂 History</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Main Worker Dashboard Screen
export default function WorkerDashboardScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<'inventory' | 'requests'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [myRequests, setMyRequests] = useState<WorkerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addStockModalVisible, setAddStockModalVisible] = useState(false);
  const [requestSaleModalVisible, setRequestSaleModalVisible] = useState(false);
  const [addPaymentModalVisible, setAddPaymentModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Load inventory from API (with available quantities)
  const loadInventory = async () => {
    try {
      // Load vehicles with status
      const vehiclesRes = await inventoryApi.getVehicles();
      const vehicles = vehiclesRes.data.data.map((v: any) => ({
        id: v.id,
        name: v.model,
        specifications: v.specifications || '',
        quantity: v.status === 'available' ? 1 : 0,
        unit_price: v.unit_price,
        chassis_number: v.chassis_number,
        status: v.status,
      }));
      
      // Load parts with available quantity calculation
      const partsRes = await inventoryApi.getParts();
      const parts = partsRes.data.data.map((p: any) => ({
        id: p.id,
        name: p.name,
        specifications: p.specifications || '',
        quantity: p.quantity,
        unit_price: p.unit_price,
        part_number: p.part_number,
        available_quantity: p.quantity - (p.reserved_quantity || 0),
        reserved_quantity: p.reserved_quantity || 0,
      }));
      
      setInventory([...vehicles, ...parts]);
    } catch (error) {
      console.error('Error loading inventory:', error);
      Alert.alert('Error', 'Failed to load inventory');
    }
  };

  // Load worker's own requests (all statuses)
  const loadMyRequests = async () => {
    try {
      const response = await salesApi.getSalesOrders();
      const orders = response.data.data || [];
      
      // Show all orders that are not completed or cancelled (draft, pending, pending_admin, confirmed)
      const relevantOrders = orders.filter((order: any) => 
        ['draft', 'pending', 'pending_admin', 'confirmed'].includes(order.status)
      );
      
      const requests: WorkerRequest[] = [];
      
      for (const order of relevantOrders) {
        const orderDetails = await salesApi.getSalesOrderById(order.id);
        const details = orderDetails.data.data;
        
        const paymentsResponse = await paymentApi.getOrderPaymentHistory(order.id);
        const payments = paymentsResponse.data.data;
        const totalPaid = payments?.summary?.total_confirmed || 0;
        
        const firstItem = details.items?.[0];
        const salesType = firstItem?.item_type === 'vehicle' ? firstItem.model : firstItem?.name;
        
        requests.push({
          id: order.id,
          order_number: order.order_number,
          customer_name: details.customer?.full_name || 'Unknown',
          sales_type: salesType || 'Item',
          quantity: firstItem?.quantity || 1,
          total_amount: order.total_amount,
          status: order.status,
          payment_status: totalPaid >= order.total_amount ? 'paid' : 'partial',
          deposit_amount: totalPaid,
          notes: order.notes || '',
          created_date: order.created_at,
        });
      }
      
      // Sort by created date (newest first)
      requests.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
      
      setMyRequests(requests);
    } catch (error) {
      console.error('Error loading my requests:', error);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([loadInventory(), loadMyRequests()]);
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

  const handleAddPayment = (order: WorkerRequest) => {
    setSelectedOrder(order);
    setAddPaymentModalVisible(true);
  };

  const handlePaymentSuccess = () => {
    loadMyRequests();
    loadInventory(); // Refresh inventory to update reserved quantities
  };

  const handleConfirmFullPayment = async (order: WorkerRequest) => {
    setProcessingId(order.id);
    try {
      // Call API to send to admin
      await salesApi.updateOrderStatus(order.id, 'pending_admin');
      Alert.alert('Success', 'Order sent to admin for final approval!');
      loadMyRequests();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to confirm payment');
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewOrderDetails = (order: WorkerRequest) => {
    Alert.alert('Order Details', `Order ${order.order_number}\nCustomer: ${order.customer_name}\nTotal: Br ${order.total_amount.toLocaleString()}\nPaid: Br ${order.deposit_amount.toLocaleString()}\nStatus: ${order.status}`);
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
    loadMyRequests();
  };

  const navigateToHistory = () => {
    navigation.navigate('HistoryReport' as never);
  };

  const navigateToCustomers = () => {
    navigation.navigate('Customers' as never);
  };

  const determineItemType = (item: InventoryItem): 'vehicle' | 'part' => {
    return item.chassis_number ? 'vehicle' : 'part';
  };

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.specifications.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getLowStockCount = () => {
    return inventory.filter(item => !item.chassis_number && (item.available_quantity || item.quantity) < 5).length;
  };

  const renderInventoryItem = ({ item }: { item: InventoryItem }) => (
    <InventoryCard
      item={item}
      onAddStock={() => setAddStockModalVisible(true)}
      onRequestSale={() => handleRequestSale(item)}
      onViewHistory={navigateToHistory}
    />
  );

  const renderRequestItem = ({ item }: { item: WorkerRequest }) => (
    <MyRequestCard
      request={item}
      onAddPayment={() => handleAddPayment(item)}
      onConfirmFullPayment={() => handleConfirmFullPayment(item)}
      onViewDetails={() => handleViewOrderDetails(item)}
      isProcessing={processingId === item.id}
    />
  );

  if (loading && inventory.length === 0 && myRequests.length === 0) {
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
        <Text style={styles.headerTitle}>
          {activeTab === 'inventory' ? 'Inventory' : 'My Requests'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {activeTab === 'inventory' 
            ? `${filteredInventory.length} items • ${getLowStockCount()} low stock`
            : `${myRequests.length} ${myRequests.length === 1 ? 'request' : 'requests'}`}
        </Text>
      </View>
      
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'inventory' && styles.tabActive]}
          onPress={() => setActiveTab('inventory')}
        >
          <Text style={[styles.tabText, activeTab === 'inventory' && styles.tabTextActive]}>📦 Inventory</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>📋 My Requests</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, styles.customersTab]}
          onPress={navigateToCustomers}
        >
          <Text style={styles.tabText}>👥 Customers</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.actionBar}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={activeTab === 'inventory' ? "Search inventory..." : "Search requests..."}
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        
        {activeTab === 'inventory' && (
          <TouchableOpacity style={styles.addStockTopButton} onPress={() => setAddStockModalVisible(true)}>
            <Text style={styles.addStockTopButtonText}>+ Add Stock</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={styles.historyHeaderButton} onPress={navigateToHistory}>
          <Text style={styles.historyHeaderButtonText}>📜 History</Text>
        </TouchableOpacity>
      </View>
      
      {activeTab === 'inventory' ? (
        <FlatList
          data={filteredInventory}
          keyExtractor={(item) => `${item.id}-${item.chassis_number || item.part_number}`}
          renderItem={renderInventoryItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ef4444" />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No items found</Text></View>}
        />
      ) : (
        <FlatList
          data={myRequests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequestItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ef4444" />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No requests</Text>
              <Text style={styles.emptySubtext}>Create a sale request from the Inventory tab</Text>
            </View>
          }
        />
      )}
      
      <AddStockModal
        visible={addStockModalVisible}
        onClose={() => setAddStockModalVisible(false)}
        vehicles={inventory.filter(item => item.chassis_number).map(item => ({
          id: item.id,
          model: item.name,
          chassis_number: item.chassis_number!,
          specifications: item.specifications,
          status: 'available' as const,
          unit_price: item.unit_price,
        }))}
        parts={inventory.filter(item => !item.chassis_number).map(item => ({
          id: item.id,
          name: item.name,
          specifications: item.specifications,
          quantity: item.quantity,
          unit_price: item.unit_price,
          min_stock_alert: 5,
        }))}
        onSuccess={handleAddStockSuccess}
      />
      
      <RequestSaleModal
        visible={requestSaleModalVisible}
        onClose={() => {
          setRequestSaleModalVisible(false);
          setSelectedItem(null);
        }}
        item={selectedItem ? {
          id: selectedItem.id,
          name: selectedItem.name,
          specifications: selectedItem.specifications,
          quantity: selectedItem.quantity,
          unit_price: selectedItem.unit_price,
          ...(selectedItem.chassis_number && { chassis_number: selectedItem.chassis_number }),
          ...(selectedItem.part_number && { part_number: selectedItem.part_number }),
        } : null}
        itemType={selectedItem ? determineItemType(selectedItem) : 'part'}
        customers={[]}
        onSuccess={handleRequestSaleSuccess}
      />
      
      <AddPaymentModal
        visible={addPaymentModalVisible}
        onClose={() => {
          setAddPaymentModalVisible(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
        onSuccess={handlePaymentSuccess}
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
  customersTab: {
    paddingVertical: 12,
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
  requestCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  customerNameText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  requestItem: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 8,
  },
  requestDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  paidAmount: {
    fontSize: 12,
    color: '#94a3b8',
  },
  requestNotes: {
    fontSize: 12,
    color: '#fbbf24',
    marginBottom: 12,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  viewButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  addPaymentButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  addPaymentButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  pendingAdminBadge: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  pendingAdminText: {
    color: '#ffffff',
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
  emptySubtext: {
    color: '#64748b',
    fontSize: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSubmitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  orderInfoContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  orderInfoText: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  orderInfoTextHighlight: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  paymentChip: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  paymentChipSelected: {
    backgroundColor: '#ef4444',
  },
  paymentChipText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  paymentChipTextSelected: {
    color: '#ffffff',
  },
  depositRow: {
    marginTop: 8,
  },
  depositOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  depositOption: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  depositOptionSelected: {
    backgroundColor: '#ef4444',
  },
  depositOptionText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  depositOptionTextSelected: {
    color: '#ffffff',
  },
});
