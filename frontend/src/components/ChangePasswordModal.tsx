import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from 'react-native';
import { authApi } from '../services/api';

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

interface PasswordInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder: string;
  loading: boolean;
}

const PasswordInput = ({
  label,
  value,
  onChangeText,
  show,
  onToggleShow,
  placeholder,
  loading,
}: PasswordInputProps) => {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.passwordBox}>
        <TextInput
          style={styles.passwordInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#64748b"
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          blurOnSubmit={false}
          returnKeyType="next"
        />

        <TouchableOpacity
          style={styles.showButton}
          onPress={onToggleShow}
          disabled={loading}
        >
          <Text style={styles.showButtonText}>{show ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function ChangePasswordModal({
  visible,
  onClose,
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  };

  const handleClose = () => {
    resetForm();
    Keyboard.dismiss();
    onClose();
  };

  const validateForm = () => {
    if (!currentPassword.trim()) {
      Alert.alert('Error', 'Please enter your current password');
      return false;
    }

    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter your new password');
      return false;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return false;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New password and confirm password do not match');
      return false;
    }

    if (currentPassword === newPassword) {
      Alert.alert(
        'Error',
        'New password must be different from current password'
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      await authApi.updatePassword(
        currentPassword,
        newPassword,
        confirmPassword
      );

      Alert.alert('Success', 'Password updated successfully');
      resetForm();
      Keyboard.dismiss();
      onClose();
    } catch (error: any) {
      console.error('Update password error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });

      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to update password'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
        style={styles.modalOverlay}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.overlayContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderIcon}>🔐</Text>
                <Text style={styles.modalTitle}>Change Password</Text>

                <TouchableOpacity
                  onPress={handleClose}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                <PasswordInput
                  label="Current Password"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  show={showCurrent}
                  onToggleShow={() => setShowCurrent((prev) => !prev)}
                  placeholder="Enter current password"
                  loading={loading}
                />

                <PasswordInput
                  label="New Password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  show={showNew}
                  onToggleShow={() => setShowNew((prev) => !prev)}
                  placeholder="Enter new password"
                  loading={loading}
                />

                <PasswordInput
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  show={showConfirm}
                  onToggleShow={() => setShowConfirm((prev) => !prev)}
                  placeholder="Confirm new password"
                  loading={loading}
                />

                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    Your new password must be at least 6 characters.
                  </Text>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleClose}
                    disabled={loading}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      loading && styles.disabledButton,
                    ]}
                    onPress={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.submitButtonText}>
                        Update Password
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
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
  overlayContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '82%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  scrollContent: {
    paddingBottom: 24,
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
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
    marginBottom: 8,
  },
  passwordBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
  },
  showButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  showButtonText: {
    color: '#ef4444',
    fontSize: 12,
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
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.5,
  },
});