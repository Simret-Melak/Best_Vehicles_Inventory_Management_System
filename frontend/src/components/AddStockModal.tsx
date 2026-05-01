import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  FlatList,
} from 'react-native';
import { inventoryApi } from '../services/api';

// Types
interface Vehicle {
  id: string;
  model: string;
  chassis_number: string;
  specifications: string | null;
  status: 'available' | 'reserved' | 'sold';
  unit_price: number;
}

interface Part {
  id: string;
  name: string;
  specifications: string | null;
  quantity: number;
  unit_price: number;
  min_stock_alert: number;
}

interface AddStockModalProps {
  visible: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  parts: Part[];
  onSuccess: () => void;
}

type InventoryType = 'vehicle' | 'part';

export default function AddStockModal({ 
  visible, 
  onClose, 
  vehicles = [],
  parts = [],
  onSuccess 
}: AddStockModalProps) {
  const [inventoryType, setInventoryType] = useState<InventoryType>('part');
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // New vehicle fields
  const [newVehicleModel, setNewVehicleModel] = useState('');
  const [newVehicleChassis, setNewVehicleChassis] = useState('');
  const [newVehicleSpecs, setNewVehicleSpecs] = useState('');
  const [newVehiclePrice, setNewVehiclePrice] = useState('');
  
  // New part fields
  const [newPartName, setNewPartName] = useState('');
  const [newPartSpecs, setNewPartSpecs] = useState('');
  const [newPartPrice, setNewPartPrice] = useState('');
  const [newPartMinStock, setNewPartMinStock] = useState('5');
  
  // Common fields
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setSelectedVehicleId('');
    setSelectedPartId('');
    setSearchQuery('');
    setNewVehicleModel('');
    setNewVehicleChassis('');
    setNewVehicleSpecs('');
    setNewVehiclePrice('');
    setNewPartName('');
    setNewPartSpecs('');
    setNewPartPrice('');
    setNewPartMinStock('5');
    setQuantity('');
    setMode('existing');
  };

  // Filter items based on search query
  const getFilteredItems = () => {
    if (inventoryType === 'part') {
      return parts.filter(part => 
        part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (part.specifications && part.specifications.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    } else {
      return vehicles.filter(vehicle => 
        vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vehicle.chassis_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (vehicle.specifications && vehicle.specifications.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
  };

  // Determine if quantity field should be shown
  const shouldShowQuantity = () => {
    // Parts always show quantity
    if (inventoryType === 'part') return true;
    
    // For vehicles: only show when adding to existing model
    if (inventoryType === 'vehicle' && mode === 'existing') return true;
    
    // New vehicles don't need quantity
    return false;
  };

  const handleSubmit = async () => {
    // Only validate quantity if the field is shown
    if (shouldShowQuantity()) {
      const qty = parseInt(quantity);
      if (!qty || qty <= 0) {
        Alert.alert('Error', 'Please enter a valid quantity');
        return;
      }
    }

    setLoading(true);

    try {
      if (inventoryType === 'vehicle') {
        if (mode === 'new') {
          // Create new vehicle (single unit - no quantity needed)
          if (!newVehicleModel.trim()) {
            Alert.alert('Error', 'Please enter vehicle model');
            setLoading(false);
            return;
          }
          if (!newVehicleChassis.trim()) {
            Alert.alert('Error', 'Please enter chassis number');
            setLoading(false);
            return;
          }
          if (!newVehiclePrice) {
            Alert.alert('Error', 'Please enter unit price');
            setLoading(false);
            return;
          }

          const vehicleData = {
            model: newVehicleModel.trim(),
            chassis_number: newVehicleChassis.trim(),
            specifications: newVehicleSpecs || null,
            unit_price: parseFloat(newVehiclePrice),
          };

          const response = await inventoryApi.createVehicle(vehicleData);
          
          Alert.alert('Success', `Vehicle ${response.data.data.model} added to inventory!`);
          
        } else {
          // Add stock to existing vehicle (add multiple new units)
          if (!selectedVehicleId) {
            Alert.alert('Error', 'Please select a vehicle model');
            setLoading(false);
            return;
          }

          const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
          if (!selectedVehicle) {
            Alert.alert('Error', 'Selected vehicle not found');
            setLoading(false);
            return;
          }

          const qty = parseInt(quantity);
          
          // Create multiple units based on quantity
          let successCount = 0;
          for (let i = 0; i < qty; i++) {
            const timestamp = Date.now() + i;
            const newChassisNumber = `${selectedVehicle.chassis_number.slice(0, -6)}${timestamp.toString().slice(-6)}`;
            
            const vehicleData = {
              model: selectedVehicle.model,
              chassis_number: newChassisNumber,
              specifications: selectedVehicle.specifications,
              unit_price: selectedVehicle.unit_price,
            };

            await inventoryApi.createVehicle(vehicleData);
            successCount++;
          }
          
          Alert.alert('Success', `Added ${successCount} new unit(s) of ${selectedVehicle.model}!`);
        }
      } else {
        // Parts logic
        const qty = parseInt(quantity);
        
        if (mode === 'new') {
          // Create new part
          if (!newPartName.trim()) {
            Alert.alert('Error', 'Please enter part name');
            setLoading(false);
            return;
          }
          if (!newPartPrice) {
            Alert.alert('Error', 'Please enter unit price');
            setLoading(false);
            return;
          }

          const partData = {
            name: newPartName.trim(),
            specifications: newPartSpecs || null,
            quantity: qty,
            unit_price: parseFloat(newPartPrice),
            min_stock_alert: parseInt(newPartMinStock) || 5,
          };

          const response = await inventoryApi.createPart(partData);
          
          Alert.alert('Success', `Part ${response.data.data.name} added with ${qty} units!`);
          
        } else {
          // Add stock to existing part
          if (!selectedPartId) {
            Alert.alert('Error', 'Please select a part');
            setLoading(false);
            return;
          }

          const response = await inventoryApi.addPartStock(selectedPartId, qty);
          
          Alert.alert('Success', `Added ${qty} units to ${response.data.data.name}!`);
        }
      }

      setLoading(false);
      resetForm();
      onSuccess();
      onClose();
      
    } catch (error: any) {
      console.error('Error adding stock:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to add stock. Please try again.');
      setLoading(false);
    }
  };

  const selectedVehicle = vehicles?.find(v => v.id === selectedVehicleId);
  const selectedPart = parts?.find(p => p.id === selectedPartId);
  
  const existingItems = getFilteredItems();
  const hasItems = existingItems && existingItems.length > 0;

  const renderItem = ({ item }: { item: any }) => {
    const isPart = inventoryType === 'part';
    const isSelected = isPart 
      ? selectedPartId === item.id 
      : selectedVehicleId === item.id;
    
    return (
      <TouchableOpacity
        style={[
          styles.itemOption,
          isSelected && styles.itemOptionSelected,
        ]}
        onPress={() => {
          if (isPart) {
            setSelectedPartId(item.id);
          } else {
            setSelectedVehicleId(item.id);
          }
        }}
      >
        <Text style={styles.itemOptionIcon}>
          {inventoryType === 'part' ? '🔧' : '🚛'}
        </Text>
        <View style={styles.itemOptionDetails}>
          <Text style={[
            styles.itemOptionName,
            isSelected && styles.itemOptionNameSelected,
          ]}>
            {isPart ? (item as Part).name : (item as Vehicle).model}
          </Text>
          {isPart ? (
            <Text style={styles.itemOptionStock}>
              Stock: {(item as Part).quantity} units • Price: ETB {(item as Part).unit_price.toLocaleString()}
            </Text>
          ) : (
            <Text style={styles.itemOptionStock}>
              Chassis: {(item as Vehicle).chassis_number} • Price: ETB {(item as Vehicle).unit_price.toLocaleString()}
            </Text>
          )}
        </View>
        {isSelected && <Text style={styles.checkMark}>✓</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderIcon}>➕</Text>
              <Text style={styles.modalTitle}>Add Stock</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              {/* Inventory Type Toggle */}
              <View style={styles.typeToggle}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    inventoryType === 'part' && styles.typeButtonActive,
                  ]}
                  onPress={() => {
                    setInventoryType('part');
                    resetForm();
                  }}
                >
                  <Text style={[styles.typeButtonText, inventoryType === 'part' && styles.typeButtonTextActive]}>
                    🔧 Part
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    inventoryType === 'vehicle' && styles.typeButtonActive,
                  ]}
                  onPress={() => {
                    setInventoryType('vehicle');
                    resetForm();
                  }}
                >
                  <Text style={[styles.typeButtonText, inventoryType === 'vehicle' && styles.typeButtonTextActive]}>
                    🚛 Vehicle
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Mode Toggle */}
              <View style={styles.modeToggle}>
                <TouchableOpacity
                  style={[
                    styles.modeButton,
                    mode === 'existing' && styles.modeButtonActive,
                  ]}
                  onPress={() => setMode('existing')}
                >
                  <Text style={[
                    styles.modeButtonText,
                    mode === 'existing' && styles.modeButtonTextActive,
                  ]}>
                    Existing {inventoryType === 'part' ? 'Part' : 'Model'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modeButton,
                    mode === 'new' && styles.modeButtonActive,
                  ]}
                  onPress={() => setMode('new')}
                >
                  <Text style={[
                    styles.modeButtonText,
                    mode === 'new' && styles.modeButtonTextActive,
                  ]}>
                    New {inventoryType === 'part' ? 'Part' : 'Vehicle'}
                  </Text>
                </TouchableOpacity>
              </View>

              {mode === 'existing' ? (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Select {inventoryType === 'part' ? 'Part' : 'Vehicle'}
                  </Text>
                  
                  {/* Search Bar */}
                  <View style={styles.searchContainer}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                      style={styles.searchInput}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder={`Search by name, chassis, or specs...`}
                      placeholderTextColor="#64748b"
                    />
                    {searchQuery !== '' && (
                      <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Text style={styles.clearIcon}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  {/* Items List - Scrollable */}
                  <View style={styles.itemListContainer}>
                    {!hasItems ? (
                      <Text style={styles.emptyText}>
                        No {inventoryType === 'part' ? 'parts' : 'vehicles'} available. Add a new one first.
                      </Text>
                    ) : (
                      <FlatList
                        data={existingItems}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        showsVerticalScrollIndicator={true}
                        style={styles.flatList}
                      />
                    )}
                  </View>
                </View>
              ) : (
                inventoryType === 'part' ? (
                  // New Part Form
                  <>
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Part Name *</Text>
                      <TextInput
                        style={styles.input}
                        value={newPartName}
                        onChangeText={setNewPartName}
                        placeholder="e.g., Heavy Duty Battery"
                        placeholderTextColor="#64748b"
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Specifications</Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        value={newPartSpecs}
                        onChangeText={setNewPartSpecs}
                        placeholder="12V, 200Ah, Lithium..."
                        placeholderTextColor="#64748b"
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                    </View>

                    <View style={styles.row}>
                      <View style={[styles.formGroup, styles.flex1]}>
                        <Text style={styles.label}>Unit Price *</Text>
                        <TextInput
                          style={styles.input}
                          value={newPartPrice}
                          onChangeText={setNewPartPrice}
                          placeholder="Price"
                          placeholderTextColor="#64748b"
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={[styles.formGroup, styles.flex1]}>
                        <Text style={styles.label}>Min Stock Alert</Text>
                        <TextInput
                          style={styles.input}
                          value={newPartMinStock}
                          onChangeText={setNewPartMinStock}
                          placeholder="5"
                          placeholderTextColor="#64748b"
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  </>
                ) : (
                  // New Vehicle Form
                  <>
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Vehicle Model *</Text>
                      <TextInput
                        style={styles.input}
                        value={newVehicleModel}
                        onChangeText={setNewVehicleModel}
                        placeholder="e.g., Electric Bajaj"
                        placeholderTextColor="#64748b"
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Chassis Number *</Text>
                      <TextInput
                        style={styles.input}
                        value={newVehicleChassis}
                        onChangeText={setNewVehicleChassis}
                        placeholder="Unique chassis number"
                        placeholderTextColor="#64748b"
                        autoCapitalize="characters"
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Specifications</Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        value={newVehicleSpecs}
                        onChangeText={setNewVehicleSpecs}
                        placeholder="Without battery, Red color..."
                        placeholderTextColor="#64748b"
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Unit Price *</Text>
                      <TextInput
                        style={styles.input}
                        value={newVehiclePrice}
                        onChangeText={setNewVehiclePrice}
                        placeholder="Price"
                        placeholderTextColor="#64748b"
                        keyboardType="numeric"
                      />
                    </View>
                    
                    {/* Note for new vehicle */}
                    <View style={styles.noteContainer}>
                      <Text style={styles.noteText}>
                        ℹ️ One vehicle unit will be added with the chassis number above.
                      </Text>
                    </View>
                  </>
                )
              )}

              {/* Quantity Input - Only shown when needed */}
              {shouldShowQuantity() && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Quantity to Add *
                    {inventoryType === 'vehicle' && mode === 'existing' && ' (Number of new units)'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={quantity}
                    onChangeText={setQuantity}
                    placeholder="Enter quantity"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                  />
                </View>
              )}

              {/* Preview Section */}
              {mode === 'existing' && (
                <View style={styles.previewContainer}>
                  <Text style={styles.previewTitle}>📋 Summary</Text>
                  {inventoryType === 'part' && selectedPart && quantity && (
                    <Text style={styles.previewText}>
                      {selectedPart.name}: {selectedPart.quantity} → {selectedPart.quantity + (parseInt(quantity) || 0)} units
                    </Text>
                  )}
                  {inventoryType === 'vehicle' && selectedVehicle && quantity && (
                    <Text style={styles.previewText}>
                      Adding {quantity} new unit(s) of {selectedVehicle.model}
                    </Text>
                  )}
                </View>
              )}
              {mode === 'new' && (
                <View style={styles.previewContainer}>
                  <Text style={styles.previewTitle}>📋 Summary</Text>
                  {inventoryType === 'vehicle' && newVehicleModel && (
                    <Text style={styles.previewText}>
                      Adding new vehicle: {newVehicleModel}
                    </Text>
                  )}
                  {inventoryType === 'part' && newPartName && quantity && (
                    <Text style={styles.previewText}>
                      Creating new part: {newPartName} with {quantity} units
                    </Text>
                  )}
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    loading && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Add Stock</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: '90%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 12,
  },
  modalHeaderIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
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
  typeToggle: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#ef4444',
  },
  typeButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#ffffff',
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#ef4444',
  },
  modeButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  modeButtonTextActive: {
    color: '#ffffff',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
    marginBottom: 8,
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
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
    color: '#64748b',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 14,
  },
  clearIcon: {
    fontSize: 14,
    color: '#64748b',
    padding: 4,
  },
  itemListContainer: {
    maxHeight: 300,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  flatList: {
    maxHeight: 300,
  },
  itemOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  itemOptionSelected: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  itemOptionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  itemOptionDetails: {
    flex: 1,
  },
  itemOptionName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 2,
  },
  itemOptionNameSelected: {
    color: '#ef4444',
  },
  itemOptionStock: {
    fontSize: 11,
    color: '#64748b',
  },
  checkMark: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
  noteContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  noteText: {
    fontSize: 12,
    color: '#60a5fa',
    textAlign: 'center',
  },
  previewContainer: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  previewTitle: {
    fontSize: 12,
    color: '#22c55e',
    marginBottom: 4,
  },
  previewText: {
    fontSize: 13,
    color: '#ffffff',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
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
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
});