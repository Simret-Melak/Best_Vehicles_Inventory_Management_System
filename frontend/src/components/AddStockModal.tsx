import React, { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { inventoryApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

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
  part_number?: string;
  name: string;
  specifications: string | null;
  quantity: number;
  reserved_quantity?: number;
  available_quantity?: number;
  unit_price: number;
  min_stock_alert: number;
}

type InventoryType = 'vehicle' | 'part';
type ModeType = 'existing' | 'new';

interface InitialItemSelection {
  id: string;
  type: InventoryType;
}

interface AddStockModalProps {
  visible: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  parts: Part[];
  onSuccess: () => void;
  initialItem?: InitialItemSelection | null;
}

const toNumber = (value: any) => {
  const numberValue = Number(value || 0);
  return Number.isNaN(numberValue) ? 0 : numberValue;
};

const getUserId = (user: any) => {
  return user?.id || user?.user_id || user?.uuid || null;
};

const getUserDisplayName = (user: any) => {
  return user?.full_name || user?.name || user?.email || 'User';
};

export default function AddStockModal({
  visible,
  onClose,
  vehicles = [],
  parts = [],
  onSuccess,
  initialItem = null,
}: AddStockModalProps) {
  const { user } = useAuth();

  const userRole = user?.role;
  const userId = getUserId(user);
  const userDisplayName = getUserDisplayName(user);

  // Based on your rule:
  // admin = view only
  // worker/store_manager = can add/create/update stock
  // super_admin = mainly user management, not inventory manipulation here
  const canManageInventory =
    userRole === 'worker' || userRole === 'store_manager';

  const hasPresetItem = !!initialItem;

  const [inventoryType, setInventoryType] = useState<InventoryType>('part');
  const [mode, setMode] = useState<ModeType>('existing');

  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [newVehicleModel, setNewVehicleModel] = useState('');
  const [newVehicleChassis, setNewVehicleChassis] = useState('');
  const [newVehicleSpecs, setNewVehicleSpecs] = useState('');
  const [newVehiclePrice, setNewVehiclePrice] = useState('');

  const [newPartName, setNewPartName] = useState('');
  const [newPartSpecs, setNewPartSpecs] = useState('');
  const [newPartPrice, setNewPartPrice] = useState('');
  const [newPartMinStock, setNewPartMinStock] = useState('5');

  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setInventoryType('part');
    setMode('existing');

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
    setNotes('');
  };

  useEffect(() => {
    if (!visible) return;

    resetForm();

    if (initialItem) {
      setInventoryType(initialItem.type);
      setMode('existing');

      if (initialItem.type === 'vehicle') {
        setSelectedVehicleId(initialItem.id);
        setSelectedPartId('');
      } else {
        setSelectedPartId(initialItem.id);
        setSelectedVehicleId('');
      }
    }
  }, [visible, initialItem?.id, initialItem?.type]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (inventoryType === 'part') {
      return parts.filter((part) => {
        return (
          part.name?.toLowerCase().includes(query) ||
          part.part_number?.toLowerCase().includes(query) ||
          part.specifications?.toLowerCase().includes(query)
        );
      });
    }

    return vehicles.filter((vehicle) => {
      return (
        vehicle.model?.toLowerCase().includes(query) ||
        vehicle.chassis_number?.toLowerCase().includes(query) ||
        vehicle.specifications?.toLowerCase().includes(query)
      );
    });
  }, [inventoryType, parts, vehicles, searchQuery]);

  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === selectedVehicleId
  );

  const selectedPart = parts.find((part) => part.id === selectedPartId);

  const selectedItemName =
    inventoryType === 'part'
      ? selectedPart?.name || 'Selected part'
      : selectedVehicle?.model || 'Selected vehicle';

  const selectedItemSubText =
    inventoryType === 'part'
      ? `Current stock: ${toNumber(selectedPart?.quantity)} units • Available: ${
          selectedPart?.available_quantity ??
          toNumber(selectedPart?.quantity) -
            toNumber(selectedPart?.reserved_quantity)
        }`
      : `Chassis: ${selectedVehicle?.chassis_number || 'N/A'} • Price: ETB ${toNumber(
          selectedVehicle?.unit_price
        ).toLocaleString()}`;

  const shouldShowQuantity = () => {
    if (inventoryType === 'part') return true;
    if (inventoryType === 'vehicle' && mode === 'existing') return true;
    return false;
  };

  const validatePermission = () => {
    if (!canManageInventory) {
      Alert.alert(
        'Permission Denied',
        'Only workers and store managers can add or update stock. Admin can only view inventory.'
      );
      return false;
    }

    if (!userId) {
      Alert.alert(
        'Login Required',
        'Could not find the logged-in user ID. Please log out and log in again.'
      );
      return false;
    }

    return true;
  };

  const validateQuantity = () => {
    if (!shouldShowQuantity()) return true;

    const qty = parseInt(quantity, 10);

    if (!qty || qty <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validatePermission()) return;
    if (!validateQuantity()) return;

    setLoading(true);

    try {
      const performedBy = userId;
      const performedByName = userDisplayName;
      const cleanNotes = notes.trim() || undefined;

      if (inventoryType === 'vehicle') {
        if (mode === 'new') {
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

          if (!newVehiclePrice.trim()) {
            Alert.alert('Error', 'Please enter unit price');
            setLoading(false);
            return;
          }

          const vehicleData = {
            model: newVehicleModel.trim(),
            chassis_number: newVehicleChassis.trim(),
            specifications: newVehicleSpecs.trim() || null,
            unit_price: toNumber(newVehiclePrice),
            performed_by: performedBy,
            performed_by_name: performedByName,
          };

          const response = await inventoryApi.createVehicle(vehicleData);

          Alert.alert(
            'Success',
            `Vehicle ${response.data.data.model} added to inventory.`
          );
        } else {
          if (!selectedVehicleId) {
            Alert.alert('Error', 'Please select a vehicle model');
            setLoading(false);
            return;
          }

          if (!selectedVehicle) {
            Alert.alert('Error', 'Selected vehicle not found');
            setLoading(false);
            return;
          }

          const qty = parseInt(quantity, 10);
          let successCount = 0;

          for (let i = 0; i < qty; i++) {
            const timestamp = Date.now() + i;

            const baseChassis =
              selectedVehicle.chassis_number.length > 6
                ? selectedVehicle.chassis_number.slice(0, -6)
                : selectedVehicle.chassis_number;

            const newChassisNumber = `${baseChassis}${timestamp
              .toString()
              .slice(-6)}`;

            const vehicleData = {
              model: selectedVehicle.model,
              chassis_number: newChassisNumber,
              specifications: selectedVehicle.specifications,
              unit_price: selectedVehicle.unit_price,
              performed_by: performedBy,
              performed_by_name: performedByName,
            };

            await inventoryApi.createVehicle(vehicleData);
            successCount += 1;
          }

          Alert.alert(
            'Success',
            `Added ${successCount} new unit(s) of ${selectedVehicle.model}.`
          );
        }
      } else {
        const qty = parseInt(quantity, 10);

        if (mode === 'new') {
          if (!newPartName.trim()) {
            Alert.alert('Error', 'Please enter part name');
            setLoading(false);
            return;
          }

          if (!newPartPrice.trim()) {
            Alert.alert('Error', 'Please enter unit price');
            setLoading(false);
            return;
          }

          const partData = {
            name: newPartName.trim(),
            specifications: newPartSpecs.trim() || null,
            quantity: qty,
            unit_price: toNumber(newPartPrice),
            min_stock_alert: parseInt(newPartMinStock, 10) || 5,
            performed_by: performedBy,
            performed_by_name: performedByName,
          };

          const response = await inventoryApi.createPart(partData);

          Alert.alert(
            'Success',
            `Part ${response.data.data.name} added with ${qty} units.`
          );
        } else {
          if (!selectedPartId) {
            Alert.alert('Error', 'Please select a part');
            setLoading(false);
            return;
          }

          const response = await inventoryApi.addPartStock(
            selectedPartId,
            qty,
            cleanNotes,
            performedBy,
            performedByName
          );

          Alert.alert(
            'Success',
            `Added ${qty} units to ${response.data.data.name}.`
          );
        }
      }

      setLoading(false);
      resetForm();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error adding stock:', {
        status: error.response?.status,
        data: error.response?.data,
        requestData: error.config?.data,
        url: error.config?.url,
        message: error.message,
      });

      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to add stock. Please try again.'
      );

      setLoading(false);
    }
  };

  const renderSelectableItem = (item: any) => {
    const isPart = inventoryType === 'part';

    const isSelected = isPart
      ? selectedPartId === item.id
      : selectedVehicleId === item.id;

    const itemName = isPart ? item.name : item.model;

    const itemSubText = isPart
      ? `Stock: ${toNumber(item.quantity)} units • Available: ${
          item.available_quantity ??
          toNumber(item.quantity) - toNumber(item.reserved_quantity)
        } • Price: ETB ${toNumber(item.unit_price).toLocaleString()}`
      : `Chassis: ${item.chassis_number} • Price: ETB ${toNumber(
          item.unit_price
        ).toLocaleString()}`;

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.itemOption, isSelected && styles.itemOptionSelected]}
        onPress={() => {
          if (isPart) {
            setSelectedPartId(item.id);
          } else {
            setSelectedVehicleId(item.id);
          }
        }}
      >
        <Text style={styles.itemOptionIcon}>{isPart ? '🔧' : '🚛'}</Text>

        <View style={styles.itemOptionDetails}>
          <Text
            style={[
              styles.itemOptionName,
              isSelected && styles.itemOptionNameSelected,
            ]}
          >
            {itemName}
          </Text>

          {isPart && item.part_number ? (
            <Text style={styles.itemOptionCode}>{item.part_number}</Text>
          ) : null}

          <Text style={styles.itemOptionStock}>{itemSubText}</Text>
        </View>

        {isSelected && <Text style={styles.checkMark}>✓</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderIcon}>➕</Text>
              <Text style={styles.modalTitle}>Add Stock</Text>

              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              {!canManageInventory ? (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    Admin and super admin accounts cannot add or update stock from
                    this screen. Inventory stock changes are allowed for workers
                    and store managers.
                  </Text>
                </View>
              ) : null}

              {!hasPresetItem ? (
                <View style={styles.typeToggle}>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      inventoryType === 'part' && styles.typeButtonActive,
                    ]}
                    onPress={() => {
                      setInventoryType('part');
                      setMode('existing');
                      setSelectedVehicleId('');
                      setSearchQuery('');
                      setQuantity('');
                    }}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        inventoryType === 'part' && styles.typeButtonTextActive,
                      ]}
                    >
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
                      setMode('new');
                      setSelectedPartId('');
                      setSearchQuery('');
                      setQuantity('');
                    }}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        inventoryType === 'vehicle' &&
                          styles.typeButtonTextActive,
                      ]}
                    >
                      🚛 Vehicle
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.lockedItemNotice}>
                  <Text style={styles.lockedItemNoticeText}>
                    {inventoryType === 'vehicle'
                      ? '🚛 Adding stock for this vehicle'
                      : '🔧 Adding stock for this part'}
                  </Text>
                </View>
              )}

              {!hasPresetItem ? (
                <View style={styles.modeToggle}>
                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      mode === 'existing' && styles.modeButtonActive,
                    ]}
                    onPress={() => setMode('existing')}
                  >
                    <Text
                      style={[
                        styles.modeButtonText,
                        mode === 'existing' && styles.modeButtonTextActive,
                      ]}
                    >
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
                    <Text
                      style={[
                        styles.modeButtonText,
                        mode === 'new' && styles.modeButtonTextActive,
                      ]}
                    >
                      New {inventoryType === 'part' ? 'Part' : 'Vehicle'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {mode === 'existing' ? (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    {hasPresetItem
                      ? 'Selected Item'
                      : `Select ${inventoryType === 'part' ? 'Part' : 'Vehicle'}`}
                  </Text>

                  {hasPresetItem ? (
                    <View style={styles.lockedSelectedItemBox}>
                      <Text style={styles.lockedSelectedItemName}>
                        {selectedItemName}
                      </Text>

                      <Text style={styles.lockedSelectedItemSub}>
                        {selectedItemSubText}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.searchContainer}>
                        <Text style={styles.searchIcon}>🔍</Text>

                        <TextInput
                          style={styles.searchInput}
                          value={searchQuery}
                          onChangeText={setSearchQuery}
                          placeholder={
                            inventoryType === 'part'
                              ? 'Search by name, part number, or specs...'
                              : 'Search by model, chassis, or specs...'
                          }
                          placeholderTextColor="#64748b"
                        />

                        {searchQuery !== '' && (
                          <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Text style={styles.clearIcon}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      <View style={styles.itemListContainer}>
                        {filteredItems.length === 0 ? (
                          <Text style={styles.emptyText}>
                            No {inventoryType === 'part' ? 'parts' : 'vehicles'}{' '}
                            found.
                          </Text>
                        ) : (
                          filteredItems.map(renderSelectableItem)
                        )}
                      </View>
                    </>
                  )}
                </View>
              ) : inventoryType === 'part' ? (
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
                      placeholder="Without battery, red color..."
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

                  <View style={styles.noteContainer}>
                    <Text style={styles.noteText}>
                      ℹ️ One vehicle unit will be added with the chassis number
                      above.
                    </Text>
                  </View>
                </>
              )}

              {shouldShowQuantity() && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Quantity to Add *
                    {inventoryType === 'vehicle' &&
                      mode === 'existing' &&
                      ' (Number of new units)'}
                  </Text>

                  <TextInput
                    style={styles.input}
                    value={quantity}
                    onChangeText={(text) =>
                      setQuantity(text.replace(/[^0-9]/g, ''))
                    }
                    placeholder="Enter quantity"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                  />
                </View>
              )}

              {inventoryType === 'part' && mode === 'existing' ? (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Optional note for stock history"
                    placeholderTextColor="#64748b"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              ) : null}

              {mode === 'existing' ? (
                <View style={styles.previewContainer}>
                  <Text style={styles.previewTitle}>📋 Summary</Text>

                  {inventoryType === 'part' && selectedPart && quantity ? (
                    <Text style={styles.previewText}>
                      {selectedPart.name}: {selectedPart.quantity} →{' '}
                      {selectedPart.quantity + (parseInt(quantity, 10) || 0)}{' '}
                      units
                    </Text>
                  ) : null}

                  {inventoryType === 'vehicle' && selectedVehicle && quantity ? (
                    <Text style={styles.previewText}>
                      Adding {quantity} new unit(s) of {selectedVehicle.model}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <View style={styles.previewContainer}>
                  <Text style={styles.previewTitle}>📋 Summary</Text>

                  {inventoryType === 'vehicle' && newVehicleModel ? (
                    <Text style={styles.previewText}>
                      Adding new vehicle: {newVehicleModel}
                    </Text>
                  ) : null}

                  {inventoryType === 'part' && newPartName && quantity ? (
                    <Text style={styles.previewText}>
                      Creating new part: {newPartName} with {quantity} units
                    </Text>
                  ) : null}
                </View>
              )}

              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (loading || !canManageInventory) &&
                      styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={loading || !canManageInventory}
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
  warningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    color: '#fca5a5',
    fontSize: 13,
    lineHeight: 18,
  },
  lockedItemNotice: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  lockedItemNoticeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  lockedSelectedItemBox: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  lockedSelectedItemName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  lockedSelectedItemSub: {
    color: '#94a3b8',
    fontSize: 12,
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
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
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
  itemOptionCode: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 2,
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