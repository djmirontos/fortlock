import { useState, useCallback } from 'react';
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
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../stores/authStore';
import { getDecryptedTotpEntries, deleteTotpEntry } from '../services/totpService';
import { TotpEntryDecrypted } from '../types';
import { useAutoLock } from '../hooks/useAutoLock';

export default function Authenticator() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { masterKey } = useAuthStore();
  const isDark = theme.isDark;

  const [entries, setEntries] = useState<TotpEntryDecrypted[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useAutoLock();

  // Load entries on focus
  useFocusEffect(
    useCallback(() => {
      if (!masterKey) return;
      setIsLoading(true);
      getDecryptedTotpEntries(masterKey)
        .then((data) => {
          setEntries(data);
        })
        .catch(() => Alert.alert('Error', 'Failed to load authenticator entries.'))
        .finally(() => setIsLoading(false));
    }, [masterKey])
  );

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
          },
        },
      ]
    );
  };

  const renderEntry = useCallback(({ item }: { item: TotpEntryDecrypted }) => {
    return (
      <TouchableOpacity
        style={{
          marginHorizontal: 16,
          marginBottom: 10,
          borderRadius: 16,
          backgroundColor: theme.surface,
          paddingHorizontal: 16,
          paddingVertical: 14,
          elevation: 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/totp-detail', params: { id: item.id } })}
      >
        {/* Color avatar */}
        <View style={{
          width: 44, height: 44, borderRadius: 12,
          backgroundColor: item.color + '20',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: item.color }}>
            {item.issuer.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: theme.textPrimary }}>
            {item.issuer}
          </Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
            {item.account}
          </Text>
        </View>

        {/* Delete + chevron */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
          <Ionicons name="chevron-forward" size={16} color={theme.stroke} />
        </View>
      </TouchableOpacity>
    );
  }, [theme]);

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
          onPress={() => router.replace('/settings')}
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
