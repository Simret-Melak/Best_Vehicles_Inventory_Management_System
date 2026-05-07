import React, { useState, useCallback } from 'react';
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
import { useAuth } from '../context/AuthContext';

interface PendingRequest {
  id: string;
  order_number: string;
  customer_name: string;
  item_identifier: string;
  item_identifier_label: string;
  sales_type: string;
  reference_number: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  deposit_bank: string;
  submitted_amount: number;
  confirmed_amount: number;
  pending_amount: number;
  remaining_amount: number;
  deposit_status: string;
  notes: string;
  requested_by: string;
  created_date: string;
  order_status?: string;
  item_id?: string;
  item_type?: 'vehicle' | 'part';
  pending_payment_ids: string[];
}

const toNumber = (value: any) => {
  const numberValue = Number(value || 0);
  return Number.isNaN(numberValue) ? 0 : numberValue;
};

const formatMoney = (value: number) => {
  return `Br ${toNumber(value).toLocaleString()}`;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getLatestPayment = (payments: any[]) => {
  if (!payments || payments.length === 0) return null;

  return [...payments].sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime()
  )[0];
};

const getUserId = (user: any) => {
  return user?.id || user?.user_id || user?.uuid || null;
};

const getUserDisplayName = (user: any) => {
  return user?.full_name || user?.name || user?.email || 'Admin';
};

const RequestCard = ({
  request,
  onConfirm,
  onReject,
  isProcessing,
}: {
  request: PendingRequest;
  onConfirm: () => void;
  onReject: () => void;
  isProcessing: boolean;
}) => {
  const hasPendingPayment = request.pending_amount > 0;
  const isFullySubmitted = request.submitted_amount >= request.total_amount;

  const depositStatusColor = hasPendingPayment ? '#f97316' : '#22c55e';
  const depositStatusBackground = hasPendingPayment
    ? 'rgba(249, 115, 22, 0.2)'
    : 'rgba(34, 197, 94, 0.2)';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderNumber}>{request.order_number}</Text>
        <Text style={styles.timeText}>{formatDate(request.created_date)}</Text>
      </View>

      <View style={styles.approvalBanner}>
        <Text style={styles.approvalBannerText}>
          ⏳ Waiting for Admin Approval
        </Text>
      </View>

      <View style={styles.detailsContainer}>
        <View style={styles.row}>
          <Text style={styles.label}>Customer name</Text>
          <Text style={styles.value}>{request.customer_name}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>{request.item_identifier_label}</Text>
          <Text style={styles.value}>{request.item_identifier || 'N/A'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Sales type</Text>
          <Text style={styles.value}>{request.sales_type}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Reference / Check no</Text>
          <Text style={styles.value}>{request.reference_number}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Quantity</Text>
          <Text style={styles.value}>{request.quantity}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Unit price</Text>
          <Text style={styles.value}>{formatMoney(request.unit_price)}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Total amount</Text>
          <Text style={styles.value}>{formatMoney(request.total_amount)}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Submitted payment</Text>
          <Text style={styles.value}>
            {formatMoney(request.submitted_amount)}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Confirmed payment</Text>
          <Text style={styles.value}>
            {formatMoney(request.confirmed_amount)}
          </Text>
        </View>

        {request.pending_amount > 0 ? (
          <View style={styles.row}>
            <Text style={styles.label}>Waiting verification</Text>
            <Text style={styles.pendingValue}>
              {formatMoney(request.pending_amount)}
            </Text>
          </View>
        ) : null}

        {request.remaining_amount > 0 ? (
          <View style={styles.row}>
            <Text style={styles.label}>Remaining</Text>
            <Text style={styles.warningValue}>
              {formatMoney(request.remaining_amount)}
            </Text>
          </View>
        ) : null}

        <View style={styles.row}>
          <Text style={styles.label}>Deposit bank</Text>
          <Text style={styles.value}>{request.deposit_bank}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Deposit status</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: depositStatusBackground },
            ]}
          >
            <Text style={[styles.statusText, { color: depositStatusColor }]}>
              {request.deposit_status}
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Requested by</Text>
          <Text style={styles.value}>{request.requested_by || 'Worker'}</Text>
        </View>
      </View>

      {!isFullySubmitted ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningBoxText}>
            This order is in pending approval but payment is not fully submitted.
            Please check the payment history before confirming.
          </Text>
        </View>
      ) : null}

      {request.notes ? (
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>Note:</Text>
          <Text style={styles.notesText}>{request.notes}</Text>
        </View>
      ) : null}

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
          disabled={isProcessing || !isFullySubmitted}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.confirmButtonText}>Confirm Sale</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const EmptyState = () => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyIcon}>⏰</Text>
    <Text style={styles.emptyTitle}>No pending requests</Text>
    <Text style={styles.emptySubtitle}>All caught up!</Text>
  </View>
);

