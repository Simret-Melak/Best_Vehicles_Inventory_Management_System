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

const CustomerFormModal = ({
  visible,
  onClose,
  onSuccess,
  customer,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customer: Customer | null;
}) => {
  const isEditing = !!customer;

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setFullName(customer?.full_name || '');
      setPhone(customer?.phone || '');
      setEmail(customer?.email || '');
      setAddress(customer?.address || '');
      setLoading(false);
    }
  }, [visible, customer]);

  const resetForm = () => {
    setFullName('');
    setPhone('');
    setEmail('');
    setAddress('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter customer name');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
      };

      if (isEditing && customer) {
        await customerApi.updateCustomer(customer.id, payload);
        Alert.alert('Success', 'Customer updated successfully!');
      } else {
        await customerApi.createCustomer(payload);
        Alert.alert('Success', 'Customer added successfully!');
      }

      await onSuccess();
      resetForm();
      onClose();
    } catch (error: any) {
      console.error('Customer save error:', {
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
      });

      Alert.alert(
        'Error',
        error.response?.data?.error ||
          `Failed to ${isEditing ? 'update' : 'add'} customer`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>
                {isEditing ? 'Edit Customer' : 'Add Customer'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {isEditing
                  ? 'Update customer name, phone, email, or address'
                  : 'Create a new customer profile'}
              </Text>
            </View>

            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.modalLabel}>Full Name *</Text>
            <TextInput
              style={styles.modalInput}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter full name"
              placeholderTextColor="#64748b"
              editable={!loading}
            />

            <Text style={styles.modalLabel}>Phone Number</Text>
            <TextInput
              style={styles.modalInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter phone number"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
              editable={!loading}
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
              autoCorrect={false}
              editable={!loading}
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
              editable={!loading}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={handleClose}
                disabled={loading}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSubmitButton,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>
                    {isEditing ? 'Save Changes' : 'Add Customer'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const OrderHistoryModal = ({
  visible,
  onClose,
  customer,
  orders,
  loading,
}: any) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '#22c55e';
      case 'completed':
        return '#3b82f6';
      case 'pending':
      case 'pending_admin':
        return '#f97316';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#94a3b8';
    }
  };

  const OrderCard = ({ order }: { order: Order }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderNumber}>{order.order_number}</Text>

        <View
          style={[
            styles.orderStatusBadge,
            { backgroundColor: `${getStatusColor(order.status)}20` },
          ]}
        >
          <Text
            style={[
              styles.orderStatusText,
              { color: getStatusColor(order.status) },
            ]}
          >
            {order.status}
          </Text>
        </View>
      </View>

      <Text style={styles.orderDate}>{formatDate(order.order_date)}</Text>

      <Text style={styles.orderTotal}>
        Total: Br {Number(order.total_amount || 0).toLocaleString()}
      </Text>

      {order.notes ? (
        <Text style={styles.orderNotes}>📝 {order.notes}</Text>
      ) : null}

      <View style={styles.orderItemsContainer}>
        <Text style={styles.orderItemsTitle}>Items:</Text>

        {order.items.map((item: OrderItem, index: number) => (
          <View key={index} style={styles.orderItem}>
            <Text style={styles.orderItemType}>
              {item.item_type === 'vehicle' ? '🚛' : '🔧'}{' '}
              {item.item_type === 'vehicle'
                ? item.vehicle_model
                : item.part_name}
            </Text>

            <Text style={styles.orderItemDetails}>
              Qty: {item.quantity} × Br{' '}
              {Number(item.unit_price || 0).toLocaleString()} = Br{' '}
              {Number(item.subtotal || 0).toLocaleString()}
            </Text>

            {item.item_type === 'vehicle' && item.chassis_number ? (
              <Text style={styles.orderItemChassis}>
                Chassis: {item.chassis_number}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.modalLarge]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>
                {customer?.full_name || 'Customer'}
              </Text>

              <Text style={styles.modalSubtitle}>
                Order History ({orders.length} orders)
              </Text>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.orderLoadingContainer}>
              <ActivityIndicator size="large" color="#ef4444" />
            </View>
          ) : orders.length === 0 ? (
            <View style={styles.orderEmptyContainer}>
              <Text style={styles.orderEmptyIcon}>📭</Text>
              <Text style={styles.orderEmptyText}>No orders found</Text>
              <Text style={styles.orderEmptySubtext}>
                This customer has no purchase history yet
              </Text>
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

const CustomerCard = ({
  customer,
  onViewOrders,
  onEdit,
}: {
  customer: Customer;
  onViewOrders: () => void;
  onEdit: () => void;
}) => (
  <View style={styles.customerCard}>
    <View style={styles.customerAvatar}>
      <Text style={styles.customerAvatarText}>
        {customer.full_name.charAt(0).toUpperCase()}
      </Text>
    </View>

    <View style={styles.customerInfo}>
      <Text style={styles.customerName}>{customer.full_name}</Text>
      <Text style={styles.customerPhone}>
        📞 {customer.phone || 'No phone'}
      </Text>
      <Text style={styles.customerEmail}>
        ✉️ {customer.email || 'No email'}
      </Text>

      {customer.address ? (
        <Text style={styles.customerAddress} numberOfLines={1}>
          📍 {customer.address}
        </Text>
      ) : null}

      <Text style={styles.customerSince}>
        Customer since: {new Date(customer.created_at).toLocaleDateString()}
      </Text>

      <View style={styles.customerActions}>
        <TouchableOpacity style={styles.viewOrdersButton} onPress={onViewOrders}>
          <Text style={styles.viewOrdersButtonText}>View Orders</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.editCustomerButton} onPress={onEdit}>
          <Text style={styles.editCustomerButtonText}>✏️ Edit</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [customerFormVisible, setCustomerFormVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);

  const loadCustomers = async () => {
    try {
      const response = await customerApi.getCustomers();

      const sortedCustomers = (response.data.data || []).sort(
        (a: Customer, b: Customer) =>
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

  const openAddCustomer = () => {
    setEditingCustomer(null);
    setCustomerFormVisible(true);
  };

  const openEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerFormVisible(true);
  };

  const closeCustomerForm = () => {
    setCustomerFormVisible(false);
    setEditingCustomer(null);
  };

  const handleCustomerPress = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setHistoryModalVisible(true);
    await loadCustomerOrders(customer.id);
  };

  const filteredCustomers = customers.filter((customer) => {
    const query = searchQuery.toLowerCase().trim();

    if (!query) return true;

    return (
      customer.full_name.toLowerCase().includes(query) ||
      customer.phone?.includes(searchQuery) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.address?.toLowerCase().includes(query)
    );
  });

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

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Customers</Text>
        <Text style={styles.headerSubtitle}>
          {filteredCustomers.length}{' '}
          {filteredCustomers.length === 1 ? 'customer' : 'customers'}
        </Text>
      </View>

      <View style={styles.actionBar}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, phone, email, or address..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {searchQuery !== '' ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity style={styles.addButton} onPress={openAddCustomer}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CustomerCard
            customer={item}
            onViewOrders={() => handleCustomerPress(item)}
            onEdit={() => openEditCustomer(item)}
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
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No customers found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try a different search term'
                : 'Tap + Add to add your first customer'}
            </Text>

            {!searchQuery ? (
              <TouchableOpacity
                style={styles.emptyAddButton}
                onPress={openAddCustomer}
              >
                <Text style={styles.emptyAddButtonText}>+ Add Customer</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />

      <CustomerFormModal
        visible={customerFormVisible}
        onClose={closeCustomerForm}
        onSuccess={loadCustomers}
        customer={editingCustomer}
      />

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
    alignItems: 'flex-start',
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
  customerAddress: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  customerSince: {
    fontSize: 10,
    color: '#64748b',
  },
  customerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  viewOrdersButton: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 7,
  },
  viewOrdersButtonText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '700',
  },
  editCustomerButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 7,
  },
  editCustomerButtonText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '700',
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
  orderEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  orderEmptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  orderEmptyText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  orderEmptySubtext: {
    fontSize: 12,
    color: '#64748b',
  },
  orderLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
});