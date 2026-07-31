import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../stores/authStore';
import { getDecryptedTotpEntries, deleteTotpEntry, generateTotpCode, getRemainingSeconds } from '../services/totpService';
import { TotpEntryDecrypted } from '../types';

export default function TotpDetail() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { masterKey } = useAuthStore();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDark = theme.background !== '#F2F2F7';

  const [entry, setEntry] = useState<TotpEntryDecrypted | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [code, setCode] = useState('------');
  const [remainingSeconds, setRemainingSeconds] = useState(getRemainingSeconds());
  const [copied, setCopied] = useState(false);

  const isWarning = remainingSeconds <= 5;
  const progressPercent = (remainingSeconds / 30) * 100;
  const formatted = code.slice(0, 3) + ' ' + code.slice(3);

  // Load entry on focus
  useFocusEffect(
    useCallback(() => {
      if (!masterKey || !id) return;
      setIsLoading(true);
      getDecryptedTotpEntries(masterKey)
        .then((entries) => {
          const found = entries.find((e) => e.id === id);
          if (found) {
            setEntry(found);
            setCode(generateTotpCode(found.secret));
          }
        })
        .catch(() => Alert.alert('Error', 'Failed to load authenticator entry.'))
        .finally(() => setIsLoading(false));
    }, [masterKey, id])
  );

  // Countdown timer — starts/stops with screen focus
  useFocusEffect(
    useCallback(() => {
      if (!entry) return;
      const interval = setInterval(() => {
        setRemainingSeconds(getRemainingSeconds());
        setCode((prev) => {
          const fresh = generateTotpCode(entry.secret);
          if (fresh !== prev) setCopied(false);
          return fresh;
        });
      }, 1000);
      return () => clearInterval(interval);
    }, [entry])
  );

  const handleCopy = async () => {
    if (!entry) return;
    const rawCode = code.replace(/\s/g, '');
    await Clipboard.setStringAsync(rawCode);
    setCopied(true);
    setTimeout(() => {
      Clipboard.setStringAsync('');
      setCopied(false);
    }, 30000);
  };

  const handleDelete = () => {
    if (!entry) return;
    Alert.alert(
      'Remove Authenticator',
      `Remove ${entry.issuer} from FortLock? Make sure to disable 2FA on the service first or you may lose access to your account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteTotpEntry(entry.id);
            router.back();
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.surface} translucent={false} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#4F6EF7" />
        </View>
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.surface} translucent={false} />
        <View style={{ backgroundColor: theme.surface, paddingTop: insets.top + 12, paddingBottom: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' }}>
            <Ionicons name="chevron-back" size={24} color="#4F6EF7" />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: theme.textPrimary }}>Authenticator</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.textSecondary }}>Entry not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.surface} translucent={false} />

      {/* Header */}
      <View style={{ backgroundColor: theme.surface, paddingTop: insets.top + 12, paddingBottom: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' }}>
          <Ionicons name="chevron-back" size={24} color="#4F6EF7" />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: theme.textPrimary }}>
          Authenticator
        </Text>
        <TouchableOpacity
          onPress={handleDelete}
          style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      {/* Hero */}
      <View style={{ backgroundColor: theme.surface, paddingVertical: 24, alignItems: 'center', marginBottom: 8 }}>
        <View style={{
          width: 72, height: 72, borderRadius: 20,
          backgroundColor: entry.color + '20',
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 12,
        }}>
          <Text style={{ fontSize: 32, fontWeight: '700', color: entry.color }}>
            {entry.issuer.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: theme.textPrimary }}>
          {entry.issuer}
        </Text>
        <Text style={{ fontSize: 14, color: theme.textSecondary, marginTop: 4 }}>
          {entry.account}
        </Text>
      </View>

      {/* Code Card */}
      <View style={{
        marginHorizontal: 16,
        backgroundColor: theme.surface,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      }}>
        {/* Code */}
        <Text style={{
          fontSize: 48, fontWeight: '700', letterSpacing: 8,
          color: isWarning ? '#EF4444' : entry.color,
          fontFamily: 'monospace',
          marginBottom: 16,
        }}>
          {formatted}
        </Text>

        {/* Progress bar */}
        <View style={{
          width: '100%', height: 4, backgroundColor: theme.surfaceSecondary,
          borderRadius: 2, overflow: 'hidden', marginBottom: 8,
        }}>
          <View style={{
            height: '100%',
            width: `${progressPercent}%`,
            backgroundColor: isWarning ? '#EF4444' : entry.color,
            borderRadius: 2,
          }} />
        </View>

        {/* Timer label */}
        <Text style={{ fontSize: 13, color: isWarning ? '#EF4444' : theme.textSecondary, fontWeight: '600' }}>
          {isWarning ? `Expires in ${remainingSeconds}s` : `Refreshes in ${remainingSeconds}s`}
        </Text>
      </View>

      {/* Copy Button */}
      <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
        <TouchableOpacity
          style={{
            height: 52, borderRadius: 14,
            backgroundColor: copied ? '#22C55E' : '#4F6EF7',
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 8,
          }}
          onPress={handleCopy}
          activeOpacity={0.85}
        >
          <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={18} color="#FFFFFF" />
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
            {copied ? 'Copied!' : 'Copy Code'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
