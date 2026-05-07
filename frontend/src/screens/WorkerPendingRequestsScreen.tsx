import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { salesApi, paymentApi, customerApi, inventoryApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

type PaymentMethod = 'cash' | 'transfer' | 'check' | 'bank_deposit';
type ItemType = 'vehicle' | 'part';

interface Customer {
  id: string;
  full_name: string;
  phone?: string;
}

interface Vehicle {
  id: string;
  model: string;
  chassis_number: string;
  specifications?: string | null;
  unit_price: number;
  status?: string;
}

interface Part {
  id: string;
  part_number?: string;
  name: string;
  specifications?: string | null;
  quantity?: number;
  reserved_quantity?: number;
  available_quantity?: number;
  unit_price: number;
}

interface WorkerRequest {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  sales_type: string;
  item_type: ItemType;
  item_id: string;
  item_identifier: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  status: string;
  confirmed_amount: number;
  pending_amount: number;
  submitted_amount: number;
  remaining_amount: number;
  payment_method: PaymentMethod;
  bank_name: string;
  reference_number: string;
  deposit_amount: number;
  notes: string;
  created_date: string;
  performed_by?: string | null;
}

interface AddPaymentModalProps {
  visible: boolean;
  request: WorkerRequest | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface EditRequestModalProps {
  visible: boolean;
  request: WorkerRequest | null;
  customers: Customer[];
  vehicles: Vehicle[];
  parts: Part[];
  onClose: () => void;
  onSuccess: () => void;
}

const toNumber = (value: any) => {
  const numeric = Number(value || 0);
  return Number.isNaN(numeric) ? 0 : numeric;
};

const formatMoney = (value: number) => {
  return `Br ${toNumber(value).toLocaleString()}`;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const getUserId = (user: any) => {
  return user?.id || user?.user_id || user?.uuid || null;
};

const getUserDisplayName = (user: any) => {
  return user?.full_name || user?.name || user?.email || 'Worker';
};

const getPaymentMethodLabel = (method: PaymentMethod) => {
  switch (method) {
    case 'cash':
      return '💰 Cash';
    case 'transfer':
      return '🏦 Transfer';
    case 'check':
      return '📝 Check';
    case 'bank_deposit':
      return '🏛️ Deposit';
    default:
      return method;
  }
};

const getLatestPayment = (payments: any[]) => {
  if (!payments || payments.length === 0) return null;

  return [...payments].sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime()
  )[0];
};

const AddPaymentModal = ({
  visible,
  request,
  onClose,
  onSuccess,
}: AddPaymentModalProps) => {
  const { user } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer');
  const [bankName, setBankName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && request) {
      setPaymentMethod('transfer');
      setBankName('');
      setReferenceNumber('');
      setAmount(String(request.remaining_amount || ''));
      setNotes('');
    }
  }, [visible, request]);

  const handleSubmit = async () => {
    if (!request) return;

    const parsedAmount = Number(amount || 0);

    if (!parsedAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid payment amount');
      return;
    }

    if (parsedAmount > request.remaining_amount) {
      Alert.alert(
        'Error',
        `Payment cannot be greater than remaining amount: ${formatMoney(
          request.remaining_amount
        )}`
      );
      return;
    }

    if (paymentMethod !== 'cash' && !bankName.trim()) {
      Alert.alert('Error', 'Bank name is required for non-cash payments');
      return;
    }

    if (
      (paymentMethod === 'transfer' || paymentMethod === 'check') &&
      !referenceNumber.trim()
    ) {
      Alert.alert('Error', 'Reference/check number is required');
      return;
    }

    setSubmitting(true);

    try {
      const response = await paymentApi.recordDeposit({
        sales_order_id: request.id,
        payment_method: paymentMethod,
        bank_name: paymentMethod === 'cash' ? null : bankName.trim(),
        reference_number:
          paymentMethod === 'cash' ? null : referenceNumber.trim() || null,
        amount: parsedAmount,
        notes: notes.trim() || null,
        performed_by: getUserId(user),
        performed_by_name: getUserDisplayName(user),
      });

      const newStatus = response?.data?.data?.order_status;

      Alert.alert(
        'Payment Submitted',
        newStatus === 'pending_admin'
          ? 'Full payment has been submitted. This order is now waiting for admin approval.'
          : 'Partial payment has been submitted. The order remains pending payment.'
      );

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error adding payment:', {
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
        requestData: error.config?.data,
      });

      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to submit payment'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!request) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Add Payment</Text>
              <Text style={styles.modalSubtitle}>{request.order_number}</Text>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.paymentSummaryBox}>
              <Text style={styles.summaryText}>
                Total: {formatMoney(request.total_amount)}
              </Text>
              <Text style={styles.summaryText}>
                Submitted: {formatMoney(request.submitted_amount)}
              </Text>
              <Text style={styles.summaryText}>
                Waiting verification: {formatMoney(request.pending_amount)}
              </Text>
              <Text style={styles.summaryRemainingText}>
                Remaining: {formatMoney(request.remaining_amount)}
              </Text>
            </View>

            <Text style={styles.inputLabel}>Payment Method</Text>

            <View style={styles.paymentMethodRow}>
              {(['cash', 'transfer', 'check', 'bank_deposit'] as PaymentMethod[]).map(
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
                        paymentMethod === method && styles.paymentChipTextSelected,
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
                    paymentMethod === 'check' ? 'Check Number' : 'Reference Number'
                  }
                  placeholderTextColor="#64748b"
                  value={referenceNumber}
                  onChangeText={setReferenceNumber}
                />
              </>
            ) : null}

            <TextInput
              style={styles.input}
              placeholder="Amount"
              placeholderTextColor="#64748b"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />

            <TextInput
              style={styles.notesInput}
              placeholder="Notes"
              placeholderTextColor="#64748b"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Payment</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const EditRequestModal = ({
  visible,
  request,
  customers,
  vehicles,
  parts,
  onClose,
  onSuccess,
}: EditRequestModalProps) => {
  const { user } = useAuth();

  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  const [itemType, setItemType] = useState<ItemType>('part');
  const [itemId, setItemId] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [bankName, setBankName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [depositAmount, setDepositAmount] = useState('');

  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && request) {
      setCustomerId(request.customer_id || '');
      setCustomerSearch('');

      setItemType(request.item_type || 'part');
      setItemId(request.item_id || '');
      setItemSearch('');

      setQuantity(String(request.quantity || 1));
      setUnitPrice(String(request.unit_price || ''));

      setPaymentMethod(request.payment_method || 'cash');
      setBankName(request.bank_name || '');
      setReferenceNumber(request.reference_number || '');
      setDepositAmount(String(request.deposit_amount || request.pending_amount || ''));

      setNotes(request.notes || '');
    }
  }, [visible, request]);

  const mergedVehicles = useMemo(() => {
    if (!request || request.item_type !== 'vehicle') return vehicles;

    const exists = vehicles.some((vehicle) => vehicle.id === request.item_id);

    if (exists || !request.item_id) return vehicles;

    return [
      {
        id: request.item_id,
        model: request.sales_type,
        chassis_number: request.item_identifier,
        unit_price: request.unit_price,
        status: 'reserved',
      },
      ...vehicles,
    ];
  }, [vehicles, request]);

  const mergedParts = useMemo(() => {
    if (!request || request.item_type !== 'part') return parts;

    const exists = parts.some((part) => part.id === request.item_id);

    if (exists || !request.item_id) return parts;

    return [
      {
        id: request.item_id,
        name: request.sales_type,
        part_number: request.item_identifier,
        unit_price: request.unit_price,
        quantity: request.quantity,
        available_quantity: request.quantity,
      },
      ...parts,
    ];
  }, [parts, request]);

  const selectedCustomer = customers.find((customer) => customer.id === customerId);

  const selectedPart = mergedParts.find((part) => part.id === itemId);
  const selectedVehicle = mergedVehicles.find((vehicle) => vehicle.id === itemId);

  const filteredCustomers = customers
    .filter((customer) => {
      const query = customerSearch.trim().toLowerCase();

      if (!query) return true;

      return (
        customer.full_name?.toLowerCase().includes(query) ||
        customer.phone?.toLowerCase().includes(query)
      );
    })
    .slice(0, 8);

  const filteredItems =
    itemType === 'part'
      ? mergedParts
          .filter((part) => {
            const query = itemSearch.trim().toLowerCase();

            if (!query) return true;

            return (
              part.name?.toLowerCase().includes(query) ||
              part.part_number?.toLowerCase().includes(query) ||
              part.specifications?.toLowerCase().includes(query)
            );
          })
          .slice(0, 8)
      : mergedVehicles
          .filter((vehicle) => {
            const query = itemSearch.trim().toLowerCase();

            if (!query) return true;

            return (
              vehicle.model?.toLowerCase().includes(query) ||
              vehicle.chassis_number?.toLowerCase().includes(query) ||
              vehicle.specifications?.toLowerCase().includes(query)
            );
          })
          .slice(0, 8);

  const calculatedTotal =
    itemType === 'vehicle'
      ? toNumber(unitPrice)
      : toNumber(quantity) * toNumber(unitPrice);

  const handleSelectPart = (part: Part) => {
    setItemId(part.id);
    setUnitPrice(String(toNumber(part.unit_price)));
    setItemSearch('');
  };

  const handleSelectVehicle = (vehicle: Vehicle) => {
    setItemId(vehicle.id);
    setQuantity('1');
    setUnitPrice(String(toNumber(vehicle.unit_price)));
    setItemSearch('');
  };

  const handleSubmit = async () => {
    if (!request) return;

    if (!customerId) {
      Alert.alert('Error', 'Please select a customer');
      return;
    }

    if (!itemId) {
      Alert.alert('Error', 'Please select an item');
      return;
    }

    const parsedQuantity = itemType === 'vehicle' ? 1 : Number(quantity || 0);
    const parsedUnitPrice = Number(unitPrice || 0);
    const parsedDepositAmount = Number(depositAmount || 0);

    if (!parsedQuantity || parsedQuantity <= 0) {
      Alert.alert('Error', 'Quantity must be greater than 0');
      return;
    }

    if (!parsedUnitPrice || parsedUnitPrice <= 0) {
      Alert.alert('Error', 'Unit price must be greater than 0');
      return;
    }

    if (!parsedDepositAmount || parsedDepositAmount <= 0) {
      Alert.alert('Error', 'Payment amount must be greater than 0');
      return;
    }

    const total = parsedQuantity * parsedUnitPrice;

    if (parsedDepositAmount > total) {
      Alert.alert('Error', 'Payment amount cannot be greater than total amount');
      return;
    }

    if (paymentMethod !== 'cash' && !bankName.trim()) {
      Alert.alert('Error', 'Bank name is required for non-cash payments');
      return;
    }

    if (
      (paymentMethod === 'transfer' || paymentMethod === 'check') &&
      !referenceNumber.trim()
    ) {
      Alert.alert('Error', 'Reference/check number is required');
      return;
    }

    setSubmitting(true);

    try {
      await salesApi.updateSaleRequest(request.id, {
        customer_id: customerId,
        notes: notes.trim() || null,

        item_type: itemType,
        item_id: itemId,
        vehicle_id: itemType === 'vehicle' ? itemId : undefined,
        part_id: itemType === 'part' ? itemId : undefined,

        quantity: parsedQuantity,
        unit_price: parsedUnitPrice,

        payment_method: paymentMethod,
        bank_name: paymentMethod === 'cash' ? null : bankName.trim(),
        reference_number:
          paymentMethod === 'cash' ? null : referenceNumber.trim() || null,
        deposit_amount: parsedDepositAmount,

        performed_by: getUserId(user),
        performed_by_name: getUserDisplayName(user),
      });

      Alert.alert('Success', 'Sale request updated successfully');

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating sale request:', {
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
        requestData: error.config?.data,
      });

      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to update sale request'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!request) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Edit Sale Request</Text>
              <Text style={styles.modalSubtitle}>{request.order_number}</Text>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                You can edit this request until the admin approves it.
              </Text>
            </View>

            <Text style={styles.inputLabel}>Customer</Text>

            <TextInput
              style={styles.input}
              placeholder="Search customer"
              placeholderTextColor="#64748b"
              value={customerSearch}
              onChangeText={setCustomerSearch}
            />

            <View style={styles.optionList}>
              {filteredCustomers.map((customer) => {
                const selected = customer.id === customerId;

                return (
                  <TouchableOpacity
                    key={customer.id}
                    style={[styles.optionRow, selected && styles.optionRowSelected]}
                    onPress={() => {
                      setCustomerId(customer.id);
                      setCustomerSearch('');
                    }}
                  >
                    <View style={styles.optionTextContainer}>
                      <Text
                        style={[
                          styles.optionTitle,
                          selected && styles.optionTitleSelected,
                        ]}
                      >
                        {customer.full_name}
                      </Text>
                      {customer.phone ? (
                        <Text style={styles.optionSubtitle}>{customer.phone}</Text>
                      ) : null}
                    </View>

                    {selected ? <Text style={styles.checkMark}>✓</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedCustomer ? (
              <Text style={styles.selectedText}>
                Selected customer: {selectedCustomer.full_name}
              </Text>
            ) : null}

            <Text style={styles.inputLabel}>Item Type</Text>

            <View style={styles.paymentMethodRow}>
              {(['part', 'vehicle'] as ItemType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.paymentChip,
                    itemType === type && styles.paymentChipSelected,
                  ]}
                  onPress={() => {
                    setItemType(type);
                    setItemId('');
                    setItemSearch('');
                    setQuantity(type === 'vehicle' ? '1' : quantity);
                  }}
                >
                  <Text
                    style={[
                      styles.paymentChipText,
                      itemType === type && styles.paymentChipTextSelected,
                    ]}
                  >
                    {type === 'part' ? '🔧 Part' : '🚛 Vehicle'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder={
                itemType === 'part'
                  ? 'Search part name or part number'
                  : 'Search model or chassis number'
              }
              placeholderTextColor="#64748b"
              value={itemSearch}
              onChangeText={setItemSearch}
            />

            <View style={styles.optionList}>
              {filteredItems.map((item: any) => {
                const selected = item.id === itemId;

                const title = itemType === 'part' ? item.name : item.model;
                const subtitle =
                  itemType === 'part'
                    ? `${item.part_number || 'No part number'} • Available: ${
                        item.available_quantity ??
                        toNumber(item.quantity) - toNumber(item.reserved_quantity)
                      }`
                    : `${item.chassis_number || 'No chassis number'} • ${
                        item.status || 'available'
                      }`;

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.optionRow, selected && styles.optionRowSelected]}
                    onPress={() => {
                      if (itemType === 'part') {
                        handleSelectPart(item);
                      } else {
                        handleSelectVehicle(item);
                      }
                    }}
                  >
                    <View style={styles.optionTextContainer}>
                      <Text
                        style={[
                          styles.optionTitle,
                          selected && styles.optionTitleSelected,
                        ]}
                      >
                        {title}
                      </Text>
                      <Text style={styles.optionSubtitle}>{subtitle}</Text>
                    </View>

                    {selected ? <Text style={styles.checkMark}>✓</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            {itemType === 'part' && selectedPart ? (
              <Text style={styles.selectedText}>
                Selected part: {selectedPart.name}
              </Text>
            ) : null}

            {itemType === 'vehicle' && selectedVehicle ? (
              <Text style={styles.selectedText}>
                Selected vehicle: {selectedVehicle.model}
              </Text>
            ) : null}

            {itemType === 'part' ? (
              <>
                <Text style={styles.inputLabel}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Quantity"
                  placeholderTextColor="#64748b"
                  value={quantity}
                  onChangeText={(text) => setQuantity(text.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                />
              </>
            ) : null}

            <Text style={styles.inputLabel}>Unit Price</Text>
            <TextInput
              style={styles.input}
              placeholder="Unit Price"
              placeholderTextColor="#64748b"
              value={unitPrice}
              onChangeText={setUnitPrice}
              keyboardType="numeric"
            />

            <View style={styles.paymentSummaryBox}>
              <Text style={styles.summaryText}>
                New Total: {formatMoney(calculatedTotal)}
              </Text>
            </View>

            <Text style={styles.inputLabel}>Payment Method</Text>

            <View style={styles.paymentMethodRow}>
              {(['cash', 'transfer', 'check', 'bank_deposit'] as PaymentMethod[]).map(
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
                        paymentMethod === method && styles.paymentChipTextSelected,
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
                    paymentMethod === 'check' ? 'Check Number' : 'Reference Number'
                  }
                  placeholderTextColor="#64748b"
                  value={referenceNumber}
                  onChangeText={setReferenceNumber}
                />
              </>
            ) : null}

            <Text style={styles.inputLabel}>Submitted Payment Amount</Text>

            <TextInput
              style={styles.input}
              placeholder="Payment Amount"
              placeholderTextColor="#64748b"
              value={depositAmount}
              onChangeText={setDepositAmount}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Notes</Text>

            <TextInput
              style={styles.notesInput}
              placeholder="Notes"
              placeholderTextColor="#64748b"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const RequestCard = ({
  request,
  onAddPayment,
  onEdit,
}: {
  request: WorkerRequest;
  onAddPayment: () => void;
  onEdit: () => void;
}) => {
  const isPending = request.status === 'pending';
  const isPendingAdmin = request.status === 'pending_admin';
  const canEdit = isPending || isPendingAdmin;

  const getStatusColor = () => {
    if (isPendingAdmin) return '#3b82f6';
    if (isPending) return '#f97316';
    return '#94a3b8';
  };

  const getStatusText = () => {
    if (isPendingAdmin) return 'Waiting for Approval';
    if (isPending) return 'Pending Payment';
    return request.status;
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderNumber}>{request.order_number}</Text>
          <Text style={styles.dateText}>{formatDate(request.created_date)}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor()}20` }]}>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
        </View>
      </View>

      <Text style={styles.customerName}>{request.customer_name}</Text>
      <Text style={styles.itemName}>
        {request.sales_type} x{request.quantity}
      </Text>

      {request.item_identifier ? (
        <Text style={styles.itemIdentifier}>{request.item_identifier}</Text>
      ) : null}

      <View style={styles.paymentInfo}>
        <Text style={styles.totalAmount}>
          Total: {formatMoney(request.total_amount)}
        </Text>

        <Text style={styles.paidAmount}>
          Submitted: {formatMoney(request.submitted_amount)}
        </Text>

        {request.confirmed_amount > 0 ? (
          <Text style={styles.confirmedAmount}>
            Confirmed: {formatMoney(request.confirmed_amount)}
          </Text>
        ) : null}

        {request.pending_amount > 0 ? (
          <Text style={styles.pendingAmount}>
            Waiting verification: {formatMoney(request.pending_amount)}
          </Text>
        ) : null}

        {request.remaining_amount > 0 ? (
          <Text style={styles.remainingAmount}>
            Remaining: {formatMoney(request.remaining_amount)}
          </Text>
        ) : null}
      </View>

      {request.notes ? <Text style={styles.notes}>📝 {request.notes}</Text> : null}

      <View style={styles.actions}>
        {canEdit ? (
          <TouchableOpacity style={styles.editButton} onPress={onEdit}>
            <Text style={styles.editButtonText}>Edit Request</Text>
          </TouchableOpacity>
        ) : null}

        {isPending && request.remaining_amount > 0 ? (
          <TouchableOpacity style={styles.addPaymentButton} onPress={onAddPayment}>
            <Text style={styles.addPaymentButtonText}>+ Add Payment</Text>
          </TouchableOpacity>
        ) : null}

        {isPendingAdmin ? (
          <View style={styles.pendingAdminBadge}>
            <Text style={styles.pendingAdminText}>
              ⏳ Waiting for Admin Approval
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default function WorkerPendingRequestsScreen() {
  const { user } = useAuth();

  const userId = getUserId(user);
  const userRole = user?.role;
  const userDisplayName = getUserDisplayName(user);

  const [requests, setRequests] = useState<WorkerRequest[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [parts, setParts] = useState<Part[]>([]);

  const [loading, setLoading] = useState(true);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [addPaymentVisible, setAddPaymentVisible] = useState(false);
  const [editRequestVisible, setEditRequestVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<WorkerRequest | null>(null);

  const loadLookups = useCallback(async () => {
    try {
      setLookupsLoading(true);

      const [customersResponse, vehiclesResponse, partsResponse] =
        await Promise.all([
          customerApi.getCustomers('', 200, 0),
          inventoryApi.getAvailableVehicles(),
          inventoryApi.getAvailableParts(),
        ]);

      setCustomers(customersResponse.data.data || []);
      setVehicles(vehiclesResponse.data.data || []);
      setParts(partsResponse.data.data || []);
    } catch (error: any) {
      console.error('Error loading edit lookups:', {
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
      });
    } finally {
      setLookupsLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);

      const response = await salesApi.getSalesOrders();
      const orders = response.data.data || [];

      const workerOrders = orders.filter((order: any) => {
        const isEditableStatus = ['pending', 'pending_admin'].includes(order.status);

        if (!isEditableStatus) return false;

        if (userRole === 'worker' && order.performed_by && userId) {
          return order.performed_by === userId;
        }

        return true;
      });

      const requestsList: WorkerRequest[] = [];

      for (const order of workerOrders) {
        const orderDetails = await salesApi.getSalesOrderById(order.id);
        const details = orderDetails.data.data;

        const paymentsResponse = await paymentApi.getOrderPaymentHistory(order.id);
        const paymentData = paymentsResponse.data.data;

        const confirmedPayments = paymentData?.payments?.confirmed || [];
        const pendingPayments = paymentData?.payments?.pending || [];
        const rejectedPayments = paymentData?.payments?.rejected || [];

        const totalConfirmed = toNumber(paymentData?.summary?.total_confirmed);
        const totalPending = toNumber(paymentData?.summary?.total_pending);
        const totalSubmitted = totalConfirmed + totalPending;

        const totalAmount = toNumber(order.total_amount || details.total_amount);
        const remainingAmount = Math.max(0, totalAmount - totalSubmitted);

        const firstItem = details.items?.[0];

        const itemType: ItemType =
          firstItem?.item_type === 'vehicle' ? 'vehicle' : 'part';

        const itemId =
          itemType === 'vehicle'
            ? firstItem?.vehicle_id
            : firstItem?.part_id;

        const salesType =
          itemType === 'vehicle'
            ? firstItem?.model
            : firstItem?.name || firstItem?.part_number;

        const itemIdentifier =
          itemType === 'vehicle'
            ? firstItem?.chassis_number
            : firstItem?.part_number;

        const latestPendingPayment = getLatestPayment(pendingPayments);
        const latestPayment =
          latestPendingPayment ||
          getLatestPayment([...confirmedPayments, ...pendingPayments, ...rejectedPayments]);

        requestsList.push({
          id: order.id,
          order_number: order.order_number,
          customer_id: details.customer?.id || order.customer_id,
          customer_name: details.customer?.full_name || 'Unknown',
          sales_type: salesType || 'Item',
          item_type: itemType,
          item_id: itemId || '',
          item_identifier: itemIdentifier || '',
          quantity: toNumber(firstItem?.quantity || 1),
          unit_price: toNumber(firstItem?.unit_price || 0),
          total_amount: totalAmount,
          status: order.status,
          confirmed_amount: totalConfirmed,
          pending_amount: totalPending,
          submitted_amount: totalSubmitted,
          remaining_amount: remainingAmount,
          payment_method: latestPayment?.payment_method || 'cash',
          bank_name: latestPayment?.bank_name || '',
          reference_number: latestPayment?.reference_number || '',
          deposit_amount: toNumber(latestPendingPayment?.amount || totalPending || 0),
          notes: order.notes || '',
          created_date: order.created_at,
          performed_by: order.performed_by,
        });
      }

      setRequests(requestsList);
    } catch (error: any) {
      console.error('Error loading requests:', {
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
        message: error.message,
      });

      Alert.alert('Error', 'Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  }, [userId, userRole]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
      loadLookups();
    }, [loadRequests, loadLookups])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadRequests(), loadLookups()]);
    setRefreshing(false);
  };

  const handleAddPayment = (request: WorkerRequest) => {
    setSelectedRequest(request);
    setAddPaymentVisible(true);
  };

  const handleEditRequest = (request: WorkerRequest) => {
    setSelectedRequest(request);
    setEditRequestVisible(true);
  };

  if (loading && requests.length === 0) {
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
        <View style={styles.headerRow}>
          <Text style={styles.headerIcon}>📋</Text>
          <Text style={styles.headerTitle}>My Sale Requests</Text>
        </View>

        <Text style={styles.headerSubtitle}>
          {requests.length} {requests.length === 1 ? 'request' : 'requests'}
          {lookupsLoading ? ' • Loading edit data...' : ''}
        </Text>
      </View>

      {requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>No pending requests</Text>
          <Text style={styles.emptySubtitle}>
            Create a sale request from the Inventory tab
          </Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RequestCard
              request={item}
              onAddPayment={() => handleAddPayment(item)}
              onEdit={() => handleEditRequest(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#ef4444"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <AddPaymentModal
        visible={addPaymentVisible}
        request={selectedRequest}
        onClose={() => {
          setAddPaymentVisible(false);
          setSelectedRequest(null);
        }}
        onSuccess={loadRequests}
      />

      <EditRequestModal
        visible={editRequestVisible}
        request={selectedRequest}
        customers={customers}
        vehicles={vehicles}
        parts={parts}
        onClose={() => {
          setEditRequestVisible(false);
          setSelectedRequest(null);
        }}
        onSuccess={async () => {
          await loadRequests();
          await loadLookups();
        }}
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
    justifyContent: 'center',
    alignItems: 'center',
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
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  dateText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 4,
  },
  itemIdentifier: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 8,
  },
  paymentInfo: {
    marginBottom: 8,
    gap: 2,
  },
  totalAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  paidAmount: {
    fontSize: 12,
    color: '#94a3b8',
  },
  confirmedAmount: {
    fontSize: 12,
    color: '#22c55e',
  },
  pendingAmount: {
    fontSize: 12,
    color: '#60a5fa',
  },
  remainingAmount: {
    fontSize: 12,
    color: '#fbbf24',
  },
  notes: {
    fontSize: 12,
    color: '#fbbf24',
    marginBottom: 12,
  },
  actions: {
    marginTop: 8,
    gap: 8,
  },
  editButton: {
    backgroundColor: '#334155',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  addPaymentButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  addPaymentButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  pendingAdminBadge: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  pendingAdminText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    textAlign: 'center',
  },
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
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
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
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  warningText: {
    color: '#60a5fa',
    fontSize: 12,
    lineHeight: 17,
  },
  paymentSummaryBox: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 4,
  },
  summaryText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  summaryRemainingText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '600',
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '600',
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
    paddingVertical: 7,
    borderRadius: 20,
  },
  paymentChipSelected: {
    backgroundColor: '#ef4444',
  },
  paymentChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  paymentChipTextSelected: {
    color: '#ffffff',
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
    marginBottom: 12,
  },
  optionList: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  optionRowSelected: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  optionTitleSelected: {
    color: '#ef4444',
  },
  optionSubtitle: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  selectedText: {
    color: '#22c55e',
    fontSize: 12,
    marginBottom: 12,
  },
  checkMark: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginBottom: 12,
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
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});