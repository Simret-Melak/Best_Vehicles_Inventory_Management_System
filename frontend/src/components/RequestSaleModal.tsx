import React, { useState, useEffect } from 'react';
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
import { salesApi, customerApi } from '../services/api';

interface RequestSaleModalProps {
  visible: boolean;
  onClose: () => void;
  item: {
    id: string;
    name: string;
    specifications: string;
    quantity: number;
    unit_price: number;
    chassis_number?: string;
    part_number?: string;
  } | null;
  itemType?: 'vehicle' | 'part';
  customers: Array<{
    id: string;
    full_name: string;
    phone: string;
    email: string;
  }>;
  onSuccess: () => void;
}

export default function RequestSaleModal({ 
  visible, 
  onClose, 
  item, 
  itemType = 'part',
  customers,
  onSuccess 
}: RequestSaleModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'check' | 'bank_deposit'>('transfer');
  const [bankName, setBankName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [fullPayment, setFullPayment] = useState(true);

  const totalAmount = item ? (item.unit_price * parseInt(quantity || '0')) : 0;
  
  useEffect(() => {
    if (fullPayment && totalAmount > 0) {
      setDepositAmount(totalAmount.toString());
    }
  }, [totalAmount, fullPayment]);

  const createNewCustomer = async (): Promise<string | null> => {
    if (!newCustomerName.trim()) {
      Alert.alert('Error', 'Customer name is required');
      return null;
    }

    setCreatingCustomer(true);
    try {
      const response = await customerApi.createCustomer({
        full_name: newCustomerName.trim(),
        phone: newCustomerPhone || null,
        email: newCustomerEmail || null,
      });
      
      Alert.alert('Success', 'Customer created successfully');
      return response.data.data.id;
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create customer');
      return null;
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCustomer && !newCustomerName.trim()) {
      Alert.alert('Error', 'Please select or add a customer');
      return;
    }
    
    if (!quantity || parseInt(quantity) <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }
    
    if (item && parseInt(quantity) > item.quantity) {
      Alert.alert('Error', `Only ${item.quantity} units available`);
      return;
    }
    
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      Alert.alert('Error', 'Please enter deposit amount');
      return;
    }
    
    if (paymentMethod !== 'cash' && !bankName.trim()) {
      Alert.alert('Error', 'Please enter bank name');
      return;
    }
    
    if ((paymentMethod === 'transfer' || paymentMethod === 'check') && !referenceNumber.trim()) {
      Alert.alert('Error', 'Please enter reference/check number');
      return;
    }

    setLoading(true);
    
    try {
      let customerId = selectedCustomer?.id;
      
      if (!customerId && newCustomerName.trim()) {
        const newId = await createNewCustomer();
        if (!newId) {
          setLoading(false);
          return;
        }
        customerId = newId;
      }
      
      if (!customerId) {
        Alert.alert('Error', 'Customer ID not found');
        setLoading(false);
        return;
      }
      
      // Prepare order data
      let orderData: any = {
        customer_id: customerId,
        notes: notes,
        payment_method: paymentMethod,
        bank_name: bankName,
        reference_number: referenceNumber,
        deposit_amount: parseFloat(depositAmount),
      };
      
      if (itemType === 'vehicle' && item?.chassis_number) {
        orderData.chassis_number = item.chassis_number;
        orderData.quantity = parseInt(quantity);
      } else if (itemType === 'part' && item?.id) {
        orderData.items = [{
          item_type: 'part',
          item_id: item.id,
          quantity: parseInt(quantity),
        }];
      } else if (item?.id) {
        orderData.items = [{
          item_type: itemType,
          item_id: item.id,
          quantity: parseInt(quantity),
        }];
      }
      
      const response = await salesApi.createSalesOrder(orderData);
      
      Alert.alert('Success', `Order ${response.data.data.order_number} created successfully!`);
      onSuccess();
      onClose();
      resetForm();
      
    } catch (error: any) {
      console.error('Error creating order:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to create sales order');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setShowNewCustomerForm(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewCustomerEmail('');
    setQuantity('1');
    setNotes('');
    setPaymentMethod('transfer');
    setBankName('');
    setReferenceNumber('');
    setDepositAmount('');
    setFullPayment(true);
  };

  const getPaymentMethodLabel = (method: string) => {
    switch(method) {
      case 'cash': return '💰 Cash';
      case 'transfer': return '🏦 Bank Transfer';
      case 'check': return '📝 Check';
      case 'bank_deposit': return '🏛️ Bank Deposit';
      default: return method;
    }
  };

  if (!item) return null;

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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Sale</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              {/* Item Information */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Item Details</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Sales type:</Text>
                  <Text style={styles.infoValue}>{item.name}</Text>
                </View>
                {itemType === 'vehicle' && item.chassis_number && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Chassis no:</Text>
                    <Text style={styles.infoValue}>{item.chassis_number}</Text>
                  </View>
                )}
                {itemType === 'part' && item.part_number && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Part no:</Text>
                    <Text style={styles.infoValue}>{item.part_number}</Text>
                  </View>
                )}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Unit price:</Text>
                  <Text style={styles.infoValue}>Br {item.unit_price?.toLocaleString()}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Quantity:</Text>
                  <TextInput
                    style={styles.quantityInput}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Total:</Text>
                  <Text style={styles.totalValue}>Br {totalAmount.toLocaleString()}</Text>
                </View>
              </View>

              {/* Customer Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Customer Information</Text>
                
                {!showNewCustomerForm ? (
                  <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.customerList}>
                      {customers.map((customer) => (
                        <TouchableOpacity
                          key={customer.id}
                          style={[
                            styles.customerChip,
                            selectedCustomer?.id === customer.id && styles.customerChipSelected,
                          ]}
                          onPress={() => setSelectedCustomer(customer)}
                        >
                          <Text style={[
                            styles.customerChipText,
                            selectedCustomer?.id === customer.id && styles.customerChipTextSelected,
                          ]}>
                            {customer.full_name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <TouchableOpacity 
                      style={styles.newCustomerButton}
                      onPress={() => setShowNewCustomerForm(true)}
                    >
                      <Text style={styles.newCustomerButtonText}>+ Add New Customer</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.newCustomerForm}>
                    <TextInput
                      style={styles.input}
                      placeholder="Customer Name *"
                      placeholderTextColor="#64748b"
                      value={newCustomerName}
                      onChangeText={setNewCustomerName}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Phone Number"
                      placeholderTextColor="#64748b"
                      value={newCustomerPhone}
                      onChangeText={setNewCustomerPhone}
                      keyboardType="phone-pad"
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      placeholderTextColor="#64748b"
                      value={newCustomerEmail}
                      onChangeText={setNewCustomerEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity 
                      style={styles.backButton}
                      onPress={() => setShowNewCustomerForm(false)}
                    >
                      <Text style={styles.backButtonText}>← Back to Customer List</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Payment Information */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Payment Details</Text>
                
                <View style={styles.paymentMethodRow}>
                  {(['cash', 'transfer', 'check', 'bank_deposit'] as const).map((method) => (
                    <TouchableOpacity
                      key={method}
                      style={[
                        styles.paymentMethodChip,
                        paymentMethod === method && styles.paymentMethodChipSelected,
                      ]}
                      onPress={() => setPaymentMethod(method)}
                    >
                      <Text style={[
                        styles.paymentMethodChipText,
                        paymentMethod === method && styles.paymentMethodChipTextSelected,
                      ]}>
                        {getPaymentMethodLabel(method)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                {paymentMethod !== 'cash' && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Bank Name"
                      placeholderTextColor="#64748b"
                      value={bankName}
                      onChangeText={setBankName}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={paymentMethod === 'check' ? "Check Number" : "Reference Number"}
                      placeholderTextColor="#64748b"
                      value={referenceNumber}
                      onChangeText={setReferenceNumber}
                    />
                  </>
                )}
                
                <View style={styles.depositRow}>
                  <View style={styles.depositOptions}>
                    <TouchableOpacity
                      style={[styles.depositOption, fullPayment && styles.depositOptionSelected]}
                      onPress={() => setFullPayment(true)}
                    >
                      <Text style={[styles.depositOptionText, fullPayment && styles.depositOptionTextSelected]}>
                        Full Payment
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.depositOption, !fullPayment && styles.depositOptionSelected]}
                      onPress={() => setFullPayment(false)}
                    >
                      <Text style={[styles.depositOptionText, !fullPayment && styles.depositOptionTextSelected]}>
                        Partial Deposit
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <TextInput
                    style={styles.input}
                    placeholder="Deposit Amount"
                    placeholderTextColor="#64748b"
                    value={depositAmount}
                    onChangeText={setDepositAmount}
                    keyboardType="numeric"
                  />
                  
                  {!fullPayment && (
                    <Text style={styles.remainingText}>
                      Remaining: Br {(totalAmount - parseFloat(depositAmount || '0')).toLocaleString()}
                    </Text>
                  )}
                </View>
              </View>

              {/* Notes */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Add notes (e.g., Without battery, delivery instructions...)"
                  placeholderTextColor="#64748b"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Submit Button */}
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, (loading || creatingCustomer) && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={loading || creatingCustomer}
                >
                  {loading || creatingCustomer ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {fullPayment ? 'Submit Request (Full Payment)' : 'Submit Request (Partial Deposit)'}
                    </Text>
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
    padding: 20,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
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
  section: {
    marginBottom: 20,
  },
  infoSection: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  infoValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  totalValue: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: 'bold',
  },
  quantityInput: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    width: 80,
    textAlign: 'center',
  },
  customerList: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  customerChip: {
    backgroundColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  customerChipSelected: {
    backgroundColor: '#ef4444',
  },
  customerChipText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  customerChipTextSelected: {
    color: '#ffffff',
  },
  newCustomerButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
  },
  newCustomerButtonText: {
    color: '#ef4444',
    fontSize: 14,
  },
  newCustomerForm: {
    gap: 12,
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
  backButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#ef4444',
    fontSize: 14,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  paymentMethodChip: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  paymentMethodChipSelected: {
    backgroundColor: '#ef4444',
  },
  paymentMethodChipText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  paymentMethodChipTextSelected: {
    color: '#ffffff',
  },
  depositRow: {
    marginTop: 8,
  },
  depositOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  depositOption: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  depositOptionSelected: {
    backgroundColor: '#ef4444',
  },
  depositOptionText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  depositOptionTextSelected: {
    color: '#ffffff',
  },
  remainingText: {
    fontSize: 12,
    color: '#fbbf24',
    marginTop: 8,
    textAlign: 'right',
  },
  notesInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 80,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
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
