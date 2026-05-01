import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { salesApi, paymentApi, customerApi, inventoryApi } from '../services/api';

// Types - Full request details
interface PendingRequest {
  id: string;
  order_number: string;
  customer_name: string;
  chassis_number: string;
  sales_type: string;
  reference_number: string;
  quantity: number;
  unit_price: number;
  deposit_bank: string;
  deposit_amount: number;
  deposit_status: string;
  notes: string;
  requested_by: string;
  created_date: string;
  payment_id?: string;
  order_status?: string;
  item_id?: string;
  item_type?: 'vehicle' | 'part';
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Request Card Component
const RequestCard = ({ 
  request, 
  onConfirm, 
  onReject, 
  isProcessing 
}: { 
  request: PendingRequest; 
  onConfirm: () => void; 
  onReject: () => void; 
  isProcessing: boolean;
}) => {
  const isDepositConfirmed = request.deposit_status === 'Confirmed';
  
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderNumber}>{request.order_number}</Text>
        <Text style={styles.timeText}>{formatDate(request.created_date)}</Text>
      </View>

      <View style={styles.detailsContainer}>
        <View style={styles.row}>
          <Text style={styles.label}>Customer name</Text>
          <Text style={styles.value}>{request.customer_name}</Text>
        </View>
        
        <View style={styles.row}>
          <Text style={styles.label}>Chassis no</Text>
          <Text style={styles.value}>{request.chassis_number}</Text>
        </View>
        
        <View style={styles.row}>
          <Text style={styles.label}>Sales type</Text>
          <Text style={styles.value}>{request.sales_type}</Text>
        </View>
        
        <View style={styles.row}>
          <Text style={styles.label}>Ck No</Text>
          <Text style={styles.value}>{request.reference_number}</Text>
        </View>
        
        <View style={styles.row}>
          <Text style={styles.label}>Quantity</Text>
          <Text style={styles.value}>{request.quantity}</Text>
        </View>
        
        <View style={styles.row}>
          <Text style={styles.label}>Unit price</Text>
          <Text style={styles.value}>Br {request.unit_price.toLocaleString()}</Text>
        </View>
        
        <View style={styles.row}>
          <Text style={styles.label}>Deposit bank</Text>
          <Text style={styles.value}>
            Total deposit Br {request.deposit_amount.toLocaleString()} at {request.deposit_bank}
          </Text>
        </View>
        
        <View style={styles.row}>
          <Text style={styles.label}>Deposit status</Text>
          <View style={[styles.statusBadge, isDepositConfirmed ? styles.statusConfirmed : styles.statusPending]}>
            <Text style={styles.statusText}>{request.deposit_status}</Text>
          </View>
        </View>
      </View>

      {request.notes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>Note:</Text>
          <Text style={styles.notesText}>{request.notes}</Text>
        </View>
      )}

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.rejectButton, isProcessing && styles.buttonDisabled]}
          onPress={onReject}
          disabled={isProcessing}
        >
          <Text style={styles.rejectButtonText}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmButton, isProcessing && styles.buttonDisabled]}
          onPress={onConfirm}
          disabled={isProcessing}
        >
          <Text style={styles.confirmButtonText}>Confirm Sale</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Empty State Component
const EmptyState = () => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyIcon}>⏰</Text>
    <Text style={styles.emptyTitle}>No pending requests</Text>
    <Text style={styles.emptySubtitle}>All caught up!</Text>
  </View>
);

