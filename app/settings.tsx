import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  StatusBar,
  Animated,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../hooks/useTheme";
import { useAuthStore } from "../stores/authStore";
import { clearAllCredentials, getRawCredentials, getDecryptedCredentials } from "../services/dbService";
import { clearAllSecureData, changeMasterPassword } from "../services/cryptoService";
import { exportBackup, importBackup } from "../services/backupService";
import * as LocalAuthentication from "expo-local-authentication";
import { LightTheme } from "../constants/theme";

const PASSWORD_RULES = [
  { label: "8+ characters", test: (p: string) => p.length >= 8 },
  { label: "Uppercase (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase (a-z)", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number (0-9)", test: (p: string) => /[0-9]/.test(p) },
  { label: "Symbol (!@#$%)", test: (p: string) => /[!@#$%^&*]/.test(p) },
  { label: "No spaces", test: (p: string) => p.length > 0 && !/\s/.test(p) },
];

export default function Settings() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { themeMode, setThemeMode, autoLockTimer, setAutoLockTimer, masterKey, setMasterKey, setDecryptedCredentials, clearSecureMemory } = useAuthStore();
  const addButtonScale = useRef(new Animated.Value(1)).current;

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [changeProgress, setChangeProgress] = useState(0);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const timerOptions = [
    { label: "1 minute", value: 1 },
    { label: "5 minutes", value: 5 },
    { label: "15 minutes", value: 15 },
    { label: "30 minutes", value: 30 },
    { label: "Never", value: 0 },
  ];
  const currentTimerLabel = timerOptions.find((t) => t.value === autoLockTimer)?.label || "1 minute";

  useEffect(() => {
    const checkBiometric = async () => {
      try {
        const available = await LocalAuthentication.hasHardwareAsync();
        setBiometricAvailable(available);
      } catch (error) {
        console.log("Biometric check error:", error);
      }
    };
    checkBiometric();
  }, []);

  const toggleBiometric = async (value: boolean) => {
    setBiometricEnabled(value);
  };

  const ruleResults = PASSWORD_RULES.map((rule) => ({
    ...rule,
    passed: rule.test(newPassword),
  }));
  const allRulesPassed = ruleResults.every((r) => r.passed);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const canChange = currentPassword.length > 0 && allRulesPassed && passwordsMatch;

  const handleChangePassword = async () => {
    if (!canChange) return;
    setChangingPassword(true);
    try {
      const rawCredentials = await getRawCredentials();
      const result = await changeMasterPassword(
        currentPassword,
        newPassword,
        rawCredentials,
        (current, total) => setChangeProgress(Math.round((current / total) * 100))
      );
      if (!result.success) {
        Alert.alert("Error", "Current password is incorrect.");
        return;
      }
      if (result.newMasterKey) {
        setMasterKey(result.newMasterKey);
        const updated = await getDecryptedCredentials(result.newMasterKey);
        setDecryptedCredentials(updated);
      }
      Alert.alert("Success", "Master password updated successfully!");
      setShowChangePassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Change password error:", error);
      Alert.alert("Error", "Failed to change password.");
    } finally {
      setChangingPassword(false);
      setChangeProgress(0);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportBackup();
    } catch (error: any) {
      Alert.alert(
        "Export Failed",
        error.message || "Could not export backup. Please try again."
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const count = await importBackup();
      if (count === 0) {
        Alert.alert(
          "Nothing Imported",
          "No new credentials found in the backup file. All credentials may already exist."
        );
      } else {
        if (masterKey) {
          const updated = await getDecryptedCredentials(masterKey);
          setDecryptedCredentials(updated);
        }
        Alert.alert(
          "Import Successful! 🎉",
          `${count} credential${count !== 1 ? "s" : ""} imported successfully.`
        );
      }
    } catch (error: any) {
      Alert.alert(
        "Import Failed",
        error.message || "Could not read backup file. Make sure it's a valid FortLock backup."
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleAutoLockTimerAlert = () => {
    Alert.alert(
      "Auto-lock Timer",
      "Lock app after being inactive for:",
      [
        ...timerOptions.map((option) => ({
          text: option.label + (option.value === autoLockTimer ? " ✓" : ""),
          onPress: () => setAutoLockTimer(option.value),
        })),
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleDeleteAllData = () => {
    Alert.alert(
      "⚠️ Delete All Data",
      "This will permanently delete ALL credentials and reset FortLock. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything",
          onPress: async () => {
            try {
              await clearAllCredentials();
              await clearAllSecureData();
              clearSecureMemory();
              router.replace("/setup");
            } catch (error) {
              Alert.alert("Error", "Failed to delete data.");
            }
          },
          style: "destructive",
        },
      ]
    );
  };

  const handleAddPress = () => {
    Animated.sequence([
      Animated.spring(addButtonScale, { toValue: 0.88, useNativeDriver: true, friction: 3, tension: 400 }),
      Animated.spring(addButtonScale, { toValue: 1, useNativeDriver: true, friction: 3, tension: 400 }),
    ]).start();
    router.push("/add");
  };

  return (
    <View style={[styles.container, { flex: 1, backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={theme === LightTheme ? "dark-content" : "light-content"}
        backgroundColor={theme.surface}
        translucent={false}
      />

      {/* Header — OUTSIDE ScrollView, guaranteed full width */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Settings</Text>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Security Section */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Security</Text>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          {/* Change Master Password */}
          <TouchableOpacity
            style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.stroke }]}
            onPress={() => setShowChangePassword(true)}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="key-outline" size={20} color={theme.primary} />
              <Text style={[styles.rowText, { color: theme.textPrimary }]}>Change Master Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>

          {/* Biometric Unlock */}
          {biometricAvailable && (
            <View style={[styles.row]}>
              <View style={styles.rowLeft}>
                <Ionicons name="finger-print" size={20} color={theme.primary} />
                <Text style={[styles.rowText, { color: theme.textPrimary }]}>Biometric Unlock</Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={toggleBiometric}
                trackColor={{ false: theme.stroke, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          )}
        </View>

        {/* Appearance Section */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Appearance</Text>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={[styles.row]}>
            <View style={styles.rowLeft}>
              <Ionicons name="color-palette-outline" size={20} color={theme.primary} />
              <Text style={[styles.rowText, { color: theme.textPrimary }]}>Theme</Text>
            </View>
            <View style={styles.themeButtonsContainer}>
              {(["light", "system", "dark"] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  onPress={() => setThemeMode(mode)}
                  style={[
                    styles.themeButton,
                    {
                      backgroundColor: themeMode === mode ? theme.primary : theme.surfaceSecondary,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.themeButtonText,
                      {
                        color: themeMode === mode ? "#FFFFFF" : theme.textSecondary,
                      },
                    ]}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* General Section */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>General</Text>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          {/* Export Backup */}
          <TouchableOpacity
            style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.stroke }]}
            onPress={handleExport}
            disabled={isExporting || isImporting}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="cloud-download-outline" size={20} color={theme.primary} />
              <Text style={[styles.rowText, { color: theme.textPrimary }]}>Export Backup</Text>
            </View>
            {isExporting ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            )}
          </TouchableOpacity>

          {/* Import Backup */}
          <TouchableOpacity
            style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.stroke }]}
            onPress={handleImport}
            disabled={isExporting || isImporting}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="cloud-upload-outline" size={20} color={theme.primary} />
              <Text style={[styles.rowText, { color: theme.textPrimary }]}>Import Backup</Text>
            </View>
            {isImporting ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            )}
          </TouchableOpacity>

          {/* Backup Info */}
          <View style={[styles.infoBox, { backgroundColor: theme.background }]}>
            <Ionicons name="shield-checkmark-outline" size={16} color={theme.primary} />
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              Backup files are encrypted. Only FortLock with your master password can read them.
            </Text>
          </View>

          {/* Auto-lock Timer */}
          <TouchableOpacity
            style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.stroke }]}
            onPress={handleAutoLockTimerAlert}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="timer-outline" size={20} color={theme.primary} />
              <Text style={[styles.rowText, { color: theme.textPrimary }]}>Auto-lock Timer</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{currentTimerLabel}</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </View>
          </TouchableOpacity>

          {/* App Version */}
          <View style={[styles.row]}>
            <View style={styles.rowLeft}>
              <Ionicons name="information-circle-outline" size={20} color={theme.primary} />
              <Text style={[styles.rowText, { color: theme.textPrimary }]}>Version</Text>
            </View>
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>1.0.0</Text>
          </View>
        </View>

        {/* Danger Zone Section */}
        <Text style={[styles.sectionLabel, { color: theme.danger }]}>Danger Zone</Text>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <TouchableOpacity
            style={[styles.row]}
            onPress={handleDeleteAllData}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="trash-outline" size={20} color={theme.danger} />
              <Text style={[styles.rowText, { color: theme.danger }]}>Delete All Data</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.danger} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Tab Bar */}
      <View style={[styles.tabBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12, backgroundColor: theme.tabBar, borderTopColor: theme.surfaceSecondary }]}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.replace("/dashboard")}
          activeOpacity={0.7}
        >
          <Ionicons name="home-outline" size={26} color={theme.textSecondary} />
          <Text style={[styles.tabLabel, { color: theme.textSecondary }]}>Home</Text>
        </TouchableOpacity>

        <View style={styles.addButtonWrapper}>
          <Animated.View style={{ transform: [{ scale: addButtonScale }] }}>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.primary, borderColor: theme.background, shadowColor: theme.primary }]}
              onPress={handleAddPress}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={32} color={theme.textPrimary} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        <TouchableOpacity
          style={styles.tabItem}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-sharp" size={26} color={theme.primary} />
          <Text style={[styles.tabLabel, { color: theme.primary }]}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Change Master Password Modal */}
      <Modal
        visible={showChangePassword}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChangePassword(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={[styles.dragHandle, { backgroundColor: theme.stroke }]} />

            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                Change Master Password
              </Text>
              <TouchableOpacity onPress={() => setShowChangePassword(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Current Password */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Current Password
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.background, borderColor: theme.stroke }]}>
                <TextInput
                  style={[styles.input, { color: theme.textPrimary }]}
                  placeholder="Enter current password"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showCurrentPw}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowCurrentPw(!showCurrentPw)}>
                  <Ionicons
                    name={showCurrentPw ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {/* New Password */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                New Password
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.background, borderColor: theme.stroke }]}>
                <TextInput
                  style={[styles.input, { color: theme.textPrimary }]}
                  placeholder="Enter new password"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showNewPw}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowNewPw(!showNewPw)}>
                  <Ionicons
                    name={showNewPw ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {/* Rules checklist */}
              <View style={[styles.rulesContainer, { backgroundColor: theme.background, borderColor: theme.stroke }]}>
                <View style={styles.rulesGrid}>
                  {ruleResults.map((rule, index) => (
                    <View key={index} style={styles.ruleItem}>
                      <Ionicons
                        name={rule.passed ? "checkmark-circle" : "ellipse-outline"}
                        size={14}
                        color={rule.passed ? "#4CD964" : theme.textSecondary}
                      />
                      <Text style={[styles.ruleText, { color: rule.passed ? "#4CD964" : theme.textSecondary }]}>
                        {rule.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Confirm Password */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Confirm New Password
              </Text>
              <View style={[styles.inputWrapper, {
                backgroundColor: theme.background,
                borderColor: confirmPassword.length > 0 ? (passwordsMatch ? "#4CD964" : theme.danger) : theme.stroke
              }]}>
                <TextInput
                  style={[styles.input, { color: theme.textPrimary }]}
                  placeholder="Re-enter new password"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={true}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Match indicator */}
              {confirmPassword.length > 0 && (
                <View style={styles.matchRow}>
                  <Ionicons
                    name={passwordsMatch ? "checkmark-circle" : "close-circle"}
                    size={14}
                    color={passwordsMatch ? "#4CD964" : theme.danger}
                  />
                  <Text style={[styles.matchText, { color: passwordsMatch ? "#4CD964" : theme.danger }]}>
                    {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                  </Text>
                </View>
              )}

              {/* Progress bar */}
              {changingPassword && (
                <View style={styles.progressContainer}>
                  <Text style={[styles.progressText, { color: theme.textSecondary }]}>
                    Re-encrypting credentials... {changeProgress}%
                  </Text>
                  <View style={[styles.progressBar, { backgroundColor: theme.stroke }]}>
                    <View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${changeProgress}%` }]} />
                  </View>
                </View>
              )}

              {/* Update button */}
              <TouchableOpacity
                style={[styles.updateButton, { backgroundColor: canChange ? theme.primary : theme.stroke }]}
                onPress={handleChangePassword}
                disabled={!canChange || changingPassword}
              >
                {changingPassword ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.updateButtonText, { color: canChange ? "#FFFFFF" : theme.textSecondary }]}>
                    Update Password
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    width: "100%",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 16,
    letterSpacing: 0.5,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  row: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  rowText: {
    fontSize: 15,
    fontWeight: "500",
  },
  themeButtonsContainer: {
    flexDirection: "row",
    gap: 6,
  },
  themeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  themeButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 0.5,
    paddingTop: 10,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minHeight: 48,
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  addButtonWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -30,
  },
  addButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    elevation: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    borderWidth: 3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: "85%",
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  fieldLabel: {
    fontSize: 13,
    marginBottom: 6,
    marginTop: 12,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 4,
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  rulesContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginVertical: 8,
  },
  rulesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  ruleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    width: "47%",
  },
  ruleText: {
    fontSize: 11,
  },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  matchText: {
    fontSize: 12,
  },
  progressContainer: {
    marginVertical: 12,
  },
  progressText: {
    fontSize: 12,
    marginBottom: 6,
    textAlign: "center",
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  updateButton: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
