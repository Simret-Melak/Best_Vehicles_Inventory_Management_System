import React, { useState, useMemo, useCallback } from 'react';
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
  ScrollView,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { inventoryApi, salesApi, paymentApi } from '../services/api';
import ItemHistoryModal from '../components/ItemHistoryModal';
import HistoryFilterModal from '../components/HistoryFilterModal';

interface HistoryEntry {
  id: string;
  item_id: string;
  item_name: string;
  item_type: 'vehicle' | 'part';
  specifications: string;
  transaction_type: string;
  quantity_change: number;
  quantity_after: number;

  performed_by?: string;
  performed_by_name?: string;
  confirmed_by?: string;
  confirmed_by_name?: string;

  notes: string;
  created_date: string;

  sales_order_id?: string | null;
  order_number?: string;
  customer_name?: string;
  customer_phone?: string;
  paid_amount?: number;
  confirmed_amount?: number;
  pending_amount?: number;
  remaining_amount?: number;

  display_quantity_change?: number;
  display_stock_after?: number | string;
}

interface OrderContext {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  totalAmount: number;
  submittedAmount: number;
  confirmedAmount: number;
  pendingAmount: number;
  remainingAmount: number;
}

const typeConfig: Record<
  string,
  { label: string; color: string; icon: string; bg: string }
> = {
  received: {
    label: 'Received',
    color: '#22c55e',
    icon: '➕',
    bg: 'rgba(34, 197, 94, 0.1)',
  },
  stock_in: {
    label: 'Stock In',
    color: '#22c55e',
    icon: '➕',
    bg: 'rgba(34, 197, 94, 0.1)',
  },
  sold: {
    label: 'Sold',
    color: '#ef4444',
    icon: '➖',
    bg: 'rgba(239, 68, 68, 0.1)',
  },
  sale_confirmed: {
    label: 'Sale Confirmed',
    color: '#ef4444',
    icon: '➖',
    bg: 'rgba(239, 68, 68, 0.1)',
  },
  reserved: {
    label: 'Reserved',
    color: '#f97316',
    icon: '🔒',
    bg: 'rgba(249, 115, 22, 0.1)',
  },
  returned: {
    label: 'Returned',
    color: '#3b82f6',
    icon: '🔄',
    bg: 'rgba(59, 130, 246, 0.1)',
  },
  adjusted: {
    label: 'Adjusted',
    color: '#a855f7',
    icon: '🛠️',
    bg: 'rgba(168, 85, 247, 0.1)',
  },
};

const toNumber = (value: any) => {
  const numberValue = Number(value || 0);
  return Number.isNaN(numberValue) ? 0 : numberValue;
};

const formatMoney = (value?: number) => {
  return `Br ${toNumber(value).toLocaleString()}`;
};

