import React, { useState, useEffect, useMemo } from 'react';
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
import { useAuth } from '../context/AuthContext';

interface Customer {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface SaleItem {
  id: string;
  vehicle_id?: string;
  part_id?: string;
  name: string;
  specifications: string;
  quantity: number;
  unit_price: number;
  chassis_number?: string;
  part_number?: string;
}

interface RequestSaleModalProps {
  visible: boolean;
  onClose: () => void;
  item: SaleItem | null;
  itemType?: 'vehicle' | 'part';
  customers?: Customer[];
  onSuccess: () => void;
}

type PaymentMethod = 'cash' | 'transfer' | 'check' | 'bank_deposit';

const toNumber = (value: any) => {
  const numeric = Number(value || 0);
  return Number.isNaN(numeric) ? 0 : numeric;
};

const formatMoney = (value: number) => {
  return `Br ${toNumber(value).toLocaleString()}`;
};

const getUserId = (user: any) => {
  return user?.id || user?.user_id || user?.uuid || null;
};

const getUserDisplayName = (user: any) => {
  return user?.full_name || user?.name || user?.email || 'Worker';
};

export default function RequestSaleModal({
  visible,
  onClose,
  item,
  itemType = 'part',
  customers = [],
  onSuccess,
}: RequestSaleModalProps) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);

  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');

  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [bankName, setBankName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [fullPayment, setFullPayment] = useState(true);

  const maxQuantity =
    itemType === 'vehicle' ? 1 : Math.max(1, toNumber(item?.quantity));

  const selectedQuantity =
    itemType === 'vehicle'
      ? 1
      : Math.max(1, Math.min(toNumber(quantity), maxQuantity));

  const totalAmount = item ? toNumber(item.unit_price) * selectedQuantity : 0;
  const paidAmount = toNumber(depositAmount);
  const remainingAmount = Math.max(0, totalAmount - paidAmount);
  const isFullyPaid = totalAmount > 0 && paidAmount >= totalAmount;

  const customersForDisplay = allCustomers.length > 0 ? allCustomers : customers;

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();

    if (!query) return customersForDisplay;

    return customersForDisplay.filter((customer) => {
      return (
        customer.full_name?.toLowerCase().includes(query) ||
        customer.phone?.toLowerCase().includes(query) ||
        customer.email?.toLowerCase().includes(query)
      );
    });
  }, [customersForDisplay, customerSearch]);

  const resetForm = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setShowNewCustomerForm(false);

    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewCustomerEmail('');
    setNewCustomerAddress('');

    setQuantity('1');
    setNotes('');

    setPaymentMethod('cash');
    setBankName('');
    setReferenceNumber('');
    setDepositAmount('');
    setFullPayment(true);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const loadCustomers = async () => {
    try {
      setLoadingCustomers(true);

      const response = await customerApi.getCustomers('', 100, 0);
      setAllCustomers(response.data?.data || []);
    } catch (error) {
      console.error('Error loading customers:', error);

      if (customers.length > 0) {
        setAllCustomers(customers);
      }
    } finally {
      setLoadingCustomers(false);
    }
  };

  useEffect(() => {
    if (visible) {
      resetForm();
      loadCustomers();
    }
  }, [visible]);

  useEffect(() => {
    if (itemType === 'vehicle') {
      setQuantity('1');
    }
  }, [itemType]);

  useEffect(() => {
    if (fullPayment && totalAmount > 0) {
      setDepositAmount(String(totalAmount));
    }
  }, [fullPayment, totalAmount]);

  const createNewCustomer = async (): Promise<Customer | null> => {
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
        address: newCustomerAddress.trim() || null,
      });

      const createdCustomer = response.data?.data;

      if (!createdCustomer?.id) {
        Alert.alert('Error', 'Customer was created but no ID was returned');
        return null;
      }

      const normalizedCustomer: Customer = {
        id: createdCustomer.id,
        full_name: createdCustomer.full_name,
        phone: createdCustomer.phone || '',
        email: createdCustomer.email || '',
        address: createdCustomer.address || '',
      };

      setAllCustomers((prev) => [normalizedCustomer, ...prev]);
      setSelectedCustomer(normalizedCustomer);
      setShowNewCustomerForm(false);

      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerEmail('');
      setNewCustomerAddress('');

      Alert.alert('Success', 'Customer created successfully');

      return normalizedCustomer;
    } catch (error: any) {
      console.error('Create customer error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });

      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to create customer'
      );

      return null;
    } finally {
      setCreatingCustomer(false);
    }
  };

  const validateForm = () => {
    if (!item) {
      Alert.alert('Error', 'No item selected');
      return false;
    }

    if (!selectedCustomer && !showNewCustomerForm) {
      Alert.alert('Error', 'Please select a customer or create a new one');
      return false;
    }

    if (showNewCustomerForm && !newCustomerName.trim()) {
      Alert.alert('Error', 'Customer name is required');
      return false;
    }

    if (itemType === 'part') {
      const qty = toNumber(quantity);

      if (!qty || qty <= 0) {
        Alert.alert('Error', 'Please enter a valid quantity');
        return false;
      }

      if (qty > maxQuantity) {
        Alert.alert(
          'Error',
          `Only ${maxQuantity} units are available for this part`
        );
        return false;
      }
    }

    if (!depositAmount.trim()) {
      Alert.alert('Error', 'Please enter the payment amount');
      return false;
    }

    if (paidAmount <= 0) {
      Alert.alert('Error', 'Payment amount must be greater than 0');
      return false;
    }

    if (paidAmount > totalAmount) {
      Alert.alert('Error', 'Payment amount cannot be greater than total amount');
      return false;
    }

    if (paymentMethod !== 'cash' && !referenceNumber.trim()) {
      Alert.alert('Error', 'Reference number is required for non-cash payments');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !item) return;

    setLoading(true);

    try {
      let customer = selectedCustomer;

      if (showNewCustomerForm) {
        customer = await createNewCustomer();

        if (!customer) {
          setLoading(false);
          return;
        }
      }

      if (!customer?.id) {
        Alert.alert('Error', 'Customer is required');
        setLoading(false);
        return;
      }

      const workerUserId = getUserId(user);
      const workerDisplayName = getUserDisplayName(user);

      if (!workerUserId) {
        Alert.alert(
          'Login Required',
          'Could not find the logged-in worker ID. Please log out and log in again.'
        );
        setLoading(false);
        return;
      }

      const itemId =
        itemType === 'vehicle'
          ? item.vehicle_id || item.id
          : item.part_id || item.id;

      const orderItem = {
        item_type: itemType,
        item_id: itemId,
        quantity: selectedQuantity,
        unit_price: toNumber(item.unit_price),
      };

      const payload: any = {
        customer_id: customer.id,
        notes: notes.trim() || null,

        payment_method: paymentMethod,
        bank_name: paymentMethod === 'cash' ? null : bankName.trim() || null,
        reference_number:
          paymentMethod === 'cash' ? null : referenceNumber.trim() || null,
        deposit_amount: paidAmount,

        quantity: selectedQuantity,
        unit_price: toNumber(item.unit_price),

        // Important:
        // performed_by must be the worker UUID.
        // performed_by_name is the display name used in history.
        performed_by: workerUserId,
        performed_by_name: workerDisplayName,

        items: [orderItem],
      };

      if (itemType === 'vehicle') {
        payload.vehicle_id = itemId;
      } else {
        payload.part_id = itemId;
      }

      console.log('Creating sales order payload:', JSON.stringify(payload));

      await salesApi.createSalesOrder(payload);

      Alert.alert(
        'Success',
        isFullyPaid
          ? 'Sale request submitted for admin approval'
          : `Sale request saved. Remaining amount: ${formatMoney(remainingAmount)}`
      );

      resetForm();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating order:', {
        status: error.response?.status,
        response: error.response?.data,
        requestData: error.config?.data,
        url: error.config?.url,
        params: error.config?.params,
        message: error.message,
      });

      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to create sales order'
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
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.keyboardView}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.modalTitle}>Request Sale</Text>
                  <Text style={styles.modalSubtitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>

                <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                <View style={styles.itemCard}>
                  <Text style={styles.itemType}>
                    {itemType === 'vehicle' ? '🚛 Vehicle' : '🔧 Part'}
                  </Text>

                  <Text style={styles.itemName}>{item.name}</Text>

                  {item.specifications ? (
                    <Text style={styles.itemSpecs} numberOfLines={2}>
                      {item.specifications}
                    </Text>
                  ) : null}

                  {item.chassis_number ? (
                    <Text style={styles.itemCode}>Chassis: {item.chassis_number}</Text>
                  ) : null}

                  {item.part_number ? (
                    <Text style={styles.itemCode}>Part #: {item.part_number}</Text>
                  ) : null}

                  <View style={styles.itemSummaryRow}>
                    <View style={styles.summaryBox}>
                      <Text style={styles.summaryLabel}>Unit Price</Text>
                      <Text style={styles.summaryValue}>
                        {formatMoney(toNumber(item.unit_price))}
                      </Text>
                    </View>

                    <View style={styles.summaryBox}>
                      <Text style={styles.summaryLabel}>Available</Text>
                      <Text style={styles.summaryValue}>
                        {itemType === 'vehicle' ? 1 : maxQuantity}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>Customer</Text>

                {selectedCustomer ? (
                  <View style={styles.selectedCustomerBox}>
                    <View style={styles.selectedCustomerInfo}>
                      <Text style={styles.selectedCustomerName}>
                        {selectedCustomer.full_name}
                      </Text>

                      {selectedCustomer.phone ? (
                        <Text style={styles.selectedCustomerSub}>
                          📞 {selectedCustomer.phone}
                        </Text>
                      ) : null}

                      {selectedCustomer.email ? (
                        <Text style={styles.selectedCustomerSub}>
                          ✉️ {selectedCustomer.email}
                        </Text>
                      ) : null}
                    </View>

                    <TouchableOpacity
                      style={styles.changeCustomerButton}
                      onPress={() => setSelectedCustomer(null)}
                    >
                      <Text style={styles.changeCustomerText}>Change</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.customerModeRow}>
                      <TouchableOpacity
                        style={[
                          styles.customerModeButton,
                          !showNewCustomerForm && styles.customerModeButtonActive,
                        ]}
                        onPress={() => setShowNewCustomerForm(false)}
                      >
                        <Text
                          style={[
                            styles.customerModeText,
                            !showNewCustomerForm && styles.customerModeTextActive,
                          ]}
                        >
                          Existing
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.customerModeButton,
                          showNewCustomerForm && styles.customerModeButtonActive,
                        ]}
                        onPress={() => setShowNewCustomerForm(true)}
                      >
                        <Text
                          style={[
                            styles.customerModeText,
                            showNewCustomerForm && styles.customerModeTextActive,
                          ]}
                        >
                          New Customer
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {!showNewCustomerForm ? (
                      <>
                        <TextInput
                          style={styles.input}
                          placeholder="Search customers by name, phone, or email..."
                          placeholderTextColor="#64748b"
                          value={customerSearch}
                          onChangeText={setCustomerSearch}
                        />

                        {loadingCustomers ? (
                          <View style={styles.smallLoadingBox}>
                            <ActivityIndicator size="small" color="#ef4444" />
                            <Text style={styles.smallLoadingText}>Loading customers...</Text>
                          </View>
                        ) : filteredCustomers.length === 0 ? (
                          <View style={styles.emptyCustomerBox}>
                            <Text style={styles.emptyCustomerText}>No customers found</Text>

                            <TouchableOpacity
                              style={styles.createCustomerInlineButton}
                              onPress={() => setShowNewCustomerForm(true)}
                            >
                              <Text style={styles.createCustomerInlineText}>
                                + Create Customer
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={styles.customerList}>
                            {filteredCustomers.slice(0, 8).map((customer) => (
                              <TouchableOpacity
                                key={customer.id}
                                style={styles.customerOption}
                                onPress={() => setSelectedCustomer(customer)}
                              >
                                <Text style={styles.customerOptionName}>
                                  {customer.full_name}
                                </Text>

                                <Text style={styles.customerOptionSub} numberOfLines={1}>
                                  {customer.phone || 'No phone'} • {customer.email || 'No email'}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </>
                    ) : (
                      <View style={styles.newCustomerForm}>
                        <Text style={styles.inputLabel}>Full Name *</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Customer full name"
                          placeholderTextColor="#64748b"
                          value={newCustomerName}
                          onChangeText={setNewCustomerName}
                        />

                        <Text style={styles.inputLabel}>Phone</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Phone number"
                          placeholderTextColor="#64748b"
                          value={newCustomerPhone}
                          onChangeText={setNewCustomerPhone}
                          keyboardType="phone-pad"
                        />

                        <Text style={styles.inputLabel}>Email</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Email address"
                          placeholderTextColor="#64748b"
                          value={newCustomerEmail}
                          onChangeText={setNewCustomerEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />

                        <Text style={styles.inputLabel}>Address</Text>
                        <TextInput
                          style={[styles.input, styles.notesInput]}
                          placeholder="Address"
                          placeholderTextColor="#64748b"
                          value={newCustomerAddress}
                          onChangeText={setNewCustomerAddress}
                          multiline
                        />
                      </View>
                    )}
                  </>
                )}

                <Text style={styles.sectionTitle}>Sale Details</Text>

                {itemType === 'part' ? (
                  <>
                    <Text style={styles.inputLabel}>Quantity</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Quantity"
                      placeholderTextColor="#64748b"
                      value={quantity}
                      onChangeText={(text) => {
                        const cleanText = text.replace(/[^0-9]/g, '');
                        setQuantity(cleanText);
                      }}
                      keyboardType="numeric"
                    />
                  </>
                ) : (
                  <View style={styles.vehicleQuantityBox}>
                    <Text style={styles.vehicleQuantityText}>
                      Vehicle quantity is fixed to 1
                    </Text>
                  </View>
                )}

                <View style={styles.totalBox}>
                  <View>
                    <Text style={styles.totalLabel}>Total Amount</Text>
                    <Text style={styles.totalValue}>{formatMoney(totalAmount)}</Text>
                  </View>

                  <View style={styles.statusBox}>
                    <Text
                      style={[
                        styles.statusText,
                        isFullyPaid ? styles.fullyPaidText : styles.partialPaidText,
                      ]}
                    >
                      {isFullyPaid ? 'Full Payment' : 'Partial Payment'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>Payment</Text>

                <View style={styles.paymentToggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.paymentToggleButton,
                      fullPayment && styles.paymentToggleActive,
                    ]}
                    onPress={() => setFullPayment(true)}
                  >
                    <Text
                      style={[
                        styles.paymentToggleText,
                        fullPayment && styles.paymentToggleTextActive,
                      ]}
                    >
                      Full
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.paymentToggleButton,
                      !fullPayment && styles.paymentToggleActive,
                    ]}
                    onPress={() => {
                      setFullPayment(false);
                      setDepositAmount('');
                    }}
                  >
                    <Text
                      style={[
                        styles.paymentToggleText,
                        !fullPayment && styles.paymentToggleTextActive,
                      ]}
                    >
                      Partial
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Payment Method</Text>
                <View style={styles.methodGrid}>
                  {[
                    { value: 'cash', label: 'Cash' },
                    { value: 'transfer', label: 'Transfer' },
                    { value: 'bank_deposit', label: 'Bank Deposit' },
                    { value: 'check', label: 'Check' },
                  ].map((method) => (
                    <TouchableOpacity
                      key={method.value}
                      style={[
                        styles.methodButton,
                        paymentMethod === method.value && styles.methodButtonActive,
                      ]}
                      onPress={() => setPaymentMethod(method.value as PaymentMethod)}
                    >
                      <Text
                        style={[
                          styles.methodText,
                          paymentMethod === method.value && styles.methodTextActive,
                        ]}
                      >
                        {method.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {paymentMethod !== 'cash' ? (
                  <>
                    <Text style={styles.inputLabel}>Bank Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Bank name"
                      placeholderTextColor="#64748b"
                      value={bankName}
                      onChangeText={setBankName}
                    />

                    <Text style={styles.inputLabel}>Reference Number *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Reference / check number"
                      placeholderTextColor="#64748b"
                      value={referenceNumber}
                      onChangeText={setReferenceNumber}
                    />
                  </>
                ) : null}

                <Text style={styles.inputLabel}>Amount Paid / Submitted *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Amount paid"
                  placeholderTextColor="#64748b"
                  value={depositAmount}
                  onChangeText={(text) => {
                    setFullPayment(false);
                    setDepositAmount(text.replace(/[^0-9.]/g, ''));
                  }}
                  keyboardType="decimal-pad"
                  editable={!fullPayment}
                />

                <View style={styles.paymentSummaryBox}>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Paid / Submitted</Text>
                    <Text style={styles.paymentSummaryPaid}>
                      {formatMoney(paidAmount)}
                    </Text>
                  </View>

                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Need to Pay</Text>
                    <Text
                      style={[
                        styles.paymentSummaryRemaining,
                        remainingAmount === 0 && styles.paymentSummaryPaid,
                      ]}
                    >
                      {remainingAmount > 0 ? formatMoney(remainingAmount) : 'Fully paid'}
                    </Text>
                  </View>

                  <Text style={styles.paymentSummaryNote}>
                    {isFullyPaid
                      ? 'This request will go to admin approval.'
                      : 'This request will stay pending payment and reserve the item.'}
                  </Text>
                </View>

                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  placeholder="Optional notes"
                  placeholderTextColor="#64748b"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleClose}
                    disabled={loading || creatingCustomer}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      (loading || creatingCustomer) && styles.disabledButton,
                    ]}
                    onPress={handleSubmit}
                    disabled={loading || creatingCustomer}
                  >
                    {loading || creatingCustomer ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.submitButtonText}>Submit Request</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    paddingTop: 18,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
  },
  closeButton: {
    backgroundColor: '#334155',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 16,
  },
  itemCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 16,
    marginBottom: 18,
  },
  itemType: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  itemName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemSpecs: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  itemCode: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 3,
    fontFamily: 'monospace',
  },
  itemSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: 10,
    marginBottom: 4,
  },
  summaryValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 6,
  },
  customerModeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  customerModeButton: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  customerModeButtonActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  customerModeText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  customerModeTextActive: {
    color: '#ffffff',
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 14,
  },
  notesInput: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
  customerList: {
    marginBottom: 14,
    gap: 8,
  },
  customerOption: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
  },
  customerOptionName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  customerOptionSub: {
    color: '#94a3b8',
    fontSize: 12,
  },
  selectedCustomerBox: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  selectedCustomerInfo: {
    flex: 1,
  },
  selectedCustomerName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  selectedCustomerSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  changeCustomerButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  changeCustomerText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCustomerBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyCustomerText: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 10,
  },
  createCustomerInlineButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createCustomerInlineText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  newCustomerForm: {
    marginBottom: 12,
  },
  smallLoadingBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  smallLoadingText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 8,
  },
  vehicleQuantityBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginBottom: 14,
  },
  vehicleQuantityText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  totalBox: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 3,
  },
  totalValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusBox: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  fullyPaidText: {
    color: '#22c55e',
  },
  partialPaidText: {
    color: '#fbbf24',
  },
  paymentToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  paymentToggleButton: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  paymentToggleActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  paymentToggleText: {
    color: '#94a3b8',
    fontWeight: '700',
  },
  paymentToggleTextActive: {
    color: '#ffffff',
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  methodButton: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  methodButtonActive: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  methodText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  methodTextActive: {
    color: '#ef4444',
  },
  paymentSummaryBox: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  paymentSummaryLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  paymentSummaryPaid: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '700',
  },
  paymentSummaryRemaining: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '700',
  },
  paymentSummaryNote: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
});