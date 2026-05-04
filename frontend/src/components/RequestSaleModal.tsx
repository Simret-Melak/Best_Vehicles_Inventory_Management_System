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

type Customer = {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
};

type SaleItem = {
  id: string;
  part_id?: string;
  vehicle_id?: string;
  name: string;
  specifications?: string | null;
  quantity: number;
  unit_price: number;
  chassis_number?: string;
  part_number?: string;
};

interface RequestSaleModalProps {
  visible: boolean;
  onClose: () => void;
  item: SaleItem | null;
  itemType?: 'vehicle' | 'part';
  customers: Customer[];
  onSuccess: () => void;
}

export default function RequestSaleModal({
  visible,
  onClose,
  item,
  itemType = 'part',
  customers,
  onSuccess,
}: RequestSaleModalProps) {
  const [loading, setLoading] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const [customerSearch, setCustomerSearch] = useState('');
  const [modalCustomers, setModalCustomers] = useState<Customer[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');

  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<
    'cash' | 'transfer' | 'check' | 'bank_deposit'
  >('transfer');

  const [bankName, setBankName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [fullPayment, setFullPayment] = useState(true);

  const parsedQuantity = Number.parseInt(quantity || '0', 10);
  const safeQuantity = Number.isNaN(parsedQuantity) ? 0 : parsedQuantity;
  const totalAmount = item ? Number(item.unit_price || 0) * safeQuantity : 0;

  useEffect(() => {
    if (!visible) return;

    resetCustomerState();
    fetchCustomersFromBackend('');
  }, [visible]);

  useEffect(() => {
    if (!visible || showNewCustomerForm) return;

    const timeout = setTimeout(() => {
      fetchCustomersFromBackend(customerSearch);
    }, customerSearch.trim() ? 300 : 0);

    return () => clearTimeout(timeout);
  }, [customerSearch, visible, showNewCustomerForm]);

  useEffect(() => {
    if (fullPayment && totalAmount > 0) {
      setDepositAmount(totalAmount.toString());
    }
  }, [totalAmount, fullPayment]);

  const resetCustomerState = () => {
    setCustomerSearch('');
    setSelectedCustomer(null);
    setModalCustomers(customers || []);
  };

  const fetchCustomersFromBackend = async (searchText: string) => {
    try {
      setSearchingCustomers(true);

      const response = await customerApi.getCustomers(searchText, 100, 0);

      console.log('CUSTOMERS API RESPONSE:', response.data);

      const result = response?.data?.data || [];

      if (Array.isArray(result)) {
        setModalCustomers(result);
      } else {
        setModalCustomers([]);
      }
    } catch (error: any) {
      console.log('CUSTOMERS API ERROR:', {
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
        params: error.config?.params,
        message: error.message,
      });

      const searchLower = searchText.trim().toLowerCase();

      if (!searchLower) {
        setModalCustomers(customers || []);
      } else {
        const localResults = (customers || []).filter((customer) => {
          const name = customer.full_name?.toLowerCase() || '';
          const phone = customer.phone?.toLowerCase() || '';
          const email = customer.email?.toLowerCase() || '';

          return (
            name.includes(searchLower) ||
            phone.includes(searchLower) ||
            email.includes(searchLower)
          );
        });

        setModalCustomers(localResults);
      }
    } finally {
      setSearchingCustomers(false);
    }
  };

  const createNewCustomer = async (): Promise<string | null> => {
    if (!newCustomerName.trim()) {
      Alert.alert('Error', 'Customer name is required');
      return null;
    }

    setCreatingCustomer(true);

    try {
      const response = await customerApi.createCustomer({
        full_name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || null,
        email: newCustomerEmail.trim() || null,
      });

      Alert.alert('Success', 'Customer created successfully');

      await fetchCustomersFromBackend('');

      return response.data.data.id;
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to create customer'
      );
      return null;
    } finally {
      setCreatingCustomer(false);
    }
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setShowNewCustomerForm(false);
    setCustomerSearch('');
    setModalCustomers(customers || []);

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

  const handleClose = () => {
    Keyboard.dismiss();
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!item) {
      Alert.alert('Error', 'No item selected');
      return;
    }

    if (!selectedCustomer && !newCustomerName.trim()) {
      Alert.alert('Error', 'Please select or add a customer');
      return;
    }

    if (!quantity || safeQuantity <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    if (safeQuantity > item.quantity) {
      Alert.alert('Error', `Only ${item.quantity} units available`);
      return;
    }

    const parsedDepositAmount = Number.parseFloat(depositAmount || '0');

    if (
      !depositAmount ||
      parsedDepositAmount <= 0 ||
      Number.isNaN(parsedDepositAmount)
    ) {
      Alert.alert('Error', 'Please enter deposit amount');
      return;
    }

    if (parsedDepositAmount > totalAmount) {
      Alert.alert('Error', 'Deposit amount cannot be greater than total amount');
      return;
    }

    if (paymentMethod !== 'cash' && !bankName.trim()) {
      Alert.alert('Error', 'Please enter bank name');
      return;
    }

    if (
      (paymentMethod === 'transfer' || paymentMethod === 'check') &&
      !referenceNumber.trim()
    ) {
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

      const orderData: any = {
        customer_id: customerId,
        notes: notes.trim() || null,
        payment_method: paymentMethod,
        bank_name: paymentMethod === 'cash' ? null : bankName.trim(),
        reference_number:
          paymentMethod === 'cash' ? null : referenceNumber.trim() || null,
        deposit_amount: parsedDepositAmount,
      };

      if (itemType === 'vehicle') {
        if (!item.chassis_number) {
          Alert.alert('Error', 'Vehicle chassis number is missing');
          setLoading(false);
          return;
        }

        orderData.chassis_number = item.chassis_number;
        orderData.quantity = safeQuantity;
      }

      if (itemType === 'part') {
        const partId = item.part_id || item.id;

        if (!partId && !item.part_number) {
          Alert.alert('Error', 'Part ID or part number is missing');
          setLoading(false);
          return;
        }

        orderData.items = [
          {
            item_type: 'part',
            item_id: partId,
            part_number: item.part_number || null,
            quantity: safeQuantity,
          },
        ];
      }

      console.log('SELECTED ITEM:', JSON.stringify(item, null, 2));
      console.log('ORDER DATA BEING SENT:', JSON.stringify(orderData, null, 2));

      const response = await salesApi.createSalesOrder(orderData);

      const orderNumber =
        response?.data?.data?.order_number ||
        response?.data?.data?.id ||
        'created';

      if (fullPayment) {
        Alert.alert(
          'Order Created',
          `Order ${orderNumber} created with full payment!\n\nThe order has been sent to Admin for approval.`
        );
      } else {
        Alert.alert(
          'Order Created',
          `Order ${orderNumber} created with partial deposit.\n\nAdd more payments in "My Requests" tab. Once fully paid, confirm to send to Admin.`
        );
      }

      onSuccess();
      resetForm();
      onClose();
    } catch (error: any) {
      console.error('Error creating order:', {
        status: error.response?.status,
        response: error.response?.data,
        requestData: error.config?.data,
        url: error.config?.url,
        params: error.config?.params,
      });

      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to create sales order'
      );
    } finally {
      setLoading(false);
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash':
        return '💰 Cash';
      case 'transfer':
        return '🏦 Bank Transfer';
      case 'check':
        return '📝 Check';
      case 'bank_deposit':
        return '🏛️ Bank Deposit';
      default:
        return method;
    }
  };

  if (!item) return null;

  const remainingAmount = totalAmount - Number.parseFloat(depositAmount || '0');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Sale</Text>

              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
              nestedScrollEnabled
            >
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Item Details</Text>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Sales type:</Text>
                  <Text style={styles.infoValue}>{item.name}</Text>
                </View>

                {itemType === 'vehicle' && item.chassis_number ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Chassis no:</Text>
                    <Text style={styles.infoValue}>{item.chassis_number}</Text>
                  </View>
                ) : null}

                {itemType === 'part' && item.part_number ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Part no:</Text>
                    <Text style={styles.infoValue}>{item.part_number}</Text>
                  </View>
                ) : null}

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Unit price:</Text>
                  <Text style={styles.infoValue}>
                    Br {Number(item.unit_price || 0).toLocaleString()}
                  </Text>
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
                  <Text style={styles.totalValue}>
                    Br {totalAmount.toLocaleString()}
                  </Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Customer Information</Text>

                {!showNewCustomerForm ? (
                  <>
                    <View style={styles.searchContainer}>
                      <Text style={styles.searchIcon}>🔍</Text>

                      <TextInput
                        style={styles.searchInput}
                        placeholder="Search existing customers..."
                        placeholderTextColor="#64748b"
                        value={customerSearch}
                        onChangeText={(text) => {
                          setCustomerSearch(text);
                          setSelectedCustomer(null);
                        }}
                        autoCorrect={false}
                      />

                      {customerSearch !== '' ? (
                        <TouchableOpacity
                          onPress={() => {
                            setCustomerSearch('');
                            setSelectedCustomer(null);
                            fetchCustomersFromBackend('');
                          }}
                        >
                          <Text style={styles.clearIcon}>✕</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    <ScrollView
                      style={styles.customerListContainer}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                      keyboardShouldPersistTaps="handled"
                    >
                      {searchingCustomers ? (
                        <View style={styles.searchingContainer}>
                          <ActivityIndicator size="small" color="#ef4444" />
                          <Text style={styles.searchingText}>
                            Loading customers...
                          </Text>
                        </View>
                      ) : modalCustomers.length === 0 ? (
                        <Text style={styles.noCustomersText}>No customers found</Text>
                      ) : (
                        modalCustomers.map((customer) => (
                          <TouchableOpacity
                            key={customer.id}
                            style={[
                              styles.customerItem,
                              selectedCustomer?.id === customer.id &&
                                styles.customerItemSelected,
                            ]}
                            onPress={() => {
                              setSelectedCustomer(customer);
                              Keyboard.dismiss();
                            }}
                          >
                            <View style={styles.customerItemContent}>
                              <Text style={styles.customerItemName}>
                                {customer.full_name}
                              </Text>

                              {customer.phone ? (
                                <Text style={styles.customerItemPhone}>
                                  📞 {customer.phone}
                                </Text>
                              ) : null}

                              {customer.email ? (
                                <Text style={styles.customerItemPhone}>
                                  ✉️ {customer.email}
                                </Text>
                              ) : null}
                            </View>

                            {selectedCustomer?.id === customer.id ? (
                              <Text style={styles.checkMark}>✓</Text>
                            ) : null}
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>

                    <TouchableOpacity
                      style={styles.newCustomerButton}
                      onPress={() => {
                        setSelectedCustomer(null);
                        setShowNewCustomerForm(true);
                      }}
                    >
                      <Text style={styles.newCustomerButtonText}>
                        + Add New Customer
                      </Text>
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
                      onPress={() => {
                        setShowNewCustomerForm(false);
                        fetchCustomersFromBackend(customerSearch);
                      }}
                    >
                      <Text style={styles.backButtonText}>
                        ← Back to Customer List
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Payment Details</Text>

                <View style={styles.paymentMethodRow}>
                  {(['cash', 'transfer', 'check', 'bank_deposit'] as const).map(
                    (method) => (
                      <TouchableOpacity
                        key={method}
                        style={[
                          styles.paymentChip,
                          paymentMethod === method && styles.paymentChipSelected,
                        ]}
                        onPress={() => {
                          setPaymentMethod(method);

                          if (method === 'cash') {
                            setBankName('');
                            setReferenceNumber('');
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.paymentChipText,
                            paymentMethod === method &&
                              styles.paymentChipTextSelected,
                          ]}
                        >
                          {getPaymentMethodLabel(method)}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>

                {paymentMethod !== 'cash' ? (
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
                      placeholder={
                        paymentMethod === 'check'
                          ? 'Check Number'
                          : 'Reference Number'
                      }
                      placeholderTextColor="#64748b"
                      value={referenceNumber}
                      onChangeText={setReferenceNumber}
                    />
                  </>
                ) : null}

                <View style={styles.depositRow}>
                  <View style={styles.depositOptions}>
                    <TouchableOpacity
                      style={[
                        styles.depositOption,
                        fullPayment && styles.depositOptionSelected,
                      ]}
                      onPress={() => setFullPayment(true)}
                    >
                      <Text
                        style={[
                          styles.depositOptionText,
                          fullPayment && styles.depositOptionTextSelected,
                        ]}
                      >
                        Full Payment
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.depositOption,
                        !fullPayment && styles.depositOptionSelected,
                      ]}
                      onPress={() => setFullPayment(false)}
                    >
                      <Text
                        style={[
                          styles.depositOptionText,
                          !fullPayment && styles.depositOptionTextSelected,
                        ]}
                      >
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

                  {!fullPayment ? (
                    <Text style={styles.remainingText}>
                      Remaining: Br {remainingAmount.toLocaleString()}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes</Text>

                <TextInput
                  style={styles.notesInput}
                  placeholder="Add notes..."
                  placeholderTextColor="#64748b"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoBoxTitle}>📋 What happens next?</Text>

                <Text style={styles.infoBoxText}>
                  • Order will be created after this request is submitted
                </Text>

                <Text style={styles.infoBoxText}>
                  • Payment will wait for admin confirmation
                </Text>

                <Text style={styles.infoBoxText}>
                  • Items will be reserved/confirmed based on your approval workflow
                </Text>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (loading || creatingCustomer) && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={loading || creatingCustomer}
                >
                  {loading || creatingCustomer ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {fullPayment ? 'Submit & Send to Admin' : 'Submit Request'}
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
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 22,
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
    marginBottom: 16,
  },
  infoSection: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 12,
  },
  infoLabel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
    textAlign: 'right',
  },
  totalValue: {
    fontSize: 15,
    color: '#ef4444',
    fontWeight: 'bold',
  },
  quantityInput: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    width: 70,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    marginBottom: 10,
    minHeight: 42,
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
  customerListContainer: {
    height: 150,
    marginBottom: 10,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchingContainer: {
    height: 148,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  searchingText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  customerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  customerItemSelected: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  customerItemContent: {
    flex: 1,
    paddingRight: 8,
  },
  customerItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  customerItemPhone: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  checkMark: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noCustomersText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    padding: 15,
  },
  newCustomerButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
  },
  newCustomerButtonText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '500',
  },
  newCustomerForm: {
    gap: 10,
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
    marginBottom: 10,
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
    marginBottom: 14,
  },
  paymentChip: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  paymentChipSelected: {
    backgroundColor: '#ef4444',
  },
  paymentChipText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  paymentChipTextSelected: {
    color: '#ffffff',
  },
  depositRow: {
    marginTop: 6,
  },
  depositOptions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
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
    fontSize: 13,
  },
  depositOptionTextSelected: {
    color: '#ffffff',
  },
  remainingText: {
    fontSize: 11,
    color: '#fbbf24',
    marginTop: 6,
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
    minHeight: 70,
  },
  infoBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  infoBoxTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#60a5fa',
    marginBottom: 6,
  },
  infoBoxText: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 3,
  },
  modalButtons: {
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
    fontWeight: '600',
  },
});