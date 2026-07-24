import { useState, useEffect, useRef, useCallback } from "react";
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
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
  ScrollView,
  Easing,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useAuthStore } from "../stores/authStore";
import { getDecryptedCredentials, toggleFavorite, deleteCredential, searchDecryptedCredentials } from "../services/dbService";
import { CardColors, LightTheme } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { DecryptedCredential } from "../types";
import ServiceLogo from "../components/ServiceLogo";
import { useAutoLock } from "../hooks/useAutoLock";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CATEGORIES = [
  { key: "all", label: "All", icon: "apps", iconSet: "material" },
  { key: "banking", label: "Banking", icon: "account-balance", iconSet: "material" },
  { key: "social", label: "Social", icon: "people", iconSet: "ion" },
  { key: "email", label: "Email", icon: "email", iconSet: "material" },
  { key: "general", label: "General", icon: "folder", iconSet: "material" },
];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};

const getCardColor = (serviceName, category) => {
  const name = serviceName.toLowerCase();
  if (name.includes("facebook")) return CardColors.facebook;
  if (name.includes("google")) return CardColors.google;
  if (name.includes("netflix")) return CardColors.netflix;
  if (category === "banking") return CardColors.banking;
  return CardColors.default;
};

const getInitial = (name: string): string => name.charAt(0).toUpperCase();

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

