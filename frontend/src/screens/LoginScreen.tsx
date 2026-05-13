import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import ForgotPasswordModal from '../components/ForgotPasswordModal';

export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [forgotPasswordVisible, setForgotPasswordVisible] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setSubmitting(true);

    try {
      await login(email.trim().toLowerCase(), password);

      // No manual navigation needed.
      // App.tsx will automatically open the correct dashboard based on user.role.
    } catch (error: any) {
      console.error('Login error:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        method: error.config?.method,
        timeout: error.config?.timeout,
        hasResponse: !!error.response,
        hasRequest: !!error.request,
      });

      const isNetworkError =
        !error.response ||
        error.message === 'Network Error' ||
        error.code === 'ECONNABORTED';

      Alert.alert(
        'Login Failed',
        isNetworkError
          ? 'Cannot reach the server. Please check your internet connection, backend server, and API URL.'
          : error.response?.data?.error || 'Invalid email or password'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" />

      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/Logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />

        <Text style={styles.appTitle}>Best Vehicles</Text>
        <Text style={styles.appSubtitle}>Inventory & Sales Management</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Welcome Back</Text>
        <Text style={styles.cardSubtitle}>Sign in to continue</Text>

        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your email"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!submitting}
        />

        <Text style={styles.inputLabel}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Enter your password"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
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
          style={styles.forgotPasswordButton}
          onPress={() => setForgotPasswordVisible(true)}
          disabled={submitting}
        >
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.loginButton, submitting && styles.disabledButton]}
          onPress={handleLogin}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.loginButtonText}>Login</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.footerText}>
        Accounts are created by the super admin.
      </Text>

      <ForgotPasswordModal
        visible={forgotPasswordVisible}
        onClose={() => setForgotPasswordVisible(false)}
      />
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoImage: {
    width: 220,
    height: 140,
    marginBottom: 14,
  },
  appTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 6,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
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
    marginBottom: 10,
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
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 18,
  },
  forgotPasswordText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },
  loginButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  footerText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 12,
    marginTop: 22,
  },
});