import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { useAuthStore } from "../stores/authStore";
import { updateCredential, getDecryptedCredentials } from "../services/dbService";
import { DecryptedCredential, CredentialData, CredentialCategory } from "../types";
import { LightTheme } from "../constants/theme";

const CATEGORIES = [
  { key: "general", label: "General" },
  { key: "banking", label: "Banking" },
  { key: "social", label: "Social" },
  { key: "email", label: "Email" },
];

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

export default function EditCredential() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { decryptedCredentials, masterKey, setDecryptedCredentials } = useAuthStore();
  const credential = decryptedCredentials.find((c) => c.id === id) as DecryptedCredential | undefined;
  const [updating, setUpdating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-20)).current;

  // Form state
  const [category, setCategory] = useState<CredentialCategory>("general");
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

  useEffect(() => {
    if (credential) {
      setCategory(credential.category);
      if (credential.category === "banking") {
        setBankName(credential.data.serviceName || "");
        setCardHolder(credential.data.cardHolder || "");
        setCardNumber(credential.data.cardNumber ? formatCardNumber(credential.data.cardNumber) : "");
        setExpiryDate(credential.data.expiryDate || "");
        setCvv(credential.data.cvv || "");
      } else {
        setServiceName(credential.data.serviceName || "");
        setUsername(credential.data.username || "");
        setPassword(credential.data.password || "");
      }
      setNotes(credential.data.notes || "");
    }
  }, [credential?.id]);

  const isFormValid = () => {
    if (isBanking) {
      return bankName.trim() && cardHolder.trim() && cardNumber.trim() && expiryDate.trim() && cvv.trim();
    }
    return serviceName.trim() && username.trim() && password.trim();
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

  const handleUpdate = async () => {
    if (!masterKey || !credential) {
      Alert.alert("Error", "Session expired. Please login again.");
      return;
    }
    if (!isFormValid()) return;

    setUpdating(true);
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

      await updateCredential(credential.id, data, masterKey);
      const updated = await getDecryptedCredentials(masterKey);
      setDecryptedCredentials(updated);
      showSuccessToast();
    } catch (error) {
      console.error("Update error:", error);
      Alert.alert("Error", "Failed to update credential.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar
          barStyle={theme === LightTheme ? "dark-content" : "light-content"}
          backgroundColor={theme.surface}
          translucent={false}
        />
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 200 }} />
      </View>
    );
  }

  if (!credential) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar
          barStyle={theme === LightTheme ? "dark-content" : "light-content"}
          backgroundColor={theme.surface}
          translucent={false}
        />
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            Edit Credential
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: theme.textSecondary }}>Credential not found</Text>
        </View>
      </View>
    );
  }

  if (!masterKey) {
    return (
      <View style={[styles.container, { flex: 1, backgroundColor: theme.background }]}>
        <StatusBar
          barStyle={theme === LightTheme ? "dark-content" : "light-content"}
          backgroundColor={theme.surface}
          translucent={false}
        />
        <View style={styles.sessionExpired}>
          <Ionicons name="lock-closed" size={48} color={theme.textSecondary} />
          <Text style={[styles.sessionText, { color: theme.textPrimary }]}>
            Session Expired
          </Text>
          <Text style={[styles.sessionSub, { color: theme.textSecondary }]}>
            Please login again to continue
          </Text>
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: theme.primary }]}
            onPress={() => router.replace("/")}
          >
            <Text style={styles.loginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
          Edit Credential
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
          keyboardShouldPersistTaps="handled"
        >
          {/* Category Chips — Read-only */}
          <View style={styles.chipsContainer}>
            {CATEGORIES.map((cat) => (
              <View
                key={cat.key}
                style={[
                  styles.chip,
                  {
                    backgroundColor: category === cat.key ? theme.primary : theme.surfaceSecondary,
                  },
                ]}
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
              </View>
            ))}
          </View>

          {/* Category locked note */}
          <Text style={[styles.categoryNote, { color: theme.textSecondary }]}>
            Category cannot be changed after creation
          </Text>

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
                    placeholder="Enter password"
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

          {/* Update Button */}
          <TouchableOpacity
            onPress={handleUpdate}
            disabled={!isFormValid() || updating}
            style={[
              styles.updateButton,
              {
                backgroundColor: isFormValid() && !updating ? theme.primary : theme.surfaceSecondary,
              },
            ]}
            activeOpacity={0.8}
          >
            {updating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.updateButtonText}>Update Credential</Text>
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
            <Text style={styles.toastTitle}>Updated Successfully</Text>
            <Text style={styles.toastSubtitle}>Your credential has been updated</Text>
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
    marginBottom: 12,
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
  categoryNote: {
    fontSize: 11,
    marginBottom: 24,
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
  updateButton: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  updateButtonText: {
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
  sessionExpired: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
  sessionText: {
    fontSize: 20,
    fontWeight: "700",
  },
  sessionSub: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  loginButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
