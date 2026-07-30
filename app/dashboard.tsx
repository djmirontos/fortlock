import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Alert,
  Animated,
  Platform,
  UIManager,
  Modal,
  Easing,
  Image,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../hooks/useTheme';
import { getDecryptedCredentials, toggleFavorite, deleteCredential } from '../services/dbService';
import { DecryptedCredential } from '../types';
import ServiceLogo from '../components/ServiceLogo';
import { useAutoLock } from '../hooks/useAutoLock';
import * as Clipboard from 'expo-clipboard';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Brand colors that stay consistent across themes
const BRAND_colors = {
  primary: '#4F6EF7',
  success: '#22C55E',
  danger: '#EF4444',
  warning: '#F59E0B',
  bankingBg: '#EFF6FF',
  bankingText: '#3B82F6',
  socialBg: '#F0FDF4',
  socialText: '#16A34A',
  emailBg: '#FFF7ED',
  emailText: '#EA580C',
  generalBg: '#F5F3FF',
  generalText: '#7C3AED',
};

const CATEGORIES = [
  { key: 'all', label: 'All', icon: 'apps' },
  { key: 'banking', label: 'Banking', icon: 'card-outline' },
  { key: 'social', label: 'Social', icon: 'people-outline' },
  { key: 'email', label: 'Email', icon: 'mail-outline' },
  { key: 'general', label: 'General', icon: 'grid-outline' },
];

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { themeMode } = useAuthStore();
  const theme = useTheme();
  const { masterKey, setDecryptedCredentials, logout } = useAuthStore();
  const [credentials, setCredentials] = useState<DecryptedCredential[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [selectedCredential, setSelectedCredential] = useState<DecryptedCredential | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);

  // Theme-aware colors
  const isDark = themeMode === 'dark' || (themeMode === 'system' && colorScheme === 'dark');

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'banking':
        return { bg: BRAND_colors.bankingBg, text: BRAND_colors.bankingText };
      case 'social':
        return { bg: BRAND_colors.socialBg, text: BRAND_colors.socialText };
      case 'email':
        return { bg: BRAND_colors.emailBg, text: BRAND_colors.emailText };
      case 'general':
      default:
        return { bg: BRAND_colors.generalBg, text: BRAND_colors.generalText };
    }
  };

  const getCategoryAccentColor = (category: string): string => {
    switch (category) {
      case 'banking':
        return '#3B82F6';
      case 'social':
        return '#16A34A';
      case 'email':
        return '#EA580C';
      case 'general':
        return '#7C3AED';
      default:
        return '#4F6EF7';
    }
  };

  const modalAnimation = useRef(new Animated.Value(0)).current;
  const addButtonScale = useRef(new Animated.Value(1)).current;

  useAutoLock();

  const closeModal = () => {
    Animated.timing(modalAnimation, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start(() => {
      setShowModal(false);
      setSelectedCredential(null);
    });
  };

  useEffect(() => {
    if (showModal) {
      Animated.spring(modalAnimation, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 100,
      }).start();
    }
  }, [showModal, modalAnimation]);

  useFocusEffect(
    useCallback(() => {
      if (masterKey) {
        setIsLoading(true);
        getDecryptedCredentials(masterKey)
          .then((creds) => {
            setDecryptedCredentials(creds);
            setCredentials(creds);
          })
          .catch((err) => {
            console.error('Failed to load credentials:', err);
            Alert.alert('Error', 'Failed to load credentials. Please try logging in again.');
          })
          .finally(() => setIsLoading(false));
      }
    }, [masterKey])
  );

  const filtered = useMemo(() => {
    let result = [...credentials];
    if (activeCategory !== 'all') {
      result = result.filter((c) => c.category === activeCategory);
    }
    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.data.serviceName?.toLowerCase().includes(lower) ||
          c.data.username?.toLowerCase().includes(lower)
      );
    }
    if (sortBy === 'alphabetical') {
      result.sort((a, b) =>
        (a.data.serviceName || '').localeCompare(b.data.serviceName || '')
      );
    } else {
      result.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return result;
  }, [credentials, activeCategory, search, sortBy]);

  const favorites = credentials.filter((c) => c.isFavorite === true);

  const handleCopy = (text: string, label: string) => {
    Clipboard.setStringAsync(text);
    Alert.alert('Copied!', label + ' copied to clipboard.');
    setTimeout(() => {
      Clipboard.setStringAsync('');
    }, 30000);
  };

  const handleAddPress = () => {
    Animated.sequence([
      Animated.spring(addButtonScale, { toValue: 0.88, useNativeDriver: true, friction: 3, tension: 400 }),
      Animated.spring(addButtonScale, { toValue: 1, useNativeDriver: true, friction: 3, tension: 400 }),
    ]).start();
    router.push('/add');
  };

  const renderChip = useCallback(({ item }) => {
    const isActive = activeCategory === item.key;
    return (
      <TouchableOpacity
        style={{
          height: 32,
          paddingHorizontal: 12,
          borderRadius: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: isActive ? '#4F6EF7' : theme.surfaceSecondary,
        }}
        onPress={() => setActiveCategory(item.key)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={item.icon}
          size={13}
          color={isActive ? '#FFFFFF' : theme.textSecondary}
        />
        <Text
          style={{
            fontSize: 12,
            fontWeight: '600',
            color: isActive ? '#FFFFFF' : theme.textSecondary,
          }}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  }, [activeCategory, theme]);

  const renderCard = useCallback(({ item }: { item: DecryptedCredential }) => {
    const displayValue =
      item.category === 'banking'
        ? item.data.cardNumber
          ? '**** ' + item.data.cardNumber.slice(-4)
          : ''
        : item.data.username || '';
    const categoryColor = getCategoryColor(item.category);

    return (
      <TouchableOpacity
        style={{
          marginHorizontal: 20,
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: theme.surface,
          elevation: 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          marginBottom: 0.5,
        }}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/detail', params: { id: item.id } })}
      >
        <ServiceLogo serviceName={item.data.serviceName} size={44} />

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: theme.textPrimary, flex: 1 }} numberOfLines={1}>
              {item.data.serviceName}
            </Text>
            <Text style={{ fontSize: 11, color: theme.textSecondary }}>
              {getTimeAgo(item.createdAt)}
            </Text>
          </View>

          <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 3 }} numberOfLines={1}>
            {displayValue}
          </Text>

          <View style={{ marginTop: 6 }}>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: categoryColor.bg,
                alignSelf: 'flex-start',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: categoryColor.text }}>
                {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            backgroundColor: theme.surfaceSecondary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPress={() => {
            setSelectedCredential(item);
            setShowModal(true);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-horizontal" size={14} color={theme.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [theme]);

  const renderListHeader = () => (
    <>
      {/* Category Chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 10, gap: 8 }}
        renderItem={renderChip}
      />

      {/* Favorites Section */}
      {favorites.length > 0 && (
        <View>
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 10,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '600', color: theme.textPrimary }}>
              Favorites
            </Text>
            {favorites.length > 3 && (
              <TouchableOpacity onPress={() => setShowFavoritesModal(true)}>
                <Text style={{ fontSize: 14, color: '#4F6EF7' }}>View all</Text>
              </TouchableOpacity>
            )}
          </View>
          {favorites.slice(0, 3).map((item) => (
            <TouchableOpacity
              key={item.id}
              style={{
                marginHorizontal: 20,
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                backgroundColor: theme.surface,
                borderLeftWidth: 3,
                borderLeftColor: getCategoryAccentColor(item.category),
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                elevation: 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
                marginBottom: 0,
              }}
              onPress={() => router.push({ pathname: '/detail', params: { id: item.id } })}
            >
              <ServiceLogo serviceName={item.data.serviceName} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.textPrimary }}>
                  {item.data.serviceName}
                </Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>
                  {item.data.username || item.data.cardHolder || ''}
                </Text>
              </View>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Ionicons name="chevron-forward" size={14} color={theme.stroke} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* All Credentials Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 10,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: '600', color: theme.textPrimary }}>
          All Credentials
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: theme.surfaceSecondary,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}
          onPress={() =>
            Alert.alert(
              'Sort',
              'Choose sort order',
              [
                {
                  text: 'Recent',
                  onPress: () => setSortBy('recent'),
                },
                {
                  text: 'A-Z',
                  onPress: () => setSortBy('alphabetical'),
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            )
          }
        >
          <Text style={{ fontSize: 13, color: theme.textSecondary }}>
            {sortBy === 'alphabetical' ? 'A-Z' : 'Recent'}
          </Text>
          <Ionicons name="chevron-down" size={12} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </>
  );

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
      <View
        style={{
          backgroundColor: theme.surface,
          paddingTop: insets.top + 12,
          paddingBottom: 14,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Image
          source={require('../assets/logo.png')}
          style={{ width: 44, height: 44, borderRadius: 12 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.textPrimary }}>
            FortLock
          </Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 1 }}>
            Your secure password vault
          </Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 1 }}>
            {credentials.length} items secured
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            logout();
            router.replace('/');
          }}
        >
          <Ionicons name="lock-closed-outline" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: theme.surface }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            height: 48,
            paddingHorizontal: 14,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: isSearchFocused ? '#4F6FFF' : theme.stroke,
            backgroundColor: theme.surface,
            elevation: 2,
            shadowColor: isSearchFocused ? '#4F6FFF' : '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isSearchFocused ? 0.12 : 0.06,
            shadowRadius: isSearchFocused ? 8 : 4,
          }}
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={isSearchFocused ? '#4F6FFF' : theme.textSecondary}
          />
          <TextInput
            style={{ flex: 1, fontSize: 15, color: theme.textPrimary }}
            placeholder="Search your vault..."
            placeholderTextColor={theme.textSecondary}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Credentials List */}
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        ListHeaderComponent={renderListHeader}
        contentContainerStyle={{ paddingBottom: 90 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={8}
      />

      {/* Tab Bar */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: theme.surface,
          borderTopWidth: 0.5,
          borderTopColor: theme.stroke,
          paddingTop: 10,
          paddingBottom: insets.bottom + 8,
          height: 64 + insets.bottom,
          flexDirection: 'row',
          alignItems: 'center',
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        }}
      >
        {/* Vault Tab — active */}
        <TouchableOpacity
          style={{ flex: 1, alignItems: 'center', gap: 3 }}
          activeOpacity={0.7}
        >
          <Ionicons name="shield-checkmark" size={24} color="#4F6EF7" />
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#4F6EF7' }}>Vault</Text>
        </TouchableOpacity>

        {/* Auth Tab */}
        <TouchableOpacity
          style={{ flex: 1, alignItems: 'center', gap: 3 }}
          onPress={() => router.replace('/authenticator')}
          activeOpacity={0.7}
        >
          <Ionicons name="key-outline" size={24} color={theme.textSecondary} />
          <Text style={{ fontSize: 11, fontWeight: '500', color: theme.textSecondary }}>Auth</Text>
        </TouchableOpacity>

        {/* Settings Tab */}
        <TouchableOpacity
          style={{ flex: 1, alignItems: 'center', gap: 3 }}
          onPress={() => router.push('/settings')}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={24} color={theme.textSecondary} />
          <Text style={{ fontSize: 11, fontWeight: '500', color: theme.textSecondary }}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* FAB — bottom right, above tab bar */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: insets.bottom + 64 + 16,
          right: 20,
          transform: [{ scale: addButtonScale }],
        }}
      >
        <TouchableOpacity
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#4F6EF7',
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 8,
            shadowColor: '#4F6EF7',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            borderWidth: 3,
            borderColor: theme.surface,
          }}
          onPress={handleAddPress}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>

      {/* Favorites Modal */}
      <Modal visible={showFavoritesModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowFavoritesModal(false)} />
          <View
            style={{
              backgroundColor: theme.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '75%',
              paddingBottom: insets.bottom + 16,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                backgroundColor: theme.stroke,
                borderRadius: 2,
                alignSelf: 'center',
                marginTop: 8,
                marginBottom: 16,
              }}
            />
            <View
              style={{
                paddingHorizontal: 20,
                marginBottom: 16,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: theme.textPrimary }}>
                  Favorites
                </Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>
                  {favorites.length} item{favorites.length !== 1 ? 's' : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowFavoritesModal(false)}>
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={favorites}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{
                    marginHorizontal: 20,
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    backgroundColor: theme.surface,
                    borderLeftWidth: 3,
                    borderLeftColor: getCategoryAccentColor(item.category),
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    elevation: 1,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.04,
                    shadowRadius: 4,
                    marginBottom: 8,
                  }}
                  onPress={() => {
                    setShowFavoritesModal(false);
                    router.push({ pathname: '/detail', params: { id: item.id } });
                  }}
                >
                  <ServiceLogo serviceName={item.data.serviceName} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: theme.textPrimary }}>
                      {item.data.serviceName}
                    </Text>
                    <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>
                      {item.data.username || item.data.cardHolder || ''}
                    </Text>
                  </View>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Ionicons name="chevron-forward" size={14} color={theme.stroke} />
                </TouchableOpacity>
              )}
              scrollEnabled
              bounces={false}
              contentContainerStyle={{ paddingHorizontal: 0, gap: 0, paddingBottom: 8 }}
            />
          </View>
        </View>
      </Modal>

      {/* Credential Options Modal */}
      {selectedCredential && (
        <Modal visible={showModal} transparent animationType="fade">
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.4)',
              },
              {
                opacity: modalAnimation,
              },
            ]}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={closeModal}
            />
          </Animated.View>

          <Animated.View
            style={[
              {
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: theme.surface,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingHorizontal: 20,
                paddingBottom: insets.bottom + 16,
              },
              {
                transform: [
                  {
                    translateY: modalAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [300, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Drag Handle */}
            <View
              style={{
                width: 36,
                height: 4,
                backgroundColor: theme.stroke,
                borderRadius: 2,
                alignSelf: 'center',
                marginTop: 8,
                marginBottom: 16,
              }}
            />

            {/* Service Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingBottom: 16,
                borderBottomWidth: 1,
                borderBottomColor: theme.surfaceSecondary,
                marginBottom: 8,
              }}
            >
              <ServiceLogo serviceName={selectedCredential.data.serviceName} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.textPrimary }}>
                  {selectedCredential.data.serviceName}
                </Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>
                  {selectedCredential.data.username}
                </Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                  Added {formatDate(selectedCredential.createdAt)}
                </Text>
              </View>
            </View>

            {/* Copy Option */}
            <TouchableOpacity
              style={{ height: 54, flexDirection: 'row', alignItems: 'center', gap: 14 }}
              onPress={() => {
                handleCopy(selectedCredential.data.password || '', 'Password');
                closeModal();
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: '#EFF6FF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="copy-outline" size={18} color="#4F6FFF" />
              </View>
              <Text style={{ flex: 1, fontSize: 15, color: theme.textPrimary }}>
                Copy Password
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.stroke} />
            </TouchableOpacity>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: theme.surfaceSecondary, marginLeft: 50 }} />

            {/* Favorites Option */}
            <TouchableOpacity
              style={{ height: 54, flexDirection: 'row', alignItems: 'center', gap: 14 }}
              onPress={async () => {
                await toggleFavorite(selectedCredential.id);
                if (masterKey) {
                  const updated = await getDecryptedCredentials(masterKey);
                  setDecryptedCredentials(updated);
                  setCredentials(updated);
                }
                closeModal();
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: selectedCredential.isFavorite ? '#FFFBEB' : theme.surfaceSecondary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={selectedCredential.isFavorite ? 'star' : 'star-outline'}
                  size={18}
                  color={selectedCredential.isFavorite ? '#F59E0B' : theme.textSecondary}
                />
              </View>
              <Text style={{ flex: 1, fontSize: 15, color: theme.textPrimary }}>
                {selectedCredential.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.stroke} />
            </TouchableOpacity>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: theme.surfaceSecondary, marginLeft: 50 }} />

            {/* Delete Option */}
            <TouchableOpacity
              style={{ height: 54, flexDirection: 'row', alignItems: 'center', gap: 14 }}
              onPress={() => {
                closeModal();
                setTimeout(() => {
                  Alert.alert(
                    'Delete Credential',
                    'This action cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          if (selectedCredential) {
                            await deleteCredential(selectedCredential.id);
                            if (masterKey) {
                              const updated = await getDecryptedCredentials(masterKey);
                              setDecryptedCredentials(updated);
                              setCredentials(updated);
                            }
                          }
                        },
                      },
                    ]
                  );
                }, 300);
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: '#FEF2F2',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </View>
              <Text style={{ flex: 1, fontSize: 15, color: '#EF4444' }}>
                Delete
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#EF4444" />
            </TouchableOpacity>
          </Animated.View>
        </Modal>
      )}
    </View>
  );
}
