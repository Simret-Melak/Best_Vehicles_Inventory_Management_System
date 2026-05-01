
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
} from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: {
    typeFilter: string;
    userFilter: string;
    dateFilter: string;
  }) => void;
  onClear: () => void;
  initialTypeFilter: string;
  initialUserFilter: string;
  initialDateFilter: string;
  uniqueUsers: string[];
}

// Dropdown option component
const DropdownSection = ({
  label,
  options,
  selectedValue,
  onSelect,
}: {
  label: string;
  options: { label: string; value: string }[];
  selectedValue: string;
  onSelect: (value: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);

  const selectedOption = options.find((opt) => opt.value === selectedValue);

  return (
    <View style={styles.dropdownSection}>
      <Text style={styles.filterLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdownHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={styles.dropdownHeaderText}>
          {selectedOption?.label || 'Select'}
        </Text>
        <Text style={styles.dropdownArrow}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.dropdownList}>
          <ScrollView style={styles.dropdownScroll}>
            {options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.dropdownOption,
                  selectedValue === option.value && styles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  onSelect(option.value);
                  setExpanded(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownOptionText,
                    selectedValue === option.value && styles.dropdownOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {selectedValue === option.value && (
                  <Text style={styles.checkMark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

export default function HistoryFilterModal({
  visible,
  onClose,
  onApply,
  onClear,
  initialTypeFilter,
  initialUserFilter,
  initialDateFilter,
  uniqueUsers,
}: Props) {
  const [localTypeFilter, setLocalTypeFilter] = useState(initialTypeFilter);
  const [localUserFilter, setLocalUserFilter] = useState(initialUserFilter);
  const [localDateFilter, setLocalDateFilter] = useState(initialDateFilter);

  useEffect(() => {
    if (visible) {
      setLocalTypeFilter(initialTypeFilter);
      setLocalUserFilter(initialUserFilter);
      setLocalDateFilter(initialDateFilter);
    }
  }, [visible, initialTypeFilter, initialUserFilter, initialDateFilter]);

  const typeOptions = [
    { label: 'All Types', value: 'all' },
    { label: 'Stock In', value: 'stock_in' },
    { label: 'Received', value: 'received' },
    { label: 'Sold', value: 'sold' },
    { label: 'Sale Confirmed', value: 'sale_confirmed' },
    { label: 'Reserved', value: 'reserved' },
    { label: 'Returned', value: 'returned' },
  ];

  const userOptions = [
    { label: 'All Users', value: 'all' },
    ...uniqueUsers.map((user) => ({ label: user, value: user })),
  ];

  const dateOptions = [
    { label: 'All Time', value: 'all' },
    { label: 'Last 7 Days', value: '7days' },
    { label: 'Last 30 Days', value: '30days' },
  ];

  const handleApply = () => {
    onApply({
      typeFilter: localTypeFilter,
      userFilter: localUserFilter,
      dateFilter: localDateFilter,
    });
    onClose();
  };

  const handleClear = () => {
    setLocalTypeFilter('all');
    setLocalUserFilter('all');
    setLocalDateFilter('all');
    onClear();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Filter Transactions</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <DropdownSection
              label="Transaction Type"
              options={typeOptions}
              selectedValue={localTypeFilter}
              onSelect={setLocalTypeFilter}
            />

            <DropdownSection
              label="User"
              options={userOptions}
              selectedValue={localUserFilter}
              onSelect={setLocalUserFilter}
            />

            <DropdownSection
              label="Date Range"
              options={dateOptions}
              selectedValue={localDateFilter}
              onSelect={setLocalDateFilter}
            />
          </ScrollView>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>Apply</Text>
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
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  dropdownSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
    marginBottom: 8,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dropdownHeaderText: {
    color: '#ffffff',
    fontSize: 14,
  },
  dropdownArrow: {
    color: '#94a3b8',
    fontSize: 12,
  },
  dropdownList: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 4,
    maxHeight: 200,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  dropdownOptionSelected: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  dropdownOptionText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  dropdownOptionTextSelected: {
    color: '#ef4444',
  },
  checkMark: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#475569',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
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
  applyButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