const getCategoryColor = (category: string): { bg: string; text: string } => {
  const colors: Record<string, { bg: string; text: string }> = {
    banking: { bg: "#DBEAFE", text: "#1D4ED8" },
    social: { bg: "#DCF5E7", text: "#15803D" },
    email: { bg: "#FEF3C7", text: "#B45309" },
    general: { bg: "#F3E8FF", text: "#7C3AED" },
  };
  return colors[category] || colors.general;
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const { decryptedCredentials, masterKey, setDecryptedCredentials, logout } = useAuthStore();
  const theme = useTheme();
  const [credentials, setCredentials] = useState<DecryptedCredential[]>([]);
  const [filtered, setFiltered] = useState<DecryptedCredential[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [selectedCredential, setSelectedCredential] = useState<DecryptedCredential | null>(null);
  const [showModal, setShowModal] = useState(false);
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
        getDecryptedCredentials(masterKey).then((creds) => {
          setDecryptedCredentials(creds);
          setCredentials(creds);
        });
      }
    }, [masterKey])
  );
  useEffect(() => { filterCredentials(); }, [credentials, search, activeCategory, sortBy]);

  const filterCredentials = () => {
    let result = [...credentials];
    if (activeCategory !== "all") {
      result = result.filter((c) => c.category === activeCategory);
    }
    if (search.trim()) {
      result = searchDecryptedCredentials(result, search);
    }
    if (sortBy === "alphabetical") {
      result.sort((a, b) => a.data.serviceName.localeCompare(b.data.serviceName));
    } else {
      result.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFiltered(result);
  };

  const handleAddPress = () => {
    Animated.sequence([
      Animated.spring(addButtonScale, { toValue: 0.88, useNativeDriver: true, friction: 3, tension: 400 }),
      Animated.spring(addButtonScale, { toValue: 1, useNativeDriver: true, friction: 3, tension: 400 }),
    ]).start();
    router.push("/add");
  };

  const handleCopy = (text, label) => {
    Clipboard.setString(text);
    Alert.alert("Copied!", label + " copied to clipboard.");
  };

  const renderChip = ({ item }) => {
    const isActive = activeCategory === item.key;
    return (
      <TouchableOpacity
        style={[styles.chip, { backgroundColor: isActive ? theme.primary : theme.surfaceSecondary }]}
        onPress={() => setActiveCategory(item.key)}
        activeOpacity={0.8}
      >
        {item.iconSet === "material" ? (
          <MaterialIcons name={item.icon} size={15} color={isActive ? "#FFFFFF" : theme.textSecondary} />
        ) : (
          <Ionicons name={item.icon} size={15} color={isActive ? "#FFFFFF" : theme.textSecondary} />
        )}
        <Text style={[styles.chipText, { color: isActive ? "#FFFFFF" : theme.textSecondary }]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderCard = ({ item }: { item: DecryptedCredential }) => {
    const displayValue = item.category === "banking"
      ? item.data.cardNumber ? "**** " + item.data.cardNumber.slice(-4) : ""
      : item.data.username || "";
    const categoryColor = getCategoryColor(item.category);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.surface, borderBottomColor: theme.stroke }]}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: "/detail", params: { id: item.id } })}
      >
        <ServiceLogo serviceName={item.data.serviceName} size={48} />

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]} numberOfLines={1}>
              {item.data.serviceName}
            </Text>
            <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
              {getTimeAgo(item.createdAt)}
            </Text>
          </View>

          <Text style={[styles.cardUsername, { color: theme.textSecondary }]} numberOfLines={1}>
            {displayValue}
          </Text>

          <View
            style={[
              styles.categoryTag,
              { backgroundColor: categoryColor.bg },
            ]}
          >
            <Text style={[styles.categoryTagText, { color: categoryColor.text }]}>
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
          <Ionicons name="ellipsis-vertical" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const favorites = credentials.filter((c) => c.isFavorite === true);

  return (
    <View style={[styles.container, { flex: 1, backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={theme === LightTheme ? "dark-content" : "light-content"}
        backgroundColor={theme.surface}
        translucent={false}
      />

      {/* Header — outside FlatList, guaranteed full width */}
      <View style={[styles.header, { backgroundColor: theme.surface, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }]}>
        <View style={styles.headerLeft}>
          <Image
            source={require("../assets/logo.png")}
            style={styles.headerLogo}
          />
        </View>
        <View style={styles.headerCenter}>
          <Text style={[styles.greeting, { color: theme.textPrimary }]}>
            {getGreeting()} 👋
          </Text>
          <Text style={[styles.count, { color: theme.textSecondary }]}>
            {credentials.length} password{credentials.length !== 1 ? "s" : ""} stored
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => { logout(); router.replace("/"); }}
          style={[styles.lockButton, { backgroundColor: theme.surfaceSecondary }]}
        >
          <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar — outside FlatList, guaranteed full width */}
      <View style={[styles.searchContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.surfaceSecondary }]}>
          <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder="Search passwords..."
            placeholderTextColor={theme.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* FlatList with only chips, favorites, and credentials */}
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={[styles.listContent, { paddingBottom: 86 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Category Chips — full width scroll */}
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={CATEGORIES}
              keyExtractor={(item) => item.key}
              contentContainerStyle={styles.chipsList}
              renderItem={renderChip}
            />

            {/* Favorites Section */}
            {favorites.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Favorites</Text>
                  <TouchableOpacity activeOpacity={0.7}>
                    <Text style={[styles.viewAll, { color: theme.primary }]}>View All</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={favorites}
                  keyExtractor={(item) => "fav-" + item.id}
                  decelerationRate="fast"
                  snapToAlignment="start"
                  contentContainerStyle={styles.favoritesList}
                  renderItem={({ item }) => {
                    const cardColor = getCardColor(item.serviceName, item.category);
                    return (
                      <TouchableOpacity
                        style={[styles.favoriteCard, { backgroundColor: theme.surface, borderColor: theme.surfaceSecondary }]}
                        activeOpacity={0.8}
                        onPress={() => router.push({ pathname: "/detail", params: { id: item.id } })}
                      >
                        <ServiceLogo serviceName={item.serviceName} size={36} />
                        <Text style={[styles.favName, { color: theme.textPrimary }]} numberOfLines={1}>{item.serviceName}</Text>
                        <Text style={[styles.favPassword, { color: theme.textSecondary }]}>••••••••</Text>
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            )}

            {/* All Credentials Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>All Credentials</Text>
                <View style={styles.sortToggle}>
                  <TouchableOpacity
                    onPress={() => setSortBy("alphabetical")}
                    activeOpacity={0.7}
                    style={[styles.sortBtn, { backgroundColor: sortBy === "alphabetical" ? `${theme.primary}15` : "transparent" }]}
                  >
                    <Text style={[styles.sortText, { color: sortBy === "alphabetical" ? theme.primary : theme.textSecondary }]}>A-Z</Text>
                  </TouchableOpacity>
                  <View style={[styles.sortDivider, { backgroundColor: theme.surfaceSecondary }]} />
                  <TouchableOpacity
                    onPress={() => setSortBy("recent")}
                    activeOpacity={0.7}
                    style={[styles.sortBtn, { backgroundColor: sortBy === "recent" ? `${theme.primary}15` : "transparent" }]}
                  >
                    <Text style={[styles.sortText, { color: sortBy === "recent" ? theme.primary : theme.textSecondary }]}>Recent</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="lock-open-outline" size={64} color={theme.surfaceSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No credentials yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>Tap + to add your first password</Text>
          </View>
        }
      />

      {/* Premium Bottom Tab Bar */}
      <View style={[styles.tabBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12, backgroundColor: theme.tabBar, borderTopColor: theme.surfaceSecondary }]}>
        <TouchableOpacity style={styles.tabItem} activeOpacity={0.7}>
          <Ionicons name="home" size={26} color={theme.primary} />
          <Text style={[styles.tabLabel, { color: theme.primary }]}>Home</Text>
        </TouchableOpacity>

        <View style={styles.addButtonWrapper}>
          <Animated.View style={{ transform: [{ scale: addButtonScale }] }}>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.primary, borderColor: theme.background, shadowColor: theme.primary }]}
              onPress={handleAddPress}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={32} color={theme.textPrimary} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.push("/settings")}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-sharp" size={26} color={theme.textSecondary} />
          <Text style={[styles.tabLabel, { color: theme.textSecondary }]}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet Modal */}
      <Modal
        transparent={true}
        animationType="none"
        visible={showModal}
        onRequestClose={closeModal}
      >
        <Animated.View
          style={[
            styles.modalBackdrop,
            {
              backgroundColor: "rgba(0,0,0,0.5)",
              opacity: modalAnimation,
            },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={closeModal}
            activeOpacity={1}
          />
        </Animated.View>

        {selectedCredential && (
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                backgroundColor: theme.surface,
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
            {/* Drag handle */}
            <View style={[styles.dragHandle, { backgroundColor: theme.stroke }]} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalServiceName, { color: theme.textPrimary }]}>
                  {selectedCredential.data.serviceName}
                </Text>
                <Text style={[styles.modalUsername, { color: theme.textSecondary }]}>
                  {selectedCredential.category === "banking"
                    ? selectedCredential.data.cardNumber ? "**** " + selectedCredential.data.cardNumber.slice(-4) : ""
                    : selectedCredential.data.username || ""}
                </Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 4 }}>
                  Added {formatDate(selectedCredential.createdAt)}
                </Text>
              </View>
              <ServiceLogo serviceName={selectedCredential.data.serviceName} size={40} />
            </View>

            {/* Options */}
            <ScrollView style={styles.modalOptions} showsVerticalScrollIndicator={false}>
              {/* Copy Option */}
              <TouchableOpacity
                style={[styles.modalOption, { borderBottomColor: theme.stroke }]}
                onPress={() => {
                  const text = selectedCredential.category === "banking"
                    ? selectedCredential.data.cardNumber || ""
                    : selectedCredential.data.password || "";
                  const label = selectedCredential.category === "banking" ? "Card number" : "Password";
                  handleCopy(text, label);
                  closeModal();
                }}
              >
                <Ionicons name="copy-outline" size={22} color={theme.primary} />
                <Text style={[styles.modalOptionText, { color: theme.textPrimary }]}>
                  Copy {selectedCredential.category === "banking" ? "Card Number" : "Password"}
                </Text>
              </TouchableOpacity>

              {/* Favorite Option */}
              <TouchableOpacity
                style={[styles.modalOption, { borderBottomColor: theme.stroke }]}
                onPress={async () => {
                  await toggleFavorite(selectedCredential.id);
                  if (masterKey) {
                    const updated = await getDecryptedCredentials(masterKey);
                    setDecryptedCredentials(updated);
                  }
                  closeModal();
                }}
              >
                <Ionicons
                  name={selectedCredential.isFavorite ? "star" : "star-outline"}
                  size={22}
                  color={selectedCredential.isFavorite ? "#F59E0B" : theme.textSecondary}
                />
                <Text style={[styles.modalOptionText, { color: theme.textPrimary }]}>
                  {selectedCredential.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                </Text>
              </TouchableOpacity>

              {/* Delete Option */}
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  Alert.alert(
                    "Delete Credential",
                    `Are you sure you want to delete "${selectedCredential.data.serviceName}"?`,
                    [
                      { text: "Cancel", onPress: () => {} },
                      {
                        text: "Delete",
                        onPress: async () => {
                          await deleteCredential(selectedCredential.id);
                          if (masterKey) {
                            const updated = await getDecryptedCredentials(masterKey);
                            setDecryptedCredentials(updated);
                          }
                          closeModal();
                        },
                        style: "destructive",
                      },
                    ]
                  );
                }}
              >
                <Ionicons name="trash-outline" size={22} color={theme.danger} />
                <Text style={[styles.modalOptionText, { color: theme.danger }]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },
  header: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  count: {
    fontSize: 13,
    marginTop: 3,
  },
  lockButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerLeft: {
    width: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 46,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  chipsList: {
    paddingHorizontal: 16,
    paddingRight: 16,
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    gap: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  section: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  viewAll: {
    fontSize: 14,
    fontWeight: "500",
  },
  favoritesList: {
    gap: 12,
    paddingBottom: 4,
  },
  favoriteCard: {
    width: 150,
    height: 96,
    borderRadius: 16,
    padding: 14,
    justifyContent: "space-between",
    borderWidth: 1,
  },
  favIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  favInitial: {
    fontSize: 14,
    fontWeight: "bold",
  },
  favName: {
    fontSize: 13,
    fontWeight: "600",
  },
  favPassword: {
    fontSize: 11,
  },
  sortToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  sortBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sortText: {
    fontSize: 13,
    fontWeight: "600",
  },
  sortDivider: {
    width: 1,
    height: 16,
    marginHorizontal: 2,
  },
  listContent: {
    gap: 0,
    paddingTop: 8,
    flexGrow: 1,
    paddingHorizontal: 0,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    backgroundColor: "transparent",
    gap: 12,
  },
  cardContent: {
    flex: 1,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  timestamp: {
    fontSize: 11,
  },
  cardUsername: {
    fontSize: 13,
  },
  categoryTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: "600",
  },
  menuButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 14,
  },
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 0.5,
    paddingTop: 10,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minHeight: 48,
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  addButtonWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -30,
  },
  addButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    elevation: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    borderWidth: 3,
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 32,
    paddingHorizontal: 16,
    maxHeight: "60%",
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  modalServiceName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalUsername: {
    fontSize: 13,
  },
  modalOptions: {
    maxHeight: "70%",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    gap: 16,
    borderBottomWidth: 1,
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: "500",
  },
});

