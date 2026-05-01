
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
import { inventoryApi } from '../services/api';
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
  performed_by: string;
  notes: string;
  created_date: string;
}

const typeConfig: Record<string, { label: string; color: string; icon: string; bg: string }> = {
  received: { label: 'Received', color: '#22c55e', icon: '➕', bg: 'rgba(34, 197, 94, 0.1)' },
  stock_in: { label: 'Stock In', color: '#22c55e', icon: '➕', bg: 'rgba(34, 197, 94, 0.1)' },
  sold: { label: 'Sold', color: '#ef4444', icon: '➖', bg: 'rgba(239, 68, 68, 0.1)' },
  sale_confirmed: { label: 'Sale Confirmed', color: '#ef4444', icon: '➖', bg: 'rgba(239, 68, 68, 0.1)' },
  reserved: { label: 'Reserved', color: '#f97316', icon: '🔒', bg: 'rgba(249, 115, 22, 0.1)' },
  returned: { label: 'Returned', color: '#3b82f6', icon: '🔄', bg: 'rgba(59, 130, 246, 0.1)' },
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

const HistoryCard = ({ entry, onPress }: { entry: HistoryEntry; onPress: () => void }) => {
  const cfg =
    typeConfig[entry.transaction_type] || {
      label: entry.transaction_type,
      color: '#94a3b8',
      icon: '📝',
      bg: 'rgba(100, 116, 139, 0.1)',
    };

  const isPositive = entry.quantity_change > 0;

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
              <Text style={[styles.typeText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          <View style={styles.quantityContainer}>
            <Text
              style={[
                styles.quantityChange,
                isPositive ? styles.quantityPositive : styles.quantityNegative,
              ]}
            >
              {isPositive ? `+${entry.quantity_change}` : entry.quantity_change}
            </Text>
            <Text style={styles.quantityAfter}>→ {entry.quantity_after}</Text>
          </View>
        </View>

        {entry.specifications ? (
          <Text style={styles.specifications} numberOfLines={1}>
            {entry.specifications}
          </Text>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.performedBy}>by {entry.performed_by || 'System'}</Text>
          <Text style={styles.date}>{formatDate(entry.created_date)}</Text>
        </View>

        {entry.notes ? (
          <Text style={styles.notes} numberOfLines={1}>
            📝 {entry.notes}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const TableRow = ({ entry, onPress }: { entry: HistoryEntry; onPress: () => void }) => {
  const cfg =
    typeConfig[entry.transaction_type] || {
      label: entry.transaction_type,
      color: '#94a3b8',
      icon: '📝',
      bg: 'rgba(100, 116, 139, 0.1)',
    };

  const isPositive = entry.quantity_change > 0;

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
            <Text style={[styles.tableTypeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        <View style={styles.changeCell}>
          <Text
            style={[
              styles.tableCellText,
              styles.changeText,
              isPositive ? styles.quantityPositive : styles.quantityNegative,
            ]}
          >
            {isPositive ? `+${entry.quantity_change}` : entry.quantity_change}
          </Text>
        </View>

        <View style={styles.afterCell}>
          <Text style={[styles.tableCellText, styles.afterText]}>{entry.quantity_after}</Text>
        </View>

        <Text style={[styles.tableCellText, styles.byCell]}>
          {entry.performed_by || 'System'}
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

  const loadHistory = async () => {
    try {
      setLoading(true);
      const allTransactions: HistoryEntry[] = [];

      const vehiclesRes = await inventoryApi.getVehicles();
      const vehicles = vehiclesRes.data.data || [];

      for (const vehicle of vehicles) {
        const historyRes = await inventoryApi.getVehicleHistory(vehicle.id);
        const vehicleHistory = historyRes?.data?.data?.history || [];

        for (const trans of vehicleHistory) {
          allTransactions.push({
            id: trans.id,
            item_id: vehicle.id,
            item_name: vehicle.model,
            item_type: 'vehicle',
            specifications: vehicle.specifications || '',
            transaction_type: trans.event_type,
            quantity_change:
              trans.event_type === 'received' ? 1 : trans.event_type === 'sold' ? -1 : 0,
            quantity_after:
              trans.event_type === 'received' ? 1 : trans.event_type === 'sold' ? 0 : 1,
            performed_by: trans.performed_by || 'System',
            notes: trans.notes || '',
            created_date: trans.created_at,
          });
        }
      }

      const partsRes = await inventoryApi.getParts();
      const parts = partsRes.data.data || [];

      for (const part of parts) {
        const transactionsRes = await inventoryApi.getPartTransactions(part.id);
        const partTransactions = transactionsRes?.data?.data?.transactions || [];

        for (const trans of partTransactions) {
          allTransactions.push({
            id: trans.id,
            item_id: part.id,
            item_name: part.name,
            item_type: 'part',
            specifications: part.specifications || '',
            transaction_type: trans.transaction_type,
            quantity_change: trans.quantity_change,
            quantity_after: trans.quantity_after,
            performed_by: trans.performed_by || 'System',
            notes: trans.notes || '',
            created_date: trans.created_at,
          });
        }
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
    const users = new Set(history.map((h) => h.performed_by || 'System'));
    return Array.from(users).sort();
  }, [history]);

  const filteredHistory = useMemo(() => {
    return history.filter((entry) => {
      const query = search.toLowerCase();
      const itemName = (entry.item_name || '').toLowerCase();
      const specs = (entry.specifications || '').toLowerCase();
      const notes = (entry.notes || '').toLowerCase();
      const performedBy = (entry.performed_by || 'system').toLowerCase();

      if (
        query &&
        !itemName.includes(query) &&
        !specs.includes(query) &&
        !notes.includes(query) &&
        !performedBy.includes(query)
      ) {
        return false;
      }

      if (typeFilter !== 'all' && entry.transaction_type !== typeFilter) return false;
      if (userFilter !== 'all' && (entry.performed_by || 'System') !== userFilter) return false;

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
    setSelectedItem({
      id: entry.item_id,
      name: entry.item_name,
      type: entry.item_type,
      sku: entry.item_type === 'vehicle' ? entry.item_name : 'Part',
      current_quantity: entry.quantity_after,
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
      'Quantity Change',
      'Quantity After',
      'Performed By',
      'Notes',
    ];

    const rows = filteredHistory.map((entry) => [
      formatDate(entry.created_date),
      entry.item_name || '',
      entry.specifications || '',
      entry.transaction_type,
      entry.quantity_change,
      entry.quantity_after,
      entry.performed_by || 'System',
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
    search !== '' || typeFilter !== 'all' || userFilter !== 'all' || dateFilter !== 'all';

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
        <Text style={styles.headerSubtitle}>{filteredHistory.length} transactions</Text>
      </View>

      <View style={styles.actionBar}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search items, users, notes..."
            placeholderTextColor="#64748b"
            value={search}
            onChangeText={setSearch}
          />
          {search !== '' && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
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

      {hasActiveFilters && (
        <View style={styles.activeFilters}>
          <Text style={styles.activeFiltersLabel}>Active filters:</Text>

          {search !== '' && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>Search: {search}</Text>
            </View>
          )}

          {typeFilter !== 'all' && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>Type: {typeFilter.replace('_', ' ')}</Text>
            </View>
          )}

          {userFilter !== 'all' && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>User: {userFilter}</Text>
            </View>
          )}

          {dateFilter !== 'all' && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>
                {dateFilter === '7days' ? 'Last 7 days' : 'Last 30 days'}
              </Text>
            </View>
          )}

          <TouchableOpacity onPress={clearAllFilters}>
            <Text style={styles.clearFiltersText}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.viewButton, viewMode === 'cards' && styles.viewButtonActive]}
          onPress={() => setViewMode('cards')}
        >
          <Text
            style={[styles.viewButtonText, viewMode === 'cards' && styles.viewButtonTextActive]}
          >
            📱 Cards
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.viewButton, viewMode === 'table' && styles.viewButtonActive]}
          onPress={() => setViewMode('table')}
        >
          <Text
            style={[styles.viewButtonText, viewMode === 'table' && styles.viewButtonTextActive]}
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ef4444" />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
        />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View style={{ minWidth: '100%' }}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.dateCell]}>Date</Text>
              <Text style={[styles.tableHeaderCell, styles.itemCell]}>Item</Text>
              <Text style={[styles.tableHeaderCell, styles.typeCell]}>Type</Text>
              <Text style={[styles.tableHeaderCell, styles.changeCell]}>Change</Text>
              <Text style={[styles.tableHeaderCell, styles.afterCell]}>After</Text>
              <Text style={[styles.tableHeaderCell, styles.byCell]}>By</Text>
              <Text style={[styles.tableHeaderCell, styles.notesCell]}>Notes</Text>
            </View>

            {/* Table Rows - FlatList handles vertical scroll */}
            <FlatList
              data={filteredHistory}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TableRow entry={item} onPress={() => handleItemClick(item)} />
              )}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ef4444" />
              }
              showsVerticalScrollIndicator={true}
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
    width: 100,
    paddingHorizontal: 8,
  },
  changeCell: {
    width: 70,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  afterCell: {
    width: 60,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  byCell: {
    width: 110,
    paddingHorizontal: 8,
  },
  notesCell: {
    width: 150,
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
