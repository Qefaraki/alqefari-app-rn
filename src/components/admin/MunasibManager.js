import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "../../services/supabase";
import { buildNameChain } from "../../utils/nameChainBuilder";
import FamilyDetailModal from "./FamilyDetailModal";
import SkeletonLoader from "../ui/SkeletonLoader";
import LargeTitleHeader from "../ios/LargeTitleHeader";
import tokens from "../ui/tokens";
import { useNetworkGuard } from "../../hooks/useNetworkGuard";

const palette = tokens.colors.najdi;
const spacing = tokens.spacing;
const typography = tokens.typography;

const FamilyCard = ({ item, onPress }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.familyCard}
      activeOpacity={0.92}
    >
      <View style={styles.familyCardContent}>
        <View style={styles.familyCardLeading}>
          <Text style={styles.familyName} numberOfLines={1}>
            عائلة {item.family_name}
          </Text>
        </View>
        <View style={styles.familyMeta}>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{item.count}</Text>
          </View>
          <Ionicons
            name="chevron-back"
            size={18}
            color={`${palette.text  }55`}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Skeleton loader for family cards
const FamilyCardSkeleton = () => (
  <View style={styles.familyCard}>
    <SkeletonLoader width="60%" height={18} style={styles.familySkeletonTitle} />
    <SkeletonLoader width="30%" height={12} />
  </View>
);

