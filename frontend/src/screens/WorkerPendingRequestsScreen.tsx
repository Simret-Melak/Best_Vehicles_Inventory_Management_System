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
import { salesApi, paymentApi } from '../services/api';

interface WorkerRequest {
  id: string;
  order_number: string;
  customer_name: string;
  sales_type: string;
  quantity: number;
  total_amount: number;
  status: string;
  deposit_amount: number;
  notes: string;
  created_date: string;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true 
  });
};

const RequestCard = ({ 
  request, 
  onConfirmFullPayment,
  onAddPayment,
  isProcessing 
}: { 
  request: WorkerRequest; 
  onConfirmFullPayment: () => void;
  onAddPayment: () => void;
  isProcessing: boolean;
}) => {
  const isDepositComplete = request.deposit_amount >= request.total_amount;
  const isPendingAdmin = request.status === 'pending_admin';
  const isPending = request.status === 'pending';
  const isDraft = request.status === 'draft';
  
  const getStatusColor = () => {
    if (isPendingAdmin) return '#3b82f6';
    if (isPending && isDepositComplete) return '#22c55e';
    if (isPending && !isDepositComplete) return '#f97316';
    if (isDraft) return '#64748b';
    return '#94a3b8';
  };
  
  const getStatusText = () => {
    if (isPendingAdmin) return 'Awaiting Admin';
    if (isPending && isDepositComplete) return 'Ready for Admin';
    if (isPending && !isDepositComplete) return 'Partial Payment';
    if (isDraft) return 'Draft';
    return request.status;
  };
  
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderNumber}>{request.order_number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor()}20` }]}>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>{getStatusText()}</Text>
        </View>
      </View>
      
      <Text style={styles.customerName}>{request.customer_name}</Text>
      <Text style={styles.itemName}>{request.sales_type} x{request.quantity}</Text>
      
      <View style={styles.paymentInfo}>
        <Text style={styles.totalAmount}>Total: Br {request.total_amount.toLocaleString()}</Text>
        <Text style={styles.paidAmount}>Paid: Br {request.deposit_amount.toLocaleString()}</Text>
        {!isDepositComplete && (
          <Text style={styles.remainingAmount}>
            Remaining: Br {(request.total_amount - request.deposit_amount).toLocaleString()}
          </Text>
        )}
      </View>
      
      {request.notes ? (
        <Text style={styles.notes}>�� {request.notes}</Text>
      ) : null}
      
      <View style={styles.actions}>
        {isPending && !isDepositComplete && (
          <TouchableOpacity 
            style={styles.addPaymentButton} 
            onPress={onAddPayment}
            disabled={isProcessing}
          >
            <Text style={styles.addPaymentButtonText}>+ Add Payment</Text>
          </TouchableOpacity>
        )}
        
        {isPending && isDepositComplete && !isPendingAdmin && (
          <TouchableOpacity 
            style={styles.confirmButton} 
            onPress={onConfirmFullPayment}
            disabled={isProcessing}
          >
            <Text style={styles.confirmButtonText}>✓ Confirm & Send to Admin</Text>
          </TouchableOpacity>
        )}
        
        {isPendingAdmin && (
          <View style={styles.pendingAdminBadge}>
            <Text style={styles.pendingAdminText}>⏳ Waiting for Admin Approval</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default function WorkerPendingRequestsScreen() {
  const [requests, setRequests] = useState<WorkerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadRequests = async () => {
    try {
      const response = await salesApi.getSalesOrders();
      const orders = response.data.data || [];
      
      // Filter orders created by this worker (in production, filter by worker_id)
      const workerOrders = orders.filter((order: any) => 
        ['draft', 'pending', 'pending_admin'].includes(order.status)
      );
      
      const requestsList: WorkerRequest[] = [];
      
      for (const order of workerOrders) {
        const orderDetails = await salesApi.getSalesOrderById(order.id);
        const details = orderDetails.data.data;
        
        const paymentsResponse = await paymentApi.getOrderPaymentHistory(order.id);
        const payments = paymentsResponse.data.data;
        const totalPaid = payments?.summary?.total_confirmed || 0;
        
        const firstItem = details.items?.[0];
        const salesType = firstItem?.item_type === 'vehicle' ? firstItem.model : firstItem?.name;
        
        requestsList.push({
          id: order.id,
          order_number: order.order_number,
          customer_name: details.customer?.full_name || 'Unknown',
          sales_type: salesType || 'Item',
          quantity: firstItem?.quantity || 1,
          total_amount: order.total_amount,
          status: order.status,
          deposit_amount: totalPaid,
          notes: order.notes || '',
          created_date: order.created_at,
        });
      }
      
      setRequests(requestsList);
    } catch (error) {
      console.error('Error loading requests:', error);
      Alert.alert('Error', 'Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  };

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

  const handleConfirmFullPayment = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await salesApi.updateOrderStatus(requestId, 'pending_admin');
      Alert.alert('Success', 'Order sent to admin for final approval!');
      loadRequests();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to confirm payment');
    } finally {
      setProcessingId(null);
    }
  };

  const handleAddPayment = (request: WorkerRequest) => {
    // This will be handled by the AddPaymentModal (reuse existing one)
    Alert.alert('Add Payment', `Add payment for order ${request.order_number}`);
  };

  if (loading && requests.length === 0) {
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
        <View style={styles.headerRow}>
          <Text style={styles.headerIcon}>📋</Text>
          <Text style={styles.headerTitle}>My Sale Requests</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          {requests.length} {requests.length === 1 ? 'request' : 'requests'}
        </Text>
      </View>

      {requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>No pending requests</Text>
          <Text style={styles.emptySubtitle}>Create a sale request from the Inventory tab</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RequestCard
              request={item}
              onConfirmFullPayment={() => handleConfirmFullPayment(item.id)}
              onAddPayment={() => handleAddPayment(item)}
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
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
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 8,
  },
  paymentInfo: {
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
    marginBottom: 2,
  },
  paidAmount: {
    fontSize: 12,
    color: '#94a3b8',
  },
  remainingAmount: {
    fontSize: 12,
    color: '#fbbf24',
  },
  notes: {
    fontSize: 12,
    color: '#fbbf24',
    marginBottom: 12,
  },
  actions: {
    marginTop: 8,
  },
  addPaymentButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  addPaymentButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  pendingAdminBadge: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    borderRadius: 8,
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
    textAlign: 'center',
  },
});
