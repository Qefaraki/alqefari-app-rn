import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import * as Haptics from "expo-haptics";

// Najdi Sadu Design System
const COLORS = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  textLight: "#24212199",
  textMedium: "#242121CC",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
};

const PermissionManager = ({ visible, onClose }) => {
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showBranchSelector, setShowBranchSelector] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState(null);

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
          .eq("id", user.id)
          .single();

        setCurrentUserRole(profile?.role);
      }
    } catch (error) {
      console.error("Error loading user role:", error);
    }
  };

  // Search users by name chain
  const searchUsers = async () => {
    if (searchText.length < 2) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        "super_admin_search_by_name_chain",
        { p_search_text: searchText }
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

      // Refresh search results
      searchUsers();
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
    const colors = {
      super_admin: COLORS.error,
      admin: COLORS.primary,
      moderator: COLORS.secondary,
      user: COLORS.textMedium,
      null: COLORS.textMedium
    };
    return colors[role] || COLORS.textMedium;
  };

  // Render user card
  const renderUserCard = ({ item }) => {
    const userRole = item.role || "user";
    const canEditThisUser = currentUserRole === "super_admin";

    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => setSelectedUser(item)}
        activeOpacity={0.7}
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
                <Ionicons name="git-branch" size={12} color={COLORS.secondary} />
                <Text style={styles.badgeText}>
                  مشرف فرع ({item.branch_count})
                </Text>
              </View>
            )}

            {item.is_blocked && (
              <View style={[styles.badge, styles.blockedBadge]}>
                <Ionicons name="ban" size={12} color={COLORS.error} />
                <Text style={[styles.badgeText, { color: COLORS.error }]}>
                  محظور
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Actions */}
        {canEditThisUser && (
          <View style={styles.actions}>
            {/* Role selector */}
            {userRole !== "super_admin" && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => showRoleMenu(item)}
              >
                <Ionicons name="key" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            )}

            {/* Branch moderator */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => manageBranchModerator(item)}
            >
              <Ionicons
                name="git-branch"
                size={20}
                color={item.is_branch_moderator ? COLORS.secondary : COLORS.textLight}
              />
            </TouchableOpacity>

            {/* Suggestion block toggle */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => toggleSuggestionBlock(item.id, item.is_blocked)}
            >
              <Ionicons
                name={item.is_blocked ? "checkmark-circle" : "ban"}
                size={20}
                color={item.is_blocked ? COLORS.success : COLORS.error}
              />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Show role selection menu
  const showRoleMenu = (user) => {
    const options = [
      { label: "مستخدم عادي", value: null },
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>إدارة الصلاحيات</Text>

            <View style={{ width: 24 }} />
          </View>

          {/* Only show for super admins */}
          {currentUserRole !== "super_admin" ? (
            <View style={styles.noAccessContainer}>
              <Ionicons name="lock-closed" size={64} color={COLORS.textLight} />
              <Text style={styles.noAccessText}>
                هذه الصفحة متاحة للمشرفين العامين فقط
              </Text>
            </View>
          ) : (
            <>
              {/* Search bar */}
              <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={20} color={COLORS.textLight} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="ابحث بالاسم الكامل..."
                    value={searchText}
                    onChangeText={setSearchText}
                    onSubmitEditing={searchUsers}
                    returnKeyType="search"
                    textAlign="right"
                  />
                  {searchText.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchText("")}>
                      <Ionicons name="close-circle" size={20} color={COLORS.textLight} />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={searchUsers}
                  disabled={searchText.length < 2}
                >
                  <Text style={styles.searchButtonText}>بحث</Text>
                </TouchableOpacity>
              </View>

              {/* Results */}
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>جاري البحث...</Text>
                </View>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  renderItem={renderUserCard}
                  contentContainerStyle={styles.listContent}
                  ListEmptyComponent={
                    searchText.length > 0 && !loading ? (
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                          لا توجد نتائج للبحث
                        </Text>
                      </View>
                    ) : null
                  }
                />
              )}
            </>
          )}

          {/* Branch Selector Modal would go here */}
          {/* Implement later with tree selection */}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.container + "40",
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  noAccessContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  noAccessText: {
    fontSize: 16,
    color: COLORS.textMedium,
    marginTop: 16,
    textAlign: "center",
  },
  searchContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.container + "40",
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
    color: COLORS.text,
  },
  searchButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: "center",
  },
  searchButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
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
    color: COLORS.textMedium,
  },
  listContent: {
    padding: 16,
  },
  userCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.container + "40",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  userChain: {
    fontSize: 12,
    color: COLORS.textMedium,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.container + "20",
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    color: COLORS.textMedium,
  },
  blockedBadge: {
    backgroundColor: COLORS.error + "10",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: COLORS.background,
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
});

export default PermissionManager;