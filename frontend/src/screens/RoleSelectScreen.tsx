import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function RoleSelectScreen() {
  const navigation = useNavigation();

  const handleSelect = (role: string) => {
    console.log(`Logged in as: ${role}`);
    if (role === 'admin') {
      navigation.navigate('AdminDashboard' as never);
    } else {
      navigation.navigate('WorkerDashboard' as never);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.blurTop} />
      <View style={styles.blurBottom} />

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>B</Text>
          </View>
          <Text style={styles.title}>BEST VEHICLE</Text>
          <Text style={styles.subtitle}>Inventory Management System</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.adminButton}
            onPress={() => handleSelect('admin')}
            activeOpacity={0.9}
          >
            <View style={styles.buttonContent}>
              <View style={styles.adminIconContainer}>
                <Text style={styles.iconText}>🛡️</Text>
              </View>
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonTitle}>Enter as Admin</Text>
                <Text style={styles.buttonSubtitle}>
                  Full access · Approve sales · View reports
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.workerButton}
            onPress={() => handleSelect('worker')}
            activeOpacity={0.9}
          >
            <View style={styles.buttonContent}>
              <View style={styles.workerIconContainer}>
                <Text style={styles.iconText}>🔧</Text>
              </View>
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonTitle}>Enter as Worker</Text>
                <Text style={styles.buttonSubtitle}>
                  View inventory · Add stock · Request sales
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.demoText}>Demo Mode — No password required</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  blurTop: {
    position: 'absolute',
    top: -100,
    left: -50,
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  blurBottom: {
    position: 'absolute',
    bottom: -100,
    right: -50,
    width: width * 0.5,
    height: width * 0.5,
    borderRadius: width * 0.25,
    backgroundColor: 'rgba(239, 68, 68, 0.03)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: '#ef4444',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    letterSpacing: 1,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  adminButton: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: '#1e293b',
  },
  workerButton: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  adminIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 24,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  buttonSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  demoText: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 32,
  },
});