import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../stores/authStore';
import { getDecryptedTotpEntries, deleteTotpEntry, generateTotpCode, getRemainingSeconds } from '../services/totpService';
import { TotpEntryDecrypted } from '../types';
import { useAutoLock } from '../hooks/useAutoLock';

export default function Authenticator() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { masterKey } = useAuthStore();
  const isDark = theme.background !== '#F2F2F7';

  const [entries, setEntries] = useState<TotpEntryDecrypted[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [remainingSeconds, setRemainingSeconds] = useState(getRemainingSeconds());
  const [codes, setCodes] = useState<Record<string, string>>({});

  useAutoLock();

  // Load entries on focus
  useFocusEffect(
    useCallback(() => {
      if (!masterKey) return;
      setIsLoading(true);
      getDecryptedTotpEntries(masterKey)
        .then((data) => {
          setEntries(data);
          // Generate initial codes
          const initialCodes: Record<string, string> = {};
          data.forEach((e) => {
            initialCodes[e.id] = generateTotpCode(e.secret);
          });
          setCodes(initialCodes);
        })
        .catch(() => Alert.alert('Error', 'Failed to load authenticator entries.'))
        .finally(() => setIsLoading(false));
    }, [masterKey])
  );

  // Tick every second — refresh codes when 30s window resets
  useEffect(() => {
    const interval = setInterval(() => {
      const secs = getRemainingSeconds();
      setRemainingSeconds(secs);

      // Regenerate codes at the start of each new 30s window
      if (secs === 30) {
        setCodes((prev) => {
          const updated = { ...prev };
          entries.forEach((e) => {
            updated[e.id] = generateTotpCode(e.secret);
          });
          return updated;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [entries]);

  const handleCopy = async (code: string, issuer: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied!', `${issuer} code copied to clipboard.`);
    setTimeout(() => Clipboard.setStringAsync(''), 30000);
  };

  const handleDelete = (entry: TotpEntryDecrypted) => {
    Alert.alert(
      'Remove Authenticator',
      `Remove ${entry.issuer} from FortLock? Make sure to disable 2FA on the service first or you may lose access.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteTotpEntry(entry.id);
            setEntries((prev) => prev.filter((e) => e.id !== entry.id));
            setCodes((prev) => {
              const updated = { ...prev };
              delete updated[entry.id];
              return updated;
            });
          },
        },
      ]
    );
  };

  const isWarning = remainingSeconds <= 5;
  const progressPercent = (remainingSeconds / 30) * 100;

  const renderEntry = ({ item }: { item: TotpEntryDecrypted }) => {
    const code = codes[item.id] || '------';
    const formatted = code.slice(0, 3) + ' ' + code.slice(3);

    return (
      <TouchableOpacity
        style={{
          marginHorizontal: 16,
          marginBottom: 10,
          borderRadius: 16,
          backgroundColor: theme.surface,
          padding: 16,
          elevation: 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
        }}
        activeOpacity={0.7}
        onPress={() => handleCopy(code, item.issuer)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Color dot + issuer */}
          <View style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: item.color + '20',
            alignItems: 'center', justifyContent: 'center',
            marginRight: 12,
          }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: item.color }}>
              {item.issuer.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary }}>
              {item.issuer}
            </Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 1 }}>
              {item.account}
            </Text>
          </View>

          {/* Delete button */}
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              width: 30, height: 30, borderRadius: 8,
              backgroundColor: theme.surfaceSecondary,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="trash-outline" size={15} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Code row */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          marginTop: 14, justifyContent: 'space-between',
        }}>
          <Text style={{
            fontSize: 34, fontWeight: '700', letterSpacing: 4,
            color: isWarning ? '#EF4444' : item.color,
            fontFamily: 'monospace',
          }}>
            {formatted}
          </Text>

          {/* Countdown ring */}
          <View style={{ alignItems: 'center', gap: 4 }}>
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              borderWidth: 3,
              borderColor: isWarning ? '#EF4444' : item.color,
              alignItems: 'center', justifyContent: 'center',
              opacity: 0.3 + (progressPercent / 100) * 0.7,
            }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: isWarning ? '#EF4444' : item.color }}>
                {remainingSeconds}
              </Text>
            </View>
            <Text style={{ fontSize: 10, color: theme.textSecondary }}>sec</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={{
          height: 3, backgroundColor: theme.surfaceSecondary,
          borderRadius: 2, marginTop: 10, overflow: 'hidden',
        }}>
          <View style={{
            height: '100%',
            width: `${progressPercent}%`,
            backgroundColor: isWarning ? '#EF4444' : item.color,
            borderRadius: 2,
          }} />
        </View>

        {/* Tap to copy hint */}
        <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 6, textAlign: 'center' }}>
          Tap to copy code
        </Text>
      </TouchableOpacity>
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

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.surface} translucent={false} />

      {/* Header */}
      <View style={{
        backgroundColor: theme.surface,
        paddingTop: insets.top + 12,
        paddingBottom: 14,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.textPrimary }}>
            Authenticator
          </Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 1 }}>
            {entries.length} account{entries.length !== 1 ? 's' : ''} protected
          </Text>
        </View>
        {/* Global countdown */}
        <View style={{
          backgroundColor: isWarning ? '#FEF2F2' : theme.surfaceSecondary,
          borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
          flexDirection: 'row', alignItems: 'center', gap: 4,
        }}>
          <Ionicons name="time-outline" size={14} color={isWarning ? '#EF4444' : theme.textSecondary} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: isWarning ? '#EF4444' : theme.textSecondary }}>
            {remainingSeconds}s
          </Text>
        </View>
      </View>

      {/* List */}
      {entries.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 24,
            backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <Ionicons name="key-outline" size={40} color="#4F6EF7" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.textPrimary, textAlign: 'center' }}>
            No Authenticators Yet
          </Text>
          <Text style={{ fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
            Add your first 2FA account by scanning a QR code or entering the secret key manually.
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderEntry}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Bottom Tab Bar */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: theme.surface,
        borderTopWidth: 0.5, borderTopColor: theme.stroke,
        paddingTop: 10, paddingBottom: insets.bottom + 8,
        height: 64 + insets.bottom,
        flexDirection: 'row', alignItems: 'center',
        elevation: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06, shadowRadius: 8,
      }}>
        {/* Vault */}
        <TouchableOpacity
          style={{ flex: 1, alignItems: 'center', gap: 3 }}
          onPress={() => router.replace('/dashboard')}
          activeOpacity={0.7}
        >
          <Ionicons name="shield-outline" size={24} color={theme.textSecondary} />
          <Text style={{ fontSize: 11, fontWeight: '500', color: theme.textSecondary }}>Vault</Text>
        </TouchableOpacity>

        {/* Auth (active) */}
        <TouchableOpacity
          style={{ flex: 1, alignItems: 'center', gap: 3 }}
          activeOpacity={0.7}
        >
          <Ionicons name="key" size={24} color="#4F6EF7" />
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#4F6EF7' }}>Auth</Text>
        </TouchableOpacity>

        {/* Settings */}
        <TouchableOpacity
          style={{ flex: 1, alignItems: 'center', gap: 3 }}
          onPress={() => router.push('/settings')}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={24} color={theme.textSecondary} />
          <Text style={{ fontSize: 11, fontWeight: '500', color: theme.textSecondary }}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* FAB — bottom right */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          bottom: insets.bottom + 64 + 16,
          right: 20,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: '#4F6EF7',
          alignItems: 'center', justifyContent: 'center',
          elevation: 8,
          shadowColor: '#4F6EF7',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          borderWidth: 3,
          borderColor: theme.surface,
        }}
        onPress={() => router.push('/add-totp')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}
