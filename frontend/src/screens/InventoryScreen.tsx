import React, { useState, useEffect } from 'react';
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
  Modal,
} from 'react-native';

// Types
interface InventoryItem {
  id: string;
  name: string;
  specifications: string;
  quantity: number;
  unit_price: number;
  status?: string;
}

// Sample data (replace with API call)
const sampleItems: InventoryItem[] = [
  {
    id: '1',
    name: 'Beast Axle 3000',
    specifications: 'Heavy-duty rear axle, 4×4 compatible, forged steel...',
    quantity: 12,
    unit_price: 25000,
  },
  {
    id: '2',
    name: 'Monster Suspension Kit',
    specifications: 'Full lift kit, 3-inch lift, heavy-duty shocks, polyurethane bushings',
    quantity: 38,
    unit_price: 35000,
  },
  {
    id: '3',
    name: 'Beast Off-Road Tires',
    specifications: '33" mud terrain tires, set of 4, reinforced sidewalls',
    quantity: 8,
    unit_price: 45000,
  },
];

// Inventory Card Component
const InventoryCard = ({ 
  item, 
  onAddStock, 
  onRequestSale, 
  onViewHistory 
}: { 
  item: InventoryItem; 
  onAddStock: () => void; 
  onRequestSale: (item: InventoryItem) => void; 
  onViewHistory: (item: InventoryItem) => void;
}) => {
  const isLowStock = item.quantity < 5;
  
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={styles.quantityContainer}>
          <Text style={[styles.quantityNumber, isLowStock && styles.lowStockQuantity]}>
            {item.quantity}
          </Text>
          <Text style={styles.quantityUnit}>in stock</Text>
        </View>
      </View>
      
      <Text style={styles.itemDescription} numberOfLines={2}>
        {item.specifications}
      </Text>
      
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.addStockButton} onPress={onAddStock}>
          <Text style={styles.addStockButtonText}>+ Add Stock</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saleButton} onPress={() => onRequestSale(item)}>
          <Text style={styles.saleButtonText}>Request Sale</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.historyButton} onPress={() => onViewHistory(item)}>
          <Text style={styles.historyButtonText}>📂 History</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Add Stock Modal Component
