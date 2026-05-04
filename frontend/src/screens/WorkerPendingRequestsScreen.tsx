import React, { useState, useCallback, useEffect } from 'react';
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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { salesApi, paymentApi } from '../services/api';

type PaymentMethod = 'cash' | 'transfer' | 'check' | 'bank_deposit';

interface WorkerRequest {
  id: string;
  order_number: string;
  customer_name: string;
  sales_type: string;
  quantity: number;
  total_amount: number;
  status: string;
  confirmed_amount: number;
  pending_amount: number;
  submitted_amount: number;
  remaining_amount: number;
  notes: string;
  created_date: string;
}

interface AddPaymentModalProps {
  visible: boolean;
  request: WorkerRequest | null;
  onClose: () => void;
  onSuccess: () => void;
}

const toNumber = (value: any) => {
  const numeric = Number(value || 0);
  return Number.isNaN(numeric) ? 0 : numeric;
};

const formatMoney = (value: number) => {
  return `Br ${toNumber(value).toLocaleString()}`;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const getPaymentMethodLabel = (method: PaymentMethod) => {
  switch (method) {
    case 'cash':
      return '💰 Cash';
    case 'transfer':
      return '🏦 Transfer';
    case 'check':
      return '📝 Check';
    case 'bank_deposit':
      return '🏛️ Deposit';
    default:
      return method;
  }
};

const AddPaymentModal = ({
  visible,
  request,
  onClose,
  onSuccess,
}: AddPaymentModalProps) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer');
  const [bankName, setBankName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && request) {
      setPaymentMethod('transfer');
      setBankName('');
      setReferenceNumber('');
      setAmount(String(request.remaining_amount || ''));
      setNotes('');
    }
  }, [visible, request]);

  const handleSubmit = async () => {
    if (!request) return;

    const parsedAmount = Number(amount || 0);

    if (!parsedAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid payment amount');
      return;
    }

    if (parsedAmount > request.remaining_amount) {
      Alert.alert(
        'Error',
        `Payment cannot be greater than remaining amount: ${formatMoney(
          request.remaining_amount
        )}`
      );
      return;
    }

    if (paymentMethod !== 'cash' && !bankName.trim()) {
      Alert.alert('Error', 'Bank name is required for non-cash payments');
      return;
    }

    if (
      (paymentMethod === 'transfer' || paymentMethod === 'check') &&
      !referenceNumber.trim()
    ) {
      Alert.alert('Error', 'Reference/check number is required');
      return;
    }

    setSubmitting(true);

    try {
      const response = await paymentApi.recordDeposit({
        sales_order_id: request.id,
        payment_method: paymentMethod,
        bank_name: paymentMethod === 'cash' ? null : bankName.trim(),
        reference_number:
          paymentMethod === 'cash' ? null : referenceNumber.trim() || null,
        amount: parsedAmount,
        notes: notes.trim() || null,
      });

      const newStatus = response?.data?.data?.order_status;

      Alert.alert(
        'Payment Submitted',
        newStatus === 'pending_admin'
          ? 'Full payment has been submitted. This order is now waiting for admin approval.'
          : 'Partial payment has been submitted. The order remains pending payment.'
      );

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error adding payment:', {
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
        requestData: error.config?.data,
      });

      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to submit payment'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!request) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Add Payment</Text>
              <Text style={styles.modalSubtitle}>{request.order_number}</Text>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.paymentSummaryBox}>
              <Text style={styles.summaryText}>
                Total: {formatMoney(request.total_amount)}
              </Text>
              <Text style={styles.summaryText}>
                Submitted: {formatMoney(request.submitted_amount)}
              </Text>
              <Text style={styles.summaryText}>
                Waiting verification: {formatMoney(request.pending_amount)}
              </Text>
              <Text style={styles.summaryRemainingText}>
                Remaining: {formatMoney(request.remaining_amount)}
              </Text>
            </View>

            <Text style={styles.inputLabel}>Payment Method</Text>

            <View style={styles.paymentMethodRow}>
              {(['cash', 'transfer', 'check', 'bank_deposit'] as PaymentMethod[]).map(
                (method) => (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.paymentChip,
                      paymentMethod === method && styles.paymentChipSelected,
                    ]}
                    onPress={() => {
                      setPaymentMethod(method);

                      if (method === 'cash') {
                        setBankName('');
                        setReferenceNumber('');
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.paymentChipText,
                        paymentMethod === method && styles.paymentChipTextSelected,
                      ]}
                    >
                      {getPaymentMethodLabel(method)}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>

            {paymentMethod !== 'cash' ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Bank Name"
                  placeholderTextColor="#64748b"
                  value={bankName}
                  onChangeText={setBankName}
                />

                <TextInput
                  style={styles.input}
                  placeholder={
                    paymentMethod === 'check' ? 'Check Number' : 'Reference Number'
                  }
                  placeholderTextColor="#64748b"
                  value={referenceNumber}
                  onChangeText={setReferenceNumber}
                />
              </>
            ) : null}

            <TextInput
              style={styles.input}
              placeholder="Amount"
              placeholderTextColor="#64748b"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />

            <TextInput
              style={styles.notesInput}
              placeholder="Notes"
              placeholderTextColor="#64748b"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Payment</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const RequestCard = ({
  request,
  onAddPayment,
}: {
  request: WorkerRequest;
  onAddPayment: () => void;
}) => {
  const isPending = request.status === 'pending';
  const isPendingAdmin = request.status === 'pending_admin';

  const getStatusColor = () => {
    if (isPendingAdmin) return '#3b82f6';
    if (isPending) return '#f97316';
    return '#94a3b8';
  };

  const getStatusText = () => {
    if (isPendingAdmin) return 'Waiting for Approval';
    if (isPending) return 'Pending Payment';
    return request.status;
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderNumber}>{request.order_number}</Text>
          <Text style={styles.dateText}>{formatDate(request.created_date)}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor()}20` }]}>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
        </View>
      </View>

      <Text style={styles.customerName}>{request.customer_name}</Text>
      <Text style={styles.itemName}>
        {request.sales_type} x{request.quantity}
      </Text>

      <View style={styles.paymentInfo}>
        <Text style={styles.totalAmount}>
          Total: {formatMoney(request.total_amount)}
        </Text>

        <Text style={styles.paidAmount}>
          Submitted: {formatMoney(request.submitted_amount)}
        </Text>

        {request.confirmed_amount > 0 ? (
          <Text style={styles.confirmedAmount}>
            Confirmed: {formatMoney(request.confirmed_amount)}
          </Text>
        ) : null}

        {request.pending_amount > 0 ? (
          <Text style={styles.pendingAmount}>
            Waiting verification: {formatMoney(request.pending_amount)}
          </Text>
        ) : null}

        {request.remaining_amount > 0 ? (
          <Text style={styles.remainingAmount}>
            Remaining: {formatMoney(request.remaining_amount)}
          </Text>
        ) : null}
      </View>

      {request.notes ? <Text style={styles.notes}>📝 {request.notes}</Text> : null}

      <View style={styles.actions}>
        {isPending && request.remaining_amount > 0 ? (
          <TouchableOpacity style={styles.addPaymentButton} onPress={onAddPayment}>
            <Text style={styles.addPaymentButtonText}>+ Add Payment</Text>
          </TouchableOpacity>
        ) : null}

        {isPendingAdmin ? (
          <View style={styles.pendingAdminBadge}>
            <Text style={styles.pendingAdminText}>
              ⏳ Waiting for Admin Approval
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default function WorkerPendingRequestsScreen() {
  const [requests, setRequests] = useState<WorkerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [addPaymentVisible, setAddPaymentVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<WorkerRequest | null>(null);

  const loadRequests = async () => {
    try {
      setLoading(true);

      const response = await salesApi.getSalesOrders();
      const orders = response.data.data || [];

      const workerOrders = orders.filter((order: any) =>
        ['pending', 'pending_admin'].includes(order.status)
      );

      const requestsList: WorkerRequest[] = [];

      for (const order of workerOrders) {
        const orderDetails = await salesApi.getSalesOrderById(order.id);
        const details = orderDetails.data.data;

        const paymentsResponse = await paymentApi.getOrderPaymentHistory(order.id);
        const paymentData = paymentsResponse.data.data;

        const totalConfirmed = toNumber(paymentData?.summary?.total_confirmed);
        const totalPending = toNumber(paymentData?.summary?.total_pending);
        const totalSubmitted = totalConfirmed + totalPending;

        const totalAmount = toNumber(order.total_amount || details.total_amount);
        const remainingAmount = Math.max(0, totalAmount - totalSubmitted);

        const firstItem = details.items?.[0];
        const salesType =
          firstItem?.item_type === 'vehicle'
            ? firstItem.model
            : firstItem?.name || firstItem?.part_number;

        requestsList.push({
          id: order.id,
          order_number: order.order_number,
          customer_name: details.customer?.full_name || 'Unknown',
          sales_type: salesType || 'Item',
          quantity: toNumber(firstItem?.quantity || 1),
          total_amount: totalAmount,
          status: order.status,
          confirmed_amount: totalConfirmed,
          pending_amount: totalPending,
          submitted_amount: totalSubmitted,
          remaining_amount: remainingAmount,
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

  const handleAddPayment = (request: WorkerRequest) => {
    setSelectedRequest(request);
    setAddPaymentVisible(true);
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
          <Text style={styles.emptySubtitle}>
            Create a sale request from the Inventory tab
          </Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RequestCard
              request={item}
              onAddPayment={() => handleAddPayment(item)}
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
        />
      )}

      <AddPaymentModal
        visible={addPaymentVisible}
        request={selectedRequest}
        onClose={() => {
          setAddPaymentVisible(false);
          setSelectedRequest(null);
        }}
        onSuccess={loadRequests}
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
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  dateText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
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
    gap: 2,
  },
  totalAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  paidAmount: {
    fontSize: 12,
    color: '#94a3b8',
  },
  confirmedAmount: {
    fontSize: 12,
    color: '#22c55e',
  },
  pendingAmount: {
    fontSize: 12,
    color: '#60a5fa',
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
    gap: 8,
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
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
    marginTop: 2,
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
  paymentSummaryBox: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 4,
  },
  summaryText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  summaryRemainingText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '600',
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '600',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  paymentChip: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  paymentChipSelected: {
    backgroundColor: '#ef4444',
  },
  paymentChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  paymentChipTextSelected: {
    color: '#ffffff',
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  notesInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 70,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});