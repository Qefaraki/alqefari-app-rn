import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  FlatList,
  Alert,
  RefreshControl,
  Animated,
  Modal,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "../../services/supabase";
import { toArabicNumerals } from "../../utils/dateUtils";
import familyNameService from "../../services/familyNameService";
import CardSurface from "../ios/CardSurface";
import { useTreeStore } from "../../stores/useTreeStore";

// Design system colors - matching the app
const colors = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  textSecondary: "#736372", // Muted Plum
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  accent: "#957EB5", // Lavender
  success: "#4CAF50",
  border: "#E0E0E0",
};

// Sadu pattern colors
const SADU_COLORS = [
  "#A13333", // Najdi Crimson
  "#D58C4A", // Desert Ochre
  "#957EB5", // Lavender
  "#8B7355", // Desert Brown
];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Sadu pattern component
const SaduPattern = ({ size = 20, color = colors.primary }) => (
  <View style={[styles.saduPattern, { width: size, height: size }]}>
    <View style={[styles.saduDiamond, { backgroundColor: color }]} />
  </View>
);

export default function MunasibManager({ onBack }) {
  const [familyStats, setFamilyStats] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredStats, setFilteredStats] = useState([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [expandedMember, setExpandedMember] = useState(null);

  // Get navigation functions from tree store
  const { setSelectedPersonId, setViewportTarget } = useTreeStore();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadFamilyStats();

    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    filterFamilies();
  }, [searchQuery, familyStats]);

  const loadFamilyStats = async () => {
    try {
      setLoading(true);

      // Get all Munasib profiles with marriages
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .is("hid", null)
        .order("name");

      if (error) throw error;

      // Get marriages for these profiles
      const profileIds = profiles.map((p) => p.id);
      if (profileIds.length === 0) {
        setFamilyStats([]);
        setFilteredStats([]);
        return;
      }

      const { data: marriages, error: marriageError } = await supabase
        .from("marriages")
        .select(
          `
          *,
          husband:profiles!marriages_husband_id_fkey(id, name, hid, generation),
          wife:profiles!marriages_wife_id_fkey(id, name, hid, generation)
        `
        )
        .or(
          `husband_id.in.(${profileIds.join(",")}),wife_id.in.(${profileIds.join(",")})`
        );

      if (marriageError) throw marriageError;

      // Group by family
      const familyGroups = familyNameService.getFamilyStatistics(profiles);

      // Add marriage data to groups
      Object.values(familyGroups).forEach((group) => {
        group.marriages = marriages?.filter((m) =>
          group.profiles.some((p) => p.id === m.husband_id || p.id === m.wife_id)
        ) || [];
      });

      // Convert to array for display
      const statsArray = Object.values(familyGroups)
        .map((group, index) => ({
          family_name: group.name,
          member_count: group.count,
          males: group.males,
          females: group.females,
          color: SADU_COLORS[index % SADU_COLORS.length],
          displayName: group.name,
        }))
        .sort((a, b) => b.member_count - a.member_count);

      setFamilyStats(statsArray);
      setFilteredStats(statsArray);
    } catch (error) {
      console.error("Error loading family stats:", error);
      Alert.alert("خطأ", "فشل تحميل بيانات العائلات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterFamilies = () => {
    if (!searchQuery.trim()) {
      setFilteredStats(familyStats);
      return;
    }

    const query = searchQuery.trim().toLowerCase();
    const filtered = familyStats.filter((stat) =>
      stat.displayName.toLowerCase().includes(query)
    );

    setFilteredStats(filtered);
  };

  const loadFamilyMembers = async (familyName) => {
    try {
      // Find all profiles with this family origin
      const { data: munasibProfiles, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .ilike("family_origin", `%${familyName}%`)
        .is("hid", null);

      if (profileError) throw profileError;

      // Get marriages for these profiles
      const profileIds = munasibProfiles.map((p) => p.id);
      if (profileIds.length === 0) {
        setFamilyMembers([]);
        return;
      }

      const { data: marriages, error: marriageError } = await supabase
        .from("marriages")
        .select(
          `
          *,
          husband:profiles!marriages_husband_id_fkey(*),
          wife:profiles!marriages_wife_id_fkey(*)
        `
        )
        .or(
          `husband_id.in.(${profileIds.join(",")}),wife_id.in.(${profileIds.join(",")})`
        );

      if (marriageError) throw marriageError;

      // Transform to member format
      const members = marriages?.map((m) => {
        const isMunasibHusband = m.husband?.hid === null;
        const alqefariMember = isMunasibHusband ? m.wife : m.husband;
        const munasibSpouse = isMunasibHusband ? m.husband : m.wife;

        return {
          marriage_id: m.id,
          alqefari_member: alqefariMember,
          spouse: munasibSpouse,
          status: m.status,
          marriage_date: m.start_date,
        };
      }) || [];

      setFamilyMembers(members);
    } catch (error) {
      console.error("Error loading family members:", error);
      setFamilyMembers([]);
    }
  };

  const handleFamilyPress = async (family) => {
    setSelectedFamily(family);
    await loadFamilyMembers(family.family_name);
    setShowDetailsModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleViewOnTree = (person) => {
    setShowDetailsModal(false);
    // Navigate to tree and select person
    setSelectedPersonId(person.id);
    if (person.hid) {
      setViewportTarget(person.hid);
    }
    onBack();
  };

  const handleViewProfile = (person) => {
    // Open profile sheet
    setSelectedPersonId(person.id);
  };

  const renderFamilyCard = ({ item, index }) => {
    return (
      <TouchableOpacity
        onPress={() => handleFamilyPress(item)}
        activeOpacity={0.9}
      >
        <CardSurface radius={12} style={styles.familyCard}>
          <View style={styles.familyHeader}>
            <View style={styles.familyTitleRow}>
              <SaduPattern size={24} color={item.color} />
              <Text style={styles.familyName}>{item.displayName}</Text>
            </View>
            <Text style={styles.familyCount}>
              {item.member_count > 1
                ? `${toArabicNumerals(item.member_count)} أفراد`
                : "فرد واحد"}
            </Text>
          </View>

          {/* Gender breakdown - only show if not zero */}
          <View style={styles.familyDetails}>
            {item.males > 0 && (
              <Text style={styles.detailText}>
                {item.males > 1
                  ? `${toArabicNumerals(item.males)} رجال`
                  : "رجل واحد"}
              </Text>
            )}
            {item.males > 0 && item.females > 0 && (
              <Text style={styles.detailSeparator}>•</Text>
            )}
            {item.females > 0 && (
              <Text style={styles.detailText}>
                {item.females > 1
                  ? `${toArabicNumerals(item.females)} نساء`
                  : "امرأة واحدة"}
              </Text>
            )}
          </View>
        </CardSurface>
      </TouchableOpacity>
    );
  };

  const renderMemberItem = ({ item, index }) => {
    const isCurrentlyMarried = item.status === "married";
    const alqefariMember = item.alqefari_member;
    const spouse = item.spouse;
    const isExpanded = expandedMember === item.marriage_id;

    // Extract full names with family lineage
    const alqefariFullName = alqefariMember?.name || "غير معروف";
    const spouseFullName = spouse?.name || "غير معروف";

    // Extract generation info if available
    const alqefariGeneration = alqefariMember?.generation ?
      `الجيل ${toArabicNumerals(alqefariMember.generation)}` : "";

    return (
      <View style={styles.memberCardContainer}>
        <TouchableOpacity
          onPress={() => {
            setExpandedMember(isExpanded ? null : item.marriage_id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          activeOpacity={0.95}
        >
          <CardSurface radius={12} style={[
            styles.memberCard,
            isExpanded && styles.memberCardExpanded
          ]}>
            {/* Main Content */}
            <View style={styles.memberMainContent}>
              <View style={styles.coupleSection}>
                {/* Al-Qefari Member */}
                <View style={styles.personInfo}>
                  <Text style={styles.personRole}>من عائلة القفاري</Text>
                  <Text style={styles.personName}>{alqefariFullName}</Text>
                  {alqefariGeneration ? (
                    <Text style={styles.personGeneration}>{alqefariGeneration}</Text>
                  ) : null}
                </View>

                {/* Connection Symbol */}
                <View style={styles.connectionSymbol}>
                  <SaduPattern size={20} color={isCurrentlyMarried ? colors.primary : colors.textSecondary} />
                </View>

                {/* Spouse */}
                <View style={styles.personInfo}>
                  <Text style={styles.personRole}>
                    {isCurrentlyMarried ?
                      (alqefariMember?.gender === "male" ? "الزوجة" : "الزوج") :
                      (alqefariMember?.gender === "male" ? "الزوجة السابقة" : "الزوج السابق")
                    }
                  </Text>
                  <Text style={styles.personName}>{spouseFullName}</Text>
                  <Text style={styles.personFamily}>من عائلة {selectedFamily?.displayName}</Text>
                </View>
              </View>

              {/* Expand Indicator */}
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.textSecondary}
              />
            </View>

            {/* Expanded Actions */}
            {isExpanded && (
              <View style={styles.expandedSection}>
                <View style={styles.divider} />
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      handleViewOnTree(alqefariMember);
                      setExpandedMember(null);
                    }}
                  >
                    <Ionicons name="git-branch-outline" size={20} color={colors.primary} />
                    <Text style={styles.actionButtonText}>عرض في الشجرة</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      handleViewProfile(alqefariMember);
                      setExpandedMember(null);
                    }}
                  >
                    <Ionicons name="person-outline" size={20} color={colors.primary} />
                    <Text style={styles.actionButtonText}>الملف الشخصي</Text>
                  </TouchableOpacity>

                  {spouse && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => {
                        handleViewProfile(spouse);
                        setExpandedMember(null);
                      }}
                    >
                      <Ionicons name="person-outline" size={20} color={colors.secondary} />
                      <Text style={styles.actionButtonText}>ملف {alqefariMember?.gender === "male" ? "الزوجة" : "الزوج"}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </CardSurface>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جارِ التحميل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleSection}>
            <Text style={styles.title}>العائلات المتصلة</Text>
            <Text style={styles.subtitle}>
              {toArabicNumerals(filteredStats.length)}{" "}
              {filteredStats.length === 1
                ? "عائلة"
                : filteredStats.length === 2
                ? "عائلتان"
                : filteredStats.length <= 10
                ? "عائلات"
                : "عائلة"}
            </Text>
          </View>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="chevron-forward" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <CardSurface radius={10} style={styles.searchCard}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="ابحث عن عائلة..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </CardSurface>
        </View>

        {/* Family List */}
        <FlatList
          data={filteredStats}
          renderItem={renderFamilyCard}
          keyExtractor={(item) => item.family_name}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadFamilyStats();
              }}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <SaduPattern size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText}>لا توجد عائلات</Text>
            </View>
          }
        />
      </Animated.View>

      {/* Family Details Modal */}
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setShowDetailsModal(false);
          setExpandedMember(null);
        }}
      >
        <SafeAreaView style={styles.modalContainer} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowDetailsModal(false);
                setExpandedMember(null);
              }}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.modalTitleSection}>
              <Text style={styles.modalTitle}>
                عائلة {selectedFamily?.displayName}
              </Text>
              <Text style={styles.modalSubtitle}>
                {familyMembers.length > 1
                  ? `${toArabicNumerals(familyMembers.length)} ${familyMembers.length === 2 ? "زواجان" : "زواجات"}`
                  : familyMembers.length === 1
                  ? "زواج واحد"
                  : "لا توجد بيانات"}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <FlatList
            data={familyMembers}
            renderItem={renderMemberItem}
            keyExtractor={(item) => item.marriage_id}
            contentContainerStyle={styles.modalListContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>لا توجد بيانات</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
    fontFamily: "SF Arabic",
  },

  // Sadu Pattern
  saduPattern: {
    justifyContent: "center",
    alignItems: "center",
  },
  saduDiamond: {
    width: "70%",
    height: "70%",
    transform: [{ rotate: "45deg" }],
    opacity: 0.8,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titleSection: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 2,
    fontFamily: "SF Arabic",
  },
  backButton: {
    padding: 8,
    marginLeft: 8,
  },

  // Search
  searchContainer: {
    padding: 16,
  },
  searchCard: {
    backgroundColor: "white",
    padding: 0,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 16,
    color: colors.text,
    fontFamily: "SF Arabic",
  },

  // Family Cards
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  familyCard: {
    backgroundColor: "white",
    marginBottom: 12,
    padding: 16,
  },
  familyHeader: {
    marginBottom: 8,
  },
  familyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  familyName: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginLeft: 12,
    fontFamily: "SF Arabic",
  },
  familyCount: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 36,
    fontFamily: "SF Arabic",
  },
  familyDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 36,
  },
  detailText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: "SF Arabic",
  },
  detailSeparator: {
    marginHorizontal: 8,
    color: colors.textSecondary,
  },

  // Empty State
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
    fontFamily: "SF Arabic",
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCloseButton: {
    padding: 8,
    marginRight: 8,
  },
  modalTitleSection: {
    flex: 1,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
    fontFamily: "SF Arabic",
  },
  modalListContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 100,
  },

  // Member Cards
  memberCardContainer: {
    marginBottom: 12,
  },
  memberCard: {
    backgroundColor: "white",
    padding: 16,
  },
  memberCardExpanded: {
    paddingBottom: 0,
  },
  memberMainContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coupleSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  personInfo: {
    flex: 1,
  },
  personRole: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: "SF Arabic",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  personName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    marginBottom: 2,
  },
  personGeneration: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: "SF Arabic",
  },
  personFamily: {
    fontSize: 12,
    color: colors.accent,
    fontFamily: "SF Arabic",
    marginTop: 2,
  },
  connectionSymbol: {
    marginHorizontal: 16,
    alignItems: "center",
  },
  expandedSection: {
    marginTop: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingBottom: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionButtonText: {
    fontSize: 14,
    color: colors.text,
    fontFamily: "SF Arabic",
    marginLeft: 6,
  },
});