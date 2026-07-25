import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import FortLockLogo from '../assets/logo.svg';
import { setupMasterPassword } from '../services/cryptoService';
import { useAuthStore } from '../stores/authStore';

interface PasswordRule {
  label: string;
  test: (password: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: '8+ characters', test: (p) => p.length >= 8 },
  { label: 'Uppercase (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { label: 'Lowercase (a-z)', test: (p) => /[a-z]/.test(p) },
  { label: 'Number (0-9)', test: (p) => /[0-9]/.test(p) },
  { label: 'Symbol (!@#$%)', test: (p) => /[!@#\$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
  { label: 'No spaces', test: (p) => p.length > 0 && !/\s/.test(p) },
];

const COLORS = {
  primary: '#4F6EF7',
  accent: '#3D5AFE',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  background: '#F8FAFC',
  card: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  weakText: '#EF4444',
  fairText: '#F59E0B',
  goodText: '#3B82F6',
  strongText: '#22C55E',
  lightAmber: '#FFFBEB',
  darkAmber: '#92400E',
  lightGray: '#F1F5F9',
  gray: '#94A3B8',
};

export default function SetupScreen() {
  const { setMasterKey, setDecryptedCredentials, setAuthenticated } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [understood, setUnderstood] = useState(false);

  const strengthBarWidth = useRef(new Animated.Value(0)).current;

  const ruleResults = PASSWORD_RULES.map((rule) => ({
    ...rule,
    passed: rule.test(password),
  }));

  const allRulesPassed = ruleResults.every((r) => r.passed);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = allRulesPassed && passwordsMatch && !isLoading;

  const passedCount = ruleResults.filter((r) => r.passed).length;

  const getStrengthInfo = () => {
    if (passedCount <= 1) return { label: 'Weak', color: COLORS.weakText, width: 20 };
    if (passedCount <= 3) return { label: 'Fair', color: COLORS.fairText, width: 50 };
    if (passedCount <= 5) return { label: 'Good', color: COLORS.goodText, width: 75 };
    return { label: 'Strong', color: COLORS.strongText, width: 100 };
  };

  const strength = getStrengthInfo();

  // Animate strength bar
  React.useEffect(() => {
    Animated.spring(strengthBarWidth, {
      toValue: strength.width,
      useNativeDriver: false,
      friction: 7,
      tension: 40,
    }).start();
  }, [passedCount, strengthBarWidth]);

  const handlePrimaryPress = () => {
    if (canSubmit) {
      setShowConfirmModal(true);
      setUnderstood(false);
    }
  };

  const handleSetup = async () => {
    if (!canSubmit || !understood) return;
    setShowConfirmModal(false);
    setIsLoading(true);
    try {
      const masterKey = await setupMasterPassword(password);
      await SecureStore.setItemAsync(
        'fortlock_biometric_key',
        masterKey.toString('base64')
      );
      setMasterKey(masterKey);
      setDecryptedCredentials([]);
      setAuthenticated(true);
      router.replace('/dashboard');
    } catch {
      Alert.alert('Error', 'Failed to set up master password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: COLORS.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.logoContainer}>
            <FortLockLogo width={80} height={80} />
          </View>
          <Text style={styles.title}>Welcome to FortLock</Text>
          <Text style={styles.subtitle}>
            Your master password encrypts everything in your vault.{'\n'}Only you can unlock your data.
          </Text>
        </View>

        {/* Password Input */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: COLORS.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: password ? COLORS.primary : COLORS.border,
            paddingHorizontal: 18,
            height: 56,
            marginBottom: 16,
          }}
        >
          <TextInput
            style={{ flex: 1, fontSize: 16, color: COLORS.textPrimary }}
            placeholder="Enter your master password"
            placeholderTextColor={COLORS.gray}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.gray} />
          </TouchableOpacity>
        </View>

        {/* Strength Card */}
        {password.length > 0 && (
          <View style={styles.strengthCard}>
            <View style={styles.strengthHeader}>
              <Text style={styles.strengthLabel}>Password Strength</Text>
              <Text style={[styles.strengthValue, { color: strength.color }]}>{strength.label}</Text>
            </View>

            <View style={styles.strengthBarContainer}>
              <View style={styles.strengthBarTrack}>
                <Animated.View
                  style={[
                    styles.strengthBarFill,
                    {
                      backgroundColor: strength.color,
                      width: strengthBarWidth.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.requirementsGrid}>
              {ruleResults.map((rule, index) => (
                <View key={index} style={styles.requirementRow}>
                  <Ionicons
                    name={rule.passed ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={rule.passed ? COLORS.success : COLORS.border}
                  />
                  <Text style={[styles.requirementText, { color: rule.passed ? COLORS.success : COLORS.gray }]}>
                    {rule.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Confirm Password Input */}
        {allRulesPassed && (
          <View style={styles.confirmSection}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: COLORS.card,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: !confirmPassword ? COLORS.border : passwordsMatch ? COLORS.success : COLORS.danger,
                paddingHorizontal: 18,
                height: 56,
                marginBottom: 16,
                marginTop: 24,
              }}
            >
              <TextInput
                style={{ flex: 1, fontSize: 16, color: COLORS.textPrimary }}
                placeholder="Confirm your password"
                placeholderTextColor={COLORS.gray}
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={{ padding: 4 }}>
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.gray} />
              </TouchableOpacity>
            </View>

            {confirmPassword.length > 0 && (
              <View style={styles.matchIndicator}>
                <Ionicons
                  name={passwordsMatch ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={passwordsMatch ? COLORS.success : COLORS.danger}
                />
                <Text style={[styles.matchText, { color: passwordsMatch ? COLORS.success : COLORS.danger }]}>
                  {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Warning Card */}
        <View style={styles.warningCard}>
          <Ionicons name="shield-outline" size={20} color={COLORS.warning} />
          <View style={styles.warningText}>
            <Text style={styles.warningTitle}>Your master password cannot be recovered.</Text>
            <Text style={styles.warningSubtitle}>If forgotten, your encrypted vault cannot be restored.</Text>
          </View>
        </View>

        {/* Primary Button */}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            {
              backgroundColor: canSubmit ? COLORS.primary : '#CBD5E1',
              shadowColor: canSubmit ? '#4F6EF7' : 'transparent',
              elevation: canSubmit ? 8 : 0,
              shadowOpacity: canSubmit ? 0.35 : 0,
            },
          ]}
          onPress={handlePrimaryPress}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color={canSubmit ? '#FFFFFF' : '#94A3B8'} size={20} />
          ) : (
            <Text style={[styles.buttonText, { color: canSubmit ? '#FFFFFF' : '#94A3B8' }]}>
              Create Secure Vault
            </Text>
          )}
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Ionicons name="lock-closed" size={12} color={COLORS.gray} />
          <Text style={styles.footerText}>Protected with AES-256 encryption</Text>
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal visible={showConfirmModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Ionicons name="warning" size={40} color={COLORS.warning} style={{ alignSelf: 'center', marginBottom: 16 }} />
            <Text style={styles.modalTitle}>Remember your master password</Text>
            <Text style={styles.modalBody}>
              This password encrypts your vault.{'\n'}FortLock cannot recover it if forgotten.
            </Text>

            <View style={styles.checkboxRow}>
              <TouchableOpacity
                style={[
                  styles.checkbox,
                  { backgroundColor: understood ? COLORS.primary : COLORS.card, borderColor: understood ? COLORS.primary : COLORS.border },
                ]}
                onPress={() => setUnderstood(!understood)}
              >
                {understood && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </TouchableOpacity>
              <Text style={styles.checkboxText}>I understand that my master password cannot be recovered.</Text>
            </View>

            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: COLORS.lightGray }]}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: COLORS.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: understood ? COLORS.primary : COLORS.border }]}
                onPress={handleSetup}
                disabled={!understood}
              >
                <Text style={[styles.modalButtonText, { color: understood ? '#FFFFFF' : COLORS.gray }]}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  strengthCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  strengthLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  strengthValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  strengthBarContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  strengthBarTrack: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  requirementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '48%',
  },
  requirementText: {
    fontSize: 13,
    flex: 1,
  },
  confirmSection: {
    position: 'relative',
  },
  matchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  matchText: {
    fontSize: 13,
    fontWeight: '500',
  },
  warningCard: {
    backgroundColor: COLORS.lightAmber,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  warningText: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.darkAmber,
    lineHeight: 20,
  },
  warningSubtitle: {
    fontSize: 13,
    color: COLORS.darkAmber,
    lineHeight: 20,
    marginTop: 2,
  },
  primaryButton: {
    marginTop: 32,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F6EF7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.gray,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 24,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
