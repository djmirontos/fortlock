import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

const COLORS = {
  background: "#F2F2F7",
  card: "#FFFFFF",
  accent: "#4F6EF7",
  textPrimary: "#1C1C1E",
  textSecondary: "#8E8E93",
  border: "#E2E8F0",
  divider: "#F2F2F7",
  placeholder: "#C7C7CC",
  disabledBg: "#E5E5EA",
  disabledText: "#C7C7CC",
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

export default function EditCredential() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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

  const formValid = !!isFormValid();

  const labelStyle = {
    fontSize: 12,
    fontWeight: "600" as const,
    color: COLORS.textSecondary,
    marginBottom: 4,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
  };

  const inputStyle = {
    fontSize: 15,
    fontWeight: "500" as const,
    color: COLORS.textPrimary,
    padding: 0,
  };

  const fieldRowStyle = {
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 64,
  };

  const dividerStyle = {
    height: 1,
    backgroundColor: COLORS.divider,
  };

  if (!credential) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar
          barStyle={theme === LightTheme ? "dark-content" : "light-content"}
          backgroundColor={theme.surface}
          translucent={false}
        />
        <View
          style={{
            height: 60,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            width: "100%",
            backgroundColor: theme.surface,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 40, height: 40, justifyContent: "center", alignItems: "center" }}
          >
            <Ionicons name="chevron-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: "600", flex: 1, textAlign: "center", color: theme.textPrimary }}>
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
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar
          barStyle={theme === LightTheme ? "dark-content" : "light-content"}
          backgroundColor={theme.surface}
          translucent={false}
        />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 16 }}>
          <Ionicons name="lock-closed" size={48} color={theme.textSecondary} />
          <Text style={{ fontSize: 20, fontWeight: "700", color: theme.textPrimary }}>
            Session Expired
          </Text>
          <Text style={{ fontSize: 14, textAlign: "center", lineHeight: 20, color: theme.textSecondary }}>
            Please login again to continue
          </Text>
          <TouchableOpacity
            style={{ paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, marginTop: 8, backgroundColor: theme.primary }}
            onPress={() => router.replace("/")}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.card} translucent={false} />

      {/* Header — OUTSIDE KeyboardAvoidingView (golden rule) */}
      <View style={{ backgroundColor: COLORS.card, paddingTop: insets.top + 12 }}>
        <View style={{ height: 60, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 40, height: 40, justifyContent: "center", alignItems: "center" }}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.accent} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: COLORS.textPrimary }}>
              Edit Credential
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
              Update your credential details
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      {/* Category Chips — read-only, outside ScrollView */}
      <View style={{ backgroundColor: COLORS.card, paddingHorizontal: 20, paddingVertical: 12 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: "row", gap: 8 }}
        >
          {CATEGORIES.map((cat) => {
            const active = category === cat.key;
            return (
              <View
                key={cat.key}
                style={{
                  height: 34,
                  paddingHorizontal: 14,
                  borderRadius: 17,
                  justifyContent: "center",
                  backgroundColor: active ? COLORS.accent : COLORS.background,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: active ? "600" : "500",
                    color: active ? "#FFFFFF" : COLORS.textSecondary,
                  }}
                >
                  {cat.label}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
      <Text
        style={{
          fontSize: 11,
          color: COLORS.textSecondary,
          paddingHorizontal: 20,
          paddingTop: 4,
          marginBottom: 8,
          backgroundColor: COLORS.card,
        }}
      >
        Category cannot be changed after creation
      </Text>

      {/* Content — INSIDE KeyboardAvoidingView + ScrollView */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Form Card */}
          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 20,
              elevation: 1,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              marginBottom: 16,
              overflow: "hidden",
            }}
          >
            {isBanking ? (
              <>
                {/* Bank Name */}
                <View style={fieldRowStyle}>
                  <Text style={labelStyle}>Bank Name</Text>
                  <TextInput
                    style={inputStyle}
                    placeholder="Enter bank name"
                    placeholderTextColor={COLORS.placeholder}
                    value={bankName}
                    onChangeText={setBankName}
                  />
                </View>
                <View style={dividerStyle} />

                {/* Card Holder Name */}
                <View style={fieldRowStyle}>
                  <Text style={labelStyle}>Card Holder Name</Text>
                  <TextInput
                    style={inputStyle}
                    placeholder="e.g. JUAN DELA CRUZ"
                    placeholderTextColor={COLORS.placeholder}
                    value={cardHolder}
                    onChangeText={setCardHolder}
                    autoCapitalize="characters"
                  />
                </View>
                <View style={dividerStyle} />

                {/* Card Number */}
                <View style={fieldRowStyle}>
                  <Text style={labelStyle}>Card Number</Text>
                  <TextInput
                    style={inputStyle}
                    placeholder="1234 5678 9012 3456"
                    placeholderTextColor={COLORS.placeholder}
                    value={cardNumber}
                    onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                    keyboardType="numeric"
                    maxLength={19}
                  />
                </View>
                <View style={dividerStyle} />

                {/* Expiry Date */}
                <View style={fieldRowStyle}>
                  <Text style={labelStyle}>Expiry Date</Text>
                  <TextInput
                    style={inputStyle}
                    placeholder="MM/YY"
                    placeholderTextColor={COLORS.placeholder}
                    value={expiryDate}
                    onChangeText={(text) => setExpiryDate(formatExpiryDate(text))}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
                <View style={dividerStyle} />

                {/* CVV */}
                <View style={fieldRowStyle}>
                  <Text style={labelStyle}>CVV</Text>
                  <TextInput
                    style={inputStyle}
                    placeholder="123"
                    placeholderTextColor={COLORS.placeholder}
                    value={cvv}
                    onChangeText={(text) => setCvv(text.replace(/\D/g, "").substring(0, 4))}
                    keyboardType="numeric"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>
              </>
            ) : (
              <>
                {/* Website or App */}
                <View style={fieldRowStyle}>
                  <Text style={labelStyle}>Website or App</Text>
                  <TextInput
                    style={inputStyle}
                    placeholder="e.g. Gmail, Netflix, GitHub"
                    placeholderTextColor={COLORS.placeholder}
                    value={serviceName}
                    onChangeText={setServiceName}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <View style={dividerStyle} />

                {/* Username or Email */}
                <View style={fieldRowStyle}>
                  <Text style={labelStyle}>Username or Email</Text>
                  <TextInput
                    style={inputStyle}
                    placeholder="Enter your username or email"
                    placeholderTextColor={COLORS.placeholder}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                <View style={dividerStyle} />

                {/* Password */}
                <View style={fieldRowStyle}>
                  <Text style={labelStyle}>Password</Text>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <TextInput
                      style={[inputStyle, { flex: 1 }]}
                      placeholder="Enter password"
                      placeholderTextColor={COLORS.placeholder}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={{ width: 40, height: 40, justifyContent: "center", alignItems: "center" }}
                    >
                      <Ionicons
                        name={showPassword ? "eye-outline" : "eye-off-outline"}
                        size={20}
                        color={COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Notes Card */}
          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 20,
              elevation: 1,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text style={labelStyle}>
              Notes <Text style={{ fontWeight: "400", textTransform: "none" }}>(optional)</Text>
            </Text>
            <TextInput
              style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]}
              placeholder="Add any notes"
              placeholderTextColor={COLORS.placeholder}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky Update Button */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: COLORS.card,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
        }}
      >
        <TouchableOpacity
          onPress={handleUpdate}
          disabled={!formValid || updating}
          activeOpacity={0.8}
          style={{
            height: 52,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: formValid && !updating ? COLORS.accent : COLORS.disabledBg,
          }}
        >
          {updating ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: formValid ? "#FFFFFF" : COLORS.disabledText,
              }}
            >
              Update Credential
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Success Toast — kept exactly as is */}
      {showToast && (
        <Animated.View
          style={{
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
            opacity: toastOpacity,
            transform: [{ translateY: toastTranslateY }],
          }}
        >
          <Ionicons name="checkmark-circle" size={24} color="#4CD964" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#1C1C1E", marginBottom: 2 }}>
              Updated Successfully
            </Text>
            <Text style={{ fontSize: 12, color: "#8E8E93" }}>
              Your credential has been updated
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