const formatDate = (dateString: string) => {
  if (!dateString) return 'Unknown date';

  const date = new Date(dateString);

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const normalizeType = (type: string) => {
  return (type || '').toLowerCase();
};

const isUuid = (value?: string) => {
  if (!value) return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
};

const getPerformedByDisplay = (entry: {
  performed_by?: string;
  performed_by_name?: string;
  confirmed_by?: string;
  confirmed_by_name?: string;
}) => {
  if (entry.performed_by_name) return entry.performed_by_name;
  if (entry.confirmed_by_name) return entry.confirmed_by_name;

  if (entry.performed_by && !isUuid(entry.performed_by)) {
    return entry.performed_by;
  }

  if (entry.confirmed_by && !isUuid(entry.confirmed_by)) {
    return entry.confirmed_by;
  }

  return 'System';
};

const isCustomerRelatedTransaction = (type: string) => {
  return ['reserved', 'sold', 'sale_confirmed', 'returned'].includes(
    normalizeType(type)
  );
};

const isSaleType = (type: string) => {
  const normalized = normalizeType(type);
  return normalized === 'sold' || normalized === 'sale_confirmed';
};

const isReservedType = (type: string) => {
  return normalizeType(type) === 'reserved';
};

const isReturnedType = (type: string) => {
  return normalizeType(type) === 'returned';
};

const isStockInType = (type: string) => {
  const normalized = normalizeType(type);
  return normalized === 'stock_in' || normalized === 'received';
};

const getDisplayQuantityChange = (transactionType: string, rawChange: any) => {
  const normalized = normalizeType(transactionType);
  const movedQty = Math.abs(toNumber(rawChange));

  if (normalized === 'reserved') return -movedQty;
  if (normalized === 'sold') return -movedQty;
  if (normalized === 'sale_confirmed') return -movedQty;

  if (normalized === 'returned') return movedQty;
  if (normalized === 'received') return movedQty;
  if (normalized === 'stock_in') return movedQty;

  return toNumber(rawChange);
};

const getVehicleDisplayQuantityChange = (eventType: string) => {
  const normalized = normalizeType(eventType);

  if (normalized === 'received') return 1;
  if (normalized === 'returned') return 1;
  if (normalized === 'reserved') return -1;
  if (normalized === 'sold' || normalized === 'sale_confirmed') return -1;

  return 0;
};

const getVehicleStockAfter = (eventType: string) => {
  const normalized = normalizeType(eventType);

  if (normalized === 'received' || normalized === 'returned') return 'Available';
  if (normalized === 'reserved') return 'Reserved';
  if (normalized === 'sold' || normalized === 'sale_confirmed') return 'Sold';

  return 'Updated';
};

const applyPartDisplayStockValues = (entries: HistoryEntry[], part: any) => {
  const totalStock = toNumber(part?.quantity);
  const reservedStock = toNumber(part?.reserved_quantity);
  let runningAvailableStock = Math.max(0, totalStock - reservedStock);

  const newestFirst = [...entries].sort((a, b) => {
    const dateA = a.created_date ? new Date(a.created_date).getTime() : 0;
    const dateB = b.created_date ? new Date(b.created_date).getTime() : 0;
    return dateB - dateA;
  });

  const calculated = newestFirst.map((entry) => {
    const transactionType = normalizeType(entry.transaction_type);
    const movedQty = Math.abs(toNumber(entry.quantity_change));
    const displayQuantityChange = getDisplayQuantityChange(
      transactionType,
      entry.quantity_change
    );

    const entryWithDisplayValues: HistoryEntry = {
      ...entry,
      display_quantity_change: displayQuantityChange,
      display_stock_after: runningAvailableStock,
    };

    if (isStockInType(transactionType)) {
      runningAvailableStock = Math.max(0, runningAvailableStock - movedQty);
    } else if (isReservedType(transactionType)) {
      runningAvailableStock += movedQty;
    } else if (isSaleType(transactionType)) {
      runningAvailableStock = runningAvailableStock;
    } else if (isReturnedType(transactionType)) {
      runningAvailableStock = Math.max(0, runningAvailableStock - movedQty);
    } else {
      runningAvailableStock = Math.max(
        0,
        runningAvailableStock - displayQuantityChange
      );
    }

    return entryWithDisplayValues;
  });

  return calculated.sort((a, b) => {
    const dateA = a.created_date ? new Date(a.created_date).getTime() : 0;
    const dateB = b.created_date ? new Date(b.created_date).getTime() : 0;
    return dateB - dateA;
  });
};

const getCustomerContextLabel = (entry: HistoryEntry) => {
  if (!entry.customer_name || !isCustomerRelatedTransaction(entry.transaction_type)) {
    return null;
  }

  if (normalizeType(entry.transaction_type) === 'reserved') {
    return `Reserved for ${entry.customer_name}`;
  }

  if (
    normalizeType(entry.transaction_type) === 'sold' ||
    normalizeType(entry.transaction_type) === 'sale_confirmed'
  ) {
    return `Bought by ${entry.customer_name}`;
  }

  if (normalizeType(entry.transaction_type) === 'returned') {
    return `Returned from ${entry.customer_name}`;
  }

  return entry.customer_name;
};

const getNeedToPayText = (entry: HistoryEntry) => {
  if (entry.remaining_amount === undefined) return '—';

  return entry.remaining_amount > 0
    ? formatMoney(entry.remaining_amount)
    : 'Fully paid';
};

const getDisplayChange = (entry: HistoryEntry) => {
  return entry.display_quantity_change !== undefined
    ? entry.display_quantity_change
    : getDisplayQuantityChange(entry.transaction_type, entry.quantity_change);
};

const getDisplayStockAfter = (entry: HistoryEntry) => {
  return entry.display_stock_after !== undefined
    ? entry.display_stock_after
    : entry.quantity_after;
};

const HistoryCard = ({
  entry,
  onPress,
}: {
  entry: HistoryEntry;
  onPress: () => void;
}) => {
  const cfg =
    typeConfig[entry.transaction_type] || {
      label: entry.transaction_type,
      color: '#94a3b8',
      icon: '📝',
      bg: 'rgba(100, 116, 139, 0.1)',
    };

  const displayChange = getDisplayChange(entry);
  const displayStockAfter = getDisplayStockAfter(entry);
  const isPositive = displayChange > 0;
  const customerContext = getCustomerContextLabel(entry);
  const performedByDisplay = getPerformedByDisplay(entry);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, { backgroundColor: cfg.bg }]}>
            <Text style={styles.iconText}>{cfg.icon}</Text>
          </View>

          <View style={styles.cardHeaderContent}>
            <Text style={styles.itemName}>{entry.item_name || 'Unknown Item'}</Text>

            <View style={styles.typeBadge}>
              <Text style={[styles.typeText, { color: cfg.color }]}>
                {cfg.label}
              </Text>
            </View>
          </View>

          <View style={styles.quantityContainer}>
            <Text
              style={[
                styles.quantityChange,
                isPositive ? styles.quantityPositive : styles.quantityNegative,
              ]}
            >
              {isPositive ? `+${displayChange}` : displayChange}
            </Text>

            <Text style={styles.quantityAfter}>→ {displayStockAfter}</Text>
          </View>
        </View>

        {entry.specifications ? (
          <Text style={styles.specifications} numberOfLines={1}>
            {entry.specifications}
          </Text>
        ) : null}

        {customerContext ? (
          <View style={styles.customerBox}>
            <Text style={styles.customerText}>{customerContext}</Text>

            {entry.customer_phone ? (
              <Text style={styles.customerSubText}>📞 {entry.customer_phone}</Text>
            ) : null}

            {entry.order_number ? (
              <Text style={styles.customerSubText}>Order: {entry.order_number}</Text>
            ) : null}

            <Text style={styles.customerPaidText}>
              Paid / Submitted: {formatMoney(entry.paid_amount)}
            </Text>

            {entry.pending_amount !== undefined && entry.pending_amount > 0 ? (
              <Text style={styles.customerPendingText}>
                Waiting verification: {formatMoney(entry.pending_amount)}
              </Text>
            ) : null}

            {entry.remaining_amount !== undefined && entry.remaining_amount > 0 ? (
              <Text style={styles.customerRemainingText}>
                Need to pay: {formatMoney(entry.remaining_amount)}
              </Text>
            ) : entry.remaining_amount !== undefined ? (
              <Text style={styles.customerFullyPaidText}>Fully paid</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.performedBy}>by {performedByDisplay}</Text>
          <Text style={styles.date}>{formatDate(entry.created_date)}</Text>
        </View>

        {entry.notes ? (
          <Text style={styles.notes} numberOfLines={2}>
            📝 {entry.notes}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const TableRow = ({
  entry,
  onPress,
}: {
  entry: HistoryEntry;
  onPress: () => void;
}) => {
  const cfg =
    typeConfig[entry.transaction_type] || {
      label: entry.transaction_type,
      color: '#94a3b8',
      icon: '📝',
      bg: 'rgba(100, 116, 139, 0.1)',
    };

  const displayChange = getDisplayChange(entry);
  const displayStockAfter = getDisplayStockAfter(entry);
  const isPositive = displayChange > 0;
  const customerContext = getCustomerContextLabel(entry);
  const needToPayText = getNeedToPayText(entry);
  const performedByDisplay = getPerformedByDisplay(entry);

  const needToPayStyle =
    entry.remaining_amount === undefined
      ? styles.neutralText
      : entry.remaining_amount > 0
        ? styles.remainingText
        : styles.fullyPaidText;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={styles.tableRow}>
        <Text style={[styles.tableCellText, styles.dateCell]}>
          {formatDate(entry.created_date)}
        </Text>

        <View style={styles.itemCell}>
          <Text style={styles.itemNameText}>{entry.item_name || 'Unknown Item'}</Text>

          {entry.specifications ? (
            <Text style={styles.specsText} numberOfLines={1}>
              {entry.specifications}
            </Text>
          ) : null}
        </View>

        <View style={styles.typeCell}>
          <View style={[styles.tableTypeBadge, { backgroundColor: `${cfg.color}20` }]}>
            <Text style={[styles.tableTypeText, { color: cfg.color }]}>
              {cfg.label}
            </Text>
          </View>
        </View>

        <View style={styles.customerCell}>
          <Text style={styles.tableCellText} numberOfLines={1}>
            {customerContext || '—'}
          </Text>

          {entry.order_number ? (
            <Text style={styles.specsText} numberOfLines={1}>
              {entry.order_number}
            </Text>
          ) : null}
        </View>

        <View style={styles.paidCell}>
          <Text style={[styles.tableCellText, styles.paidText]}>
            {entry.paid_amount !== undefined ? formatMoney(entry.paid_amount) : '—'}
          </Text>
        </View>

        <View style={styles.remainingCell}>
          <Text style={[styles.tableCellText, needToPayStyle]} numberOfLines={1}>
            {needToPayText}
          </Text>
        </View>

        <View style={styles.changeCell}>
          <Text
            style={[
              styles.tableCellText,
              styles.changeText,
              isPositive ? styles.quantityPositive : styles.quantityNegative,
            ]}
          >
            {isPositive ? `+${displayChange}` : displayChange}
          </Text>
        </View>

        <View style={styles.afterCell}>
          <Text style={[styles.tableCellText, styles.afterText]}>
            {displayStockAfter}
          </Text>
        </View>

        <Text style={[styles.tableCellText, styles.byCell]}>
          {performedByDisplay}
        </Text>

        <Text style={[styles.tableCellText, styles.notesCell]} numberOfLines={1}>
          {entry.notes || '—'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default function HistoryReportScreen() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const getOrderContext = async (
    orderId: string | null | undefined,
    cache: Map<string, OrderContext | null>
  ): Promise<OrderContext | null> => {
    if (!orderId) return null;

    if (cache.has(orderId)) {
      return cache.get(orderId) || null;
    }

    try {
      const [orderDetailsResponse, paymentsResponse] = await Promise.all([
        salesApi.getSalesOrderById(orderId),
        paymentApi.getOrderPaymentHistory(orderId),
      ]);

      const orderDetails = orderDetailsResponse.data.data;
      const paymentData = paymentsResponse.data.data;

      const totalConfirmed = toNumber(paymentData?.summary?.total_confirmed);
      const totalPending = toNumber(paymentData?.summary?.total_pending);

      const totalSubmitted =
        toNumber(paymentData?.summary?.total_submitted) ||
        totalConfirmed + totalPending;

      const totalAmount = toNumber(
        paymentData?.order?.total_amount || orderDetails?.total_amount
      );

      const context: OrderContext = {
        orderId,
        orderNumber:
          orderDetails?.order_number ||
          paymentData?.order?.order_number ||
          '',
        customerName:
          orderDetails?.customer?.full_name ||
          paymentData?.order?.customer_name ||
          '',
        customerPhone: orderDetails?.customer?.phone || '',
        totalAmount,
        submittedAmount: totalSubmitted,
        confirmedAmount: totalConfirmed,
        pendingAmount: totalPending,
        remainingAmount: Math.max(0, totalAmount - totalSubmitted),
      };

      cache.set(orderId, context);
      return context;
    } catch (error) {
      console.log('Failed to load sales order context for history:', {
        orderId,
        error,
      });

      cache.set(orderId, null);
      return null;
    }
  };

  const buildHistoryEntry = async ({
    base,
    salesOrderId,
    orderCache,
    fallbackCustomerName,
    fallbackCustomerPhone,
    fallbackOrderNumber,
  }: {
    base: Omit<
      HistoryEntry,
      | 'sales_order_id'
      | 'order_number'
      | 'customer_name'
      | 'customer_phone'
      | 'paid_amount'
      | 'confirmed_amount'
      | 'pending_amount'
      | 'remaining_amount'
    >;
    salesOrderId?: string | null;
    orderCache: Map<string, OrderContext | null>;
    fallbackCustomerName?: string;
    fallbackCustomerPhone?: string;
    fallbackOrderNumber?: string;
  }): Promise<HistoryEntry> => {
    const context = await getOrderContext(salesOrderId, orderCache);

    return {
      ...base,
      sales_order_id: salesOrderId || null,
      order_number: context?.orderNumber || fallbackOrderNumber || '',
      customer_name: context?.customerName || fallbackCustomerName || '',
      customer_phone: context?.customerPhone || fallbackCustomerPhone || '',
      paid_amount: context?.submittedAmount,
      confirmed_amount: context?.confirmedAmount,
      pending_amount: context?.pendingAmount,
      remaining_amount: context?.remainingAmount,
    };
  };

  const loadHistory = async () => {
    try {
      setLoading(true);

      const allTransactions: HistoryEntry[] = [];
      const orderCache = new Map<string, OrderContext | null>();

      const vehiclesRes = await inventoryApi.getVehicles();
      const vehicles = vehiclesRes.data.data || [];

      for (const vehicle of vehicles) {
        const historyRes = await inventoryApi.getVehicleHistory(vehicle.id);
        const vehicleHistory = historyRes?.data?.data?.history || [];

        for (const trans of vehicleHistory) {
          const salesOrderId =
            trans.sales_order_id ||
            trans.sales_order?.id ||
            null;

          const eventType = trans.event_type || 'unknown';
          const vehicleDisplayChange = getVehicleDisplayQuantityChange(eventType);

          const entry = await buildHistoryEntry({
            salesOrderId,
            orderCache,
            fallbackCustomerName: trans.customer?.full_name || '',
            fallbackCustomerPhone: trans.customer?.phone || '',
            fallbackOrderNumber: trans.sales_order?.order_number || '',
            base: {
              id: `vehicle-${trans.id}`,
              item_id: vehicle.id,
              item_name: vehicle.model,
              item_type: 'vehicle',
              specifications: vehicle.specifications || '',
              transaction_type: eventType,
              quantity_change: vehicleDisplayChange,
              quantity_after: vehicleDisplayChange === -1 ? 0 : 1,
              display_quantity_change: vehicleDisplayChange,
              display_stock_after: getVehicleStockAfter(eventType),

              performed_by: trans.performed_by || undefined,
              performed_by_name:
                trans.performed_by_name ||
                trans.confirmed_by_name ||
                undefined,
              confirmed_by: trans.confirmed_by || undefined,
              confirmed_by_name: trans.confirmed_by_name || undefined,

              notes: trans.notes || '',
              created_date: trans.created_at,
            },
          });

          allTransactions.push(entry);
        }
      }

      const partsRes = await inventoryApi.getParts();
      const parts = partsRes.data.data || [];

      for (const part of parts) {
        const transactionsRes = await inventoryApi.getPartTransactions(part.id);

        const partTransactions =
          transactionsRes?.data?.data?.transactions ||
          transactionsRes?.data?.data ||
          [];

        const partEntries: HistoryEntry[] = [];

        for (const trans of partTransactions) {
          const salesOrderId =
            trans.sales_order_id ||
            trans.sales_order?.id ||
            null;

          const transactionType = trans.transaction_type || 'unknown';

          const entry = await buildHistoryEntry({
            salesOrderId,
            orderCache,
            fallbackCustomerName: trans.customer?.full_name || '',
            fallbackCustomerPhone: trans.customer?.phone || '',
            fallbackOrderNumber: trans.sales_order?.order_number || '',
            base: {
              id: `part-${trans.id}`,
              item_id: part.id,
              item_name: part.name,
              item_type: 'part',
              specifications: part.specifications || '',
              transaction_type: transactionType,
              quantity_change: toNumber(trans.quantity_change),
              quantity_after: toNumber(trans.quantity_after),

              performed_by: trans.performed_by || undefined,
              performed_by_name:
                trans.performed_by_name ||
                trans.confirmed_by_name ||
                undefined,
              confirmed_by: trans.confirmed_by || undefined,
              confirmed_by_name: trans.confirmed_by_name || undefined,

              notes: trans.notes || '',
              created_date: trans.created_at,
            },
          });

          partEntries.push(entry);
        }

        const calculatedPartEntries = applyPartDisplayStockValues(partEntries, part);
        allTransactions.push(...calculatedPartEntries);
      }

      allTransactions.sort((a, b) => {
        const dateA = a.created_date ? new Date(a.created_date).getTime() : 0;
        const dateB = b.created_date ? new Date(b.created_date).getTime() : 0;
        return dateB - dateA;
      });

      setHistory(allTransactions);
    } catch (error) {
      console.error('Error loading history:', error);
      Alert.alert('Error', 'Failed to load history data');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const uniqueUsers = useMemo(() => {
    const users = new Set(history.map((h) => getPerformedByDisplay(h)));
    return Array.from(users).sort();
  }, [history]);

  const filteredHistory = useMemo(() => {
    return history.filter((entry) => {
      const query = search.toLowerCase();

      const itemName = (entry.item_name || '').toLowerCase();
      const specs = (entry.specifications || '').toLowerCase();
      const notes = (entry.notes || '').toLowerCase();
      const performedBy = getPerformedByDisplay(entry).toLowerCase();
      const customerName = (entry.customer_name || '').toLowerCase();
      const orderNumber = (entry.order_number || '').toLowerCase();

      if (
        query &&
        !itemName.includes(query) &&
        !specs.includes(query) &&
        !notes.includes(query) &&
        !performedBy.includes(query) &&
        !customerName.includes(query) &&
        !orderNumber.includes(query)
      ) {
        return false;
      }

      if (typeFilter !== 'all' && entry.transaction_type !== typeFilter) {
        return false;
      }

      if (userFilter !== 'all' && getPerformedByDisplay(entry) !== userFilter) {
        return false;
      }

      if (dateFilter !== 'all' && entry.created_date) {
        const entryDate = new Date(entry.created_date);
        const now = new Date();
        const daysDiff = (now.getTime() - entryDate.getTime()) / (1000 * 3600 * 24);

        if (dateFilter === '7days' && daysDiff > 7) return false;
        if (dateFilter === '30days' && daysDiff > 30) return false;
      }

      return true;
    });
  }, [history, search, typeFilter, userFilter, dateFilter]);

  const handleItemClick = (entry: HistoryEntry) => {
    const stockAfter = getDisplayStockAfter(entry);

    setSelectedItem({
      id: entry.item_id,
      name: entry.item_name,
      type: entry.item_type,
      sku: entry.item_type === 'vehicle' ? entry.item_name : 'Part',
      current_quantity:
        typeof stockAfter === 'number' ? stockAfter : entry.quantity_after,
      unit_price: 0,
    });

    setHistoryModalVisible(true);
  };

  const applyFilters = ({
    typeFilter,
    userFilter,
    dateFilter,
  }: {
    typeFilter: string;
    userFilter: string;
    dateFilter: string;
  }) => {
    setTypeFilter(typeFilter);
    setUserFilter(userFilter);
    setDateFilter(dateFilter);
  };

  const clearModalFilters = () => {
    setTypeFilter('all');
    setUserFilter('all');
    setDateFilter('all');
  };

  const clearAllFilters = () => {
    setSearch('');
    clearModalFilters();
  };

  const exportCSV = () => {
    const headers = [
      'Date',
      'Item',
      'Specifications',
      'Type',
      'Customer',
      'Order Number',
      'Paid/Submitted',
      'Pending Verification',
      'Need to Pay',
      'Quantity Change',
      'Available Stock After',
      'Performed By',
      'Notes',
    ];

    const rows = filteredHistory.map((entry) => [
      formatDate(entry.created_date),
      entry.item_name || '',
      entry.specifications || '',
      entry.transaction_type,
      entry.customer_name || '',
      entry.order_number || '',
      entry.paid_amount ?? '',
      entry.pending_amount ?? '',
      entry.remaining_amount ?? '',
      getDisplayChange(entry),
      getDisplayStockAfter(entry),
      getPerformedByDisplay(entry),
      entry.notes || '',
    ]);

    let csvContent = headers.join(',') + '\n';

    rows.forEach((row) => {
      csvContent += row.map((cell) => `"${cell}"`).join(',') + '\n';
    });

    Alert.alert('Export', `CSV would be exported with ${filteredHistory.length} records`);
    console.log('CSV Content:', csvContent);
  };

  const hasActiveFilters =
    search !== '' ||
    typeFilter !== 'all' ||
    userFilter !== 'all' ||
    dateFilter !== 'all';

  if (loading && history.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ef4444" />
      </View>
    );
  }

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🔍</Text>
      <Text style={styles.emptyTitle}>No transactions found</Text>
      <Text style={styles.emptySubtitle}>Try adjusting your filters</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerIcon}>📜</Text>
          <Text style={styles.headerTitle}>Transaction History</Text>
        </View>

        <Text style={styles.headerSubtitle}>
          {filteredHistory.length} transactions
        </Text>
      </View>

      <View style={styles.actionBar}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Search items, customers, orders, users, notes..."
            placeholderTextColor="#64748b"
            value={search}
            onChangeText={setSearch}
          />

          {search !== '' ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]}
          onPress={() => setFilterModalVisible(true)}
        >
          <Text style={styles.filterButtonText}>⚙️ Filter</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.exportButton} onPress={exportCSV}>
          <Text style={styles.exportButtonText}>📎 CSV</Text>
        </TouchableOpacity>
      </View>

      {hasActiveFilters ? (
        <View style={styles.activeFilters}>
          <Text style={styles.activeFiltersLabel}>Active filters:</Text>

          {search !== '' ? (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>Search: {search}</Text>
            </View>
          ) : null}

          {typeFilter !== 'all' ? (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>
                Type: {typeFilter.replace('_', ' ')}
              </Text>
            </View>
          ) : null}

          {userFilter !== 'all' ? (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>User: {userFilter}</Text>
            </View>
          ) : null}

          {dateFilter !== 'all' ? (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>
                {dateFilter === '7days' ? 'Last 7 days' : 'Last 30 days'}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity onPress={clearAllFilters}>
            <Text style={styles.clearFiltersText}>Clear all</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.viewButton, viewMode === 'cards' && styles.viewButtonActive]}
          onPress={() => setViewMode('cards')}
        >
          <Text
            style={[
              styles.viewButtonText,
              viewMode === 'cards' && styles.viewButtonTextActive,
            ]}
          >
            📱 Cards
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.viewButton, viewMode === 'table' && styles.viewButtonActive]}
          onPress={() => setViewMode('table')}
        >
          <Text
            style={[
              styles.viewButtonText,
              viewMode === 'table' && styles.viewButtonTextActive,
            ]}
          >
            📊 Table
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'cards' ? (
        <FlatList
          data={filteredHistory}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <HistoryCard entry={item} onPress={() => handleItemClick(item)} />
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
          ListEmptyComponent={renderEmptyState}
        />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.dateCell]}>Date</Text>
              <Text style={[styles.tableHeaderCell, styles.itemCell]}>Item</Text>
              <Text style={[styles.tableHeaderCell, styles.typeCell]}>Type</Text>
              <Text style={[styles.tableHeaderCell, styles.customerCell]}>
                Customer / Order
              </Text>
              <Text style={[styles.tableHeaderCell, styles.paidCell]}>Paid</Text>
              <Text style={[styles.tableHeaderCell, styles.remainingCell]}>
                Need to Pay
              </Text>
              <Text style={[styles.tableHeaderCell, styles.changeCell]}>
                Qty Change
              </Text>
              <Text style={[styles.tableHeaderCell, styles.afterCell]}>
                Available After
              </Text>
              <Text style={[styles.tableHeaderCell, styles.byCell]}>By</Text>
              <Text style={[styles.tableHeaderCell, styles.notesCell]}>Notes</Text>
            </View>

            <FlatList
              data={filteredHistory}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TableRow entry={item} onPress={() => handleItemClick(item)} />
              )}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#ef4444"
                />
              }
              showsVerticalScrollIndicator
              ListEmptyComponent={renderEmptyState}
            />
          </View>
        </ScrollView>
      )}

      <HistoryFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={applyFilters}
        onClear={clearModalFilters}
        initialTypeFilter={typeFilter}
        initialUserFilter={userFilter}
        initialDateFilter={dateFilter}
        uniqueUsers={uniqueUsers}
      />

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
  filterButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  filterButtonActive: {
    backgroundColor: '#ef4444',
  },
  filterButtonText: {
    color: '#ffffff',
    fontSize: 14,
  },
  exportButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  exportButtonText: {
    color: '#ffffff',
    fontSize: 14,
  },
  activeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  activeFiltersLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  filterChip: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    maxWidth: 220,
  },
  filterChipText: {
    fontSize: 11,
    color: '#ef4444',
  },
  clearFiltersText: {
    fontSize: 11,
    color: '#ef4444',
    textDecorationLine: 'underline',
  },
  viewToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  viewButton: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#334155',
  },
  viewButtonActive: {
    backgroundColor: '#ef4444',
  },
  viewButtonText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  viewButtonTextActive: {
    color: '#ffffff',
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
    alignItems: 'flex-start',
    marginBottom: 8,
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
  cardHeaderContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  typeBadge: {
    alignSelf: 'flex-start',
  },
  typeText: {
    fontSize: 11,
    fontWeight: '500',
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
  },
  specifications: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  customerBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  customerText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
  },
  customerSubText: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 2,
  },
  customerPaidText: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  customerPendingText: {
    color: '#60a5fa',
    fontSize: 11,
    marginTop: 2,
  },
  customerRemainingText: {
    color: '#fbbf24',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  customerFullyPaidText: {
    color: '#22c55e',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  performedBy: {
    fontSize: 11,
    color: '#64748b',
  },
  date: {
    fontSize: 11,
    color: '#64748b',
  },
  notes: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingVertical: 12,
  },
  tableHeaderCell: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingVertical: 12,
  },
  tableCellText: {
    fontSize: 13,
    color: '#cbd5e1',
  },
  dateCell: {
    width: 110,
    paddingHorizontal: 8,
  },
  itemCell: {
    width: 180,
    paddingHorizontal: 8,
  },
  typeCell: {
    width: 105,
    paddingHorizontal: 8,
  },
  customerCell: {
    width: 190,
    paddingHorizontal: 8,
  },
  paidCell: {
    width: 140,
    paddingHorizontal: 8,
  },
  remainingCell: {
    width: 140,
    paddingHorizontal: 8,
  },
  changeCell: {
    width: 85,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  afterCell: {
    width: 110,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  byCell: {
    width: 110,
    paddingHorizontal: 8,
  },
  notesCell: {
    width: 170,
    paddingHorizontal: 8,
  },
  itemNameText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ffffff',
  },
  specsText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  paidText: {
    color: '#22c55e',
    fontWeight: '600',
  },
  remainingText: {
    color: '#fbbf24',
    fontWeight: '600',
  },
  fullyPaidText: {
    color: '#22c55e',
    fontWeight: '600',
  },
  neutralText: {
    color: '#64748b',
  },
  changeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  afterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
  },
  tableTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  tableTypeText: {
    fontSize: 11,
    fontWeight: '500',
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
    paddingTop: 40,
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