const AddStockModal = ({ 
  visible, 
  onClose, 
  items, 
  onSuccess 
}: { 
  visible: boolean; 
  onClose: () => void; 
  items: InventoryItem[]; 
  onSuccess: () => void;
}) => {
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    // API call would go here
    console.log('Add stock:', { itemId: selectedItemId, quantity, notes });
    onSuccess();
    onClose();
    setSelectedItemId('');
    setQuantity('');
    setNotes('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add Stock</Text>
          
          <Text style={styles.modalLabel}>Select Item</Text>
          <View style={styles.modalPicker}>
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.pickerOption,
                  selectedItemId === item.id && styles.pickerOptionSelected,
                ]}
                onPress={() => setSelectedItemId(item.id)}
              >
                <Text style={[
                  styles.pickerOptionText,
                  selectedItemId === item.id && styles.pickerOptionTextSelected,
                ]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <Text style={styles.modalLabel}>Quantity</Text>
          <TextInput
            style={styles.modalInput}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            placeholder="Enter quantity"
            placeholderTextColor="#64748b"
          />
          
          <Text style={styles.modalLabel}>Notes (optional)</Text>
          <TextInput
            style={[styles.modalInput, styles.modalTextArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes..."
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={3}
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSubmitButton} onPress={handleSubmit}>
              <Text style={styles.modalSubmitButtonText}>Add Stock</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Request Sale Modal Component
const RequestSaleModal = ({ 
  visible, 
  onClose, 
  item, 
  onSuccess 
}: { 
  visible: boolean; 
  onClose: () => void; 
  item: InventoryItem | null; 
  onSuccess: () => void;
}) => {
  const [quantity, setQuantity] = useState('');
  const [customerName, setCustomerName] = useState('');

  const handleSubmit = () => {
    console.log('Request sale:', { item, quantity, customerName });
    onSuccess();
    onClose();
    setQuantity('');
    setCustomerName('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Request Sale</Text>
          
          {item && (
            <View style={styles.modalInfoRow}>
              <Text style={styles.modalInfoLabel}>Item:</Text>
              <Text style={styles.modalInfoValue}>{item.name}</Text>
            </View>
          )}
          
          <Text style={styles.modalLabel}>Customer Name</Text>
          <TextInput
            style={styles.modalInput}
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Enter customer name"
            placeholderTextColor="#64748b"
          />
          
          <Text style={styles.modalLabel}>Quantity</Text>
          <TextInput
            style={styles.modalInput}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            placeholder="Enter quantity"
            placeholderTextColor="#64748b"
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSubmitButton} onPress={handleSubmit}>
              <Text style={styles.modalSubmitButtonText}>Submit Request</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Item History Modal Component
const ItemHistoryModal = ({ 
  visible, 
  onClose, 
  item 
}: { 
  visible: boolean; 
  onClose: () => void; 
  item: InventoryItem | null;
}) => {
  // Mock history data
  const mockHistory = [
    { id: '1', type: 'stock_in', quantity: 20, date: '2024-03-15', user: 'Admin', notes: 'Initial stock' },
    { id: '2', type: 'sold', quantity: -5, date: '2024-03-20', user: 'Worker', notes: 'Sold to customer' },
    { id: '3', type: 'stock_in', quantity: 10, date: '2024-04-01', user: 'Worker', notes: 'New shipment' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.modalLarge]}>
          <Text style={styles.modalTitle}>Item History</Text>
          
          {item && (
            <View style={styles.historyHeader}>
              <Text style={styles.historyItemName}>{item.name}</Text>
              <Text style={styles.historyCurrentStock}>Current: {item.quantity} in stock</Text>
            </View>
          )}
          
          <FlatList
            data={mockHistory}
            keyExtractor={(item) => item.id}
            renderItem={({ item: historyItem }) => (
              <View style={styles.historyRow}>
                <View style={styles.historyIconContainer}>
                  <Text style={historyItem.type === 'stock_in' ? styles.historyIconIn : styles.historyIconOut}>
                    {historyItem.type === 'stock_in' ? '➕' : '➖'}
                  </Text>
                </View>
                <View style={styles.historyDetails}>
                  <Text style={styles.historyType}>
                    {historyItem.type === 'stock_in' ? 'Stock Added' : 'Item Sold'}
                  </Text>
                  <Text style={styles.historyMeta}>
                    {historyItem.date} • {historyItem.user}
                  </Text>
                  {historyItem.notes && (
                    <Text style={styles.historyNotes}>{historyItem.notes}</Text>
                  )}
                </View>
                <Text style={[
                  styles.historyQuantity,
                  historyItem.type === 'stock_in' ? styles.historyQuantityPositive : styles.historyQuantityNegative
                ]}>
                  {historyItem.type === 'stock_in' ? `+${historyItem.quantity}` : `${historyItem.quantity}`}
                </Text>
              </View>
            )}
            style={styles.historyList}
          />
          
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Main Inventory Screen
export default function InventoryScreen() {
  const [items, setItems] = useState<InventoryItem[]>(sampleItems);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [saleItem, setSaleItem] = useState<InventoryItem | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [pendingCount, setPendingCount] = useState(2);

  const admin = true; // Replace with actual role check

  const loadItems = async () => {
    setLoading(true);
    // Replace with actual API call
    // const data = await api.get('/inventory/vehicles');
    // setItems(data);
    setLoading(false);
  };

  const loadPendingCount = async () => {
    if (!admin) return;
    // Replace with actual API call
    // const pending = await api.get('/sales/pending');
    // setPendingCount(pending.length);
  };

  useEffect(() => {
    loadItems();
    loadPendingCount();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    await loadPendingCount();
    setRefreshing(false);
  };

  const handleSuccess = () => {
    loadItems();
    loadPendingCount();
  };

  const filteredItems = items.filter((item) => {
    const query = search.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      item.specifications.toLowerCase().includes(query)
    );
  });

  const lowStockCount = items.filter((item) => item.quantity < 5).length;

  const renderItem = ({ item }: { item: InventoryItem }) => (
    <InventoryCard
      item={item}
      onAddStock={() => setAddStockOpen(true)}
      onRequestSale={(item) => setSaleItem(item)}
      onViewHistory={(item) => setHistoryItem(item)}
    />
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventory</Text>
        <Text style={styles.headerSubtitle}>
          {items.length} items • {lowStockCount} low stock
        </Text>
      </View>
      
      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.addStockMainButton} onPress={() => setAddStockOpen(true)}>
          <Text style={styles.addStockMainButtonText}>+ Add Stock</Text>
        </TouchableOpacity>
        {admin && pendingCount > 0 && (
          <TouchableOpacity style={styles.pendingButton}>
            <Text style={styles.pendingButtonText}>⚠️ {pendingCount} Pending</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search by name or specifications..."
          placeholderTextColor="#64748b"
          value={search}
          onChangeText={setSearch}
        />
      </View>
      
      {/* Items List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ef4444" />
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No items found.</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => setAddStockOpen(true)}>
            <Text style={styles.emptyButtonText}>+ Add your first item</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ef4444" />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
      
      {/* Modals */}
      <AddStockModal
        visible={addStockOpen}
        onClose={() => setAddStockOpen(false)}
        items={items}
        onSuccess={handleSuccess}
      />
      <RequestSaleModal
        visible={!!saleItem}
        onClose={() => setSaleItem(null)}
        item={saleItem}
        onSuccess={handleSuccess}
      />
      <ItemHistoryModal
        visible={!!historyItem}
        onClose={() => setHistoryItem(null)}
        item={historyItem}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  addStockMainButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addStockMainButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  pendingButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pendingButtonText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '500',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
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
    marginBottom: 8,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  quantityNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ef4444',
    marginRight: 4,
  },
  lowStockQuantity: {
    color: '#fbbf24',
  },
  quantityUnit: {
    fontSize: 12,
    color: '#94a3b8',
  },
  itemDescription: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 12,
    lineHeight: 18,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  addStockButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  addStockButtonText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '500',
  },
  saleButton: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  saleButtonText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '500',
  },
  historyButton: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  historyButtonText: {
    color: '#94a3b8',
    fontSize: 12,
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
    paddingTop: 100,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalLarge: {
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
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
  modalPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  pickerOption: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  pickerOptionSelected: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  pickerOptionText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  pickerOptionTextSelected: {
    color: '#ffffff',
  },
  modalInfoRow: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 8,
  },
  modalInfoLabel: {
    color: '#94a3b8',
    fontSize: 14,
    marginRight: 8,
  },
  modalInfoValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
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
  modalCloseButton: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  modalCloseButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  // History Modal Styles
  historyHeader: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  historyItemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  historyCurrentStock: {
    fontSize: 14,
    color: '#94a3b8',
  },
  historyList: {
    maxHeight: 400,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  historyIconContainer: {
    width: 40,
    alignItems: 'center',
  },
  historyIconIn: {
    fontSize: 20,
  },
  historyIconOut: {
    fontSize: 20,
  },
  historyDetails: {
    flex: 1,
    marginLeft: 12,
  },
  historyType: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  historyMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  historyNotes: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  historyQuantity: {
    fontSize: 14,
    fontWeight: '600',
  },
  historyQuantityPositive: {
    color: '#22c55e',
  },
  historyQuantityNegative: {
    color: '#ef4444',
  },
});
