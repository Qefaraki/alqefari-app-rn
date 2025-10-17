import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  Modal,
  Animated,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { supabase } from "../../services/supabase";
import { buildNameChain } from "../../utils/nameChainBuilder";
import { useTreeStore } from "../../stores/useTreeStore";
import SkeletonLoader from "../ui/SkeletonLoader";
import tokens from "../ui/tokens";
import { isCousinMarriage } from "../../utils/cousinMarriageDetector";

// Skeleton loader for marriage cards
const MarriageCardSkeleton = () => (
  <View style={styles.memberCard}>
    <View style={styles.memberCardInner}>
      <View style={styles.personHeader}>
        <View style={styles.personLead}>
          <View style={styles.memberAvatarSkeleton} />
          <View style={styles.personSkeletonText}>
            <SkeletonLoader width="70%" height={20} style={styles.skeletonLinePrimary} />
            <SkeletonLoader width="90%" height={14} />
          </View>
        </View>
        <SkeletonLoader width={20} height={20} />
      </View>
      <SkeletonLoader width={120} height={32} />
    </View>
  </View>
);

export default function FamilyDetailModal({ visible, family, onClose, onNavigateToProfile }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]); // For name chain building

  const { setSelectedPersonId } = useTreeStore();
  const router = useRouter();

  useEffect(() => {
    if (visible && family) {
      loadFamilyMembers();
    }
  }, [visible, family]);

  useEffect(() => {
    filterMembers();
  }, [searchQuery, members]);

  const loadFamilyMembers = async () => {
    if (!family) return;

    try {
      setLoading(true);

      // Get ALL profiles to build chains properly
      const { data: allProfilesData } = await supabase
        .from("profiles")
        .select("id, name, father_id, gender, generation, phone");

      // Create a Map for O(1) lookups
      const profilesMap = new Map();
      allProfilesData?.forEach(p => profilesMap.set(p.id, p));

      setAllProfiles(allProfilesData || []);

      // Get marriages for this family's members
      const memberIds = family.members.map((m) => m.id);

      const { data: marriages, error } = await supabase
        .from("marriages")
        .select(
          `
          *,
          husband:profiles!marriages_husband_id_fkey(id, name, hid, father_id, gender, generation, phone, family_origin),
          wife:profiles!marriages_wife_id_fkey(id, name, hid, father_id, gender, generation, phone, family_origin)
        `,
        )
        .or(
          `husband_id.in.(${memberIds.join(",")}),wife_id.in.(${memberIds.join(",")})`,
        )
        .is("deleted_at", null); // Defense in depth: explicit soft-delete filter

      if (error) throw error;

      // Process marriages to get the Al-Qefari member and Munasib member
      const processedMembers =
        marriages?.map((marriage) => {
          const isMunasibHusband = marriage.husband?.hid === null;
          const munasibMember = isMunasibHusband
            ? marriage.husband
            : marriage.wife;
          const alqefariMember = isMunasibHusband
            ? marriage.wife
            : marriage.husband;

          return {
            id: marriage.id,
            munasib: munasibMember,
            alqefari: alqefariMember,
            status: marriage.status,
          };
        }) || [];

      setMembers(processedMembers);
      setFilteredMembers(processedMembers);
    } catch (error) {
      console.error("Error loading family members:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterMembers = () => {
    if (!searchQuery.trim()) {
      setFilteredMembers(members);
      return;
    }

    const query = searchQuery.trim().toLowerCase();
    const filtered = members.filter((member) => {
      const munasibName = member.munasib?.name?.toLowerCase() || "";
      const alqefariName = member.alqefari?.name?.toLowerCase() || "";
      return munasibName.includes(query) || alqefariName.includes(query);
    });

    setFilteredMembers(filtered);
  };

  const handleMemberPress = (member) => {
    // Navigate to Al-Qefari spouse's location, but open Munasib's profile
    if (member.alqefari?.id && member.munasib?.id) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Close this modal first
      onClose();

      // Check if this is a cousin marriage (both spouses are Al-Qefari with HID)
      const isCousinMatch = isCousinMarriage(member.alqefari, member.munasib);

      // Use callback if provided (closes parent modals + navigates)
      if (onNavigateToProfile) {
        // Navigate to tree, centering on Al-Qefari, but open Munasib's sheet
        onNavigateToProfile(member.munasib.id, member.alqefari.id);
      } else {
        // Fallback for standalone usage
        const params = {
          highlightProfileId: member.alqefari.id, // Center tree on Al-Qefari
          openProfileId: member.munasib.id,        // Open Munasib's sheet
          focusOnProfile: 'true',                  // Trigger tree centering
        };

        // If cousin marriage, add spouse IDs for dual-path highlighting
        if (isCousinMatch) {
          params.spouse1Id = member.munasib.id;
          params.spouse2Id = member.alqefari.id;
          console.log('[FamilyDetailModal] Cousin marriage detected, adding spouse IDs:', params);
        }

        router.push({
          pathname: "/",
          params,
        });
      }
    }
  };

  const handleWhatsAppPress = (phone) => {
    if (!phone) return;

    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = phone.replace(/\D/g, '');

    // Saudi numbers should start with 966
    const fullPhone = cleanPhone.startsWith('966') ? cleanPhone : `966${cleanPhone}`;

    Linking.openURL(`whatsapp://send?phone=${fullPhone}`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderMemberCard = ({ item }) => {
    // Get Munasib name (spouse from other family)
    const munasibName = item.munasib ? item.munasib.name : "غير معروف";

    // Build name chain for Al-Qefari member WITH first name
    let alqefariChain = "";
    if (item.alqefari) {
      const names = [];
      let currentId = item.alqefari.id; // Include person's own name

      // Build the ancestry chain by traversing father_id links
      const profilesMap = new Map();
      allProfiles?.forEach(p => profilesMap.set(p.id, p));

      while (currentId) {
        const p = profilesMap.get(currentId);
        if (!p) break;
        names.push(p.name);
        currentId = p.father_id;
      }

      // Add family name at the end
      names.push("القفاري");

      // Join names with " بن " or " بنت " connector
      if (names.length > 1) {
        const connector = item.alqefari.gender === "female" ? "بنت" : "بن";
        alqefariChain = names[0] + " " + connector + " " + names.slice(1).join(" ");
      } else {
        alqefariChain = names.join(" ");
      }
    }

    return (
      <MarriageCard
        item={item}
        munasibName={munasibName}
        alqefariChain={alqefariChain}
        onPress={() => handleMemberPress(item)}
        onWhatsAppPress={handleWhatsAppPress}
      />
    );
  };

  if (!family) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.sheetHandleContainer}>
          <View style={styles.sheetHandle} />
        </View>
        {/* Header with Count Badge */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={palette.text} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>عائلة {family.family_name}</Text>
          </View>
          {/* Count Badge in Corner */}
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{filteredMembers.length}</Text>
          </View>
        </View>

        {/* Search Bar - Matches MunasibManager */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={palette.text + "66"} />
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث عن شخص..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={palette.text + "66"}
            />
            {searchQuery !== "" && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Ionicons name="close-circle" size={18} color={palette.text + "66"} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Members List */}
        {loading ? (
          <View style={styles.listContent}>
            {[...Array(4)].map((_, i) => (
              <MarriageCardSkeleton key={i} />
            ))}
          </View>
        ) : (
          <FlatList
            data={filteredMembers}
            renderItem={renderMemberCard}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={64} color={palette.text + "26"} />
                <Text style={styles.emptyTitle}>لا توجد نتائج</Text>
                <Text style={styles.emptySubtitle}>
                  جرب البحث بكلمات مختلفة
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const palette = tokens.colors.najdi;
const spacing = tokens.spacing;
const typography = tokens.typography;

// Separate MarriageCard component for better organization and animations
const MarriageCard = ({ item, munasibName, alqefariChain, onPress, onWhatsAppPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const munasibInitial = munasibName?.trim()?.charAt(0) ?? "";

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          styles.memberCard,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        <View style={styles.memberCardInner}>
          <View style={styles.personHeader}>
            <View style={styles.personLead}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>{munasibInitial}</Text>
              </View>
              <View style={styles.personTextBlock}>
                <Text style={styles.munasibName} numberOfLines={1}>
                  {munasibName}
                </Text>
                <View style={styles.chainRow}>
                  <Text style={styles.chainText} numberOfLines={2}>
                    {alqefariChain || "غير معروف"}
                  </Text>
                  {item.alqefari?.generation && (
                    <View style={styles.generationBadge}>
                      <Text style={styles.generationText}>
                        الجيل {item.alqefari.generation}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={palette.text + "55"}
              style={styles.memberChevron}
            />
          </View>
          {item.munasib?.phone ? (
            <TouchableOpacity
              style={styles.whatsappButton}
              onPress={(e) => {
                e.stopPropagation();
                onWhatsAppPress(item.munasib.phone);
              }}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
              <Text style={styles.whatsappLabel}>واتساب</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  sheetHandleContainer: {
    alignItems: "center",
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.text + "1A",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  closeButton: {
    width: tokens.touchTarget.minimum,
    height: tokens.touchTarget.minimum,
    justifyContent: "center",
    alignItems: "center",
    marginStart: -spacing.xs,
  },
  titleContainer: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    ...typography.title3,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
    color: palette.text,
    fontWeight: "700",
  },
  countBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: tokens.radii.md,
    backgroundColor: palette.primary,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  countText: {
    ...typography.subheadline,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
    color: palette.background,
    fontWeight: "700",
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.container}33`,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  searchInput: {
    flex: 1,
    ...typography.subheadline,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
    color: palette.text,
    marginHorizontal: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },
  memberCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.container}40`,
    marginBottom: spacing.sm,
    ...Platform.select({
      ios: tokens.shadow.ios,
      android: tokens.shadow.android,
    }),
  },
  memberCardInner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  personHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  personLead: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: spacing.md,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${palette.primary}14`,
    justifyContent: "center",
    alignItems: "center",
  },
  memberAvatarText: {
    ...typography.headline,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
    color: palette.primary,
    fontWeight: "700",
  },
  personTextBlock: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  munasibName: {
    ...typography.title3,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
    color: palette.text,
    fontWeight: "600",
  },
  chainRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chainText: {
    flex: 1,
    ...typography.subheadline,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
    color: palette.text + "99",
    lineHeight: typography.subheadline.lineHeight,
  },
  generationBadge: {
    backgroundColor: `${palette.container}30`,
    borderRadius: tokens.radii.sm,
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
  },
  generationText: {
    ...typography.caption1,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
    color: palette.text + "99",
    fontWeight: "600",
  },
  memberChevron: {
    transform: [{ scaleX: -1 }],
  },
  whatsappButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: tokens.radii.md,
    backgroundColor: "#25D36615",
  },
  whatsappLabel: {
    ...typography.subheadline,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
    color: "#128C7E",
    fontWeight: "600",
  },
  memberAvatarSkeleton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${palette.container}30`,
  },
  personSkeletonText: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  skeletonLinePrimary: {
    marginBottom: spacing.xs / 2,
  },
  emptyContainer: {
    flex: 1,
    paddingTop: spacing.xxl,
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.title3,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
    color: palette.text,
    fontWeight: "600",
  },
  emptySubtitle: {
    ...typography.subheadline,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
    color: palette.text + "66",
    textAlign: "center",
    lineHeight: typography.subheadline.lineHeight,
  },
});
