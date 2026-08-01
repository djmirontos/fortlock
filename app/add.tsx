import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
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
import { addCredential, getDecryptedCredentials, updateCredentialTags } from "../services/dbService";
import { getTags } from "../services/tagService";
import { CredentialData, Tag } from "../types";

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

const getPasswordStrength = (pwd: string) => {
  if (pwd.length === 0) return null;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
  const mixed = hasUpper && hasLower && hasNumber && hasSymbol;
  if (pwd.length >= 12 && mixed) return { label: "Strong", color: "#34C759", width: "100%" };
  if (pwd.length >= 8) return { label: "Fair", color: "#FF9500", width: "66%" };
  return { label: "Weak", color: "#FF3B30", width: "33%" };
};

export default function AddCredential() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { masterKey, setDecryptedCredentials } = useAuthStore();

  const COLORS = {
    background: theme.background,
    card: theme.surface,
    accent: "#4F6EF7",
    textPrimary: theme.textPrimary,
    textSecondary: theme.textSecondary,
    border: theme.stroke,
    danger: "#FF3B30",
    success: "#34C759",
    divider: theme.background,
    placeholder: theme.textSecondary,
    disabledBg: theme.surfaceSecondary,
    disabledText: theme.textSecondary,
  };
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-20)).current;
  const buttonOpacity = useRef(new Animated.Value(1)).current;

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

  const isBanking = selectedTags.includes('tag_banking');

  useEffect(() => {
    getTags().then(setTags).catch(() => {});
  }, []);

  const isFormValid = () => {
    if (isBanking) {
      return bankName.trim() && cardHolder.trim() && cardNumber.trim() && expiryDate.trim() && cvv.trim();
    }
    return serviceName.trim() && username.trim() && password.trim();
  };

  const formValid = !!isFormValid();

  useEffect(() => {
    Animated.timing(buttonOpacity, {
      toValue: formValid ? 1 : 0.6,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [formValid, buttonOpacity]);

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
    setSelectedTags([]);
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
      const data: CredentialData = isBanking ? {
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

      // `category` is still persisted for backward compatibility; derive it
      // from the selected tags.
      const derivedCategory = selectedTags.includes('tag_banking') ? 'banking' :
        selectedTags.includes('tag_social') ? 'social' :
        selectedTags.includes('tag_email') ? 'email' : 'general';

      const newCredential = await addCredential(data, derivedCategory as any, masterKey);
      await updateCredentialTags(newCredential.id, selectedTags);
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

  const passwordStrength = getPasswordStrength(password);

  const labelStyle = {
    fontSize: 12,
    fontWeight: "600" as const,
    color: COLORS.textSecondary,
    marginBottom: 4,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
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

  if (!masterKey) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar
          barStyle={theme.isDark ? "light-content" : "dark-content"}
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
            <Text style={{ color: theme.surface, fontSize: 16, fontWeight: "700" }}>Go to Login</Text>
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
              Add Credential
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
              Securely store a new credential
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      {/* Content — a single FlatList is the only vertical scroll container.
          The horizontal tag ScrollView inside ListHeaderComponent is safe
          because it scrolls on the other axis. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <FlatList
          data={[]}
          renderItem={null}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListHeaderComponent={
            <View>
              {/* Tag chips row */}
              <View style={{ backgroundColor: theme.surface, paddingVertical: 12 }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 8, flexDirection: 'row' }}
                  keyboardShouldPersistTaps="handled"
                >
                  {tags.map((tag) => {
                    const isSelected = selectedTags.includes(tag.id);
                    return (
                      <TouchableOpacity
                        key={tag.id}
                        style={{
                          height: 34, paddingHorizontal: 14, borderRadius: 17,
                          flexDirection: 'row', alignItems: 'center', gap: 6,
                          backgroundColor: isSelected ? tag.color : theme.surfaceSecondary,
                        }}
                        onPress={() => {
                          setSelectedTags((prev) =>
                            prev.includes(tag.id)
                              ? prev.filter((id) => id !== tag.id)
                              : [...prev, tag.id]
                          );
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isSelected ? '#FFFFFF' : tag.color }} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? '#FFFFFF' : theme.textSecondary }}>
                          {tag.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Form card */}
              <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 20,
              overflow: "hidden",
              elevation: 1,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              marginBottom: 16,
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
                      placeholder="Enter password or generate"
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

                {/* Inline Generate Link */}
                <TouchableOpacity
                  onPress={handleGeneratePassword}
                  style={{ paddingVertical: 8, paddingHorizontal: 16, alignSelf: "flex-start" }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 12, color: COLORS.accent, fontWeight: "600" }}>
                    ✦ Generate
                  </Text>
                </TouchableOpacity>

                {/* Password Strength Bar */}
                {passwordStrength && (
                  <>
                    <View
                      style={{
                        height: 3,
                        borderRadius: 2,
                        marginHorizontal: 16,
                        marginBottom: 10,
                        width: passwordStrength.width as any,
                        backgroundColor: passwordStrength.color,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: passwordStrength.color,
                        paddingHorizontal: 16,
                        marginBottom: 8,
                      }}
                    >
                      {passwordStrength.label}
                    </Text>
                  </>
                )}
              </>
            )}
          </View>

          {/* Notes Card */}
          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 20,
              overflow: "hidden",
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
              </View>
            </View>
          }
        />
      </KeyboardAvoidingView>

      {/* Sticky Save Button */}
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
        <Animated.View style={{ opacity: buttonOpacity }}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!formValid || loading}
            activeOpacity={0.8}
            style={{
              height: 52,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: formValid && !loading ? COLORS.accent : COLORS.disabledBg,
            }}
          >
            {loading ? (
              <ActivityIndicator color={theme.surface} />
            ) : (
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: formValid ? theme.surface : COLORS.disabledText,
                }}
              >
                Save Credential
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Success Toast — kept exactly as is */}
      {showToast && (
        <Animated.View
          style={{
            position: "absolute",
            top: 60,
            left: 16,
            right: 16,
            backgroundColor: theme.surface,
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
            <Text style={{ fontSize: 14, fontWeight: "700", color: theme.textPrimary, marginBottom: 2 }}>
              Saved Successfully
            </Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>
              Credential has been added to your vault
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
