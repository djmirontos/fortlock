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
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../hooks/useTheme";
import { useAuthStore } from "../stores/authStore";
import { clearAllCredentials } from "../services/dbService";
import { clearAllSecureData } from "../services/cryptoService";
import * as LocalAuthentication from "expo-local-authentication";
import { LightTheme } from "../constants/theme";

export default function Settings() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { themeMode, setThemeMode, logout } = useAuthStore();
  const addButtonScale = useRef(new Animated.Value(1)).current;

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [autoLockTimer, setAutoLockTimer] = useState("1 min");

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

  const handleChangePassword = () => {
    Alert.alert("Change Master Password", "Feature coming soon - we're implementing secure password change!");
  };

  const handleExportBackup = () => {
    Alert.alert("Export Backup", "Export feature coming soon!");
  };

  const handleImportBackup = () => {
    Alert.alert("Import Backup", "Import feature coming soon!");
  };

  const handleAutoLockTimer = () => {
    const options = ["1 min", "5 min", "15 min", "30 min", "Never"];
    Alert.alert(
      "Auto-lock Timer",
      "Select how long before the app locks after inactivity",
      [
        ...options.map((option) => ({
          text: option,
          onPress: () => setAutoLockTimer(option),
        })),
        { text: "Cancel", onPress: () => {} },
      ]
    );
  };

  const handleDeleteAllData = () => {
    Alert.alert(
      "⚠️ Delete All Data",
      "This will permanently delete ALL credentials and reset the app. This cannot be undone.",
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Delete Everything",
          onPress: async () => {
            try {
              await clearAllCredentials();
              await clearAllSecureData();
              logout();
              router.replace("/");
            } catch (error) {
              Alert.alert("Error", "Failed to delete data");
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
            onPress={handleChangePassword}
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
            onPress={handleExportBackup}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="download-outline" size={20} color={theme.primary} />
              <Text style={[styles.rowText, { color: theme.textPrimary }]}>Export Backup</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>

          {/* Import Backup */}
          <TouchableOpacity
            style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.stroke }]}
            onPress={handleImportBackup}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="upload-outline" size={20} color={theme.primary} />
              <Text style={[styles.rowText, { color: theme.textPrimary }]}>Import Backup</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>

          {/* Auto-lock Timer */}
          <TouchableOpacity
            style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.stroke }]}
            onPress={handleAutoLockTimer}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="timer-outline" size={20} color={theme.primary} />
              <Text style={[styles.rowText, { color: theme.textPrimary }]}>Auto-lock Timer</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{autoLockTimer}</Text>
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
});