export default function MunasibManager({ onClose, onNavigateToProfile }) {
  const [familyStats, setFamilyStats] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredStats, setFilteredStats] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [showFamilyDetail, setShowFamilyDetail] = useState(false);

  // Network guard for offline protection
  const { checkBeforeAction } = useNetworkGuard();

  useEffect(() => {
    loadFamilyStats();
  }, []);

  useEffect(() => {
    filterFamilies();
  }, [searchQuery, familyStats]);

  const loadFamilyStats = async ({ useOverlay = false } = {}) => {
    if (!initialLoading && useOverlay) {
      setIsFetching(true);
    }
    try {

      // Step 1: Get all Munasib profiles with family_origin
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .is("hid", null)
        .not("family_origin", "is", null);

      if (error) throw error;

      // Step 2: Filter to only profiles with active marriages
      let activeProfiles = profiles || [];

      if (profiles && profiles.length > 0) {
        const profileIds = profiles.map(p => p.id);

        // Query marriages table (RLS auto-filters deleted_at IS NULL)
        const { data: activeMarriages, error: marriagesError } = await supabase
          .from("marriages")
          .select("wife_id")
          .in("wife_id", profileIds);

        if (marriagesError) {
          console.error("Error loading marriages:", marriagesError);
          // Continue with all profiles if marriages query fails
        } else {
          // Filter to only profiles with active marriages
          const activeWifeIds = new Set(activeMarriages?.map(m => m.wife_id) || []);
          activeProfiles = profiles.filter(p => activeWifeIds.has(p.id));
        }
      }

      // Step 3: Group by family_origin
      const familyGroups = {};
      activeProfiles.forEach((profile) => {
        const familyName = profile.family_origin;
        if (!familyGroups[familyName]) {
          familyGroups[familyName] = {
            family_name: familyName,
            members: [],
            count: 0,
          };
        }
        familyGroups[familyName].members.push(profile);
        familyGroups[familyName].count++;
      });

      // Convert to sorted array
      const statsArray = Object.values(familyGroups).sort(
        (a, b) => b.count - a.count,
      );

      setFamilyStats(statsArray);
    } catch (error) {
      console.error("Error loading family stats:", error);
    } finally {
      setInitialLoading(false);
      setIsFetching(false);
    }
  };

  const filterFamilies = () => {
    if (!searchQuery.trim()) {
      setFilteredStats(familyStats);
      return;
    }

    const query = searchQuery.trim().toLowerCase();
    const filtered = familyStats.filter((stat) =>
      stat.family_name.toLowerCase().includes(query),
    );

    setFilteredStats(filtered);
  };

  const handleFamilyPress = (family) => {
    setSelectedFamily(family);
    setShowFamilyDetail(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderFamilyCard = ({ item }) => (
    <FamilyCard item={item} onPress={() => handleFamilyPress(item)} />
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom", "left", "right"]}>
        <LargeTitleHeader
          title="الأنساب"
          emblemSource={require('../../../assets/logo/AlqefariEmblem.png')}
          rightSlot={
            onClose ? (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                }}
                style={styles.backButton}
              >
                <Ionicons name="chevron-back" size={28} color={palette.text} />
              </TouchableOpacity>
            ) : null
          }
        />

        <View style={styles.introSurface}>
          <View style={styles.patternRow}>
            {[...Array(7)].map((_, i) => (
              <Image
                key={i}
                source={require("../../../assets/sadu_patterns/png/7.png")}
                style={styles.introPattern}
                resizeMode="contain"
              />
            ))}
          </View>
          <View style={styles.introContent}>
            <Text style={styles.introTitle}>سجل الأنساب</Text>
            <Text style={styles.introSubtitle}>
              تصفح العائلات المرتبطة بالقفاري عبر الزواج وتعرّف على أفرادها
            </Text>
          </View>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={`${palette.text  }66`} />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث عن عائلة..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={`${palette.text  }66`}
          />
          {searchQuery !== "" && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery("");
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Ionicons name="close-circle" size={18} color={`${palette.text  }66`} />
            </TouchableOpacity>
          )}
        </View>

        {/* Family List */}
        {initialLoading ? (
          <View style={styles.listContent}>
            {[...Array(5)].map((_, i) => (
              <FamilyCardSkeleton key={i} />
            ))}
          </View>
        ) : (
          <FlatList
            data={filteredStats}
            renderItem={renderFamilyCard}
            keyExtractor={(item) => item.family_name}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onRefresh={() => loadFamilyStats({ useOverlay: true })}
            refreshing={isFetching}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyCard}>
                  <Image
                    source={require("../../../assets/logo/AlqefariEmblem.png")}
                    style={styles.emptyEmblem}
                    resizeMode="contain"
                  />
                  <Text style={styles.emptyTitle}>ما لقينا عائلات مطابقة</Text>
                  <Text style={styles.emptySubtitle}>
                    غيّر كلمات البحث أو جرّب كتابة اسم العائلة بدون إضافات.
                  </Text>
                </View>
              </View>
            }
          />
        )}

        {/* Family Detail Modal */}
        <FamilyDetailModal
          visible={showFamilyDetail}
          family={selectedFamily}
          onClose={() => {
            setShowFamilyDetail(false);
            setSelectedFamily(null);
          }}
          onNavigateToProfile={onNavigateToProfile}
        />
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  backButton: {
    padding: spacing.xs,
  },
  introSurface: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.container}40`,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: tokens.shadow.ios,
      android: tokens.shadow.android,
    }),
  },
  patternRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    height: 32,
    overflow: 'hidden',
    borderTopLeftRadius: tokens.radii.lg,
    borderTopRightRadius: tokens.radii.lg,
  },
  introPattern: {
    width: 64,
    height: 32,
    tintColor: palette.primary,
    opacity: 0.4,
  },
  introContent: {
    paddingTop: spacing.md + 24,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  introTitle: {
    ...typography.title3,
    fontFamily: "SF Arabic",
    color: palette.text,
    fontWeight: "700",
  },
  introSubtitle: {
    ...typography.subheadline,
    fontFamily: "SF Arabic",
    color: `${palette.text  }99`,
    lineHeight: typography.subheadline.lineHeight,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: `${palette.text}10`,
    paddingHorizontal: spacing.md,
    height: 48,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    ...typography.subheadline,
    fontFamily: "SF Arabic",
    color: palette.text,
    marginHorizontal: spacing.xs,
  },
  listWrapper: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingTop: spacing.md,
  },
  listHeaderSpacer: {
    height: spacing.md,
  },
  familyCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: `${palette.text}10`,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 2,
      },
    }),
  },
  familyCardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  familyCardLeading: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  familyName: {
    flex: 1,
    ...typography.title3,
    fontFamily: "SF Arabic",
    color: palette.text,
    fontWeight: "600",
  },
  familyMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  countBadge: {
    minWidth: 48,
    minHeight: 36,
    borderRadius: tokens.radii.md,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  countText: {
    ...typography.headline,
    fontFamily: "SF Arabic",
    color: palette.background,
    fontWeight: "700",
  },
  familySkeletonTitle: {
    marginBottom: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  skeletonCard: {
    width: "90%",
    maxWidth: 360,
    backgroundColor: palette.background,
    borderRadius: tokens.radii.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.container}40`,
    marginBottom: spacing.md,
  },
  inlineSkeletonContainer: {
    height: spacing.lg,
    justifyContent: "center",
  },
  inlineSkeleton: {
    paddingHorizontal: spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  emptyCard: {
    width: "80%",
    maxWidth: 360,
    backgroundColor: palette.background,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.container}40`,
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    ...Platform.select({
      ios: tokens.shadow.ios,
      android: tokens.shadow.android,
    }),
  },
  emptyEmblem: {
    width: 48,
    height: 48,
    tintColor: palette.primary,
  },
  emptyTitle: {
    ...typography.title3,
    fontFamily: "SF Arabic",
    color: palette.text,
    fontWeight: "600",
  },
  emptySubtitle: {
    ...typography.subheadline,
    fontFamily: "SF Arabic",
    color: `${palette.text  }99`,
    textAlign: "center",
    lineHeight: typography.subheadline.lineHeight,
  },
  emptyAction: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.primary}66`,
    backgroundColor: palette.background,
  },
  emptyActionPressed: {
    backgroundColor: `${palette.primary}10`,
  },
  emptyActionText: {
    ...typography.subheadline,
    fontFamily: "SF Arabic",
    color: palette.primary,
    fontWeight: "600",
  },
});
