import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import FortLockLogo from '../assets/logo.svg';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../hooks/useTheme';
import { verifyAndGetMasterKey, hasMasterPassword } from '../services/cryptoService';
import { getDecryptedCredentials } from '../services/dbService';
import { FontSize, Spacing, Radius } from '../constants/theme';

export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { setAuthenticated, setBiometricAvailable, biometricAvailable, setMasterKey, setDecryptedCredentials } = useAuthStore();
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
      const masterKey = await verifyAndGetMasterKey(password);
      if (masterKey) {
        const decrypted = await getDecryptedCredentials(masterKey);
        setMasterKey(masterKey);
        setDecryptedCredentials(decrypted);
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
      const keyBase64 = await SecureStore.getItemAsync(
        'fortlock_biometric_key',
        { requireAuthentication: true, authenticationPrompt: 'Unlock FortLock' }
      );
      if (keyBase64) {
        const { Buffer: BufferClass } = require('buffer');
        const masterKey = BufferClass.from(keyBase64, 'base64');
        const decrypted = await getDecryptedCredentials(masterKey);
        setMasterKey(masterKey);
        setDecryptedCredentials(decrypted);
        setAuthenticated(true);
        router.replace('/dashboard');
      } else {
        Alert.alert('Error', 'Please use your master password to unlock.');
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
      style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Brand Section */}
      <View style={styles.brandSection}>
        <FortLockLogo width={80} height={80} />
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
            <ActivityIndicator color={theme.surface} />
          ) : (
            <Text style={[styles.unlockText, { color: theme.surface }]}>Unlock</Text>
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
    fontSize: FontSize.lg,
    fontWeight: 'bold',
  },
  biometricButton: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
  },
});
