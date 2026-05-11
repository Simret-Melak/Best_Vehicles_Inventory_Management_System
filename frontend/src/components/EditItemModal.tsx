import React, { useEffect, useState } from 'react';
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

interface InventoryItem {
  id: string;
  name: string;
  specifications: string;
  quantity: number;
  unit_price: number;
  chassis_number?: string;
  part_number?: string;
  status?: string;
  available_quantity?: number;
  reserved_quantity?: number;
}

interface EditItemModalProps {
  visible: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  itemType: 'vehicle' | 'part';
  onSuccess: () => void;
}

const toNumber = (value: any) => {
  const numeric = Number(value || 0);
  return Number.isNaN(numeric) ? 0 : numeric;
};

const getUserId = (user: any) => {
  return user?.id || user?.user_id || user?.uuid || null;
};

const getUserDisplayName = (user: any) => {
  return user?.full_name || user?.name || user?.email || 'User';
};

export default function EditItemModal({
  visible,
  onClose,
  item,
  itemType,
  onSuccess,
}: EditItemModalProps) {
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const userRole = user?.role;
  const canEditInventory =
    userRole === 'worker' || userRole === 'store_manager';

  useEffect(() => {
    if (!visible || !item) return;

    setName(item.name || '');
    setSpecifications(item.specifications || '');
    setUnitPrice(String(item.unit_price || ''));
    setChassisNumber(item.chassis_number || '');
  }, [visible, item]);

  const resetForm = () => {
    setName('');
    setSpecifications('');
    setUnitPrice('');
    setChassisNumber('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateForm = () => {
    if (!canEditInventory) {
      Alert.alert(
        'Permission Denied',
        'Only workers and store managers can edit inventory items.'
      );
      return false;
    }

    if (!item) {
      Alert.alert('Error', 'No item selected');
      return false;
    }

    if (!name.trim()) {
      Alert.alert('Error', itemType === 'vehicle' ? 'Model is required' : 'Part name is required');
      return false;
    }

    if (itemType === 'vehicle' && !chassisNumber.trim()) {
      Alert.alert('Error', 'Chassis number is required');
      return false;
    }

    if (!unitPrice.trim() || toNumber(unitPrice) <= 0) {
      Alert.alert('Error', 'Please enter a valid unit price');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !item) return;

    setLoading(true);

    try {
      const performedBy = getUserId(user);
      const performedByName = getUserDisplayName(user);

      if (itemType === 'vehicle') {
        await inventoryApi.updateVehicle(item.id, {
          model: name.trim(),
          chassis_number: chassisNumber.trim(),
          specifications: specifications.trim() || null,
          unit_price: toNumber(unitPrice),
          performed_by: performedBy,
          performed_by_name: performedByName,
        });
      } else {
        await inventoryApi.updatePart(item.id, {
          name: name.trim(),
          specifications: specifications.trim() || null,
          unit_price: toNumber(unitPrice),
          performed_by: performedBy,
          performed_by_name: performedByName,
        });
      }

      Alert.alert(
        'Success',
        itemType === 'vehicle'
          ? 'Vehicle updated successfully'
          : 'Part updated successfully'
      );

      resetForm();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating item:', {
        status: error.response?.status,
        data: error.response?.data,
        requestData: error.config?.data,
        url: error.config?.url,
        message: error.message,
      });

      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to update item'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

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
              <Text style={styles.modalHeaderIcon}>✏️</Text>
              <Text style={styles.modalTitle}>
                Edit {itemType === 'vehicle' ? 'Vehicle' : 'Part'}
              </Text>

              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              {!canEditInventory ? (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    Only workers and store managers can edit inventory items.
                  </Text>
                </View>
              ) : null}

              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  {itemType === 'vehicle' ? 'Vehicle Model *' : 'Part Name *'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder={
                    itemType === 'vehicle' ? 'Vehicle model' : 'Part name'
                  }
                  placeholderTextColor="#64748b"
                  editable={!loading && canEditInventory}
                />
              </View>

              {itemType === 'vehicle' ? (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Chassis Number *</Text>
                  <TextInput
                    style={styles.input}
                    value={chassisNumber}
                    onChangeText={setChassisNumber}
                    placeholder="Unique chassis number"
                    placeholderTextColor="#64748b"
                    autoCapitalize="characters"
                    editable={!loading && canEditInventory}
                  />
                </View>
              ) : item.part_number ? (
                <View style={styles.readOnlyBox}>
                  <Text style={styles.readOnlyLabel}>Part Number</Text>
                  <Text style={styles.readOnlyValue}>{item.part_number}</Text>
                </View>
              ) : null}

              <View style={styles.formGroup}>
                <Text style={styles.label}>Specifications</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={specifications}
                  onChangeText={setSpecifications}
                  placeholder="Specifications"
                  placeholderTextColor="#64748b"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  editable={!loading && canEditInventory}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Unit Price *</Text>
                <TextInput
                  style={styles.input}
                  value={unitPrice}
                  onChangeText={(text) =>
                    setUnitPrice(text.replace(/[^0-9.]/g, ''))
                  }
                  placeholder="Unit price"
                  placeholderTextColor="#64748b"
                  keyboardType="decimal-pad"
                  editable={!loading && canEditInventory}
                />
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  Stock quantity is not edited here. Use Add Stock for parts so
                  the stock history stays correct.
                </Text>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (loading || !canEditInventory) && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={loading || !canEditInventory}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Save Changes</Text>
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
    height: 90,
    textAlignVertical: 'top',
  },
  readOnlyBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginBottom: 16,
  },
  readOnlyLabel: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 4,
  },
  readOnlyValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  infoBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 18,
  },
  infoText: {
    color: '#60a5fa',
    fontSize: 12,
    lineHeight: 17,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
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