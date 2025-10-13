import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTreeStore } from "../../stores/useTreeStore";
import * as Haptics from "expo-haptics";

// Najdi Sadu palette
const colors = {
  background: "#F9F7F3",
  white: "#FFFFFF",
  text: "#242121",
  textMuted: "#736372",
  primary: "#A13333",
  secondary: "#D58C4A",
  separator: "#C6C6C8",
};

/**
 * BranchSelector Component
 *
 * Allows super admins to select a branch from the family tree for
 * branch moderator assignment. Uses HID-based selection for pattern matching.
 *
 * Props:
 * - visible: boolean - Show/hide modal
 * - onSelect: (branch) => void - Called when branch is selected
 * - onClose: () => void - Called when modal is closed
 * - selectedUserId: string - User being assigned (for display)
 * - selectedUserName: string - User name (for display)
 */
const BranchSelector = ({ visible, onSelect, onClose, selectedUserId, selectedUserName }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState(null);

  // Get tree data from store
  const treeData = useTreeStore((state) => state.treeData);
  const nodesMap = useTreeStore((state) => state.nodesMap);

  // Calculate descendants count for each node
  const getDescendantsCount = (hid) => {
    if (!hid) return 0;
    return treeData.filter(node =>
      node.hid && node.hid.startsWith(hid + ".") || node.hid === hid
    ).length;
  };

  // Filter branches by search query
  const filteredBranches = useMemo(() => {
    if (!treeData || treeData.length === 0) return [];

    let branches = treeData.filter(node => node.hid); // Only nodes with HID

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      branches = branches.filter(node =>
        node.name?.toLowerCase().includes(query) ||
        node.hid?.includes(query)
      );
    }

    // Sort by HID depth (shorter HIDs first = higher in tree)
    return branches.sort((a, b) => {
      const depthA = (a.hid || "").split(".").length;
      const depthB = (b.hid || "").split(".").length;
      if (depthA !== depthB) return depthA - depthB;
      return (a.hid || "").localeCompare(b.hid || "");
    });
  }, [treeData, searchQuery]);

  const handleBranchSelect = (branch) => {
    setSelectedBranch(branch);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const descendantsCount = getDescendantsCount(branch.hid);

    Alert.alert(
      "تأكيد التعيين",
      `هل تريد تعيين ${selectedUserName} كمشرف على فرع:\n\n` +
      `${branch.name}\n` +
      `HID: ${branch.hid}\n` +
      `عدد الأفراد: ${descendantsCount}`,
      [
        {
          text: "إلغاء",
          style: "cancel",
          onPress: () => setSelectedBranch(null),
        },
        {
          text: "تعيين",
          style: "default",
          onPress: () => {
            onSelect({
              id: branch.id,
              hid: branch.hid,
              name: branch.name,
              descendantsCount,
            });
            setSelectedBranch(null);
            setSearchQuery("");
          },
        },
      ]
    );
  };

  const renderBranchCard = ({ item, index }) => {
    const descendantsCount = getDescendantsCount(item.hid);
    const depth = (item.hid || "").split(".").length;
    const isSelected = selectedBranch?.id === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.branchCard,
          isSelected && styles.branchCardSelected,
        ]}
        onPress={() => handleBranchSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.branchContent}>
          {/* Indentation indicator */}
          <View style={[styles.depthIndicator, { width: depth * 12 }]} />

          {/* Branch info */}
          <View style={styles.branchInfo}>
            <View style={styles.branchHeader}>
              <Text style={styles.branchName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.hidBadge}>
                <Text style={styles.hidText}>{item.hid}</Text>
              </View>
            </View>

            <View style={styles.branchMeta}>
              <Ionicons name="people" size={14} color={colors.textMuted} />
              <Text style={styles.metaText}>
                {descendantsCount} فرد في هذا الفرع
              </Text>
            </View>
          </View>

          {/* Select icon */}
          <Ionicons
            name="chevron-back"
            size={20}
            color={colors.textMuted}
            style={styles.selectIcon}
          />
        </View>
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Image
            source={require("../../../assets/logo/AlqefariEmblem.png")}
            style={styles.emblem}
            resizeMode="contain"
          />
          <View style={styles.titleContent}>
            <Text style={styles.title}>اختر الفرع</Text>
            {selectedUserName && (
              <Text style={styles.subtitle}>للمشرف: {selectedUserName}</Text>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search"
            size={20}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث بالاسم أو HID..."
            placeholderTextColor={colors.textMuted + "99"}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            textAlign="right"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery("");
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color={colors.secondary} />
        <Text style={styles.infoText}>
          اختر فرعاً من الشجرة. سيتمكن المشرف من إدارة هذا الفرع وجميع الأفراد المنتسبين له.
        </Text>
      </View>

      {/* Results List */}
      {treeData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.emptyText}>جاري تحميل بيانات الشجرة...</Text>
        </View>
      ) : filteredBranches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={48} color={colors.textMuted + "60"} />
          <Text style={styles.emptyText}>لا توجد نتائج</Text>
          <Text style={styles.emptySubtext}>جرب البحث باسم آخر أو HID</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBranches}
          keyExtractor={(item) => item.id}
          renderItem={renderBranchCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={true}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 10 : 20,
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
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 4,
    fontFamily: "SF Arabic",
  },

  // Search
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 24,
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

  // Info Banner
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.secondary + "10",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.secondary + "30",
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    fontFamily: "SF Arabic",
    lineHeight: 18,
  },

  // Branch Cards
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  branchCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.background,
  },
  branchCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  branchContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  depthIndicator: {
    height: "100%",
    borderRightWidth: 2,
    borderRightColor: colors.secondary + "40",
    marginRight: 12,
  },
  branchInfo: {
    flex: 1,
  },
  branchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  branchName: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    marginRight: 8,
  },
  hidBadge: {
    backgroundColor: colors.primary + "10",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  hidText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
  },
  branchMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
  },
  selectIcon: {
    marginLeft: 8,
  },

  // Empty States
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginTop: 16,
    textAlign: "center",
    fontFamily: "SF Arabic",
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: "center",
    fontFamily: "SF Arabic",
  },
});

export default BranchSelector;
