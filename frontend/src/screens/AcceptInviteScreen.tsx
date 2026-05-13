import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabaseClient } from '../services/supabaseClient';

export default function AcceptInviteScreen({ navigation }: any) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkInviteSession();
  }, []);

  const checkInviteSession = async () => {
    try {
      const { data, error } = await supabaseClient.auth.getSession();

      if (error) {
        console.error('Invite session check error:', error.message);
      }

      setHasSession(!!data.session);
    } catch (error: any) {
      console.error('Invite session check failed:', error.message);
      setHasSession(false);
    } finally {
      setCheckingSession(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();

      if (!sessionData.session) {
        Alert.alert(
          'Invite Link Expired',
          'This invite link is expired or invalid. Please ask the super admin to send a new invitation.'
        );
        return;
      }

      const { error } = await supabaseClient.auth.updateUser({
        password,
      });

      if (error) {
        Alert.alert('Error', error.message || 'Failed to set password');
        return;
      }

      await supabaseClient.auth.signOut();

      Alert.alert(
        'Account Ready',
        'Your password has been set successfully. You can now log in.',
        [
          {
            text: 'Go to Login',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Accept invite error:', error.message);

      Alert.alert(
        'Error',
        error.message || 'Failed to accept invitation'
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ef4444" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" />

      <View style={styles.card}>
        <Text style={styles.icon}>📩</Text>

        <Text style={styles.title}>Accept Invitation</Text>

        <Text style={styles.subtitle}>
          Set your password to activate your Best Vehicles account.
        </Text>

        {!hasSession ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>Invite link not active</Text>
            <Text style={styles.warningText}>
              This invite link may be expired, already used, or not opened from
              the email correctly. Ask the super admin to send a new invitation.
            </Text>
          </View>
        ) : null}

        <Text style={styles.inputLabel}>New Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Enter password"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading && hasSession}
          />

          <TouchableOpacity
            style={styles.showPasswordButton}
            onPress={() => setShowPassword((prev) => !prev)}
            disabled={loading}
          >
            <Text style={styles.showPasswordText}>
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.inputLabel}>Confirm Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor="#64748b"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading && hasSession}
        />

        <TouchableOpacity
          style={[
            styles.submitButton,
            (loading || !hasSession) && styles.disabledButton,
          ]}
          onPress={handleAcceptInvite}
          disabled={loading || !hasSession}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>Set Password</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }}
          disabled={loading}
        >
          <Text style={styles.loginLinkText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: '#334155',
  },
  icon: {
    fontSize: 42,
    textAlign: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  warningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
  },
  warningTitle: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  warningText: {
    color: '#fca5a5',
    fontSize: 12,
    lineHeight: 17,
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
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  passwordContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
  },
  showPasswordButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  showPasswordText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.55,
  },
  loginLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  loginLinkText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
});