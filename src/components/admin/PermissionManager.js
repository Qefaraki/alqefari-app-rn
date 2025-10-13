import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import * as Haptics from "expo-haptics";
import BranchSelector from "./BranchSelector";
import BranchList from "./BranchList";

// Exact colors from ProfileConnectionManagerV2
const colors = {
  // Najdi Sadu palette
  background: "#F9F7F3",      // Al-Jass White
  container: "#D1BBA3",        // Camel Hair Beige
  text: "#242121",            // Sadu Night
  textMuted: "#736372",       // Muted plum
  primary: "#A13333",         // Najdi Crimson
  secondary: "#D58C4A",       // Desert Ochre

  // Status colors (keeping brand palette)
  success: "#D58C4A",         // Desert Ochre for approve
  warning: "#D58C4A",         // Desert Ochre for pending
  error: "#A13333",           // Najdi Crimson for reject

  // System colors
  white: "#FFFFFF",
  separator: "#C6C6C8",
  whatsapp: "#A13333",  // Changed to Najdi Crimson as requested
};

/**
 * AnimatedUserCard Component
 *
 * Extracted from renderUserCard to fix memory leak issue.
 * Proper component lifecycle with cleanup for Animated.Value.
 */
const AnimatedUserCard = ({
  item,
  index,
  currentUserRole,
  getRoleColor,
  getRoleLabel,
  onUserSelect,
  onShowRoleMenu,
  onManageBranch,
  onToggleBlock,
}) => {
  const userRole = item.role || "user";
  const canEditThisUser = currentUserRole === "super_admin";
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start entrance animation
    const animation = Animated.timing(animatedValue, {
      toValue: 1,
      duration: 400,
      delay: Math.min(index * 50, 300),
      useNativeDriver: true,
    });
    animation.start();

    // CLEANUP: Stop animation on unmount to prevent memory leak
    return () => {
      animation.stop();
      animatedValue.stopAnimation();
    };
  }, [index]);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  return (
    <Animated.View
      style={[
        {
          opacity: animatedValue,
          transform: [{ translateY }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => {
          onUserSelect(item);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        activeOpacity={0.95}
      >
        <View style={styles.userInfo}>
          {/* User name and chain */}
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userChain} numberOfLines={1}>
            {item.full_name_chain}
          </Text>

          {/* Role and status badges */}
          <View style={styles.badgeRow}>
            <View style={[styles.roleBadge, { backgroundColor: getRoleColor(userRole) + "20" }]}>
              <Text style={[styles.roleText, { color: getRoleColor(userRole) }]}>
                {getRoleLabel(userRole)}
              </Text>
            </View>

            {item.is_branch_moderator && (
              <View style={styles.badge}>
                <Ionicons name="git-branch" size={12} color={colors.secondary} />
                <Text style={styles.badgeText}>
                  مشرف فرع ({item.branch_count})
                </Text>
              </View>
            )}

            {item.is_blocked && (
              <View style={[styles.badge, styles.blockedBadge]}>
                <Ionicons name="ban" size={12} color={colors.error} />
                <Text style={[styles.badgeText, { color: colors.error }]}>
                  محظور
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Actions with better visual design */}
        {canEditThisUser && (
          <View style={styles.actions}>
            {/* Role selector */}
            {userRole !== "super_admin" && (
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryAction]}
                onPress={() => {
                  onShowRoleMenu(item);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Ionicons name="key" size={18} color={colors.primary} />
              </TouchableOpacity>
            )}

            {/* Branch moderator */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                item.is_branch_moderator && styles.activeAction
              ]}
              onPress={() => {
                onManageBranch(item);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Ionicons
                name="git-branch"
                size={18}
                color={item.is_branch_moderator ? colors.secondary : colors.textMuted}
              />
            </TouchableOpacity>

            {/* Suggestion block toggle */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                item.is_blocked && styles.dangerAction
              ]}
              onPress={() => {
                onToggleBlock(item.id, item.is_blocked);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
            >
              <Ionicons
                name={item.is_blocked ? "checkmark-circle" : "ban"}
                size={18}
                color={item.is_blocked ? colors.success : colors.error}
              />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const PermissionManager = ({ onClose, onBack, user, profile }) => {
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showBranchSelector, setShowBranchSelector] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [searchTimer, setSearchTimer] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Load current user's role
  useEffect(() => {
    loadCurrentUserRole();
  }, []);

  const loadCurrentUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id) // Fixed: was looking for id = user.id
          .single();

        setCurrentUserRole(profile?.role);
      }
    } catch (error) {
      console.error("Error loading user role:", error);
    }
  };

  // Search users by name chain
  const searchUsers = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const { data, error } = await supabase.rpc(
        "super_admin_search_by_name_chain",
        { p_search_text: query }
      );

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error("Error searching users:", error);
      Alert.alert("خطأ", "فشل البحث عن المستخدمين");
    } finally {
      setLoading(false);
    }
  };

  // Handle search text change with debouncing
  const handleSearchTextChange = (text) => {
    setSearchText(text);

    // Clear previous timer
    if (searchTimer) clearTimeout(searchTimer);

    // If text is cleared, clear results immediately
    if (!text) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    // Debounce search for 300ms
    const timer = setTimeout(() => {
      searchUsers(text);
    }, 300);
    setSearchTimer(timer);
  };

  // Change user role
  const changeUserRole = async (userId, newRole) => {
    try {
      const { data, error } = await supabase.rpc(
        "super_admin_set_user_role",
        {
          p_target_user_id: userId,
          p_new_role: newRole
        }
      );

      if (error) throw error;

      Alert.alert(
        "نجح",
        `تم تغيير الصلاحية إلى ${getRoleLabel(newRole)}`,
        [{ text: "حسناً" }]
      );

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Refresh search results with current query
      if (searchText) {
        searchUsers(searchText);
      }
    } catch (error) {
      console.error("Error changing role:", error);
      Alert.alert("خطأ", error.message || "فشل تغيير الصلاحية");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Toggle suggestion block
  const toggleSuggestionBlock = async (userId, currentlyBlocked) => {
    try {
      const shouldBlock = !currentlyBlocked;

      if (shouldBlock) {
        // Show reason input dialog
        Alert.prompt(
          "حظر الاقتراحات",
          "أدخل سبب الحظر:",
          [
            { text: "إلغاء", style: "cancel" },
            {
              text: "حظر",
              onPress: async (reason) => {
                const { data, error } = await supabase.rpc(
                  "admin_toggle_suggestion_block",
                  {
                    p_user_id: userId,
                    p_block: true,
                    p_reason: reason || "بدون سبب محدد"
                  }
                );

                if (error) throw error;

                Alert.alert("تم الحظر", "تم حظر المستخدم من تقديم الاقتراحات");
                searchUsers();
              }
            }
          ],
          "plain-text"
        );
      } else {
        // Unblock
        const { data, error } = await supabase.rpc(
          "admin_toggle_suggestion_block",
          {
            p_user_id: userId,
            p_block: false
          }
        );

        if (error) throw error;

        Alert.alert("تم إلغاء الحظر", "يمكن للمستخدم الآن تقديم الاقتراحات");
        searchUsers();
      }
    } catch (error) {
      console.error("Error toggling block:", error);
      Alert.alert("خطأ", "فشل تغيير حالة الحظر");
    }
  };

  // Get role label in Arabic
  const getRoleLabel = (role) => {
    const labels = {
      super_admin: "مشرف عام",
      admin: "مشرف",
      moderator: "مراقب",
      user: "مستخدم",
      null: "مستخدم"
    };
    return labels[role] || "مستخدم";
  };

  // Get role color
  const getRoleColor = (role) => {
    const roleColors = {
      super_admin: colors.error,
      admin: colors.primary,
      moderator: colors.secondary,
      user: colors.textMuted,
      null: colors.textMuted
    };
    return roleColors[role] || colors.textMuted;
  };

  // Render user card with animations
  const renderUserCard = ({ item, index }) => {
    return (
      <AnimatedUserCard
        item={item}
        index={index}
        currentUserRole={currentUserRole}
        getRoleColor={getRoleColor}
        getRoleLabel={getRoleLabel}
        onUserSelect={setSelectedUser}
        onShowRoleMenu={showRoleMenu}
        onManageBranch={manageBranchModerator}
        onToggleBlock={toggleSuggestionBlock}
      />
    );
  };

  // Show role selection menu
  const showRoleMenu = (user) => {
    const options = [
      { label: "مستخدم عادي", value: null },
      { label: "مراقب", value: "moderator" },
      { label: "مشرف", value: "admin" },
      { label: "مشرف عام", value: "super_admin" }
    ];

    Alert.alert(
      "تغيير الصلاحية",
      `اختر الصلاحية الجديدة لـ ${user.name}:`,
      [
        ...options.map(opt => ({
          text: opt.label,
          onPress: () => changeUserRole(user.id, opt.value)
        })),
        { text: "إلغاء", style: "cancel" }
      ]
    );
  };

  // Manage branch moderator
  const manageBranchModerator = (user) => {
    if (user.is_branch_moderator) {
      Alert.alert(
        "إدارة مشرف الفرع",
        `${user.name} مشرف على ${user.branch_count} فرع`,
        [
          {
            text: "عرض الفروع",
            onPress: () => showUserBranches(user)
          },
          {
            text: "إضافة فرع جديد",
            onPress: () => {
              setSelectedUser(user);
              setShowBranchSelector(true);
            }
          },
          { text: "إغلاق", style: "cancel" }
        ]
      );
    } else {
      setSelectedUser(user);
      setShowBranchSelector(true);
    }
  };

  // Show user's branches
  const showUserBranches = async (user) => {
    try {
      const { data } = await supabase.rpc(
        "get_user_permissions_summary",
        { p_user_id: user.id }
      );

      if (data?.moderated_branches?.length > 0) {
        const branchList = data.moderated_branches
          .map(b => `• ${b.branch_name}`)
          .join("\n");

        Alert.alert(
          "الفروع المُدارة",
          branchList,
          [{ text: "حسناً" }]
        );
      }
    } catch (error) {
      console.error("Error loading branches:", error);
    }
  };

  // Handle branch selection from BranchSelector
  const handleBranchSelected = async (branch) => {
    if (!selectedUser) return;

    try {
      const { data, error } = await supabase.rpc(
        "super_admin_assign_branch_moderator",
        {
          p_user_id: selectedUser.id,
          p_branch_hid: branch.hid,
          p_notes: `تم التعيين على فرع ${branch.name} (${branch.descendantsCount} فرد)`
        }
      );

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "نجح التعيين",
        `تم تعيين ${selectedUser.name} كمشرف على فرع:\n${branch.name}\n\nعدد الأفراد: ${branch.descendantsCount}`,
        [{ text: "حسناً" }]
      );

      // Refresh search results
      if (searchText) {
        searchUsers(searchText);
      }

      // Close modal
      setShowBranchSelector(false);
      setSelectedUser(null);
    } catch (error) {
      console.error("Error assigning branch moderator:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("خطأ", error.message || "فشل تعيين مشرف الفرع");
    }
  };

  // Use onBack if provided, otherwise use onClose
  const handleBack = onBack || onClose;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header - matching ProfileConnectionManagerV2 pattern */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Image
              source={require('../../../assets/logo/AlqefariEmblem.png')}
              style={styles.emblem}
              resizeMode="contain"
            />
            <View style={styles.titleContent}>
              <Text style={styles.title}>إدارة الصلاحيات</Text>
            </View>
            {handleBack && (
              <TouchableOpacity
                onPress={handleBack}
                style={styles.backButton}
              >
                <Ionicons name="chevron-back" size={28} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>

          {/* Only show for admins and super admins */}
          {!["admin", "super_admin"].includes(currentUserRole) ? (
            <View style={styles.noAccessContainer}>
              <Ionicons name="lock-closed" size={64} color={colors.textMuted} />
              <Text style={styles.noAccessText}>
                هذه الصفحة متاحة للمشرفين فقط
              </Text>
            </View>
          ) : (
            <>
              {/* Search bar - auto-search like tree SearchBar */}
              <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="ابحث بالاسم الكامل..."
                    placeholderTextColor={colors.textMuted + "99"}
                    value={searchText}
                    onChangeText={handleSearchTextChange}
                    returnKeyType="search"
                    textAlign="right"
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  {searchText.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setSearchText("");
                        setSearchResults([]);
                        setHasSearched(false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={styles.clearButton}
                    >
                      <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Results */}
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>جاري البحث...</Text>
                </View>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  renderItem={renderUserCard}
                  contentContainerStyle={styles.listContent}
                  ListEmptyComponent={
                    hasSearched && !loading ? (
                      <View style={styles.emptyContainer}>
                        <Ionicons name="search-outline" size={48} color={colors.textMuted + "60"} />
                        <Text style={styles.emptyText}>
                          لا توجد نتائج للبحث
                        </Text>
                        <Text style={styles.emptySubtext}>
                          جرب البحث باسم آخر
                        </Text>
                      </View>
                    ) : !hasSearched ? (
                      <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={48} color={colors.textMuted + "60"} />
                        <Text style={styles.emptyText}>
                          ابحث عن المستخدمين لإدارة صلاحياتهم
                        </Text>
                      </View>
                    ) : null
                  }
                />
              )}
            </>
          )}

          {/* Branch Selector Modal */}
          <Modal
            visible={showBranchSelector}
            animationType="slide"
            presentationStyle="fullScreen"
          >
            <BranchSelector
              visible={showBranchSelector}
              onSelect={handleBranchSelected}
              onClose={() => {
                setShowBranchSelector(false);
                setSelectedUser(null);
              }}
              selectedUserId={selectedUser?.id}
              selectedUserName={selectedUser?.name}
            />
          </Modal>
        </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header - matching ProfileConnectionManagerV2 pattern
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 10 : 20, // Extra padding for iOS Dynamic Island
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  backButton: {
    padding: 8,
    marginLeft: 8,
    marginRight: -8,
  },
  emblem: {
    width: 52,
    height: 52,
    tintColor: colors.text,
    marginRight: 3,
    marginTop: -5,
    marginLeft: -5,
  },
  titleContent: {
    flex: 1,
    paddingTop: 6,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
  },

  noAccessContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  noAccessText: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 16,
    textAlign: "center",
    fontFamily: "SF Arabic",
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 24, // Pill shape like tree SearchBar
    paddingHorizontal: 16,
    height: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    fontFamily: "SF Arabic",
    paddingVertical: 0,
    height: "100%",
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  userCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.background,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
    fontFamily: "SF Arabic",
  },
  userChain: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
    fontFamily: "SF Arabic",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.container + "20",
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
  },
  blockedBadge: {
    backgroundColor: colors.error + "10",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 44,  // iOS minimum touch target
    height: 44,  // iOS minimum touch target
    borderRadius: 22,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryAction: {
    backgroundColor: colors.primary + "10",
  },
  activeAction: {
    backgroundColor: colors.secondary + "10",
  },
  dangerAction: {
    backgroundColor: colors.error + "10",
  },
  emptyContainer: {
    padding: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    color: colors.text,
    fontFamily: "SF Arabic",
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
    marginTop: 8,
    textAlign: "center",
  },
});

export default PermissionManager;