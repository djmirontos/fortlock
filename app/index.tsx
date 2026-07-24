import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../hooks/useTheme';
import { verifyMasterPassword, hasMasterPassword } from '../services/cryptoService';
import { FontSize, Spacing, Radius } from '../constants/theme';

export default function LoginScreen() {
  const theme = useTheme();
  const { setAuthenticated, setBiometricAvailable, biometricAvailable } = useAuthStore();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const init = async () => {
      const hasPassword = await hasMasterPassword();
      if (!hasPassword) {
        router.replace('/setup');
        return;
      }
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);
      setChecking(false);
    };
    init();
  }, []);

  const handleUnlock = async () => {
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your master password');
      return;
    }
    setIsLoading(true);
    try {
      const isValid = await verifyMasterPassword(password);
      if (isValid) {
        setAuthenticated(true);
        router.replace('/dashboard');
      } else {
        Alert.alert('Incorrect Password', 'Please try again.');
        setPassword('');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock FortLock',
        fallbackLabel: 'Use Password',
      });
      if (result.success) {
        setAuthenticated(true);
        router.replace('/dashboard');
      }
    } catch {
      Alert.alert('Error', 'Biometric authentication failed.');
    }
  };

  if (checking) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Brand Section */}
      <View style={styles.brandSection}>
        <Image
          source={require('../assets/icon.png')}
          style={styles.logo}
        />
        <Text style={[styles.appName, { color: theme.textPrimary }]}>
          FortLock
        </Text>
        <Text style={[styles.tagline, { color: theme.textSecondary }]}>
          Your passwords. Fortified.
        </Text>
      </View>

      {/* Action Section */}
      <View style={styles.actionSection}>
        <View style={[
          styles.inputWrapper,
          { backgroundColor: theme.surface, borderColor: theme.stroke }
        ]}>
          <TextInput
            style={[styles.input, { color: theme.textPrimary }]}
            placeholder="Master Password"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleUnlock}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.unlockButton, { backgroundColor: theme.primary }]}
          onPress={handleUnlock}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.unlockText}>Unlock</Text>
          )}
        </TouchableOpacity>

        {biometricAvailable && (
          <TouchableOpacity
            style={styles.biometricButton}
            onPress={handleBiometric}
          >
            <Ionicons
              name="finger-print"
              size={48}
              color={theme.primary}
            />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: Spacing.md,
    borderRadius: Radius.md,
  },
  appName: {
    fontSize: FontSize.xxxl,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
  },
  tagline: {
    fontSize: FontSize.md,
  },
  actionSection: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.md,
  },
  inputWrapper: {
    width: '100%',
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: FontSize.lg,
  },
  unlockButton: {
    width: '100%',
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockText: {
    color: '#FFFFFF',
    fontSize: FontSize.lg,
    fontWeight: 'bold',
  },
  biometricButton: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
  },
});
