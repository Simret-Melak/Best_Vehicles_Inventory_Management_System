import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { paymentApi } from '../services/api';

interface AddPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  order: {
    id: string;
    order_number: string;
    total_amount: number;
    deposit_amount: number;
  } | null;
  onSuccess: () => void;
}

export default function AddPaymentModal({ 
  visible, 
  onClose, 
  order, 
  onSuccess 
}: AddPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'check' | 'bank_deposit'>('transfer');
  const [bankName, setBankName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [fullPayment, setFullPayment] = useState(true);

  const totalAmount = order?.total_amount || 0;
  const paidAmount = order?.deposit_amount || 0;
  const remainingAmount = totalAmount - paidAmount;

  useEffect(() => {
    if (fullPayment && remainingAmount > 0) {
      setAmount(remainingAmount.toString());
    } else if (!fullPayment) {
      setAmount('');
    }
  }, [fullPayment, remainingAmount]);

  const handleSubmit = async () => {
    const paymentAmount = parseFloat(amount);
    
    if (!paymentAmount || paymentAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    
    if (paymentAmount > remainingAmount) {
      Alert.alert('Error', `Amount cannot exceed remaining balance of Br ${remainingAmount.toLocaleString()}`);
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
      await paymentApi.recordDeposit({
        sales_order_id: order?.id,
        payment_method: paymentMethod,
        bank_name: bankName,
        reference_number: referenceNumber,
        amount: paymentAmount,
      });
      
      Alert.alert('Success', 'Payment recorded! Admin will confirm once verified.');
      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAmount('');
    setPaymentMethod('transfer');
    setBankName('');
    setReferenceNumber('');
    setFullPayment(true);
  };

  if (!order) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add Payment</Text>
          
          {/* Order Info */}
          <View style={styles.orderInfoContainer}>
            <Text style={styles.orderInfoText}>Order: {order.order_number}</Text>
            <Text style={styles.orderInfoText}>Total: Br {totalAmount.toLocaleString()}</Text>
            <Text style={styles.orderInfoText}>Paid: Br {paidAmount.toLocaleString()}</Text>
            <Text style={styles.orderInfoTextHighlight}>
              Remaining: Br {remainingAmount.toLocaleString()}
            </Text>
          </View>
          
          {/* Payment Method */}
          <Text style={styles.modalLabel}>Payment Method</Text>
          <View style={styles.paymentMethodRow}>
            {(['cash', 'transfer', 'check', 'bank_deposit'] as const).map((method) => (
              <TouchableOpacity
                key={method}
                style={[styles.paymentChip, paymentMethod === method && styles.paymentChipSelected]}
                onPress={() => setPaymentMethod(method)}
              >
                <Text style={[styles.paymentChipText, paymentMethod === method && styles.paymentChipTextSelected]}>
                  {method === 'cash' ? '💰 Cash' : 
                   method === 'transfer' ? '🏦 Transfer' : 
                   method === 'check' ? '📝 Check' : '🏛️ Deposit'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Bank Details (for non-cash) */}
          {paymentMethod !== 'cash' && (
            <>
              <TextInput
                style={styles.modalInput}
                placeholder="Bank Name"
                placeholderTextColor="#64748b"
                value={bankName}
                onChangeText={setBankName}
              />
              <TextInput
                style={styles.modalInput}
                placeholder={paymentMethod === 'check' ? "Check Number" : "Reference Number"}
                placeholderTextColor="#64748b"
                value={referenceNumber}
                onChangeText={setReferenceNumber}
              />
            </>
          )}
          
          {/* Amount Options */}
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
                  Partial
                </Text>
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Amount"
              placeholderTextColor="#64748b"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
          </View>
          
          {/* Action Buttons */}
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Payment</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  orderInfoContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  orderInfoText: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  orderInfoTextHighlight: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
    marginBottom: 8,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  paymentChip: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  modalButtons: {
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
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
