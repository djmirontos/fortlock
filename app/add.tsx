import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "../hooks/useTheme";
import { useAuthStore } from "../stores/authStore";
import { addCredential, getDecryptedCredentials } from "../services/dbService";
import { CredentialData } from "../types";
import { LightTheme } from "../constants/theme";

const CATEGORIES = [
  { key: "general", label: "General" },
  { key: "banking", label: "Banking" },
  { key: "social", label: "Social" },
  { key: "email", label: "Email" },
];

const generatePassword = () => {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  const all = uppercase + lowercase + numbers + symbols;
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += all.charAt(Math.floor(Math.random() * all.length));
  }
  return password;
};

const formatCardNumber = (text: string): string => {
  const digits = text.replace(/\D/g, "");
  const groups = digits.match(/.{1,4}/g) || [];
  return groups.join(" ").substring(0, 19);
};

const formatExpiryDate = (text: string): string => {
  const digits = text.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  return digits.substring(0, 2) + "/" + digits.substring(2, 4);
};

export default function AddCredential() {
  const theme = useTheme();
  const { masterKey, setDecryptedCredentials } = useAuthStore();
  const [category, setCategory] = useState("general");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-20)).current;

  // Common fields
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");

  // Banking fields
  const [bankName, setBankName] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");

  // Other categories fields
  const [serviceName, setServiceName] = useState("");
  const [username, setUsername] = useState("");

  const isBanking = category === "banking";

  const isFormValid = () => {
    if (isBanking) {
      return bankName.trim() && cardHolder.trim() && cardNumber.trim() && expiryDate.trim() && cvv.trim();
    }
    return serviceName.trim() && username.trim() && password.trim();
  };

  const handleGeneratePassword = () => {
    setPassword(generatePassword());
  };

  const showSuccessToast = () => {
    setShowToast(true);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(toastTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
          tension: 40,
        }),
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(2200),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowToast(false);
      toastTranslateY.setValue(-20);
    });
  };

  const clearForm = () => {
    setCategory("general");
    setPassword("");
    setNotes("");
    setBankName("");
    setCardHolder("");
    setCardNumber("");
    setExpiryDate("");
    setCvv("");
    setServiceName("");
    setUsername("");
    setShowPassword(false);
  };

  const handleSave = async () => {
    if (!isFormValid()) return;

    if (!masterKey) {
      Alert.alert("Session Expired", "Please login again.");
      router.replace("/");
      return;
    }

    setLoading(true);
    try {
      const data: CredentialData = category === "banking" ? {
        serviceName: bankName,
        cardHolder: cardHolder.trim(),
        cardNumber: cardNumber.replace(/\s/g, ""),
        expiryDate,
        cvv,
        notes,
      } : {
        serviceName,
        username,
        password,
        notes,
      };

      await addCredential(data, category as any, masterKey);
      const updated = await getDecryptedCredentials(masterKey);
      setDecryptedCredentials(updated);
      showSuccessToast();
      clearForm();
    } catch (error) {
      console.error("Save error:", error);
      Alert.alert("Error", "Failed to save credential. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { flex: 1, backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={theme === LightTheme ? "dark-content" : "light-content"}
        backgroundColor={theme.surface}
        translucent={false}
      />

      {/* Header — OUTSIDE KeyboardAvoidingView, guaranteed full width */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          Add Credential
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content — INSIDE KeyboardAvoidingView + ScrollView */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Category Chips */}
          <View style={styles.chipsContainer}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setCategory(cat.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: category === cat.key ? theme.primary : theme.surfaceSecondary,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: category === cat.key ? "#FFFFFF" : theme.textSecondary,
                    },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isBanking ? (
            <>
              {/* Bank Name */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Bank Name
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.stroke,
                      color: theme.textPrimary,
                    },
                  ]}
                  placeholder="Enter bank name"
                  placeholderTextColor={theme.textSecondary}
                  value={bankName}
                  onChangeText={setBankName}
                />
              </View>

              {/* Card Holder Name */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Card Holder Name
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.stroke,
                      color: theme.textPrimary,
                    },
                  ]}
                  placeholder="e.g. JUAN DELA CRUZ"
                  placeholderTextColor={theme.textSecondary}
                  value={cardHolder}
                  onChangeText={setCardHolder}
                  autoCapitalize="characters"
                />
              </View>

              {/* Card Number */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Card Number
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.stroke,
                      color: theme.textPrimary,
                    },
                  ]}
                  placeholder="1234 5678 9012 3456"
                  placeholderTextColor={theme.textSecondary}
                  value={cardNumber}
                  onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                  keyboardType="numeric"
                  maxLength={19}
                />
              </View>

              {/* Expiry and CVV Row */}
              <View style={styles.rowContainer}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 12 }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Expiry
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.stroke,
                        color: theme.textPrimary,
                      },
                    ]}
                    placeholder="MM/YY"
                    placeholderTextColor={theme.textSecondary}
                    value={expiryDate}
                    onChangeText={(text) => setExpiryDate(formatExpiryDate(text))}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    CVV
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.stroke,
                        color: theme.textPrimary,
                      },
                    ]}
                    placeholder="123"
                    placeholderTextColor={theme.textSecondary}
                    value={cvv}
                    onChangeText={(text) => setCvv(text.replace(/\D/g, "").substring(0, 4))}
                    keyboardType="numeric"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              {/* Service Name */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Service Name
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.stroke,
                      color: theme.textPrimary,
                    },
                  ]}
                  placeholder="e.g. Gmail, Netflix, GitHub"
                  placeholderTextColor={theme.textSecondary}
                  value={serviceName}
                  onChangeText={setServiceName}
                />
              </View>

              {/* Username */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Username
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.stroke,
                      color: theme.textPrimary,
                    },
                  ]}
                  placeholder="Enter your username or email"
                  placeholderTextColor={theme.textSecondary}
                  value={username}
                  onChangeText={setUsername}
                />
              </View>

              {/* Password */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Password
                </Text>
                <View
                  style={[
                    styles.passwordInputContainer,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.stroke,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.passwordInput, { color: theme.textPrimary }]}
                    placeholder="Enter password or generate"
                    placeholderTextColor={theme.textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showPassword ? "eye-outline" : "eye-off-outline"}
                      size={20}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Generate Password Button */}
              <TouchableOpacity
                onPress={handleGeneratePassword}
                style={[styles.generateButton, { backgroundColor: theme.primary }]}
                activeOpacity={0.8}
              >
                <Ionicons name="key-outline" size={18} color="#FFFFFF" />
                <Text style={styles.generateButtonText}>Generate Strong Password</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Notes */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Notes (Optional)
            </Text>
            <TextInput
              style={[
                styles.notesInput,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.stroke,
                  color: theme.textPrimary,
                },
              ]}
              placeholder="Add any notes"
              placeholderTextColor={theme.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={!isFormValid() || loading}
            style={[
              styles.saveButton,
              {
                backgroundColor: isFormValid() && !loading ? theme.primary : theme.surfaceSecondary,
              },
            ]}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save Credential</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Toast */}
      {showToast && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={24} color="#4CD964" />
          <View style={{ flex: 1 }}>
            <Text style={styles.toastTitle}>Saved Successfully</Text>
            <Text style={styles.toastSubtitle}>Credential has been added to your vault</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    width: "100%",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  chipsContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 32,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: "center",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: "500",
  },
  passwordInputContainer: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  eyeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  rowContainer: {
    flexDirection: "row",
    gap: 0,
  },
  notesInput: {
    minHeight: 90,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "500",
    textAlignVertical: "top",
  },
  generateButton: {
    height: 44,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  generateButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  saveButton: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  toast: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#4CD964",
    zIndex: 999,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 2,
  },
  toastSubtitle: {
    fontSize: 12,
    color: "#8E8E93",
  },
});
