import { useState } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { setupMasterPassword } from '../services/cryptoService';
import { FontSize, Spacing, Radius } from '../constants/theme';

interface PasswordRule {
  label: string;
  test: (password: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: '8+ characters', test: (p) => p.length >= 8 },
  { label: 'Uppercase (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { label: 'Lowercase (a-z)', test: (p) => /[a-z]/.test(p) },
  { label: 'Number (0-9)', test: (p) => /[0-9]/.test(p) },
  { label: 'Symbol (!@#\$%)', test: (p) => /[!@#\$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
  { label: 'No spaces', test: (p) => p.length > 0 && !/\s/.test(p) },
];

export default function SetupScreen() {
  const theme = useTheme();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const ruleResults = PASSWORD_RULES.map((rule) => ({
    ...rule,
    passed: rule.test(password),
  }));

  const allRulesPassed = ruleResults.every((r) => r.passed);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = allRulesPassed && passwordsMatch && !isLoading;

  const handleSetup = async () => {
    if (!canSubmit) return;
    setIsLoading(true);
    try {
      await setupMasterPassword(password);
      router.replace('/dashboard');
    } catch {
      Alert.alert('Error', 'Failed to set up master password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Welcome to FortLock ??
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Create a strong master password to protect your credentials.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.formSection}>

          {/* Password Field */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Master Password
          </Text>
          <View style={[
            styles.inputWrapper,
            { backgroundColor: theme.surface, borderColor: theme.stroke }
          ]}>
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="Create a strong password"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
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

          {/* Password Rules — 2 Column Grid */}
          <View style={[styles.rulesContainer, { backgroundColor: theme.surface, borderColor: theme.stroke }]}>
            <View style={styles.rulesGrid}>
              {ruleResults.map((rule, index) => (
                <View key={index} style={styles.ruleItem}>
                  <Ionicons
                    name={rule.passed ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={rule.passed ? '#4CD964' : theme.textSecondary}
                  />
                  <Text style={[
                    styles.ruleLabel,
                    { color: rule.passed ? '#4CD964' : theme.textSecondary }
                  ]}>
                    {rule.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Confirm Password Field */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Confirm Password
          </Text>
          <View style={[
            styles.inputWrapper,
            {
              backgroundColor: theme.surface,
              borderColor: confirmPassword.length > 0
                ? passwordsMatch ? '#4CD964' : '#FF3B30'
                : theme.stroke,
            }
          ]}>
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="Re-enter your password"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry={!showConfirm}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
              <Ionicons
                name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Match Indicator */}
          {confirmPassword.length > 0 && (
            <View style={styles.matchRow}>
              <Ionicons
                name={passwordsMatch ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={passwordsMatch ? '#4CD964' : '#FF3B30'}
              />
              <Text style={[
                styles.matchText,
                { color: passwordsMatch ? '#4CD964' : '#FF3B30' }
              ]}>
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </Text>
            </View>
          )}

          {/* Warning */}
          <View style={[styles.warningBox, { backgroundColor: '#FFF3CD' }]}>
            <Ionicons name="warning-outline" size={16} color="#856404" />
            <Text style={[styles.warningText, { color: '#856404' }]}>
              No password recovery. If forgotten, all data will be lost.
            </Text>
          </View>

          {/* Setup Button */}
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: canSubmit ? theme.primary : theme.stroke }
            ]}
            onPress={handleSetup}
            disabled={!canSubmit}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[
                styles.buttonText,
                { color: canSubmit ? '#FFFFFF' : theme.textSecondary }
              ]}>
                Create Master Password
              </Text>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.xl,
  },
  headerSection: { marginBottom: Spacing.lg },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  formSection: { gap: Spacing.sm },
  label: {
    fontSize: FontSize.sm,
    marginBottom: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    height: 52,
    marginBottom: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: FontSize.lg,
  },
  rulesContainer: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  rulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '47%',
  },
  ruleLabel: {
    fontSize: FontSize.xs,
    flexShrink: 1,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.xs,
  },
  matchText: { fontSize: FontSize.sm },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  warningText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    flex: 1,
  },
  button: {
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  buttonText: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
  },
});
