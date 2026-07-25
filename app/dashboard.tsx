import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  Alert,
  Clipboard,
  Animated,
  Platform,
  UIManager,
  Modal,
  ScrollView,
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
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
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

  // Theme-aware colors
  const isDark = themeMode === 'dark' || (themeMode === 'system' && colorScheme === 'dark');
  const colors = {
    background: theme.background,
    surface: theme.surface,
    surfaceSecondary: theme.surfaceSecondary,
    textPrimary: theme.textPrimary,
    textSecondary: theme.textSecondary,
    textMuted: theme.textSecondary,
    border: theme.stroke,
    ...BRAND_colors,
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'banking':
        return { bg: colors.bankingBg, text: colors.bankingText };
      case 'social':
        return { bg: colors.socialBg, text: colors.socialText };
      case 'email':
        return { bg: colors.emailBg, text: colors.emailText };
      case 'general':
      default:
        return { bg: colors.generalBg, text: colors.generalText };
    }
  };

  const dynamicStyles = {
    header: {
      backgroundColor: colors.surface,
      borderBottomColor: colors.surfaceSecondary,
    },
    headerTitle: { color: colors.textPrimary },
    headerSubtitle: { color: colors.textSecondary },
    lockButton: { backgroundColor: colors.background },
    searchContainer: {
      backgroundColor: colors.surface,
      borderBottomColor: colors.surfaceSecondary,
    },
    searchInput: { backgroundColor: colors.surfaceSecondary },
    searchField: { color: colors.textPrimary },
    sectionTitle: { color: colors.textPrimary },
    seeAll: { color: colors.primary },
    favoriteCard: {
      backgroundColor: colors.surface,
      shadowColor: colors.textPrimary,
    },
    favoriteName: { color: colors.textPrimary },
    sortButton: { backgroundColor: colors.surfaceSecondary },
    sortText: { color: colors.textSecondary },
    credentialCard: {
      backgroundColor: colors.surface,
      shadowColor: colors.textPrimary,
    },
    cardTitle: { color: colors.textPrimary },
    timestamp: { color: colors.textMuted },
    cardSubtitle: { color: colors.textSecondary },
    emptyStateContainer: { backgroundColor: colors.background },
    emptyIconContainer: { backgroundColor: colors.primary + '1A' },
    emptyTitle: { color: colors.textPrimary },
    emptySubtitle: { color: colors.textSecondary },
    modalBackdrop: { backgroundColor: colors.textPrimary },
    modalContent: { backgroundColor: colors.surface },
    modalHeader: { borderBottomColor: colors.surfaceSecondary },
    modalServiceName: { color: colors.textPrimary },
    modalServiceUsername: { color: colors.textSecondary },
    tabBar: { backgroundColor: colors.surface, borderTopColor: colors.surfaceSecondary },
    activeIndicator: { backgroundColor: colors.primary + '0A' },
    activeTabLabel: { color: colors.primary },
    inactiveTabLabel: { color: colors.textSecondary },
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
    Clipboard.setString(text);
    Alert.alert('Copied!', label + ' copied to clipboard.');
    setTimeout(() => {
      Clipboard.setString('');
    }, 30000);
  };

  const handleAddPress = () => {
    Animated.sequence([
      Animated.spring(addButtonScale, { toValue: 0.88, useNativeDriver: true, friction: 3, tension: 400 }),
      Animated.spring(addButtonScale, { toValue: 1, useNativeDriver: true, friction: 3, tension: 400 }),
    ]).start();
    router.push('/add');
  };

  const getCardGradient = (category: string): string => {
    switch (category) {
      case 'banking':
        return '#EFF6FF';
      case 'social':
        return '#F0FDF4';
      case 'email':
        return '#FFF7ED';
      case 'general':
        return '#F5F3FF';
      default:
        return '#F8FAFC';
    }
  };

  const getCategoryShadowColor = (category: string): string => {
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

  const renderChip = useCallback(({ item }) => {
    const isActive = activeCategory === item.key;
    return (
      <TouchableOpacity
        style={[
          styles.chip,
          {
            backgroundColor: isActive ? colors.primary : colors.surfaceSecondary,
          },
        ]}
        onPress={() => setActiveCategory(item.key)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={item.icon}
          size={13}
          color={isActive ? '#FFFFFF' : colors.textSecondary}
        />
        <Text
          style={[
            styles.chipText,
            {
              color: isActive ? '#FFFFFF' : colors.textSecondary,
            },
          ]}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  }, [activeCategory]);

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
          backgroundColor: theme.surface,
          marginHorizontal: 20,
          borderRadius: 16,
          padding: 16,
          marginBottom: 8,
          elevation: 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/detail', params: { id: item.id } })}
      >
        <ServiceLogo serviceName={item.data.serviceName} size={44} />

        <View style={styles.cardContent}>
          <View style={styles.cardRow1}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.data.serviceName}
            </Text>
            <Text style={styles.timestamp}>{getTimeAgo(item.createdAt)}</Text>
          </View>

          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {displayValue}
          </Text>

          <View
            style={[
              styles.categoryPill,
              { backgroundColor: categoryColor.bg },
            ]}
          >
            <Text style={[styles.categoryText, { color: categoryColor.text }]}>
              {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => {
            setSelectedCredential(item);
            setShowModal(true);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.menuIconContainer}>
            <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} translucent={false} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={dynamicStyles.sectionTitle.color} />
        </View>
      </View>
    );
  }

  const renderListHeader = () => (
    <>
      {/* Category Chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.chipsContent}
        renderItem={renderChip}
      />

      {/* Favorites Section */}
      {favorites.length > 0 && (
        <View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
              marginBottom: 12,
              marginTop: 20,
            }}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: '600',
                color: theme.textPrimary,
              }}
            >
              Favorites
            </Text>
            {favorites.length > 3 && (
              <Text
                style={{
                  fontSize: 14,
                  color: '#4F6EF7',
                }}
              >
                See all ({favorites.length})
              </Text>
            )}
          </View>
          {favorites.slice(0, 3).map((item) => (
            <TouchableOpacity
              key={item.id}
              style={{
                marginHorizontal: 20,
                marginBottom: 8,
                borderRadius: 20,
                overflow: 'hidden',
              }}
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: '/detail', params: { id: item.id } })}
            >
              <View
                style={{
                  backgroundColor: getCardGradient(item.category),
                  padding: 16,
                  borderRadius: 20,
                  borderLeftWidth: 3,
                  borderLeftColor: getCategoryColor(item.category).text,
                  elevation: 4,
                  shadowColor: getCategoryShadowColor(item.category),
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.12,
                  shadowRadius: 8,
                }}
              >
                {/* Row 1: Logo + Name + Category */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ServiceLogo serviceName={item.data.serviceName} size={36} />
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: 'bold',
                        color: theme.textPrimary,
                      }}
                    >
                      {item.data.serviceName}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                        backgroundColor: getCategoryColor(item.category).bg,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: getCategoryColor(item.category).text,
                        }}
                      >
                        {item.category.charAt(0).toUpperCase() +
                          item.category.slice(1)}
                      </Text>
                    </View>
                    <Ionicons name="star" size={16} color="#F59E0B" />
                  </View>
                </View>

                {/* Row 2: Masked Value */}
                <Text
                  style={{
                    marginTop: 12,
                    fontSize: 20,
                    fontWeight: '300',
                    letterSpacing: 3,
                    color: theme.textSecondary,
                    fontFamily: 'monospace',
                  }}
                >
                  {item.category === 'banking' && item.data.cardNumber
                    ? '**** ' + item.data.cardNumber.slice(-4)
                    : '••••••••'}
                </Text>

                {/* Row 3: Username + Timestamp */}
                <View
                  style={{
                    marginTop: 8,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.textSecondary,
                    }}
                  >
                    {item.data.username || item.data.cardHolder || ''}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: theme.textSecondary,
                    }}
                  >
                    {formatDate(item.createdAt)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* All Credentials Header */}
      <View style={styles.allItemsHeader}>
        <Text style={styles.sectionTitle}>All Items</Text>
        <TouchableOpacity
          style={styles.sortButton}
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
          <Text style={styles.sortText}>{sortBy === 'alphabetical' ? 'A-Z' : 'Recent'}</Text>
          <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </>
  );

  if (filtered.length === 0 && credentials.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} translucent={false} />

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerLeft}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.headerLogo}
            />
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>FortLock</Text>
            <Text style={styles.headerSubtitle}>0 items secured</Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* Empty State */}
        <ScrollView
          contentContainerStyle={styles.emptyStateContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.emptyIconContainer}>
            <Ionicons name="shield-outline" size={40} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Your vault is empty</Text>
          <Text style={styles.emptySubtitle}>Add your first password to get started.</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/add')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.emptyButtonText}>Add Password</Text>
          </TouchableOpacity>
        </ScrollView>

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
            flexDirection: 'row',
            alignItems: 'center',
            height: 64 + insets.bottom,
            paddingBottom: insets.bottom,
            elevation: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
          }}
        >
          {/* Vault Tab (Left) */}
          <TouchableOpacity
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 8,
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="shield-checkmark" size={22} color="#4F6EF7" />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: '#4F6EF7',
                marginTop: 3,
              }}
            >
              Vault
            </Text>
          </TouchableOpacity>

          {/* FAB (Center) */}
          <Animated.View
            style={{
              width: 64,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: -20,
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
                elevation: 12,
                shadowColor: '#4F6EF7',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 16,
                borderWidth: 3,
                borderColor: '#FFFFFF',
              }}
              onPress={handleAddPress}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>

          {/* Settings Tab (Right) */}
          <TouchableOpacity
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 8,
            }}
            onPress={() => router.push('/settings')}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={22} color={theme.textSecondary} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '500',
                color: theme.textSecondary,
                marginTop: 3,
              }}
            >
              Settings
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (search && filtered.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} translucent={false} />

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerLeft}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.headerLogo}
            />
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>FortLock</Text>
            <Text style={styles.headerSubtitle}>{credentials.length} items secured</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              logout();
              router.replace('/');
            }}
            style={styles.lockButton}
          >
            <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 12,
            backgroundColor: theme.surface,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isSearchFocused ? theme.surface : theme.surfaceSecondary,
              borderRadius: 16,
              height: 50,
              paddingHorizontal: 14,
              gap: 10,
              borderWidth: 1,
              borderColor: isSearchFocused ? '#4F6FFF' : theme.stroke,
              elevation: isSearchFocused ? 6 : 2,
              shadowColor: isSearchFocused ? '#4F6FFF' : '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: isSearchFocused ? 0.15 : 0.06,
              shadowRadius: isSearchFocused ? 8 : 4,
            }}
          >
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={{
                flex: 1,
                fontSize: 15,
                color: colors.textPrimary,
              }}
              placeholder="Search your vault..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="options-outline" size={18} color={colors.textSecondary} />
            )}
          </View>
        </View>

        {/* No Results */}
        <ScrollView
          contentContainerStyle={styles.emptyStateContainer}
          showsVerticalScrollIndicator={false}
        >
          <Ionicons name="search-outline" size={40} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { marginTop: 20 }]}>No results found</Text>
          <Text style={styles.emptySubtitle}>Try searching with different keywords</Text>
        </ScrollView>

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
            flexDirection: 'row',
            alignItems: 'center',
            height: 64 + insets.bottom,
            paddingBottom: insets.bottom,
            elevation: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
          }}
        >
          {/* Vault Tab (Left) */}
          <TouchableOpacity
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 8,
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="shield-checkmark" size={22} color="#4F6EF7" />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: '#4F6EF7',
                marginTop: 3,
              }}
            >
              Vault
            </Text>
          </TouchableOpacity>

          {/* FAB (Center) */}
          <Animated.View
            style={{
              width: 64,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: -20,
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
                elevation: 12,
                shadowColor: '#4F6EF7',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 16,
                borderWidth: 3,
                borderColor: '#FFFFFF',
              }}
              onPress={handleAddPress}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>

          {/* Settings Tab (Right) */}
          <TouchableOpacity
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 8,
            }}
            onPress={() => router.push('/settings')}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={22} color={theme.textSecondary} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '500',
                color: theme.textSecondary,
                marginTop: 3,
              }}
            >
              Settings
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} translucent={false} />

      {/* Header */}
      <View
        style={{
          backgroundColor: theme.surface,
          paddingTop: insets.top + 12,
          paddingBottom: 14,
          paddingHorizontal: 20,
          borderBottomWidth: 0,
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Image
              source={require('../assets/logo.png')}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
              }}
            />
            <Text
              style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: theme.textPrimary,
              }}
            >
              FortLock
            </Text>
          </View>
          <Text
            style={{
              marginTop: 2,
              fontSize: 13,
              color: theme.textSecondary,
            }}
          >
            {credentials.length} item{credentials.length !== 1 ? 's' : ''} secured
          </Text>
          <Text
            style={{
              marginTop: 1,
              fontSize: 11,
              color: theme.textSecondary,
            }}
          >
            Last synced just now
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            logout();
            router.replace('/');
          }}
          style={{
            position: 'absolute',
            right: 20,
            top: insets.top + 16,
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: theme.surfaceSecondary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name="lock-closed-outline"
            size={16}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInput}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchField}
            placeholder="Search your vault..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <Ionicons name="options-outline" size={18} color={colors.textSecondary} />
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
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 90 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={8}
        getItemLayout={(data, index) => ({
          length: 88,
          offset: 88 * index,
          index,
        })}
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
          flexDirection: 'row',
          alignItems: 'center',
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        }}
      >
        {/* Vault Tab (Left) */}
        <TouchableOpacity
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 8,
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="shield-checkmark" size={22} color="#4F6EF7" />
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: '#4F6EF7',
              marginTop: 3,
            }}
          >
            Vault
          </Text>
        </TouchableOpacity>

        {/* FAB (Center) */}
        <Animated.View
          style={{
            width: 64,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: -20,
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
              elevation: 12,
              shadowColor: '#4F6EF7',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.4,
              shadowRadius: 16,
              borderWidth: 3,
              borderColor: '#FFFFFF',
            }}
            onPress={handleAddPress}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>

        {/* Settings Tab (Right) */}
        <TouchableOpacity
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 8,
          }}
          onPress={() => router.push('/settings')}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={22} color={theme.textSecondary} />
          <Text
            style={{
              fontSize: 11,
              fontWeight: '500',
              color: theme.textSecondary,
              marginTop: 3,
            }}
          >
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Credential Options Modal */}
      {selectedCredential && (
        <Modal visible={showModal} transparent animationType="fade">
          <Animated.View
            style={[
              styles.modalBackdrop,
              {
                opacity: modalAnimation,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.modalBackdropTouch}
              onPress={closeModal}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.modalContent,
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
            <View
              style={[
                styles.modalSheet,
                {
                  backgroundColor: theme.surface,
                  paddingBottom: insets.bottom + 16,
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
              {selectedCredential && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingBottom: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.surfaceSecondary,
                    marginBottom: 8,
                    paddingHorizontal: 4,
                  }}
                >
                  <ServiceLogo
                    serviceName={selectedCredential.data?.serviceName || ''}
                    size={44}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '700',
                        color: theme.textPrimary,
                      }}
                    >
                      {selectedCredential.data?.serviceName || ''}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: theme.textSecondary,
                        marginTop: 2,
                      }}
                    >
                      {selectedCredential.data?.username ||
                        selectedCredential.data?.cardHolder ||
                        ''}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: theme.textSecondary,
                        marginTop: 2,
                      }}
                    >
                      Added {formatDate(selectedCredential.createdAt)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Copy Option */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  height: 56,
                  gap: 14,
                }}
                onPress={() => {
                  const text =
                    selectedCredential?.category === 'banking'
                      ? selectedCredential?.data?.cardNumber || ''
                      : selectedCredential?.data?.password || '';
                  handleCopy(
                    text,
                    selectedCredential?.category === 'banking'
                      ? 'Card number'
                      : 'Password'
                  );
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
                <Text
                  style={{ flex: 1, fontSize: 15, color: theme.textPrimary }}
                >
                  {selectedCredential?.category === 'banking'
                    ? 'Copy Card Number'
                    : 'Copy Password'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={theme.stroke} />
              </TouchableOpacity>

              {/* Divider */}
              <View
                style={{
                  height: 1,
                  backgroundColor: theme.surfaceSecondary,
                  marginLeft: 50,
                }}
              />

              {/* Favorites Option */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  height: 56,
                  gap: 14,
                }}
                onPress={async () => {
                  if (selectedCredential) {
                    await toggleFavorite(selectedCredential.id);
                    if (masterKey) {
                      const updated = await getDecryptedCredentials(masterKey);
                      setDecryptedCredentials(updated);
                      setCredentials(updated);
                    }
                    closeModal();
                  }
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: selectedCredential?.isFavorite
                      ? '#FFFBEB'
                      : theme.surfaceSecondary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={
                      selectedCredential?.isFavorite
                        ? 'star'
                        : 'star-outline'
                    }
                    size={18}
                    color={
                      selectedCredential?.isFavorite
                        ? '#F59E0B'
                        : theme.textSecondary
                    }
                  />
                </View>
                <Text
                  style={{ flex: 1, fontSize: 15, color: theme.textPrimary }}
                >
                  {selectedCredential?.isFavorite
                    ? 'Remove from Favorites'
                    : 'Add to Favorites'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={theme.stroke} />
              </TouchableOpacity>

              {/* Divider */}
              <View
                style={{
                  height: 1,
                  backgroundColor: theme.surfaceSecondary,
                  marginLeft: 50,
                }}
              />

              {/* Delete Option */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  height: 56,
                  gap: 14,
                }}
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
                              await deleteCredential(
                                selectedCredential.id
                              );
                              if (masterKey) {
                                const updated =
                                  await getDecryptedCredentials(masterKey);
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
                <Text
                  style={{ flex: 1, fontSize: 15, color: '#EF4444' }}
                >
                  Delete
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0,
  },
  headerLeft: {
    width: 44,
    alignItems: 'flex-start',
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    width: 44,
  },
  lockButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    height: 44,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchField: {
    flex: 1,
    fontSize: 15,
  },
  chipsContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  seeAll: {
    fontSize: 14,
  },
  favoritesContent: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 4,
  },
  favoriteCard: {
    width: 140,
    height: 88,
    borderRadius: 16,
    padding: 14,
    justifyContent: 'space-between',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  favoriteBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  favoriteName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  allItemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sortButton: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortText: {
    fontSize: 13,
  },
  listContent: {
    paddingTop: 8,
  },
  credentialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    gap: 14,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardContent: {
    flex: 1,
  },
  cardRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
  },
  cardSubtitle: {
    fontSize: 13,
    marginTop: 3,
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  menuButton: {
    padding: 4,
  },
  menuIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    paddingBottom: 120,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 0.5,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 20,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  activeIndicator: {
    width: 40,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactiveIndicator: {
    width: 40,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  inactiveTabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  fabWrapper: {
    marginTop: -28,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalBackdropTouch: {
    flex: 1,
  },
  modalContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  modalServiceName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalUsername: {
    fontSize: 13,
    marginTop: 2,
  },
  modalDate: {
    fontSize: 11,
    marginTop: 2,
  },
  modalOption: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
  },
  optionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    fontSize: 15,
  },
});
