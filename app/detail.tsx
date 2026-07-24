import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Clipboard,
  StatusBar,
  Animated,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { useAuthStore } from "../stores/authStore";
import { deleteCredential, getDecryptedCredentials } from "../services/dbService";
import { LightTheme } from "../constants/theme";
import { DecryptedCredential } from "../types";
import ServiceLogo from "../components/ServiceLogo";

export default function DetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { decryptedCredentials, masterKey, setDecryptedCredentials } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showCardNumber, setShowCardNumber] = useState(false);
  const [showCVV, setShowCVV] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-20)).current;

  const credential = decryptedCredentials.find((c) => c.id === id) as DecryptedCredential | undefined;

  const showSuccessToast = (message: string) => {
    setToastMessage(message);
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
      Animated.delay(1700),
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

  const handleCopy = (text: string, label: string) => {
    Clipboard.setString(text);
    showSuccessToast(`${label} copied to clipboard`);
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Credential",
      "This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          onPress: async () => {
            try {
              await deleteCredential(credential!.id);
              if (masterKey) {
                const updated = await getDecryptedCredentials(masterKey);
                setDecryptedCredentials(updated);
              }
              router.back();
            } catch (error) {
              Alert.alert("Error", "Failed to delete credential");
            }
          },
          style: "destructive",
        },
      ]
    );
  };

  const handleEdit = () => {
    router.push({ pathname: "/edit", params: { id: credential!.id } });
  };

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
            Credential Detail
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: theme.textSecondary }}>Credential not found</Text>
        </View>
      </View>
    );
  }

  const isBanking = credential.category === "banking";
  const titleText = isBanking ? "Banking Detail" : "Credential Detail";
  const copyButtonText = isBanking ? "Copy Card Number" : "Copy Password";
  const copyValue = isBanking ? credential.data.cardNumber : credential.data.password;

  const formatCardNumber = (number: string): string => {
    return number.replace(/\s/g, "").match(/.{1,4}/g)?.join(" ") || number;
  };

  const maskCardNumber = (number: string): string => {
    const digits = number.replace(/\s/g, "");
    return "**** **** **** " + digits.slice(-4);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={theme === LightTheme ? "dark-content" : "light-content"}
        backgroundColor={theme.surface}
        translucent={false}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          {titleText}
        </Text>
        <TouchableOpacity onPress={handleEdit} style={styles.editButton}>
          <Ionicons name="create-outline" size={22} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Service Card */}
        <View style={[styles.serviceCard, { backgroundColor: theme.surface }]}>
          <ServiceLogo serviceName={credential.data.serviceName} size={72} />
          <Text style={[styles.serviceName, { color: theme.textPrimary }]}>
            {credential.data.serviceName}
          </Text>
        </View>

        {/* Detail Fields */}
        <View style={styles.fieldsContainer}>
          {isBanking ? (
            <>
              {/* Card Holder */}
              <View style={[styles.fieldCard, { backgroundColor: theme.surface }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    Card Holder
                  </Text>
                  <Text style={[styles.fieldValue, { color: theme.textPrimary }]}>
                    {credential.data.cardHolder || "—"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleCopy(credential.data.cardHolder || "", "Card holder")}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="copy-outline" size={20} color={theme.primary} />
                </TouchableOpacity>
              </View>

              {/* Card Number */}
              <View style={[styles.fieldCard, { backgroundColor: theme.surface }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    Card Number
                  </Text>
                  <Text style={[styles.fieldValue, { color: theme.textPrimary }]}>
                    {showCardNumber ? formatCardNumber(credential.data.cardNumber!) : maskCardNumber(credential.data.cardNumber!)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowCardNumber(!showCardNumber)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showCardNumber ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={theme.primary}
                    style={{ marginRight: 12 }}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleCopy(credential.data.cardNumber || "", "Card number")}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="copy-outline" size={20} color={theme.primary} />
                </TouchableOpacity>
              </View>

              {/* Expiry and CVV Row */}
              <View style={styles.rowContainer}>
                <View style={[styles.fieldCard, styles.halfCard, { backgroundColor: theme.surface }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                      Expiry Date
                    </Text>
                    <Text style={[styles.fieldValue, { color: theme.textPrimary }]}>
                      {credential.data.expiryDate || "—"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleCopy(credential.data.expiryDate || "", "Expiry date")}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="copy-outline" size={20} color={theme.primary} />
                  </TouchableOpacity>
                </View>

                <View style={[styles.fieldCard, styles.halfCard, { backgroundColor: theme.surface }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                      CVV
                    </Text>
                    <Text style={[styles.fieldValue, { color: theme.textPrimary }]}>
                      {showCVV ? credential.data.cvv : "•••"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowCVV(!showCVV)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={showCVV ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={theme.primary}
                      style={{ marginRight: 12 }}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleCopy(credential.data.cvv || "", "CVV")}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="copy-outline" size={20} color={theme.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            <>
              {/* Username */}
              <View style={[styles.fieldCard, { backgroundColor: theme.surface }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    Username
                  </Text>
                  <Text style={[styles.fieldValue, { color: theme.textPrimary }]}>
                    {credential.data.username || "—"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleCopy(credential.data.username || "", "Username")}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="copy-outline" size={20} color={theme.primary} />
                </TouchableOpacity>
              </View>

              {/* Password */}
              <View style={[styles.fieldCard, { backgroundColor: theme.surface }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    Password
                  </Text>
                  <Text style={[styles.fieldValue, { color: theme.textPrimary }]}>
                    {showPassword ? credential.data.password : "••••••••"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={theme.primary}
                    style={{ marginRight: 12 }}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleCopy(credential.data.password || "", "Password")}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="copy-outline" size={20} color={theme.primary} />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Notes (if exists) */}
          {credential.data.notes && (
            <View style={[styles.fieldCard, { backgroundColor: theme.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  Notes
                </Text>
                <Text style={[styles.fieldValue, { color: theme.textPrimary }]}>
                  {credential.data.notes}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleCopy(credential.data.notes || "", "Notes")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="copy-outline" size={20} color={theme.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.button, styles.copyButton, { backgroundColor: theme.primary }]}
            onPress={() => handleCopy(copyValue || "", copyButtonText)}
          >
            <Text style={styles.buttonText}>{copyButtonText}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.deleteButton, { backgroundColor: theme.danger }]}
            onPress={handleDelete}
          >
            <Text style={styles.buttonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.toastTitle}>Copied!</Text>
            <Text style={styles.toastSubtitle}>{toastMessage}</Text>
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
  editButton: {
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
    paddingBottom: 32,
  },
  serviceCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    height: 160,
    width: "100%",
  },
  serviceName: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
  },
  fieldsContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  fieldCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: "500",
  },
  rowContainer: {
    flexDirection: "row",
    gap: 12,
  },
  halfCard: {
    flex: 1,
  },
  buttonsContainer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 24,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  copyButton: {
    flex: 1,
  },
  deleteButton: {
    flex: 1,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
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
    borderLeftWidth: 4,
    borderLeftColor: "#4CD964",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
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
