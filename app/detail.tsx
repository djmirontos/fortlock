import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Clipboard,
  StatusBar,
  Animated,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, Camera } from "expo-camera";
import { useTheme } from "../hooks/useTheme";
import { useAuthStore } from "../stores/authStore";
import { deleteCredential, getDecryptedCredentials } from "../services/dbService";
import { DecryptedCredential } from "../types";
import ServiceLogo from "../components/ServiceLogo";

const getCategoryPillColor = (category: string) => {
  switch (category) {
    case "banking":
      return { bg: "#EFF6FF", text: "#3B82F6" };
    case "social":
      return { bg: "#F0FDF4", text: "#16A34A" };
    case "email":
      return { bg: "#FFF7ED", text: "#EA580C" };
    case "general":
    default:
      return { bg: "#F5F3FF", text: "#7C3AED" };
  }
};

export default function DetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const COLORS = {
    background: theme.background,
    card: theme.surface,
    accent: "#4F6EF7",
    textPrimary: theme.textPrimary,
    textSecondary: theme.textSecondary,
    danger: "#FF3B30",
    divider: theme.background,
  };

  const { id } = useLocalSearchParams<{ id: string }>();
  const { decryptedCredentials, masterKey, setDecryptedCredentials } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showCardNumber, setShowCardNumber] = useState(false);
  const [showCVV, setShowCVV] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showWebBridge, setShowWebBridge] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [isSending, setIsSending] = useState(false);
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
    setTimeout(() => {
      Clipboard.setString("");
    }, 30000);
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

  const handleSendToDesktop = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
    setScanned(false);
    setIsSending(false);
    setShowWebBridge(true);
  };

  const handleQRScanned = async ({ data }: { data: string }) => {
    if (scanned || isSending) return;
    setScanned(true);
    setIsSending(true);

    try {
      // Validate it's a FortLock relay URL
      const ALLOWED_HOSTS = ['fortlock-web.vercel.app'];
      const url = new URL(data);
      if (
        url.protocol !== 'https:' ||
        !ALLOWED_HOSTS.includes(url.hostname) ||
        !url.pathname.startsWith('/api/relay/')
      ) {
        Alert.alert('Invalid QR Code', 'Please scan the QR code from fortlock-web.vercel.app', [
          { text: 'Try Again', onPress: () => setScanned(false) },
        ]);
        setIsSending(false);
        return;
      }

      // Determine what to send based on credential type
      const valueToSend = isBanking
        ? credential!.data.cardNumber || ''
        : credential!.data.password || '';

      const res = await fetch(data, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: valueToSend }),
      });

      if (res.ok) {
        setShowWebBridge(false);
        showSuccessToast('Password sent to desktop!');
      } else if (res.status === 404 || res.status === 410) {
        Alert.alert('Session Expired', 'The QR code has expired. Please generate a new one on the desktop.', [
          { text: 'OK', onPress: () => setShowWebBridge(false) },
        ]);
      } else {
        throw new Error('Failed to send');
      }
    } catch (error: any) {
      if (error?.message === 'Invalid URL') {
        Alert.alert('Invalid QR Code', 'Please scan the QR code from fortlock-web.vercel.app', [
          { text: 'Try Again', onPress: () => setScanned(false) },
        ]);
      } else {
        Alert.alert('Error', 'Failed to send password to desktop. Please try again.', [
          { text: 'Try Again', onPress: () => setScanned(false) },
        ]);
      }
      setIsSending(false);
    }
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

  if (!credential) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar
          barStyle={theme.isDark ? "light-content" : "dark-content"}
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
  const pillColor = getCategoryPillColor(credential.category);

  const formatCardNumber = (number: string): string => {
    return number.replace(/\s/g, "").match(/.{1,4}/g)?.join(" ") || number;
  };

  const maskCardNumber = (number: string): string => {
    const digits = number.replace(/\s/g, "");
    return "**** **** **** " + digits.slice(-4);
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: "600" as const,
    color: COLORS.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
    marginBottom: 4,
  };

  const valueStyle = {
    fontSize: 15,
    fontWeight: "500" as const,
    color: COLORS.textPrimary,
  };

  const fieldRowStyle = {
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 64,
    flexDirection: "row" as const,
    alignItems: "center" as const,
  };

  const dividerStyle = {
    height: 1,
    backgroundColor: COLORS.divider,
  };

  const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.card} translucent={false} />

      {/* Header — OUTSIDE ScrollView, direct child of container (golden rule) */}
      <View style={{ backgroundColor: COLORS.card, paddingTop: insets.top + 12 }}>
        <View style={{ height: 60, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 40, height: 40, justifyContent: "center", alignItems: "center" }}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.accent} />
          </TouchableOpacity>
          <Text
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 17,
              fontWeight: "700",
              color: COLORS.textPrimary,
            }}
          >
            {titleText}
          </Text>
          <TouchableOpacity
            onPress={handleEdit}
            style={{ width: 40, height: 40, justifyContent: "center", alignItems: "center" }}
          >
            <Ionicons name="create-outline" size={22} color={COLORS.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View
          style={{
            backgroundColor: COLORS.card,
            paddingVertical: 24,
            alignItems: "center",
          }}
        >
          <ServiceLogo serviceName={credential.data.serviceName} size={64} />
          <Text style={{ fontSize: 20, fontWeight: "700", color: COLORS.textPrimary, marginTop: 12 }}>
            {credential.data.serviceName}
          </Text>
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 12,
              backgroundColor: pillColor.bg,
              marginTop: 8,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: pillColor.text }}>
              {credential.category.charAt(0).toUpperCase() + credential.category.slice(1)}
            </Text>
          </View>
        </View>

        {/* Fields Section */}
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
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
            }}
          >
            {isBanking ? (
              <>
                {/* Card Holder */}
                <View style={fieldRowStyle}>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Card Holder</Text>
                    <Text style={valueStyle}>{credential.data.cardHolder || "—"}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleCopy(credential.data.cardHolder || "", "Card holder")}
                    hitSlop={hitSlop}
                  >
                    <Ionicons name="copy-outline" size={20} color={COLORS.accent} />
                  </TouchableOpacity>
                </View>
                <View style={dividerStyle} />

                {/* Card Number */}
                <View style={fieldRowStyle}>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Card Number</Text>
                    <Text style={valueStyle}>
                      {showCardNumber
                        ? formatCardNumber(credential.data.cardNumber!)
                        : maskCardNumber(credential.data.cardNumber!)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                    <TouchableOpacity
                      onPress={() => setShowCardNumber(!showCardNumber)}
                      hitSlop={hitSlop}
                    >
                      <Ionicons
                        name={showCardNumber ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleCopy(credential.data.cardNumber || "", "Card number")}
                      hitSlop={hitSlop}
                    >
                      <Ionicons name="copy-outline" size={20} color={COLORS.accent} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={dividerStyle} />

                {/* Expiry Date */}
                <View style={fieldRowStyle}>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Expiry Date</Text>
                    <Text style={valueStyle}>{credential.data.expiryDate || "—"}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleCopy(credential.data.expiryDate || "", "Expiry date")}
                    hitSlop={hitSlop}
                  >
                    <Ionicons name="copy-outline" size={20} color={COLORS.accent} />
                  </TouchableOpacity>
                </View>
                <View style={dividerStyle} />

                {/* CVV */}
                <View style={fieldRowStyle}>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>CVV</Text>
                    <Text style={valueStyle}>{showCVV ? credential.data.cvv : "•••"}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                    <TouchableOpacity onPress={() => setShowCVV(!showCVV)} hitSlop={hitSlop}>
                      <Ionicons
                        name={showCVV ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleCopy(credential.data.cvv || "", "CVV")}
                      hitSlop={hitSlop}
                    >
                      <Ionicons name="copy-outline" size={20} color={COLORS.accent} />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* Username / Email */}
                <View style={fieldRowStyle}>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Username / Email</Text>
                    <Text style={valueStyle}>{credential.data.username || "—"}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleCopy(credential.data.username || "", "Username")}
                    hitSlop={hitSlop}
                  >
                    <Ionicons name="copy-outline" size={20} color={COLORS.accent} />
                  </TouchableOpacity>
                </View>
                <View style={dividerStyle} />

                {/* Password */}
                <View style={fieldRowStyle}>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Password</Text>
                    <Text style={valueStyle}>
                      {showPassword ? credential.data.password : "••••••••"}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={hitSlop}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleCopy(credential.data.password || "", "Password")}
                      hitSlop={hitSlop}
                    >
                      <Ionicons name="copy-outline" size={20} color={COLORS.accent} />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Notes (if exists) */}
          {credential.data.notes && (
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
                marginTop: 12,
              }}
            >
              <View style={fieldRowStyle}>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>Notes</Text>
                  <Text style={valueStyle}>{credential.data.notes}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleCopy(credential.data.notes || "", "Notes")}
                  hitSlop={hitSlop}
                >
                  <Ionicons name="copy-outline" size={20} color={COLORS.accent} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={{ paddingHorizontal: 16, marginTop: 16, marginBottom: 32 }}>
          <TouchableOpacity
            style={{
              width: "100%",
              height: 52,
              borderRadius: 14,
              backgroundColor: COLORS.accent,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
            onPress={() => handleCopy(copyValue || "", copyButtonText)}
          >
            <Text style={{ color: theme.surface, fontSize: 15, fontWeight: "700" }}>
              {copyButtonText}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              width: "100%",
              height: 52,
              borderRadius: 14,
              backgroundColor: theme.surfaceSecondary,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
              flexDirection: "row",
              gap: 8,
            }}
            onPress={handleSendToDesktop}
          >
            <Ionicons name="desktop-outline" size={18} color={theme.textPrimary} />
            <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: "700" }}>
              Send to Desktop
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              width: "100%",
              height: 52,
              borderRadius: 14,
              backgroundColor: "#FEF2F2",
              borderWidth: 1,
              borderColor: "#FECACA",
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={handleDelete}
          >
            <Text style={{ color: COLORS.danger, fontSize: 15, fontWeight: "700" }}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
            borderLeftWidth: 4,
            borderLeftColor: "#4CD964",
            elevation: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            zIndex: 999,
            opacity: toastOpacity,
            transform: [{ translateY: toastTranslateY }],
          }}
        >
          <Ionicons name="checkmark-circle" size={24} color="#4CD964" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: theme.textPrimary, marginBottom: 2 }}>
              Copied!
            </Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>{toastMessage}</Text>
          </View>
        </Animated.View>
      )}

      {/* Web Bridge QR Scanner Modal */}
      <Modal visible={showWebBridge} animationType="slide" onRequestClose={() => setShowWebBridge(false)}>
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
          {/* Header */}
          <View style={{
            paddingTop: insets.top + 12,
            paddingBottom: 14,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#1C1C1E',
          }}>
            <TouchableOpacity
              onPress={() => setShowWebBridge(false)}
              style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' }}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFFFFF' }}>
                Send to Desktop
              </Text>
              <Text style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>
                Scan the QR code on fortlock-web.vercel.app
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Camera */}
          {hasPermission === false && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
              <Ionicons name="videocam-off-outline" size={64} color="#8E8E93" />
              <Text style={{ fontSize: 17, fontWeight: '600', color: '#FFFFFF', marginTop: 16, textAlign: 'center' }}>
                Camera Access Required
              </Text>
              <Text style={{ fontSize: 14, color: '#8E8E93', marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
                Please enable camera access in your device settings.
              </Text>
            </View>
          )}

          {hasPermission === true && (
            <View style={{ flex: 1, position: 'relative' }}>
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleQRScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
              {/* Overlay */}
              <View style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <View style={{
                  width: 240, height: 240, borderRadius: 20,
                  borderWidth: 2, borderColor: '#4F6EF7',
                }} />
                <Text style={{
                  color: '#FFFFFF', marginTop: 20, fontSize: 14,
                  textAlign: 'center', fontWeight: '500',
                  textShadowColor: 'rgba(0,0,0,0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 4,
                }}>
                  Point at the QR code on your desktop
                </Text>
              </View>

              {isSending && (
                <View style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>✓</Text>
                  <Text style={{ color: '#FFFFFF', marginTop: 8, fontSize: 15 }}>Sending to desktop...</Text>
                </View>
              )}
            </View>
          )}

          {hasPermission === null && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#8E8E93' }}>Requesting camera permission...</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
