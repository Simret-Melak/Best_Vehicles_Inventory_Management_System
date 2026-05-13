import React, { useCallback, useEffect, useState } from 'react';
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
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { inventoryApi } from '../services/api';

interface LowStockPart {
  id: string;
  part_number?: string | null;
  name: string;
  specifications?: string | null;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  unit_price: number;
  min_stock_alert: number;
  created_at?: string;
}

const toNumber = (value: unknown): number => {
  const numberValue = Number(value || 0);
  return Number.isNaN(numberValue) ? 0 : numberValue;
};

const formatMoney = (value: unknown): string => {
  return `Br ${toNumber(value).toLocaleString()}`;
};

const LowStockCard = ({ item }: { item: LowStockPart }) => {
  const totalQuantity = toNumber(item.quantity);
  const reservedQuantity = toNumber(item.reserved_quantity);
  const availableQuantity = toNumber(item.available_quantity);
  const minStockAlert = toNumber(item.min_stock_alert || 5);

  const isOutOfStock = availableQuantity <= 0;

  return (
    <View style={[styles.card, isOutOfStock && styles.outOfStockCard]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <Text style={styles.itemTypeBadge}>🔧 LOW STOCK PART</Text>
          <Text style={styles.itemName}>{item.name}</Text>

          {item.part_number ? (
            <Text style={styles.partNumber}>Part #: {item.part_number}</Text>
          ) : null}
        </View>

        <View style={styles.availableBox}>
          <Text
            style={[
              styles.availableNumber,
              isOutOfStock && styles.outOfStockNumber,
            ]}
          >
            {availableQuantity}
          </Text>
          <Text style={styles.availableLabel}>available</Text>
        </View>
      </View>

      {item.specifications ? (
        <Text style={styles.specifications} numberOfLines={2}>
          {item.specifications}
        </Text>
      ) : null}

      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          ⚠️ Available stock is below minimum alert level
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{totalQuantity}</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Reserved</Text>
          <Text style={styles.statValue}>{reservedQuantity}</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Min Alert</Text>
          <Text style={styles.statValue}>{minStockAlert}</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Price</Text>
          <Text style={styles.statValue}>{formatMoney(item.unit_price)}</Text>
        </View>
      </View>
    </View>
  );
};

export default function LowStockScreen() {
  const navigation = useNavigation();

  const [parts, setParts] = useState<LowStockPart[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLowStockParts = async () => {
    try {
      const response = await inventoryApi.getLowStockParts();

      const loadedParts: LowStockPart[] = (response.data.data || [])
        .map((part: any) => ({
          id: part.id,
          part_number: part.part_number,
          name: part.name,
          specifications: part.specifications || '',
          quantity: toNumber(part.quantity),
          reserved_quantity: toNumber(part.reserved_quantity),
          available_quantity: toNumber(part.available_quantity),
          unit_price: toNumber(part.unit_price),
          min_stock_alert: toNumber(part.min_stock_alert || 5),
          created_at: part.created_at,
        }))
        .sort((a: LowStockPart, b: LowStockPart) => {
          return a.available_quantity - b.available_quantity;
        });

      setParts(loadedParts);
    } catch (error: any) {
      console.error('Error loading low stock parts:', {
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
      });

      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to load low stock items'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLowStockParts();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLowStockParts();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLowStockParts();
    setRefreshing(false);
  };

  const filteredParts = parts.filter((part) => {
    const query = searchQuery.toLowerCase().trim();

    if (!query) return true;

    return (
      part.name.toLowerCase().includes(query) ||
      part.specifications?.toLowerCase().includes(query) ||
      part.part_number?.toLowerCase().includes(query)
    );
  });

  if (loading && parts.length === 0) {
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
        <View style={styles.headerTopRow}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Low Stock</Text>
            <Text style={styles.headerSubtitle}>
              {filteredParts.length}{' '}
              {filteredParts.length === 1 ? 'item needs' : 'items need'} attention
            </Text>
          </View>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>

        <TextInput
          style={styles.searchInput}
          placeholder="Search low stock parts..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={filteredParts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <LowStockCard item={item} />}
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
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>No low stock items</Text>
            <Text style={styles.emptySubtitle}>
              All parts are above their minimum stock alert level.
            </Text>
          </View>
        }
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
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
  },
  backButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  searchContainer: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 14,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
    color: '#64748b',
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    paddingVertical: 11,
  },
  clearIcon: {
    color: '#64748b',
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  outOfStockCard: {
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  cardTitleContainer: {
    flex: 1,
  },
  itemTypeBadge: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  itemName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  partNumber: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  availableBox: {
    alignItems: 'flex-end',
  },
  availableNumber: {
    color: '#fbbf24',
    fontSize: 26,
    fontWeight: 'bold',
  },
  outOfStockNumber: {
    color: '#ef4444',
  },
  availableLabel: {
    color: '#64748b',
    fontSize: 10,
  },
  specifications: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  warningBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  warningText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 78,
  },
  statLabel: {
    color: '#64748b',
    fontSize: 10,
    marginBottom: 2,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});