import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../services/authStorage';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const ROLE_OPTIONS: UserRole[] = [
  'super_admin',
  'admin',
  'worker',
  'store_manager',
];

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  worker: 'Worker',
  store_manager: 'Store Manager',
};

const roleDescriptions: Record<UserRole, string> = {
  super_admin: 'Can manage users and access admin features',
  admin: 'Can approve sales and view inventory/history',
  worker: 'Can create sale requests and add payments',
  store_manager: 'Can add stock and view inventory/history',
};

const roleColors: Record<UserRole, string> = {
  super_admin: '#a855f7',
  admin: '#3b82f6',
  worker: '#22c55e',
  store_manager: '#f97316',
};

const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return 'N/A';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const isValidEmail = (email: string) => {
  return /\S+@\S+\.\S+/.test(email);
};

const RoleChip = ({
  role,
  selected,
  onPress,
}: {
  role: UserRole;
  selected: boolean;
  onPress: () => void;
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.roleChip,
        selected && {
          backgroundColor: `${roleColors[role]}22`,
          borderColor: roleColors[role],
        },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.roleChipText,
          selected && { color: roleColors[role] },
        ]}
      >
        {roleLabels[role]}
      </Text>
    </TouchableOpacity>
  );
};

const CreateUserModal = ({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('worker');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setFullName('');
      setEmail('');
      setTemporaryPassword('');
      setShowPassword(false);
      setRole('worker');
      setSubmitting(false);
    }
  }, [visible]);

  const generateTemporaryPassword = () => {
    const randomNumber = Math.floor(10000 + Math.random() * 90000);
    const prefix =
      role === 'admin'
        ? 'Admin'
        : role === 'store_manager'
          ? 'Store'
          : role === 'super_admin'
            ? 'Super'
            : 'Worker';

    setTemporaryPassword(`${prefix}@${randomNumber}`);
    setShowPassword(true);
  };

  const handleCreate = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Full name is required');
      return;
    }

    if (!email.trim() || !isValidEmail(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email');
      return;
    }

    if (!temporaryPassword || temporaryPassword.length < 6) {
      Alert.alert('Error', 'Temporary password must be at least 6 characters');
      return;
    }

    setSubmitting(true);

    try {
      await authApi.createUser({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password: temporaryPassword,
        role,
      });

      Alert.alert(
        'User Created',
        `${roleLabels[role]} account has been created.\n\nTemporary password:\n${temporaryPassword}\n\nGive this password to the user and ask them to change it after login.`
      );

      onCreated();
      onClose();
    } catch (error: any) {
      console.error('Create user error:', {
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
      });

      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to create user'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Create User</Text>
              <Text style={styles.modalSubtitle}>
                Create a staff account with a temporary password
              </Text>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter full name"
              placeholderTextColor="#64748b"
              value={fullName}
              onChangeText={setFullName}
              editable={!submitting}
            />

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter email address"
              placeholderTextColor="#64748b"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
            />

            <Text style={styles.inputLabel}>Temporary Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter temporary password"
                placeholderTextColor="#64748b"
                value={temporaryPassword}
                onChangeText={setTemporaryPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
              />

              <TouchableOpacity
                style={styles.showPasswordButton}
                onPress={() => setShowPassword((prev) => !prev)}
                disabled={submitting}
              >
                <Text style={styles.showPasswordText}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.generatePasswordButton}
              onPress={generateTemporaryPassword}
              disabled={submitting}
            >
              <Text style={styles.generatePasswordText}>
                Generate Temporary Password
              </Text>
            </TouchableOpacity>

            <View style={styles.passwordInfoBox}>
              <Text style={styles.passwordInfoTitle}>Temporary Password</Text>
              <Text style={styles.passwordInfoText}>
                Give this password to the user privately. After logging in, they
                should use Change Password to set their own password.
              </Text>
            </View>

            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.roleGrid}>
              {ROLE_OPTIONS.map((roleOption) => (
                <RoleChip
                  key={roleOption}
                  role={roleOption}
                  selected={role === roleOption}
                  onPress={() => setRole(roleOption)}
                />
              ))}
            </View>

            <View style={styles.roleInfoBox}>
              <Text style={[styles.roleInfoTitle, { color: roleColors[role] }]}>
                {roleLabels[role]}
              </Text>
              <Text style={styles.roleInfoText}>{roleDescriptions[role]}</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={submitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.disabledButton]}
                onPress={handleCreate}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Create User</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const ResetPasswordModal = ({
  visible,
  user,
  onClose,
}: {
  visible: boolean;
  user: UserProfile | null;
  onClose: () => void;
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setPassword('');
      setShowPassword(false);
      setSubmitting(false);
    }
  }, [visible]);

  const handleReset = async () => {
    if (!user) return;

    if (!password || password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);

    try {
      await authApi.resetUserPassword(user.id, password);

      Alert.alert('Success', `Password reset for ${user.full_name}`);
      onClose();
    } catch (error: any) {
      console.error('Reset password error:', {
        status: error.response?.status,
        data: error.response?.data,
      });

      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to reset password'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.smallModalContent}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <Text style={styles.modalSubtitle}>{user.email}</Text>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>New Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Minimum 6 characters"
              placeholderTextColor="#64748b"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!submitting}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={styles.showPasswordButton}
              onPress={() => setShowPassword((prev) => !prev)}
              disabled={submitting}
            >
              <Text style={styles.showPasswordText}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.disabledButton]}
              onPress={handleReset}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Reset</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const UserCard = ({
  user,
  currentUserId,
  onToggleStatus,
  onChangeRole,
  onResetPassword,
  onDeleteUser,
  processingId,
}: {
  user: UserProfile;
  currentUserId?: string;
  onToggleStatus: (user: UserProfile) => void;
  onChangeRole: (user: UserProfile, role: UserRole) => void;
  onResetPassword: (user: UserProfile) => void;
  onDeleteUser: (user: UserProfile) => void;
  processingId: string | null;
}) => {
  const isSelf = user.id === currentUserId;
  const isProcessing = processingId === user.id;

  return (
    <View style={[styles.userCard, !user.is_active && styles.disabledUserCard]}>
      <View style={styles.userHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.full_name?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.full_name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          <Text style={styles.createdText}>
            Created: {formatDate(user.created_at)}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            user.is_active ? styles.activeBadge : styles.inactiveBadge,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              user.is_active ? styles.activeText : styles.inactiveText,
            ]}
          >
            {user.is_active ? 'Active' : 'Disabled'}
          </Text>
        </View>
      </View>

      <View style={styles.roleSection}>
        <Text style={styles.sectionLabel}>Role</Text>

        <View style={styles.roleGrid}>
          {ROLE_OPTIONS.map((roleOption) => {
            const selected = user.role === roleOption;

            return (
              <TouchableOpacity
                key={roleOption}
                style={[
                  styles.roleChipSmall,
                  selected && {
                    backgroundColor: `${roleColors[roleOption]}22`,
                    borderColor: roleColors[roleOption],
                  },
                  isProcessing && styles.disabledButton,
                ]}
                disabled={isProcessing || isSelf}
                onPress={() => onChangeRole(user, roleOption)}
              >
                <Text
                  style={[
                    styles.roleChipSmallText,
                    selected && { color: roleColors[roleOption] },
                  ]}
                >
                  {roleLabels[roleOption]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isSelf ? (
          <Text style={styles.selfNote}>
            You cannot change your own role, disable yourself, or delete yourself.
          </Text>
        ) : null}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={() => onResetPassword(user)}
          disabled={isProcessing}
        >
          <Text style={styles.resetButtonText}>Reset Password</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            user.is_active ? styles.disableButton : styles.enableButton,
            (isProcessing || isSelf) && styles.disabledButton,
          ]}
          onPress={() => onToggleStatus(user)}
          disabled={isProcessing || isSelf}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text
              style={
                user.is_active
                  ? styles.disableButtonText
                  : styles.enableButtonText
              }
            >
              {user.is_active ? 'Disable' : 'Enable'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.deleteButton,
            (isProcessing || isSelf) && styles.disabledButton,
          ]}
          onPress={() => onDeleteUser(user)}
          disabled={isProcessing || isSelf}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function UserManagementScreen() {
  const navigation = useNavigation();
  const { user: currentUser, isSuperAdmin } = useAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadUsers = async () => {
    try {
      setLoading(true);

      const response = await authApi.getUsers();
      setUsers(response.data.data || []);
    } catch (error: any) {
      console.error('Load users error:', {
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
      });

      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to load users'
      );
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isSuperAdmin) {
        loadUsers();
      }
    }, [isSuperAdmin])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const handleToggleStatus = (targetUser: UserProfile) => {
    const nextStatus = !targetUser.is_active;

    Alert.alert(
      nextStatus ? 'Enable User' : 'Disable User',
      `Are you sure you want to ${nextStatus ? 'enable' : 'disable'} ${
        targetUser.full_name
      }?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: nextStatus ? 'Enable' : 'Disable',
          style: nextStatus ? 'default' : 'destructive',
          onPress: async () => {
            setProcessingId(targetUser.id);

            try {
              await authApi.updateUserStatus(targetUser.id, nextStatus);
              await loadUsers();
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.response?.data?.error || 'Failed to update user status'
              );
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const handleChangeRole = (targetUser: UserProfile, role: UserRole) => {
    if (targetUser.role === role) return;

    Alert.alert(
      'Change Role',
      `Change ${targetUser.full_name}'s role to ${roleLabels[role]}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Change',
          onPress: async () => {
            setProcessingId(targetUser.id);

            try {
              await authApi.updateUserRole(targetUser.id, role);
              await loadUsers();
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.response?.data?.error || 'Failed to update role'
              );
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const handleResetPassword = (targetUser: UserProfile) => {
    setSelectedUser(targetUser);
    setResetModalVisible(true);
  };

  const handleDeleteUser = (targetUser: UserProfile) => {
    if (targetUser.id === currentUser?.id) {
      Alert.alert('Error', 'You cannot delete your own account');
      return;
    }

    Alert.alert(
      'Delete User',
      `Are you sure you want to permanently delete ${targetUser.full_name}? This cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(targetUser.id);

            try {
              await authApi.deleteUser(targetUser.id);
              await loadUsers();

              Alert.alert(
                'Deleted',
                `${targetUser.full_name} has been deleted`
              );
            } catch (error: any) {
              console.error('Delete user error:', {
                status: error.response?.status,
                data: error.response?.data,
                url: error.config?.url,
              });

              Alert.alert(
                'Error',
                error.response?.data?.error || 'Failed to delete user'
              );
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const filteredUsers = users.filter((u) => {
    const query = search.toLowerCase().trim();

    if (!query) return true;

    return (
      u.full_name?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.role?.toLowerCase().includes(query)
    );
  });

  const roleCounts = ROLE_OPTIONS.reduce((acc, role) => {
    acc[role] = users.filter((u) => u.role === role).length;
    return acc;
  }, {} as Record<UserRole, number>);

  if (!isSuperAdmin) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedIcon}>🔒</Text>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedText}>
            Only super admins can manage users.
          </Text>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading && users.length === 0) {
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
        <View>
          <Text style={styles.headerTitle}>Manage Users</Text>
          <Text style={styles.headerSubtitle}>
            {users.length} total users • {users.filter((u) => u.is_active).length}{' '}
            active
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setCreateModalVisible(true)}
        >
          <Text style={styles.addButtonText}>+ User</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        {ROLE_OPTIONS.map((role) => (
          <View key={role} style={styles.summaryCard}>
            <Text style={[styles.summaryNumber, { color: roleColors[role] }]}>
              {roleCounts[role]}
            </Text>
            <Text style={styles.summaryLabel}>{roleLabels[role]}</Text>
          </View>
        ))}
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users by name, email, or role..."
          placeholderTextColor="#64748b"
          value={search}
          onChangeText={setSearch}
        />

        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <UserCard
            user={item}
            currentUserId={currentUser?.id}
            onToggleStatus={handleToggleStatus}
            onChangeRole={handleChangeRole}
            onResetPassword={handleResetPassword}
            onDeleteUser={handleDeleteUser}
            processingId={processingId}
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No users found</Text>
            <Text style={styles.emptySubtitle}>
              Create a user or adjust your search.
            </Text>
          </View>
        }
      />

      <CreateUserModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreated={loadUsers}
      />

      <ResetPasswordModal
        visible={resetModalVisible}
        user={selectedUser}
        onClose={() => {
          setResetModalVisible(false);
          setSelectedUser(null);
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
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
  },
  addButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryLabel: {
    color: '#94a3b8',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2,
  },
  searchContainer: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
    color: '#64748b',
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    paddingVertical: 11,
  },
  clearIcon: {
    color: '#64748b',
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  userCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  disabledUserCard: {
    opacity: 0.65,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  userEmail: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 2,
  },
  createdText: {
    color: '#64748b',
    fontSize: 11,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.16)',
  },
  inactiveBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  activeText: {
    color: '#22c55e',
  },
  inactiveText: {
    color: '#ef4444',
  },
  roleSection: {
    marginBottom: 12,
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  roleChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  roleChipSmall: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleChipSmallText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  selfNote: {
    color: '#fbbf24',
    fontSize: 11,
    marginTop: 8,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  resetButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  disableButton: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  disableButtonText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  enableButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  enableButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '88%',
  },
  smallModalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 12,
    marginBottom: 16,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
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
    fontWeight: 'bold',
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
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 14,
    marginBottom: 14,
  },
  passwordContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#ffffff',
    fontSize: 14,
  },
  showPasswordButton: {
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  showPasswordText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  generatePasswordButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  generatePasswordText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '700',
  },
  passwordInfoBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  passwordInfoTitle: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  passwordInfoText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
  },
  roleInfoBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 6,
    marginBottom: 16,
  },
  roleInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  roleInfoText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
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
    fontWeight: '600',
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
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 13,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  accessDeniedIcon: {
    fontSize: 52,
    marginBottom: 14,
  },
  accessDeniedTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  accessDeniedText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});