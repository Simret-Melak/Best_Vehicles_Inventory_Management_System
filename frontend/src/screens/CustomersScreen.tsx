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
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { customerApi } from '../services/api';

// Types
interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  address: string;
  created_at: string;
}

interface OrderItem {
  item_type: 'vehicle' | 'part';
  quantity: number;
  unit_price: number;
  subtotal: number;
  vehicle_model?: string;
  chassis_number?: string;
  specifications?: string;
  part_name?: string;
  part_specifications?: string;
}

interface Order {
  id: string;
  order_number: string;
  order_date: string;
  status: string;
  total_amount: number;
  notes: string;
  items: OrderItem[];
}

// Add Customer Modal
const AddCustomerModal = ({ visible, onClose, onSuccess }: any) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter customer name');
      return;
    }

    setLoading(true);
    try {
      await customerApi.createCustomer({
        full_name: fullName.trim(),
        phone: phone || null,
        email: email || null,
        address: address || null,
      });
      
      Alert.alert('Success', 'Customer added successfully!');
      onSuccess();
      onClose();
      setFullName('');
      setPhone('');
      setEmail('');
      setAddress('');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to add customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add Customer</Text>
          
          <Text style={styles.modalLabel}>Full Name *</Text>
          <TextInput
            style={styles.modalInput}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter full name"
            placeholderTextColor="#64748b"
          />
          
          <Text style={styles.modalLabel}>Phone Number</Text>
          <TextInput
            style={styles.modalInput}
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter phone number"
            placeholderTextColor="#64748b"
            keyboardType="phone-pad"
          />
          
          <Text style={styles.modalLabel}>Email</Text>
          <TextInput
            style={styles.modalInput}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter email address"
            placeholderTextColor="#64748b"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <Text style={styles.modalLabel}>Address</Text>
          <TextInput
            style={[styles.modalInput, styles.modalTextArea]}
            value={address}
            onChangeText={setAddress}
            placeholder="Enter address"
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={3}
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalSubmitButton, loading && styles.buttonDisabled]} 
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.modalSubmitButtonText}>
                {loading ? 'Adding...' : 'Add Customer'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Order History Modal
const OrderHistoryModal = ({ visible, onClose, customer, orders, loading }: any) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'confirmed': return '#22c55e';
      case 'completed': return '#3b82f6';
      case 'pending': return '#f97316';
      case 'cancelled': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  const OrderCard = ({ order }: { order: Order }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderNumber}>{order.order_number}</Text>
        <View style={[styles.orderStatusBadge, { backgroundColor: `${getStatusColor(order.status)}20` }]}>
          <Text style={[styles.orderStatusText, { color: getStatusColor(order.status) }]}>
            {order.status}
          </Text>
        </View>
      </View>
      
      <Text style={styles.orderDate}>{formatDate(order.order_date)}</Text>
      <Text style={styles.orderTotal}>Total: Br {order.total_amount.toLocaleString()}</Text>
      
      {order.notes ? (
        <Text style={styles.orderNotes}>📝 {order.notes}</Text>
      ) : null}
      
      <View style={styles.orderItemsContainer}>
        <Text style={styles.orderItemsTitle}>Items:</Text>
        {order.items.map((item: OrderItem, index: number) => (
          <View key={index} style={styles.orderItem}>
            <Text style={styles.orderItemType}>
              {item.item_type === 'vehicle' ? '🚛' : '🔧'} {item.item_type === 'vehicle' ? item.vehicle_model : item.part_name}
            </Text>
            <Text style={styles.orderItemDetails}>
              Qty: {item.quantity} × Br {item.unit_price.toLocaleString()} = Br {item.subtotal.toLocaleString()}
            </Text>
            {item.item_type === 'vehicle' && item.chassis_number && (
              <Text style={styles.orderItemChassis}>Chassis: {item.chassis_number}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.modalLarge]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{customer?.full_name}</Text>
              <Text style={styles.modalSubtitle}>Order History ({orders.length} orders)</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ef4444" />
            </View>
          ) : orders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No orders found</Text>
              <Text style={styles.emptySubtext}>This customer has no purchase history yet</Text>
            </View>
          ) : (
            <FlatList
              data={orders}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <OrderCard order={item} />}
              contentContainerStyle={styles.ordersList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

// Customer Card Component
const CustomerCard = ({ customer, onPress }: { customer: Customer; onPress: () => void }) => (
  <TouchableOpacity style={styles.customerCard} onPress={onPress}>
    <View style={styles.customerAvatar}>
      <Text style={styles.customerAvatarText}>{customer.full_name.charAt(0)}</Text>
    </View>
    <View style={styles.customerInfo}>
      <Text style={styles.customerName}>{customer.full_name}</Text>
      <Text style={styles.customerPhone}>📞 {customer.phone || 'No phone'}</Text>
      <Text style={styles.customerEmail}>✉️ {customer.email || 'No email'}</Text>
      <Text style={styles.customerSince}>Customer since: {new Date(customer.created_at).toLocaleDateString()}</Text>
    </View>
  </TouchableOpacity>
);

// Main Customers Screen
export default function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);

  const loadCustomers = async () => {
    try {
      const response = await customerApi.getCustomers();
      // Sort customers by created_at (latest first)
      const sortedCustomers = (response.data.data || []).sort((a: Customer, b: Customer) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setCustomers(sortedCustomers);
    } catch (error) {
      console.error('Error loading customers:', error);
      Alert.alert('Error', 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerOrders = async (customerId: string) => {
    setOrdersLoading(true);
    try {
      const response = await customerApi.getCustomerOrders(customerId);
      // Orders are already sorted by order_date descending from backend
      setCustomerOrders(response.data.data.orders || []);
    } catch (error) {
      console.error('Error loading customer orders:', error);
      Alert.alert('Error', 'Failed to load order history');
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCustomers();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCustomers();
    setRefreshing(false);
  };

  const handleCustomerPress = async (customer: Customer) => {
    setSelectedCustomer(customer);
    await loadCustomerOrders(customer.id);
    setHistoryModalVisible(true);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.includes(searchQuery) ||
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && customers.length === 0) {
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
        <Text style={styles.headerTitle}>Customers</Text>
        <Text style={styles.headerSubtitle}>
          {filteredCustomers.length} {filteredCustomers.length === 1 ? 'customer' : 'customers'}
        </Text>
      </View>
      
      {/* Action Bar */}
      <View style={styles.actionBar}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>��</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, phone or email..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => setAddModalVisible(true)}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>
      
      {/* Customers List - Latest First */}
      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CustomerCard customer={item} onPress={() => handleCustomerPress(item)} />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ef4444" />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No customers found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'Try a different search term' : 'Tap + Add to add your first customer'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity 
                style={styles.emptyAddButton} 
                onPress={() => setAddModalVisible(true)}
              >
                <Text style={styles.emptyAddButtonText}>+ Add Customer</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
      
      {/* Add Customer Modal */}
      <AddCustomerModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSuccess={loadCustomers}
      />
      
      {/* Order History Modal */}
      <OrderHistoryModal
        visible={historyModalVisible}
        onClose={() => {
          setHistoryModalVisible(false);
          setSelectedCustomer(null);
          setCustomerOrders([]);
        }}
        customer={selectedCustomer}
        orders={customerOrders}
        loading={ordersLoading}
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
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
  clearIcon: {
    fontSize: 14,
    color: '#64748b',
    padding: 4,
  },
  addButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  customerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  customerAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  customerPhone: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 2,
  },
  customerEmail: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  customerSince: {
    fontSize: 10,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  emptyAddButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  emptyAddButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  // Modal Styles
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
  modalLarge: {
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: 'bold',
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
  buttonDisabled: {
    opacity: 0.5,
  },
  // Order History Styles
  ordersList: {
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  orderStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  orderDate: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
    marginBottom: 8,
  },
  orderNotes: {
    fontSize: 12,
    color: '#fbbf24',
    marginBottom: 12,
  },
  orderItemsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  orderItemsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  orderItem: {
    marginBottom: 8,
    paddingLeft: 8,
  },
  orderItemType: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ffffff',
  },
  orderItemDetails: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  orderItemChassis: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#64748b',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
});
