import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { inventoryApi, salesApi, paymentApi } from '../services/api';

interface Transaction {
  id: string;
  event_type?: string;
  transaction_type?: string;
  quantity_change?: number;
  quantity_after?: number;

  performed_by?: string;
  performed_by_name?: string | null;
  confirmed_by?: string;
  confirmed_by_name?: string | null;

  customer?: {
    full_name?: string;
    phone?: string;
  };

  sales_order?: {
    id?: string;
    order_number?: string;
  };

  sales_order_id?: string | null;
  notes?: string;
  created_at?: string;
}

interface EnrichedTransaction extends Transaction {
  order_number?: string;
  order_status?: string;
  customer_name?: string;
  customer_phone?: string;
  order_total?: number;
  submitted_amount?: number;
  confirmed_amount?: number;
  pending_amount?: number;
  remaining_amount?: number;
  item_quantity?: number;
  item_unit_price?: number;
  item_subtotal?: number;
}

interface ItemHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  item: {
    id: string;
    name: string;
    type: 'vehicle' | 'part';
    sku?: string;
    current_quantity: number;
    unit_price: number;
  } | null;
}

interface OrderContext {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  customerName: string;
  customerPhone: string;
  orderTotal: number;
  submittedAmount: number;
  confirmedAmount: number;
  pendingAmount: number;
  remainingAmount: number;
  itemQuantity: number;
  itemUnitPrice: number;
  itemSubtotal: number;
}

const toNumber = (value: any) => {
  const numeric = Number(value || 0);
  return Number.isNaN(numeric) ? 0 : numeric;
};

const formatMoney = (value?: number) => {
  return `Br ${toNumber(value).toLocaleString()}`;
};

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Unknown date';

  try {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) return 'Invalid date';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'Invalid date';
  }
};

const getTransactionType = (transaction: Transaction): string => {
  return transaction.event_type || transaction.transaction_type || 'unknown';
};

const getTransactionIcon = (type: string) => {
  const normalized = type.toLowerCase();

  if (normalized === 'received' || normalized === 'stock_in') return '➕';
  if (normalized === 'sold' || normalized === 'sale_confirmed') return '➖';
  if (normalized === 'reserved') return '🔒';
  if (normalized === 'returned') return '🔄';
  if (normalized === 'adjusted') return '🛠️';

  return '📝';
};

const getTransactionColor = (type: string) => {
  const normalized = type.toLowerCase();

  if (normalized === 'received' || normalized === 'stock_in') return '#22c55e';
  if (normalized === 'sold' || normalized === 'sale_confirmed') return '#ef4444';
  if (normalized === 'reserved') return '#f97316';
  if (normalized === 'returned') return '#3b82f6';
  if (normalized === 'adjusted') return '#a855f7';

  return '#94a3b8';
};

const getTransactionLabel = (type: string, itemType: 'vehicle' | 'part') => {
  const normalized = type.toLowerCase();

  switch (normalized) {
    case 'received':
      return itemType === 'vehicle' ? 'Vehicle Received' : 'Received';
    case 'stock_in':
      return 'Stock Added';
    case 'sold':
      return itemType === 'vehicle' ? 'Vehicle Sold' : 'Part Sold';
    case 'sale_confirmed':
      return 'Sale Confirmed';
    case 'reserved':
      return 'Reserved';
    case 'returned':
      return 'Returned / Released';
    case 'adjusted':
      return 'Adjusted';
    default:
      return type;
  }
};

const isSaleTransaction = (type: string) => {
  const normalized = type.toLowerCase();
  return normalized === 'sold' || normalized === 'sale_confirmed';
};

const isReservationTransaction = (type: string) => {
  return type.toLowerCase() === 'reserved';
};

const isCustomerRelatedTransaction = (type: string) => {
  const normalized = type.toLowerCase();
  return ['reserved', 'sold', 'sale_confirmed', 'returned'].includes(normalized);
};

const getQuantityMovedLabel = (type: string) => {
  const normalized = type.toLowerCase();

  if (normalized === 'reserved') return 'Reserved qty';
  if (normalized === 'sold' || normalized === 'sale_confirmed') return 'Sold qty';
  if (normalized === 'returned') return 'Released qty';
  if (normalized === 'received' || normalized === 'stock_in') return 'Added qty';

  return 'Qty change';
};

