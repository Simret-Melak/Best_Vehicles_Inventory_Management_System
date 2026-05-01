
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
import { inventoryApi } from '../services/api';

interface Transaction {
  id: string;
  event_type?: string;  // For vehicle history
  transaction_type?: string;  // For part transactions
  quantity_change: number;
  quantity_after: number;
  performed_by?: string;
  customer?: { full_name: string; phone: string };
  sales_order?: { order_number: string };
  notes: string;
  created_at: string;  // Backend uses created_at, not created_date
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

// Safe formatDate function
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return 'Unknown date';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    });
  } catch (error) {
    return 'Invalid date';
  }
};

// Get transaction type from either event_type or transaction_type
const getTransactionType = (transaction: Transaction): string => {
  return transaction.event_type || transaction.transaction_type || 'unknown';
};

const getTransactionIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t === 'received' || t === 'stock_in') return '➕';
  if (t === 'sold' || t === 'sale_confirmed') return '➖';
  if (t === 'reserved') return '🔒';
  if (t === 'returned') return '🔄';
  return '📝';
};

const getTransactionColor = (type: string) => {
  const t = type.toLowerCase();
  if (t === 'received' || t === 'stock_in') return '#22c55e';
  if (t === 'sold' || t === 'sale_confirmed') return '#ef4444';
  if (t === 'reserved') return '#f97316';
  if (t === 'returned') return '#3b82f6';
  return '#94a3b8';
};

const getTransactionLabel = (type: string) => {
  const t = type.toLowerCase();
  switch(t) {
    case 'received': return 'Vehicle Received';
    case 'stock_in': return 'Stock Added';
    case 'sold': return 'Vehicle Sold';
    case 'sale_confirmed': return 'Sale Confirmed';
    case 'reserved': return 'Reserved';
    case 'returned': return 'Returned';
    default: return type;
  }
};

const TransactionCard = ({ transaction }: { transaction: Transaction }) => {
  const quantityChange = transaction?.quantity_change ?? 0;
  const quantityAfter = transaction?.quantity_after ?? 0;
  const isPositive = quantityChange > 0;
  const transactionType = getTransactionType(transaction);
  const isSale = transactionType === 'sold' || transactionType === 'sale_confirmed';
  
  const icon = getTransactionIcon(transactionType);
  const color = getTransactionColor(transactionType);
  const label = getTransactionLabel(transactionType);
  const performedBy = transaction?.performed_by || 'System';
  const createdDate = transaction?.created_at;
  const notes = transaction?.notes;
  const customer = transaction?.customer;
  const salesOrder = transaction?.sales_order;
  const formattedDate = formatDate(createdDate);

  return (
    <View style={styles.transactionCard}>
      {/* Header with Icon and Type */}
      <View style={styles.transactionHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionType}>{label}</Text>
          <Text style={styles.transactionDate}>{formattedDate}</Text>
        </View>
        <View style={styles.quantityContainer}>
          <Text style={[
            styles.quantityChange,
            isPositive ? styles.quantityPositive : styles.quantityNegative
          ]}>
            {isPositive ? `+${quantityChange}` : quantityChange}
          </Text>
          <Text style={styles.quantityAfter}>→ {quantityAfter}</Text>
        </View>
      </View>
      
      {/* Performed By */}
      <View style={styles.infoRow}>
        <Text style={styles.infoIcon}>👤</Text>
        <Text style={styles.infoText}>Performed by: <Text style={styles.infoValue}>{performedBy}</Text></Text>
      </View>
      
      {/* Customer Info (if sale) */}
      {isSale && customer && customer.full_name && (
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>👥</Text>
          <Text style={styles.infoText}>Customer: <Text style={styles.infoValue}>{customer.full_name}</Text></Text>
          {customer.phone && (
            <Text style={styles.customerPhone}>📞 {customer.phone}</Text>
          )}
        </View>
      )}
      
      {/* Order Number (if sale) */}
      {isSale && salesOrder && salesOrder.order_number && (
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>📋</Text>
          <Text style={styles.infoText}>Order: <Text style={styles.orderNumberValue}>{salesOrder.order_number}</Text></Text>
        </View>
      )}
      
      {/* Notes */}
      {notes ? (
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>📝 Notes:</Text>
          <Text style={styles.notesText}>{notes}</Text>
        </View>
      ) : null}
    </View>
  );
};

export default function ItemHistoryModal({ visible, onClose, item }: ItemHistoryModalProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [itemDetails, setItemDetails] = useState<any>(null);

  const loadHistory = async () => {
    if (!item || !item.id) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      let response;
      
      if (item.type === 'vehicle') {
        response = await inventoryApi.getVehicleHistory(item.id);
        const data = response?.data?.data;
        if (data) {
          setItemDetails(data.vehicle);
          setTransactions(data.history || []);
        } else {
          setTransactions([]);
        }
      } else {
        response = await inventoryApi.getPartTransactions(item.id);
        const data = response?.data?.data;
        if (data) {
          setItemDetails(data.part);
          setTransactions(data.transactions || []);
        } else {
          setTransactions([]);
        }
      }
    } catch (error) {
      console.error('Error loading history:', error);
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderText}>
              <Text style={styles.modalTitle}>{item.name || 'Unknown Item'}</Text>
              <Text style={styles.modalSubtitle}>
                {item.type === 'vehicle' 
                  ? `Chassis: ${item.sku || item.id || 'N/A'}`
                  : `Current Stock: ${item.current_quantity || 0} units`}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Summary Stats */}
          {itemDetails && (
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {item.type === 'vehicle' 
                    ? (itemDetails.status === 'available' ? 'Available' : itemDetails.status || 'Unknown')
                    : `${itemDetails.quantity || 0} units`}
                </Text>
                <Text style={styles.statLabel}>Current Status</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  Br {(itemDetails.unit_price || 0).toLocaleString()}
                </Text>
                <Text style={styles.statLabel}>Unit Price</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{transactions.length}</Text>
                <Text style={styles.statLabel}>Total Events</Text>
              </View>
            </View>
          )}

          {/* Transactions List */}
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
              keyExtractor={(item, index) => item?.id || index.toString()}
              renderItem={({ item }) => <TransactionCard transaction={item} />}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ef4444" />
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
    marginBottom: 20,
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ef4444',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
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
  customerPhone: {
    fontSize: 11,
    color: '#60a5fa',
    marginLeft: 24,
    marginTop: 2,
  },
  orderNumberValue: {
    color: '#fbbf24',
    fontWeight: '500',
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
