import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';

interface RequestDetail {
  id: string;
  order_number: string;
  customer_name: string;
  chassis_number: string;
  sales_type: string;
  reference_number: string;
  quantity: number;
  unit_price: number;
  deposit_bank: string;
  deposit_amount: number;
  deposit_status: string;
  notes: string;
  created_date: string;
}

export default function AdminRequestDetailScreen({ route, navigation }: any) {
  const { request } = route.params;

  const handleConfirm = () => {
    Alert.alert(
      'Confirm Sale',
      'This will mark the vehicle as sold and update inventory. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: () => {
            console.log('Sale confirmed:', request);
            navigation.goBack();
          }
        },
      ]
    );
  };

  const handleReject = () => {
    Alert.alert(
      'Reject Sale',
      'Are you sure you want to reject this request?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reject', 
          onPress: () => {
            console.log('Sale rejected:', request);
            navigation.goBack();
          }
        },
      ]
    );
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header with Order Number and Time */}
        <View style={styles.header}>
          <Text style={styles.orderNumber}>{request.order_number || 'SO#0175'}</Text>
          <Text style={styles.date}>{formatDate(request.created_date) || '9:25 AM'}</Text>
        </View>

        {/* Main Details Card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Customer name</Text>
            <Text style={styles.value}>{request.customer_name || 'Ins. Teshome Tefera'}</Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Chassis no</Text>
            <Text style={styles.value}>{request.chassis_number || 'LBUDWFTL1R0100759'}</Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Sales type</Text>
            <Text style={styles.value}>{request.sales_type || 'Electric Bajaj'}</Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Ck No</Text>
            <Text style={styles.value}>{request.reference_number || 'Transfer'}</Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Quantity</Text>
            <Text style={styles.value}>{request.quantity || '1'}</Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Unit price</Text>
            <Text style={styles.value}>Br {request.unit_price?.toLocaleString() || '350,000.00'}</Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Deposit bank</Text>
            <Text style={styles.value}>
              Total deposit Br {(request.deposit_amount || 350000).toLocaleString()} at {request.deposit_bank || 'CBE'}
            </Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Deposit status</Text>
            <View style={[styles.statusBadge, styles.statusConfirmed]}>
              <Text style={styles.statusText}>{request.deposit_status || 'Confirmed'}</Text>
            </View>
          </View>
        </View>

        {/* Notes Section */}
        {request.notes && (
          <View style={styles.notesCard}>
            <Text style={styles.notesLabel}>Note:</Text>
            <Text style={styles.notesText}>{request.notes}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.rejectButton} onPress={handleReject}>
            <Text style={styles.rejectButtonText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmButtonText}>Confirm Sale</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  date: {
    fontSize: 12,
    color: '#64748b',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  label: {
    fontSize: 14,
    color: '#94a3b8',
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusConfirmed: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  statusText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '600',
  },
  notesCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  notesLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#fbbf24',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
