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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "../../services/supabase";
import { toArabicNumerals } from "../../utils/dateUtils";
import pdfExportService from "../../services/pdfExport";
import familyNameService from "../../services/familyNameService";

// Design system colors
const colors = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  textSecondary: "#736372", // Muted Plum
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  accent: "#957EB5", // Lavender (Munasib color)
  success: "#4CAF50",
  error: "#F44336",
  warning: "#FF9800",
};

// Desert palette for avatars
const FAMILY_COLORS = [
  "#A13333", // Najdi Crimson
  "#D58C4A", // Desert Ochre
  "#957EB5", // Lavender
  "#736372", // Muted Plum
  "#8B7355", // Desert Brown
  "#6B8E23", // Olive
  "#CD853F", // Peru
  "#DAA520", // Goldenrod
];

export default function MunasibManager({ onBack }) {
  const [familyStats, setFamilyStats] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredStats, setFilteredStats] = useState([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadFamilyStats();

    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    filterFamilies();
  }, [searchQuery, familyStats]);

  const loadFamilyStats = async () => {
    try {
      setLoading(true);

      // Get family connection statistics
      const { data: stats, error: statsError } = await supabase.rpc(
        "get_family_connection_stats"
      );

      if (statsError) {
        console.error("Stats error:", statsError);
        // Fallback to direct query
        await loadFamilyStatsFallback();
        return;
      }

      // Process and sort statistics
      const processedStats = (stats || []).map((stat, index) => ({
        ...stat,
        color: FAMILY_COLORS[index % FAMILY_COLORS.length],
        displayName: stat.family_name || "غير محدد",
      }));

      setFamilyStats(processedStats);
      setFilteredStats(processedStats);
    } catch (error) {
      console.error("Error loading family stats:", error);
      Alert.alert("خطأ", "فشل تحميل إحصائيات العائلات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadFamilyStatsFallback = async () => {
    try {
      // Get all Munasib profiles
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .is("hid", null)
        .order("name");

      if (error) throw error;

      // Get marriages for these profiles
      const profileIds = profiles.map((p) => p.id);
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

      // Add marriage counts
      Object.values(familyGroups).forEach((group) => {
        group.marriages = marriages.filter((m) =>
          group.profiles.some((p) => p.id === m.husband_id || p.id === m.wife_id)
        );
        group.activeMarriages = group.marriages.filter(
          (m) => m.status === "married"
        ).length;
        group.totalMarriages = group.marriages.length;
      });

      // Convert to array and sort
      const statsArray = Object.values(familyGroups)
        .map((group, index) => ({
          family_name: group.name,
          total_marriages: group.totalMarriages || group.count,
          active_marriages: group.activeMarriages || 0,
          male_spouses: group.males,
          female_spouses: group.females,
          generations: group.generations,
          color: FAMILY_COLORS[index % FAMILY_COLORS.length],
          displayName: group.name,
        }))
        .sort((a, b) => b.total_marriages - a.total_marriages);

      setFamilyStats(statsArray);
      setFilteredStats(statsArray);
    } catch (error) {
      console.error("Fallback error:", error);
      setFamilyStats([]);
      setFilteredStats([]);
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
      setLoading(true);

      // Get all marriages to this family
      const { data, error } = await supabase.rpc("get_marriages_by_family", {
        p_family_name: familyName,
      });

      if (error) {
        console.error("Error loading family members:", error);
        // Fallback query
        await loadFamilyMembersFallback(familyName);
        return;
      }

      setFamilyMembers(data || []);
    } catch (error) {
      console.error("Error:", error);
      Alert.alert("خطأ", "فشل تحميل تفاصيل العائلة");
    } finally {
      setLoading(false);
    }
  };

  const loadFamilyMembersFallback = async (familyName) => {
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
      const members = marriages.map((m) => {
        const isMunasibHusband = m.husband?.hid === null;
        const alqefariMember = isMunasibHusband ? m.wife : m.husband;
        const munasibSpouse = isMunasibHusband ? m.husband : m.wife;

        return {
          marriage_id: m.id,
          alqefari_member_id: alqefariMember?.id,
          alqefari_member_name: alqefariMember?.name || "غير معروف",
          alqefari_member_hid: alqefariMember?.hid,
          spouse_id: munasibSpouse?.id,
          spouse_name: munasibSpouse?.name || "غير معروف",
          spouse_family: munasibSpouse?.family_origin || familyName,
          marriage_status: m.status,
          marriage_date: m.start_date,
          is_active: m.status === "married",
        };
      });

      setFamilyMembers(members);
    } catch (error) {
      console.error("Fallback error:", error);
      setFamilyMembers([]);
    }
  };

  const handleFamilyPress = async (family) => {
    setSelectedFamily(family);
    await loadFamilyMembers(family.family_name);
    setShowDetailsModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleMemberPress = (member) => {
    const statusText =
      member.marriage_status === "married"
        ? "متزوج"
        : member.marriage_status === "divorced"
        ? "مطلق"
        : "أرمل";

    Alert.alert(
      member.alqefari_member_name,
      `${statusText} من ${member.spouse_name}\nمن عائلة ${member.spouse_family}\n${
        member.alqefari_member_hid ? `HID: ${member.alqefari_member_hid}` : ""
      }`,
      [
        {
          text: "إغلاق",
          style: "cancel",
        },
      ]
    );
  };

  const handleExportFamily = async (familyName) => {
    try {
      setExporting(true);
      // TODO: Implement family-specific export
      await pdfExportService.exportMunasibReport();
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert("خطأ", "فشل تصدير التقرير");
    } finally {
      setExporting(false);
    }
  };

  const renderFamilyCard = ({ item, index }) => {
    const percentage = Math.round(
      (item.total_marriages / (familyStats[0]?.total_marriages || 1)) * 100
    );

    return (
      <TouchableOpacity
        style={styles.familyCard}
        onPress={() => handleFamilyPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.familyHeader}>
          <View
            style={[styles.familyIcon, { backgroundColor: item.color + "20" }]}
          >
            <Text style={[styles.familyInitial, { color: item.color }]}>
              {item.displayName.charAt(0)}
            </Text>
          </View>
          <View style={styles.familyInfo}>
            <Text style={styles.familyName}>{item.displayName}</Text>
            <Text style={styles.familySubtitle}>
              {toArabicNumerals(item.total_marriages)} زواج
              {item.active_marriages > 0 &&
                ` (${toArabicNumerals(item.active_marriages)} نشط)`}
            </Text>
          </View>
          <View style={styles.familyStats}>
            <View
              style={[styles.percentageBadge, { borderColor: item.color }]}
            >
              <Text style={[styles.percentageText, { color: item.color }]}>
                {toArabicNumerals(percentage)}%
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </View>
        </View>

        <View style={styles.familyDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="male" size={16} color={colors.primary} />
            <Text style={styles.detailText}>
              {toArabicNumerals(item.male_spouses)} ذكور
            </Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailItem}>
            <Ionicons name="female" size={16} color={colors.accent} />
            <Text style={styles.detailText}>
              {toArabicNumerals(item.female_spouses)} إناث
            </Text>
          </View>
          {item.generations && item.generations.length > 0 && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailItem}>
                <Ionicons name="git-branch" size={16} color={colors.secondary} />
                <Text style={styles.detailText}>
                  أجيال {item.generations.map(toArabicNumerals).join("، ")}
                </Text>
              </View>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderMemberItem = ({ item }) => {
    const statusColor =
      item.marriage_status === "married"
        ? colors.success
        : item.marriage_status === "divorced"
        ? colors.warning
        : colors.textSecondary;

    const statusIcon =
      item.marriage_status === "married"
        ? "checkmark-circle"
        : item.marriage_status === "divorced"
        ? "close-circle"
        : "alert-circle";

    return (
      <TouchableOpacity
        style={styles.memberCard}
        onPress={() => handleMemberPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.memberHeader}>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{item.alqefari_member_name}</Text>
            <Text style={styles.memberHID}>{item.alqefari_member_hid || "—"}</Text>
          </View>
          <Ionicons name="heart" size={16} color={colors.primary} />
          <View style={styles.memberInfo}>
            <Text style={styles.spouseName}>{item.spouse_name}</Text>
            <Text style={styles.spouseFamily}>من عائلة {item.spouse_family}</Text>
          </View>
        </View>
        <View style={styles.memberStatus}>
          <Ionicons name={statusIcon} size={20} color={statusColor} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {item.marriage_status === "married"
              ? "متزوج"
              : item.marriage_status === "divorced"
              ? "مطلق"
              : "أرمل"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جارِ تحميل العائلات المتصلة...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>العائلات المتصلة</Text>
            <Text style={styles.subtitle}>
              {toArabicNumerals(filteredStats.length)} عائلة
            </Text>
          </View>
          <TouchableOpacity
            style={styles.exportButton}
            onPress={() => handleExportFamily(null)}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="download-outline" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
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
        </View>

        {/* Statistics Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {toArabicNumerals(
                familyStats.reduce((sum, f) => sum + f.total_marriages, 0)
              )}
            </Text>
            <Text style={styles.summaryLabel}>إجمالي الزواجات</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {toArabicNumerals(
                familyStats.reduce((sum, f) => sum + f.active_marriages, 0)
              )}
            </Text>
            <Text style={styles.summaryLabel}>زواجات نشطة</Text>
          </View>
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
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyText}>لا توجد عائلات متصلة</Text>
            </View>
          }
        />
      </Animated.View>

      {/* Family Details Modal */}
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowDetailsModal(false)}
              style={styles.modalBackButton}
            >
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitle}>
                عائلة {selectedFamily?.displayName}
              </Text>
              <Text style={styles.modalSubtitle}>
                {toArabicNumerals(familyMembers.length)} زواج
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalExportButton}
              onPress={() => handleExportFamily(selectedFamily?.family_name)}
              disabled={exporting}
            >
              <Ionicons name="share-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
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

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.container + "40",
  },
  backButton: {
    padding: 8,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  exportButton: {
    padding: 8,
  },

  // Search
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.container + "20",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.container + "40",
  },
  searchInput: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 16,
    color: colors.text,
    fontFamily: "SF Arabic",
  },

  // Summary
  summaryContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryCard: {
    flex: 1,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.primary,
    fontFamily: "SF Arabic",
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.container + "40",
    marginHorizontal: 16,
  },

  // Family Cards
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  familyCard: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.container + "20",
  },
  familyHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  familyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  familyInitial: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "SF Arabic",
  },
  familyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  familyName: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  familySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  familyStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  percentageBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    marginRight: 8,
  },
  percentageText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  familyDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.container + "20",
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  detailDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.container + "40",
    marginHorizontal: 12,
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
    borderBottomColor: colors.container + "40",
  },
  modalBackButton: {
    padding: 8,
  },
  modalTitleContainer: {
    flex: 1,
    marginLeft: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalExportButton: {
    padding: 8,
  },
  modalListContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 100,
  },

  // Member Cards
  memberCard: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  memberHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  memberHID: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  spouseName: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
    fontFamily: "SF Arabic",
    textAlign: "right",
  },
  spouseFamily: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: "right",
  },
  memberStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.container + "20",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
    fontFamily: "SF Arabic",
  },
});