const getAfterLabel = (type: string, itemType: 'vehicle' | 'part') => {
  const normalized = type.toLowerCase();

  if (itemType === 'vehicle') return 'Status after';

  if (normalized === 'reserved') return 'Reserved after';
  if (normalized === 'returned') return 'Reserved after';
  if (normalized === 'sold' || normalized === 'sale_confirmed') return 'Stock after';
  if (normalized === 'received' || normalized === 'stock_in') return 'Stock after';

  return 'Qty after';
};

const getVehicleStatusAfter = (type: string) => {
  const normalized = type.toLowerCase();

  if (normalized === 'reserved') return 'Reserved';
  if (normalized === 'sold' || normalized === 'sale_confirmed') return 'Sold';
  if (normalized === 'returned' || normalized === 'received') return 'Available';

  return 'Updated';
};

const getPerformedByName = (transaction: Transaction) => {
  return (
    transaction.performed_by_name ||
    transaction.confirmed_by_name ||
    'System'
  );
};

const getConfirmedByName = (transaction: Transaction) => {
  return transaction.confirmed_by_name || null;
};

const TransactionCard = ({
  transaction,
  itemType,
}: {
  transaction: EnrichedTransaction;
  itemType: 'vehicle' | 'part';
}) => {
  const transactionType = getTransactionType(transaction);
  const icon = getTransactionIcon(transactionType);
  const color = getTransactionColor(transactionType);
  const label = getTransactionLabel(transactionType, itemType);

  const quantityChange = toNumber(transaction.quantity_change);
  const quantityAfter = toNumber(transaction.quantity_after);
  const quantityMoved = Math.abs(quantityChange);

  const isPositive = quantityChange > 0;
  const performedBy = getPerformedByName(transaction);
  const confirmedBy = getConfirmedByName(transaction);
  const notes = transaction.notes || '';

  const customerName =
    transaction.customer_name || transaction.customer?.full_name || '';

  const customerPhone =
    transaction.customer_phone || transaction.customer?.phone || '';

  const orderNumber =
    transaction.order_number || transaction.sales_order?.order_number || '';

  const shouldShowCustomer =
    customerName && isCustomerRelatedTransaction(transactionType);

  const afterValue =
    itemType === 'vehicle'
      ? getVehicleStatusAfter(transactionType)
      : quantityAfter.toString();

  const showQuantity =
    itemType === 'part' ||
    transaction.quantity_change !== undefined ||
    transaction.quantity_after !== undefined;

  return (
    <View style={styles.transactionCard}>
      <View style={styles.transactionHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>

        <View style={styles.transactionDetails}>
          <Text style={styles.transactionType}>{label}</Text>
          <Text style={styles.transactionDate}>
            {formatDate(transaction.created_at)}
          </Text>
        </View>

        {showQuantity ? (
          <View style={styles.quantityContainer}>
            <Text
              style={[
                styles.quantityChange,
                isPositive ? styles.quantityPositive : styles.quantityNegative,
              ]}
            >
              {quantityChange > 0 ? `+${quantityChange}` : quantityChange}
            </Text>

            <Text style={styles.quantityAfter}>→ {afterValue}</Text>
          </View>
        ) : (
          <View style={styles.quantityContainer}>
            <Text style={styles.quantityAfter}>{afterValue}</Text>
          </View>
        )}
      </View>

      <View style={styles.metricsGrid}>
        {showQuantity ? (
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>
              {getQuantityMovedLabel(transactionType)}
            </Text>
            <Text style={styles.metricValue}>{quantityMoved}</Text>
          </View>
        ) : null}

        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>
            {getAfterLabel(transactionType, itemType)}
          </Text>
          <Text style={styles.metricValue}>{afterValue}</Text>
        </View>

        {transaction.item_unit_price !== undefined &&
        transaction.item_unit_price > 0 ? (
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Unit price</Text>
            <Text style={styles.metricValueSmall}>
              {formatMoney(transaction.item_unit_price)}
            </Text>
          </View>
        ) : null}

        {transaction.item_subtotal !== undefined &&
        transaction.item_subtotal > 0 ? (
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Line total</Text>
            <Text style={styles.metricValueSmall}>
              {formatMoney(transaction.item_subtotal)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoIcon}>👤</Text>
        <Text style={styles.infoText}>
          Performed by: <Text style={styles.infoValue}>{performedBy}</Text>
        </Text>
      </View>

      {confirmedBy ? (
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>✅</Text>
          <Text style={styles.infoText}>
            Confirmed by: <Text style={styles.infoValue}>{confirmedBy}</Text>
          </Text>
        </View>
      ) : null}

      {shouldShowCustomer ? (
        <View style={styles.customerBox}>
          <Text style={styles.customerTitle}>
            {isReservationTransaction(transactionType)
              ? 'Reserved for'
              : isSaleTransaction(transactionType)
                ? 'Sold to'
                : 'Customer'}
          </Text>

          <Text style={styles.customerName}>{customerName}</Text>

          {customerPhone ? (
            <Text style={styles.customerLine}>📞 {customerPhone}</Text>
          ) : null}

          {orderNumber ? (
            <Text style={styles.customerLine}>📋 Order: {orderNumber}</Text>
          ) : null}

          {transaction.order_status ? (
            <Text style={styles.customerLine}>
              Status: {transaction.order_status}
            </Text>
          ) : null}

          <View style={styles.paymentGrid}>
            <View style={styles.paymentBox}>
              <Text style={styles.paymentLabel}>Order total</Text>
              <Text style={styles.paymentValue}>
                {transaction.order_total !== undefined
                  ? formatMoney(transaction.order_total)
                  : '—'}
              </Text>
            </View>

            <View style={styles.paymentBox}>
              <Text style={styles.paymentLabel}>Paid / submitted</Text>
              <Text style={styles.paymentValueGreen}>
                {transaction.submitted_amount !== undefined
                  ? formatMoney(transaction.submitted_amount)
                  : '—'}
              </Text>
            </View>

            <View style={styles.paymentBox}>
              <Text style={styles.paymentLabel}>Waiting verification</Text>
              <Text style={styles.paymentValueBlue}>
                {transaction.pending_amount !== undefined
                  ? formatMoney(transaction.pending_amount)
                  : '—'}
              </Text>
            </View>

            <View style={styles.paymentBox}>
              <Text style={styles.paymentLabel}>Need to pay</Text>
              <Text
                style={
                  transaction.remaining_amount && transaction.remaining_amount > 0
                    ? styles.paymentValueWarning
                    : styles.paymentValueGreen
                }
              >
                {transaction.remaining_amount !== undefined
                  ? transaction.remaining_amount > 0
                    ? formatMoney(transaction.remaining_amount)
                    : 'Fully paid'
                  : '—'}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {!shouldShowCustomer && transaction.sales_order_id ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            This transaction is linked to a sales order, but customer/payment
            details were not returned by the backend for that order.
          </Text>
        </View>
      ) : null}

      {notes ? (
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>📝 Notes:</Text>
          <Text style={styles.notesText}>{notes}</Text>
        </View>
      ) : null}
    </View>
  );
};

export default function ItemHistoryModal({
  visible,
  onClose,
  item,
}: ItemHistoryModalProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [transactions, setTransactions] = useState<EnrichedTransaction[]>([]);
  const [itemDetails, setItemDetails] = useState<any>(null);

  const getSalesOrderId = (transaction: Transaction) => {
    return transaction.sales_order_id || transaction.sales_order?.id || null;
  };

  const getOrderContext = async (
    orderId: string | null,
    cache: Map<string, OrderContext | null>
  ): Promise<OrderContext | null> => {
    if (!orderId || !item) return null;

    if (cache.has(orderId)) {
      return cache.get(orderId) || null;
    }

    try {
      const [orderDetailsResponse, paymentHistoryResponse] = await Promise.all([
        salesApi.getSalesOrderById(orderId),
        paymentApi.getOrderPaymentHistory(orderId),
      ]);

      const orderDetails = orderDetailsResponse.data.data;
      const paymentData = paymentHistoryResponse.data.data;

      const items = orderDetails?.items || [];

      const matchingItem = items.find((orderItem: any) => {
        if (item.type === 'vehicle') {
          return (
            orderItem.vehicle_id === item.id ||
            orderItem.vehicle?.id === item.id
          );
        }

        return orderItem.part_id === item.id || orderItem.part?.id === item.id;
      });

      const totalConfirmed = toNumber(paymentData?.summary?.total_confirmed);
      const totalPending = toNumber(paymentData?.summary?.total_pending);

      const totalSubmitted =
        toNumber(paymentData?.summary?.total_submitted) ||
        totalConfirmed + totalPending;

      const orderTotal = toNumber(
        paymentData?.order?.total_amount || orderDetails?.total_amount
      );

      const context: OrderContext = {
        orderId,
        orderNumber:
          orderDetails?.order_number || paymentData?.order?.order_number || '',
        orderStatus: orderDetails?.status || paymentData?.order?.status || '',
        customerName:
          orderDetails?.customer?.full_name ||
          paymentData?.order?.customer_name ||
          '',
        customerPhone: orderDetails?.customer?.phone || '',
        orderTotal,
        submittedAmount: totalSubmitted,
        confirmedAmount: totalConfirmed,
        pendingAmount: totalPending,
        remainingAmount: Math.max(0, orderTotal - totalSubmitted),
        itemQuantity: toNumber(matchingItem?.quantity),
        itemUnitPrice: toNumber(matchingItem?.unit_price),
        itemSubtotal: toNumber(matchingItem?.subtotal),
      };

      cache.set(orderId, context);
      return context;
    } catch (error) {
      console.log('Could not load order/payment context for transaction:', {
        orderId,
        error,
      });

      cache.set(orderId, null);
      return null;
    }
  };

  const enrichTransactions = async (rawTransactions: Transaction[]) => {
    const orderCache = new Map<string, OrderContext | null>();

    const enriched = await Promise.all(
      rawTransactions.map(async (transaction) => {
        const orderId = getSalesOrderId(transaction);
        const context = await getOrderContext(orderId, orderCache);

        const enrichedTransaction: EnrichedTransaction = {
          ...transaction,
          sales_order_id: orderId || transaction.sales_order_id || null,
          order_number:
            context?.orderNumber || transaction.sales_order?.order_number || '',
          order_status: context?.orderStatus || '',
          customer_name:
            context?.customerName || transaction.customer?.full_name || '',
          customer_phone:
            context?.customerPhone || transaction.customer?.phone || '',
          order_total: context?.orderTotal,
          submitted_amount: context?.submittedAmount,
          confirmed_amount: context?.confirmedAmount,
          pending_amount: context?.pendingAmount,
          remaining_amount: context?.remainingAmount,
          item_quantity: context?.itemQuantity,
          item_unit_price: context?.itemUnitPrice,
          item_subtotal: context?.itemSubtotal,
        };

        return enrichedTransaction;
      })
    );

    return enriched.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  };

  const loadHistory = async () => {
    if (!item?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      let rawTransactions: Transaction[] = [];

      if (item.type === 'vehicle') {
        const response = await inventoryApi.getVehicleHistory(item.id);
        const data = response?.data?.data;

        setItemDetails(data?.vehicle || null);
        rawTransactions = data?.history || data?.transactions || [];
      } else {
        const response = await inventoryApi.getPartTransactions(item.id);
        const data = response?.data?.data;

        setItemDetails(data?.part || null);
        rawTransactions = data?.transactions || data?.history || [];
      }

      const enriched = await enrichTransactions(rawTransactions);
      setTransactions(enriched);
    } catch (error) {
      console.error('Error loading item history:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && item) {
      loadHistory();
    }
  }, [visible, item]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  if (!item) return null;

  const totalStock = toNumber(itemDetails?.quantity || item.current_quantity);

  const reservedStock =
    item.type === 'part'
      ? toNumber(itemDetails?.reserved_quantity)
      : itemDetails?.status === 'reserved'
        ? 1
        : 0;

  const availableStock =
    item.type === 'part'
      ? Math.max(0, totalStock - reservedStock)
      : itemDetails?.status === 'available'
        ? 1
        : 0;

  const soldCount = transactions
    .filter((transaction) => isSaleTransaction(getTransactionType(transaction)))
    .reduce(
      (sum, transaction) => sum + Math.abs(toNumber(transaction.quantity_change)),
      0
    );

  const reservedCount = transactions
    .filter((transaction) =>
      isReservationTransaction(getTransactionType(transaction))
    )
    .reduce(
      (sum, transaction) => sum + Math.abs(toNumber(transaction.quantity_change)),
      0
    );

  const unitPrice = toNumber(itemDetails?.unit_price || item.unit_price);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderText}>
              <Text style={styles.modalTitle}>{item.name || 'Unknown Item'}</Text>

              <Text style={styles.modalSubtitle}>
                {item.type === 'vehicle'
                  ? `Chassis: ${item.sku || item.id || 'N/A'}`
                  : `Part ID: ${item.sku || item.id || 'N/A'}`}
              </Text>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {item.type === 'vehicle' ? (
            <>
              <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {itemDetails?.status || 'Unknown'}
                  </Text>
                  <Text style={styles.statLabel}>Current Status</Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{reservedStock}</Text>
                  <Text style={styles.statLabel}>Reserved</Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statValue}>
                    Br {unitPrice.toLocaleString()}
                  </Text>
                  <Text style={styles.statLabel}>Unit Price</Text>
                </View>
              </View>

              <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{soldCount}</Text>
                  <Text style={styles.statLabel}>Total Sold</Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{reservedCount}</Text>
                  <Text style={styles.statLabel}>Total Reserved</Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{transactions.length}</Text>
                  <Text style={styles.statLabel}>Total Events</Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{totalStock}</Text>
                  <Text style={styles.statLabel}>Total Stock</Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{availableStock}</Text>
                  <Text style={styles.statLabel}>Available Stock</Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{reservedStock}</Text>
                  <Text style={styles.statLabel}>Reserved Stock</Text>
                </View>
              </View>

              <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>
                    Br {unitPrice.toLocaleString()}
                  </Text>
                  <Text style={styles.statLabel}>Unit Price</Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{soldCount}</Text>
                  <Text style={styles.statLabel}>Total Sold</Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{transactions.length}</Text>
                  <Text style={styles.statLabel}>Total Events</Text>
                </View>
              </View>
            </>
          )}

          <Text style={styles.historyTitle}>Transaction History</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ef4444" />
            </View>
          ) : transactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No transactions found</Text>
            </View>
          ) : (
            <FlatList
              data={transactions}
              keyExtractor={(transaction, index) =>
                transaction?.id
                  ? `${transaction.id}-${index}`
                  : index.toString()
              }
              renderItem={({ item: transaction }) => (
                <TransactionCard transaction={transaction} itemType={item.type} />
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#1e293b',
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
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
  modalHeaderText: {
    flex: 1,
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
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ef4444',
    marginBottom: 4,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 20,
  },
  transactionCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 11,
    color: '#94a3b8',
  },
  quantityContainer: {
    alignItems: 'flex-end',
  },
  quantityChange: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  quantityPositive: {
    color: '#22c55e',
  },
  quantityNegative: {
    color: '#ef4444',
  },
  quantityAfter: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  metricBox: {
    flexGrow: 1,
    minWidth: '46%',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 3,
  },
  metricValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '700',
  },
  metricValueSmall: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
  },
  infoIcon: {
    fontSize: 12,
    marginRight: 6,
    color: '#64748b',
  },
  infoText: {
    fontSize: 11,
    color: '#64748b',
  },
  infoValue: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  customerBox: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 10,
  },
  customerTitle: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  customerName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  customerLine: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  paymentBox: {
    minWidth: '46%',
    flexGrow: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
  },
  paymentLabel: {
    color: '#64748b',
    fontSize: 10,
    marginBottom: 3,
  },
  paymentValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  paymentValueGreen: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '700',
  },
  paymentValueBlue: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '700',
  },
  paymentValueWarning: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '700',
  },
  warningBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  warningText: {
    color: '#fbbf24',
    fontSize: 11,
    lineHeight: 15,
  },
  notesContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  notesLabel: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyContainer: {
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
  },
});