// Main Pending Requests Screen (Admin)
export default function PendingRequestsScreen() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Load pending_admin orders (worker confirmed, waiting for admin)
  const loadRequests = async () => {
    try {
      setLoading(true);
      
      // Fetch orders with status 'pending_admin' (worker confirmed full payment)
      const ordersResponse = await salesApi.getSalesOrders({ status: 'pending_admin' });
      const orders = ordersResponse.data.data || [];
      
      const pendingRequests: PendingRequest[] = [];
      
      for (const order of orders) {
        const orderDetailsResponse = await salesApi.getSalesOrderById(order.id);
        const orderDetails = orderDetailsResponse.data.data;
        
        const paymentsResponse = await paymentApi.getOrderPaymentHistory(order.id);
        const payments = paymentsResponse.data.data;
        const confirmedPayments = payments?.payments?.confirmed || [];
        const totalPaid = confirmedPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
        
        const customerResponse = await customerApi.getCustomerById(order.customer_id);
        const customer = customerResponse.data.data;
        
        const firstItem = orderDetails.items?.[0];
        let chassisNumber = '';
        let salesType = '';
        let unitPrice = 0;
        let itemId = '';
        let itemType: 'vehicle' | 'part' = 'part';
        
        if (firstItem?.item_type === 'vehicle' && firstItem.vehicle) {
          chassisNumber = firstItem.vehicle.chassis_number;
          salesType = firstItem.vehicle.model;
          unitPrice = firstItem.vehicle.unit_price;
          itemId = firstItem.vehicle.id;
          itemType = 'vehicle';
        } else if (firstItem?.item_type === 'part' && firstItem.part) {
          chassisNumber = firstItem.part.part_number || '';
          salesType = firstItem.part.name;
          unitPrice = firstItem.part.unit_price;
          itemId = firstItem.part.id;
          itemType = 'part';
        }
        
        const latestPayment = confirmedPayments[confirmedPayments.length - 1];
        
        pendingRequests.push({
          id: order.id,
          order_number: order.order_number,
          customer_name: customer?.full_name || 'Unknown',
          chassis_number: chassisNumber,
          sales_type: salesType,
          reference_number: latestPayment?.reference_number || 'N/A',
          quantity: firstItem?.quantity || 1,
          unit_price: unitPrice,
          deposit_bank: latestPayment?.bank_name || 'N/A',
          deposit_amount: totalPaid,
          deposit_status: totalPaid >= order.total_amount ? 'Confirmed' : 'Pending',
          notes: order.notes || '',
          requested_by: orderDetails.confirmed_by || 'Worker',
          created_date: order.created_at,
          payment_id: latestPayment?.id,
          order_status: order.status,
          item_id: itemId,
          item_type: itemType,
        });
      }
      
      setRequests(pendingRequests);
    } catch (error) {
      console.error('Error loading pending requests:', error);
      Alert.alert('Error', 'Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const handleConfirm = async (requestId: string) => {
    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    setProcessingId(requestId);
    
    try {
      // Confirm any pending payments first
      if (request.payment_id) {
        await paymentApi.confirmDeposit(request.payment_id);
      }
      
      // Update order status to confirmed (this will also update inventory via backend trigger)
      await salesApi.updateOrderStatus(requestId, 'confirmed');
      
      // Remove from pending list
      setRequests(prev => prev.filter(r => r.id !== requestId));
      
      Alert.alert('Success', `Order ${request.order_number} confirmed successfully! Inventory updated.`);
    } catch (error: any) {
      console.error('Error confirming order:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to confirm order');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    setProcessingId(requestId);
    
    try {
      // Update order status to cancelled
      await salesApi.updateOrderStatus(requestId, 'cancelled');
      
      // Remove from pending list
      setRequests(prev => prev.filter(r => r.id !== requestId));
      
      Alert.alert('Rejected', `Order ${request.order_number} has been rejected.`);
    } catch (error: any) {
      console.error('Error rejecting order:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to reject order');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerIcon}>⚠️</Text>
          <Text style={styles.headerTitle}>Pending Approvals</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          {requests.length} pending sale {requests.length === 1 ? 'request' : 'requests'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ef4444" />
        </View>
      ) : requests.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RequestCard
              request={item}
              onConfirm={() => handleConfirm(item.id)}
              onReject={() => handleReject(item.id)}
              isProcessing={processingId === item.id}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ef4444" />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerIcon: {
    fontSize: 28,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  timeText: {
    fontSize: 11,
    color: '#64748b',
  },
  detailsContainer: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: '#94a3b8',
    flex: 1,
  },
  value: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusConfirmed: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  statusPending: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
  },
  statusText: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '600',
  },
  notesContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  notesLabel: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 2,
  },
  notesText: {
    fontSize: 12,
    color: '#fbbf24',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  rejectButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
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
  },
});