export default function PendingRequestsScreen() {
  const { user } = useAuth();

  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const adminUserId = getUserId(user);
  const adminDisplayName = getUserDisplayName(user);

  const loadRequests = async () => {
    try {
      setLoading(true);

      const ordersResponse = await salesApi.getSalesOrders({
        status: 'pending_admin',
      });

      const orders = ordersResponse.data.data || [];
      const pendingRequests: PendingRequest[] = [];

      for (const order of orders) {
        const orderDetailsResponse = await salesApi.getSalesOrderById(order.id);
        const orderDetails = orderDetailsResponse.data.data;

        const paymentsResponse = await paymentApi.getOrderPaymentHistory(order.id);
        const paymentData = paymentsResponse.data.data;

        const confirmedPayments = paymentData?.payments?.confirmed || [];
        const pendingPayments = paymentData?.payments?.pending || [];
        const allSubmittedPayments = [...confirmedPayments, ...pendingPayments];

        const totalConfirmed = toNumber(paymentData?.summary?.total_confirmed);
        const totalPending = toNumber(paymentData?.summary?.total_pending);
        const totalSubmitted =
          toNumber(paymentData?.summary?.total_submitted) ||
          totalConfirmed + totalPending;

        const totalAmount = toNumber(
          paymentData?.order?.total_amount ||
            orderDetails.total_amount ||
            order.total_amount
        );

        const remainingAmount = Math.max(0, totalAmount - totalSubmitted);
        const latestPayment = getLatestPayment(allSubmittedPayments);

        const firstItem = orderDetails.items?.[0];

        let itemIdentifier = '';
        let itemIdentifierLabel = 'Item no';
        let salesType = 'Item';
        let unitPrice = 0;
        let itemId = '';
        let itemType: 'vehicle' | 'part' = 'part';

        if (firstItem?.item_type === 'vehicle') {
          itemIdentifier =
            firstItem.chassis_number ||
            firstItem.vehicle?.chassis_number ||
            '';

          itemIdentifierLabel = 'Chassis no';

          salesType =
            firstItem.model ||
            firstItem.vehicle?.model ||
            'Vehicle';

          unitPrice = toNumber(
            firstItem.unit_price ||
              firstItem.vehicle?.unit_price
          );

          itemId =
            firstItem.vehicle_id ||
            firstItem.vehicle?.id ||
            '';

          itemType = 'vehicle';
        }

        if (firstItem?.item_type === 'part') {
          itemIdentifier =
            firstItem.part_number ||
            firstItem.part?.part_number ||
            '';

          itemIdentifierLabel = 'Part no';

          salesType =
            firstItem.name ||
            firstItem.part?.name ||
            'Part';

          unitPrice = toNumber(
            firstItem.unit_price ||
              firstItem.part?.unit_price
          );

          itemId =
            firstItem.part_id ||
            firstItem.part?.id ||
            '';

          itemType = 'part';
        }

        const customerName =
          orderDetails.customer?.full_name ||
          order.customer?.full_name ||
          paymentData?.order?.customer_name ||
          'Unknown';

        const depositStatus =
          totalPending > 0
            ? 'Submitted / Waiting Verification'
            : 'Verified';

        const requestedBy =
          order.performed_by_name ||
          orderDetails.performed_by_name ||
          latestPayment?.performed_by_name ||
          order.created_by_name ||
          orderDetails.created_by_name ||
          'Worker';

        pendingRequests.push({
          id: order.id,
          order_number: order.order_number,
          customer_name: customerName,
          item_identifier: itemIdentifier,
          item_identifier_label: itemIdentifierLabel,
          sales_type: salesType,
          reference_number: latestPayment?.reference_number || 'N/A',
          quantity: toNumber(firstItem?.quantity || 1),
          unit_price: unitPrice,
          total_amount: totalAmount,
          deposit_bank:
            latestPayment?.bank_name ||
            latestPayment?.payment_method ||
            'N/A',
          submitted_amount: totalSubmitted,
          confirmed_amount: totalConfirmed,
          pending_amount: totalPending,
          remaining_amount: remainingAmount,
          deposit_status: depositStatus,
          notes: order.notes || orderDetails.notes || '',
          requested_by: requestedBy,
          created_date: order.created_at || orderDetails.created_at,
          order_status: order.status,
          item_id: itemId,
          item_type: itemType,
          pending_payment_ids: pendingPayments.map((payment: any) => payment.id),
        });
      }

      pendingRequests.sort(
        (a, b) =>
          new Date(b.created_date || 0).getTime() -
          new Date(a.created_date || 0).getTime()
      );

      setRequests(pendingRequests);
    } catch (error: any) {
      console.error('Error loading pending requests:', {
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
        params: error.config?.params,
        message: error.message,
      });

      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to load pending requests'
      );
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

  const handleConfirm = async (requestId: string) => {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    if (!adminUserId) {
      Alert.alert(
        'Login Required',
        'Could not find the logged-in admin ID. Please log out and log in again.'
      );
      return;
    }

    if (request.submitted_amount < request.total_amount) {
      Alert.alert(
        'Payment Incomplete',
        `This order still has ${formatMoney(
          request.remaining_amount
        )} remaining. It cannot be confirmed yet.`
      );
      return;
    }

    setProcessingId(requestId);

    try {
      for (const paymentId of request.pending_payment_ids) {
        await paymentApi.confirmDeposit(
          paymentId,
          adminUserId,
          adminDisplayName
        );
      }

      await salesApi.updateOrderStatus(
        requestId,
        'confirmed',
        adminUserId,
        adminDisplayName
      );

      setRequests((prev) => prev.filter((r) => r.id !== requestId));

      Alert.alert(
        'Success',
        `Order ${request.order_number} confirmed successfully. Inventory updated.`
      );
    } catch (error: any) {
      console.error('Error confirming order:', {
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
        requestData: error.config?.data,
      });

      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to confirm order'
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    if (!adminUserId) {
      Alert.alert(
        'Login Required',
        'Could not find the logged-in admin ID. Please log out and log in again.'
      );
      return;
    }

    Alert.alert(
      'Reject Sale Request',
      `Are you sure you want to reject order ${request.order_number}? Reserved inventory will be released.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(requestId);

            try {
              await salesApi.updateOrderStatus(
                requestId,
                'cancelled',
                undefined,
                undefined,
                adminUserId,
                adminDisplayName
              );

              setRequests((prev) => prev.filter((r) => r.id !== requestId));

              Alert.alert(
                'Rejected',
                `Order ${request.order_number} has been rejected.`
              );
            } catch (error: any) {
              console.error('Error rejecting order:', {
                status: error.response?.status,
                data: error.response?.data,
                url: error.config?.url,
                requestData: error.config?.data,
              });

              Alert.alert(
                'Error',
                error.response?.data?.error || 'Failed to reject order'
              );
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
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
          {requests.length} pending sale{' '}
          {requests.length === 1 ? 'request' : 'requests'}
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
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#ef4444"
            />
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
  approvalBanner: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  approvalBannerText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  detailsContainer: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
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
  pendingValue: {
    fontSize: 12,
    color: '#60a5fa',
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  warningValue: {
    fontSize: 12,
    color: '#fbbf24',
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  warningBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  warningBoxText: {
    color: '#fbbf24',
    fontSize: 12,
    lineHeight: 17,
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