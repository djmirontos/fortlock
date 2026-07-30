import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, Camera } from 'expo-camera';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../stores/authStore';
import { addTotpEntry, parseOtpAuthUri, getRandomColor } from '../services/totpService';

type AddMode = 'scan' | 'manual';

export default function AddTotp() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { masterKey } = useAuthStore();
  const isDark = theme.background !== '#F2F2F7';

  const [mode, setMode] = useState<AddMode>('scan');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Manual entry fields
  const [issuer, setIssuer] = useState('');
  const [account, setAccount] = useState('');
  const [secret, setSecret] = useState('');

  const isManualValid = issuer.trim().length > 0 && account.trim().length > 0 && secret.trim().length > 0;

  useEffect(() => {
    if (mode === 'scan') {
      Camera.requestCameraPermissionsAsync().then(({ status }) => {
        setHasCameraPermission(status === 'granted');
      });
    }
  }, [mode]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || !masterKey) return;
    setScanned(true);

    const parsed = parseOtpAuthUri(data);
    if (!parsed) {
      Alert.alert(
        'Invalid QR Code',
        'This QR code is not a valid authenticator code. Please scan a QR code from a website\'s 2FA setup page.',
        [{ text: 'Try Again', onPress: () => setScanned(false) }]
      );
      return;
    }

    setIsSaving(true);
    try {
      await addTotpEntry(parsed.issuer, parsed.account, parsed.secret, masterKey, getRandomColor());
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add authenticator.');
      setScanned(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSave = async () => {
    if (!isManualValid || !masterKey) return;
    setIsSaving(true);
    try {
      await addTotpEntry(issuer, account, secret, masterKey, getRandomColor());
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add authenticator.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.surface}
        translucent={false}
      />

      {/* Header */}
      <View
        style={{
          backgroundColor: theme.surface,
          paddingTop: insets.top + 12,
          paddingBottom: 14,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={24} color="#4F6EF7" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: theme.textPrimary }}>
            Add Authenticator
          </Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
            Scan a QR code or enter manually
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Mode Toggle */}
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: 20,
          marginTop: 16,
          marginBottom: 8,
          backgroundColor: theme.surfaceSecondary,
          borderRadius: 12,
          padding: 4,
        }}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            height: 36,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: mode === 'scan' ? theme.surface : 'transparent',
            elevation: mode === 'scan' ? 2 : 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: mode === 'scan' ? 0.08 : 0,
            shadowRadius: 4,
          }}
          onPress={() => { setMode('scan'); setScanned(false); }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: mode === 'scan' ? '#4F6EF7' : theme.textSecondary }}>
            Scan QR Code
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            flex: 1,
            height: 36,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: mode === 'manual' ? theme.surface : 'transparent',
            elevation: mode === 'manual' ? 2 : 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: mode === 'manual' ? 0.08 : 0,
            shadowRadius: 4,
          }}
          onPress={() => setMode('manual')}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: mode === 'manual' ? '#4F6EF7' : theme.textSecondary }}>
            Enter Manually
          </Text>
        </TouchableOpacity>
      </View>

      {/* Scan Mode */}
      {mode === 'scan' && (
        <View style={{ flex: 1 }}>
          {hasCameraPermission === null && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color="#4F6EF7" />
              <Text style={{ color: theme.textSecondary, marginTop: 12 }}>Requesting camera permission...</Text>
            </View>
          )}
          {hasCameraPermission === false && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
              <Ionicons name="videocam-off-outline" size={64} color={theme.textSecondary} />
              <Text style={{ fontSize: 17, fontWeight: '600', color: theme.textPrimary, marginTop: 16, textAlign: 'center' }}>
                Camera Access Required
              </Text>
              <Text style={{ fontSize: 14, color: theme.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
                Please enable camera access in your device settings to scan QR codes.
              </Text>
              <TouchableOpacity
                style={{ marginTop: 16 }}
                onPress={() => setMode('manual')}
              >
                <Text style={{ fontSize: 15, color: '#4F6EF7', fontWeight: '600' }}>Enter Manually Instead</Text>
              </TouchableOpacity>
            </View>
          )}
          {hasCameraPermission === true && (
            <View style={{ flex: 1, position: 'relative' }}>
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
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
                  backgroundColor: 'transparent',
                }} />
                <Text style={{
                  color: '#FFFFFF', marginTop: 20, fontSize: 14,
                  textAlign: 'center', fontWeight: '500',
                  textShadowColor: 'rgba(0,0,0,0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 4,
                }}>
                  Point camera at the QR code{'\n'}from your account's 2FA setup page
                </Text>
              </View>
              {isSaving && (
                <View style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', marginTop: 12, fontSize: 15 }}>Adding authenticator...</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Manual Mode */}
      {mode === 'manual' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Info Card */}
            <View style={{
              backgroundColor: '#EFF6FF',
              borderRadius: 14,
              padding: 14,
              flexDirection: 'row',
              gap: 10,
              marginBottom: 16,
            }}>
              <Ionicons name="information-circle-outline" size={20} color="#4F6EF7" />
              <Text style={{ flex: 1, fontSize: 13, color: '#1E40AF', lineHeight: 18 }}>
                Find the manual entry option on the website's 2FA setup page. Look for "Can't scan QR code?" or "Enter key manually".
              </Text>
            </View>

            {/* Form Card */}
            <View style={{
              backgroundColor: theme.surface,
              borderRadius: 20,
              overflow: 'hidden',
              elevation: 1,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
            }}>
              {/* Issuer */}
              <View style={{ paddingHorizontal: 16, paddingVertical: 14, minHeight: 64 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Service Name
                </Text>
                <TextInput
                  style={{ fontSize: 15, fontWeight: '500', color: theme.textPrimary, padding: 0 }}
                  placeholder="e.g. Google, GitHub, Facebook"
                  placeholderTextColor="#C7C7CC"
                  value={issuer}
                  onChangeText={setIssuer}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>

              <View style={{ height: 1, backgroundColor: theme.background, marginHorizontal: 0 }} />

              {/* Account */}
              <View style={{ paddingHorizontal: 16, paddingVertical: 14, minHeight: 64 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Account / Email
                </Text>
                <TextInput
                  style={{ fontSize: 15, fontWeight: '500', color: theme.textPrimary, padding: 0 }}
                  placeholder="e.g. user@gmail.com"
                  placeholderTextColor="#C7C7CC"
                  value={account}
                  onChangeText={setAccount}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
              </View>

              <View style={{ height: 1, backgroundColor: theme.background, marginHorizontal: 0 }} />

              {/* Secret Key */}
              <View style={{ paddingHorizontal: 16, paddingVertical: 14, minHeight: 64 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Secret Key
                </Text>
                <TextInput
                  style={{ fontSize: 15, fontWeight: '500', color: theme.textPrimary, padding: 0, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}
                  placeholder="e.g. JBSWY3DPEHPK3PXP"
                  placeholderTextColor="#C7C7CC"
                  value={secret}
                  onChangeText={setSecret}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
            </View>

            <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 8, marginHorizontal: 4, lineHeight: 18 }}>
              The secret key is provided by the service during 2FA setup. It is usually a long string of letters and numbers.
            </Text>
          </ScrollView>

          {/* Sticky Save Button */}
          <View style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            backgroundColor: theme.surface,
            paddingHorizontal: 16, paddingTop: 12,
            paddingBottom: insets.bottom + 12,
            borderTopWidth: 0.5, borderTopColor: theme.stroke,
          }}>
            <TouchableOpacity
              style={{
                height: 52, borderRadius: 14,
                backgroundColor: isManualValid ? '#4F6EF7' : theme.surfaceSecondary,
                alignItems: 'center', justifyContent: 'center',
              }}
              onPress={handleManualSave}
              disabled={!isManualValid || isSaving}
              activeOpacity={0.85}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '700', color: isManualValid ? '#FFFFFF' : theme.textSecondary }}>
                  Add Authenticator
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
