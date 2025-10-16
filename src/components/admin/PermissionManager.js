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
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import * as Haptics from "expo-haptics";
import BranchSelector from "./BranchSelector";
import BranchList from "./BranchList";
import PermissionSummary from "./PermissionSummary";
import { SkeletonUserCard } from "../ui/Skeleton";
import enhancedSearchService from "../../services/enhancedSearchService";
import { formatNameWithTitle } from "../../services/professionalTitleService";
import { getGenerationLabel } from "../../utils/generationUtils";

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
 * Helper: Get desert color from palette (cycling)
 */
const getDesertColor = (index) => {
  const desertPalette = [
    "rgba(161, 51, 51, 1)",
    "rgba(213, 140, 74, 1)",
    "rgba(209, 187, 163, 1)",
    "rgba(161, 51, 51, 0.8)",
    "rgba(213, 140, 74, 0.8)",
    "rgba(209, 187, 163, 0.8)",
    "rgba(161, 51, 51, 0.6)",
    "rgba(213, 140, 74, 0.6)",
    "rgba(209, 187, 163, 0.6)",
    "rgba(161, 51, 51, 1)"
  ];
  return desertPalette[index % desertPalette.length];
};

/**
 * Helper: Extract initials from full name chain
 */
const getInitials = (fullNameChain) => {
  if (!fullNameChain) return "؟";
  const firstName = fullNameChain.split(" بن ")[0];
  return firstName.charAt(0);
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
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onUserSelect(item);
        }}
        activeOpacity={0.95}
      >
        <View style={styles.userInfo}>
          {/* Avatar + Name Row (unified with SearchBar) */}
          <View style={styles.avatarNameRow}>
            {/* Avatar (photo or colored circle with initials) */}
            {item.photo_url ? (
              <Image
                source={{ uri: item.photo_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: getDesertColor(index) }]}>
                <Text style={styles.avatarInitial}>
                  {getInitials(item.full_name_chain)}
                </Text>
              </View>
            )}

            {/* Name with professional title */}
            <Text style={styles.userNameChain} numberOfLines={2}>
              {formatNameWithTitle({
                name_chain: item.full_name_chain,
                professional_title: item.professional_title,
                title_abbreviation: item.title_abbreviation
              }, { maxLength: 60 })}
            </Text>
          </View>

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

            {/* Generation badge */}
            {item.generation && (
              <View style={styles.generationBadge}>
                <Text style={styles.generationText}>
                  {getGenerationLabel(item.generation)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Chevron affordance - indicates card is tappable */}
        <Ionicons
          name="chevron-back"
          size={20}
          color={colors.textMuted}
          style={styles.chevronIcon}
        />

        {/* REMOVED: Action buttons moved to PermissionSummary detail view */}
        {false && canEditThisUser && (
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
                <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                <Text style={[styles.actionLabel, { color: colors.primary }]}>الصلاحية</Text>
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
                name="star"
                size={20}
                color={item.is_branch_moderator ? colors.secondary : colors.textMuted}
              />
              <Text style={[styles.actionLabel, {
                color: item.is_branch_moderator ? colors.secondary : colors.textMuted
              }]}>المشرف</Text>
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
                name={item.is_blocked ? "lock-open" : "lock-closed"}
                size={20}
                color={item.is_blocked ? colors.success : colors.error}
              />
              <Text style={[styles.actionLabel, {
                color: item.is_blocked ? colors.success : colors.error
              }]}>الحظر</Text>
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
  const [refreshing, setRefreshing] = useState(false); // Pull-to-refresh state
  const flatListRef = useRef(null);
  const searchInputRef = useRef(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showBranchSelector, setShowBranchSelector] = useState(false);
  const [showPermissionSummary, setShowPermissionSummary] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(true); // Track initial role check
  const [searchTimer, setSearchTimer] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // Track loading state for actions

  // Pagination & filtering state
  const [selectedRole, setSelectedRole] = useState("all"); // "all", "super_admin", "admin", "moderator"
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  // Load current user's role
  useEffect(() => {
    loadCurrentUserRole();
  }, []);

  // Load all users by default after role check
  useEffect(() => {
    if (!roleLoading && ['admin', 'super_admin'].includes(currentUserRole)) {
      // Load first page of all users on mount
      searchUsers('', 1, 'all');
    }
  }, [roleLoading, currentUserRole]);

  // Cleanup search timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimer) {
        clearTimeout(searchTimer);
      }
    };
  }, [searchTimer]);

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
    } finally {
      // Always stop role loading, even on error
      setRoleLoading(false);
    }
  };

  // Search users using optimized RPC with pagination and role filtering
  const searchUsers = async (query, page = 1, roleFilter = selectedRole) => {
    setLoading(true);
    const trimmedQuery = query?.trim() || "";
    setHasSearched(trimmedQuery.length > 0);

    try {
      // Calculate offset for pagination
      const offset = (page - 1) * pageSize;

      // Prepare role filter (null = all roles)
      const roleParam = roleFilter === "all" ? null : roleFilter;

      // Call optimized RPC - returns all data in single query
      const { data, error } = await supabase.rpc('admin_list_permission_users', {
        p_search_query: query || null,
        p_role_filter: roleParam,
        p_limit: pageSize,
        p_offset: offset
      });

      if (error) {
        console.error("RPC error:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        setSearchResults([]);
        setTotalCount(0);
        setCurrentPage(1);
        return;
      }

      // Extract total count from first row (all rows have same total_count)
      const totalCount = data[0]?.total_count || 0;
      setTotalCount(totalCount);
      setCurrentPage(page);

      // Get branch moderator counts (still need separate query for this)
      const profileIds = data.map(p => p.id);
      const { data: branchMods, error: branchError } = await supabase
        .from('branch_moderators')
        .select('user_id')
        .in('user_id', profileIds)
        .eq('is_active', true);

      if (branchError) throw branchError;

      // Get blocked users (still need separate query for this)
      const { data: blocked, error: blockError } = await supabase
        .from('suggestion_blocks')
        .select('blocked_user_id')
        .in('blocked_user_id', profileIds)
        .eq('is_active', true);

      if (blockError) throw blockError;

      // Count branch moderator assignments per user
      const branchCounts = {};
      (branchMods || []).forEach(bm => {
        branchCounts[bm.user_id] = (branchCounts[bm.user_id] || 0) + 1;
      });

      // Create blocked users set for fast lookup
      const blockedSet = new Set((blocked || []).map(b => b.blocked_user_id));

      // Transform RPC results to match expected format and filter out super_admins
      const enrichedResults = data
        .map(row => ({
          id: row.id,
          name: row.full_name_chain?.split(' بن ')[0] || row.full_name_chain?.split(' ')[0] || 'غير معروف',
          full_name_chain: row.full_name_chain || 'غير معروف',
          phone: row.phone,
          role: row.user_role,
          is_branch_moderator: branchCounts[row.id] > 0,
          branch_count: branchCounts[row.id] || 0,
          is_blocked: blockedSet.has(row.id),
          photo_url: row.photo_url,
          generation: row.generation,
          professional_title: row.professional_title,
          title_abbreviation: row.title_abbreviation,
        }))
        .filter(user => user.role !== 'super_admin'); // Exclude super admins from list

      setSearchResults(enrichedResults);
    } catch (error) {
      console.error("Error searching users:", error);
      Alert.alert("خطأ", error.message || "فشل البحث عن المستخدمين");
      setSearchResults([]);
      setTotalCount(0);
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
      setHasSearched(false);
      setCurrentPage(1);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      searchUsers("", 1, selectedRole);
      return;
    }

    // Reset to page 1 for new search
    setCurrentPage(1);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });

    // Debounce search for 150ms (optimal for modern UX)
    const timer = setTimeout(() => {
      searchUsers(text, 1, selectedRole);
    }, 150);
    setSearchTimer(timer);
  };

  // Handle role filter change
  const handleRoleFilterChange = (role) => {
    setSelectedRole(role);
    setCurrentPage(1); // Reset to page 1 when filter changes
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    searchUsers(searchText, 1, role);
  };

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await searchUsers(searchText, currentPage, selectedRole);
    setRefreshing(false);
  };

  // Pagination handlers
  const handleNextPage = () => {
    const totalPages = Math.ceil(totalCount / pageSize);
    if (currentPage < totalPages) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      searchUsers(searchText, currentPage + 1, selectedRole);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      searchUsers(searchText, currentPage - 1, selectedRole);
    }
  };

  // Change user role
  const changeUserRole = async (userId, newRole) => {
    if (actionLoading) return; // Prevent duplicate calls

    try {
      setActionLoading('role');

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
        await searchUsers(searchText);
      }
    } catch (error) {
      console.error("Error changing role:", error);
      Alert.alert("خطأ", error.message || "فشل تغيير الصلاحية");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle suggestion block (Android-compatible)
  const toggleSuggestionBlock = async (userId, currentlyBlocked) => {
    if (actionLoading) return; // Prevent duplicate calls

    try {
      const shouldBlock = !currentlyBlocked;

      if (shouldBlock) {
        // Android doesn't support Alert.prompt - use Alert.alert with default reason
        if (Platform.OS === 'android') {
          Alert.alert(
            "حظر الاقتراحات",
            "هل تريد حظر هذا المستخدم من تقديم الاقتراحات؟",
            [
              { text: "إلغاء", style: "cancel" },
              {
                text: "حظر",
                onPress: async () => {
                  setActionLoading('block');
                  const { data, error } = await supabase.rpc(
                    "admin_toggle_suggestion_block",
                    {
                      p_user_id: userId,
                      p_block: true,
                      p_reason: "محظور من قبل المشرف"
                    }
                  );

                  if (error) throw error;

                  Alert.alert("تم الحظر", "تم حظر المستخدم من تقديم الاقتراحات");
                  if (searchText) {
                    await searchUsers(searchText);
                  }
                  setActionLoading(null);
                }
              }
            ]
          );
        } else {
          // iOS supports Alert.prompt
          Alert.prompt(
            "حظر الاقتراحات",
            "أدخل سبب الحظر:",
            [
              { text: "إلغاء", style: "cancel" },
              {
                text: "حظر",
                onPress: async (reason) => {
                  setActionLoading('block');
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
                  if (searchText) {
                    await searchUsers(searchText);
                  }
                  setActionLoading(null);
                }
              }
            ],
            "plain-text"
          );
        }
      } else {
        // Unblock
        setActionLoading('unblock');
        const { data, error } = await supabase.rpc(
          "admin_toggle_suggestion_block",
          {
            p_user_id: userId,
            p_block: false
          }
        );

        if (error) throw error;

        Alert.alert("تم إلغاء الحظر", "يمكن للمستخدم الآن تقديم الاقتراحات");
        if (searchText) {
          await searchUsers(searchText);
        }
        setActionLoading(null);
      }
    } catch (error) {
      console.error("Error toggling block:", error);
      Alert.alert("خطأ", "فشل تغيير حالة الحظر");
      setActionLoading(null);
    }
  };

  // Get role label in Arabic
  const getRoleLabel = (role) => {
    const labels = {
      super_admin: "المدير العام",
      admin: "مشرف",
      moderator: "منسق",
      user: "عضو",
      null: "عضو"
    };
    return labels[role] || "عضو";
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

  // Handle user selection to show permission summary
  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setShowPermissionSummary(true);
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
        onUserSelect={handleUserSelect}
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

          {/* Optimistic rendering: Show skeleton during role check */}
          {roleLoading ? (
            <>
              {/* Search bar skeleton */}
              <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
                  <TextInput
                    ref={searchInputRef}
                    style={styles.searchInput}
                    placeholder="ابحث بالاسم الكامل..."
                    placeholderTextColor={colors.textMuted + "99"}
                    editable={false}
                    textAlign="right"
                  />
                </View>
              </View>

              {/* Full page skeleton (6 cards) */}
              <View style={styles.listContent}>
                <SkeletonUserCard />
                <SkeletonUserCard />
                <SkeletonUserCard />
                <SkeletonUserCard />
                <SkeletonUserCard />
                <SkeletonUserCard />
              </View>
            </>
          ) : !["admin", "super_admin"].includes(currentUserRole) ? (
            /* Lock screen only after role check completes */
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
                        searchInputRef.current?.blur();
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleSearchTextChange("");
                      }}
                      style={styles.clearButton}
                    >
                      <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* iOS Segmented Control for Role Filter */}
              <View style={styles.segmentedControlContainer}>
                <View style={styles.segmentedControl}>
                  <TouchableOpacity
                    style={[
                      styles.segment,
                      selectedRole === "all" && styles.segmentActive
                    ]}
                    onPress={() => handleRoleFilterChange("all")}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.segmentText,
                      selectedRole === "all" && styles.segmentTextActive
                    ]}>
                      الكل
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.segment,
                      selectedRole === "admin" && styles.segmentActive
                    ]}
                    onPress={() => handleRoleFilterChange("admin")}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.segmentText,
                      selectedRole === "admin" && styles.segmentTextActive
                    ]}>
                      مشرف
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.segment,
                      selectedRole === "moderator" && styles.segmentActive
                    ]}
                    onPress={() => handleRoleFilterChange("moderator")}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.segmentText,
                      selectedRole === "moderator" && styles.segmentTextActive
                    ]}>
                      منسق
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Results */}
              <View style={{ flex: 1, position: 'relative' }}>
                {loading && searchResults.length === 0 ? (
                  /* Initial search loading - show 6 skeleton cards */
                  <View style={styles.listContent}>
                    <SkeletonUserCard />
                    <SkeletonUserCard />
                    <SkeletonUserCard />
                    <SkeletonUserCard />
                    <SkeletonUserCard />
                    <SkeletonUserCard />
                  </View>
                ) : (
                  <FlatList
                    ref={flatListRef}
                    data={searchResults}
                    keyExtractor={(item) => item.id}
                    renderItem={renderUserCard}
                    contentContainerStyle={styles.listContent}
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                    refreshControl={
                      <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary} // Najdi Crimson spinner
                        colors={[colors.primary]} // Android
                      />
                    }
                    ListEmptyComponent={
                      !loading && searchResults.length === 0 ? (
                        /* Empty because search/filter returned no results */
                        selectedRole !== "all" && !searchText ? (
                          /* Empty filter - no users with this role */
                          <View style={styles.emptyContainer}>
                            <Ionicons name="funnel-outline" size={48} color={colors.textMuted + "60"} />
                            <Text style={styles.emptyText}>
                              لا يوجد مستخدمون بهذه الصلاحية
                            </Text>
                            <Text style={styles.emptySubtext}>
                              جرب فلتر آخر أو امسح الفلتر
                            </Text>
                          </View>
                        ) : (
                          /* Empty search - no results for search query */
                          <View style={styles.emptyContainer}>
                            <Ionicons name="search-outline" size={48} color={colors.textMuted + "60"} />
                            <Text style={styles.emptyText}>
                              لا توجد نتائج للبحث
                            </Text>
                            <Text style={styles.emptySubtext}>
                              جرب البحث باسم آخر أو امسح الفلتر
                            </Text>
                          </View>
                        )
                      ) : null
                    }
                    ListFooterComponent={
                      totalCount > pageSize && searchResults.length > 0 ? (
                        <View style={styles.paginationContainer}>
                          <TouchableOpacity
                            style={[
                              styles.paginationButton,
                              currentPage === 1 && styles.paginationButtonDisabled
                            ]}
                            onPress={handlePrevPage}
                            disabled={currentPage === 1}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name="chevron-forward"
                              size={20}
                              color={currentPage === 1 ? colors.textMuted : colors.primary}
                            />
                            <Text style={[
                              styles.paginationButtonText,
                              currentPage === 1 && styles.paginationButtonTextDisabled
                            ]}>
                              السابق
                            </Text>
                          </TouchableOpacity>

                          <View style={styles.pageInfo}>
                            <Text style={styles.pageInfoText}>
                              صفحة {currentPage} من {Math.ceil(totalCount / pageSize)}
                            </Text>
                            <Text style={styles.pageInfoSubtext}>
                              {totalCount} مستخدم
                            </Text>
                          </View>

                          <TouchableOpacity
                            style={[
                              styles.paginationButton,
                              currentPage >= Math.ceil(totalCount / pageSize) && styles.paginationButtonDisabled
                            ]}
                            onPress={handleNextPage}
                            disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                            activeOpacity={0.7}
                          >
                            <Text style={[
                              styles.paginationButtonText,
                              currentPage >= Math.ceil(totalCount / pageSize) && styles.paginationButtonTextDisabled
                            ]}>
                              التالي
                            </Text>
                            <Ionicons
                              name="chevron-back"
                              size={20}
                              color={currentPage >= Math.ceil(totalCount / pageSize) ? colors.textMuted : colors.primary}
                            />
                          </TouchableOpacity>
                        </View>
                      ) : null
                    }
                  />
                )}
              </View>
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

          {/* Permission Summary Modal */}
          <Modal
            visible={showPermissionSummary}
            animationType="slide"
            presentationStyle="pageSheet"
          >
            {selectedUser && (
              <PermissionSummary
                user={selectedUser}
                onClose={() => {
                  setShowPermissionSummary(false);
                  setSelectedUser(null);
                }}
                onRefresh={() => {
                  if (searchText) {
                    searchUsers(searchText);
                  }
                }}
                currentUserRole={currentUserRole}
                onRoleChange={(userId, currentRole) => {
                  showRoleMenu(selectedUser);
                }}
                onBranchManage={(user) => {
                  manageBranchModerator(user);
                }}
                onBlockToggle={(userId, isBlocked) => {
                  toggleSuggestionBlock(userId, isBlocked);
                }}
              />
            )}
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
  avatarNameRow: {
    flexDirection: "row-reverse",  // RTL: avatar on right, name on left
    alignItems: "center",
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 12,  // Space between avatar and name (RTL)
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.white,
    fontFamily: "SF Arabic",
  },
  userNameChain: {
    flex: 1,
    fontSize: 17,  // Larger, more prominent
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    lineHeight: 24,  // Better readability for multi-line chains
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
  generationBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.container + "40", // Camel Hair Beige 40%
  },
  generationText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  chevronIcon: {
    marginLeft: 8,
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

  // Segmented Control (iOS-style)
  segmentedControlContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: colors.container + "40", // Camel Hair Beige 40%
    borderRadius: 10,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textMuted,
    fontFamily: "SF Arabic",
  },
  segmentTextActive: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
  },

  // Pagination
  paginationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  paginationButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary + "30",
    gap: 4,
  },
  paginationButtonDisabled: {
    borderColor: colors.container,
    backgroundColor: colors.background,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
    fontFamily: "SF Arabic",
  },
  paginationButtonTextDisabled: {
    color: colors.textMuted,
  },
  pageInfo: {
    alignItems: "center",
  },
  pageInfoText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  pageInfoSubtext: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
    marginTop: 2,
  },
});

export default PermissionManager;
