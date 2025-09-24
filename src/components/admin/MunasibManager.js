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
  Image,
  Alert,
  RefreshControl,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "../../services/supabase";
import { toArabicNumerals } from "../../utils/dateUtils";
import pdfExportService from "../../services/pdfExport";

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
};

// Desert palette for avatars
const AVATAR_COLORS = [
  "#A13333", // Najdi Crimson
  "#D58C4A", // Desert Ochre
  "#957EB5", // Lavender
  "#736372", // Muted Plum
  "#8B7355", // Desert Brown
];

export default function MunasibManager({ onBack }) {
  const [munasibProfiles, setMunasibProfiles] = useState([]);
  const [filteredProfiles, setFilteredProfiles] = useState([]);
  const [marriages, setMarriages] = useState([]);
  const [familyStats, setFamilyStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadMunasibData();

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
    filterProfiles();
  }, [searchQuery, selectedFamily, munasibProfiles]);

  const loadMunasibData = async () => {
    try {
      setLoading(true);

      // Fetch Munasib profiles (those without HID)
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .is("hid", null)
        .order("name");

      if (profilesError) throw profilesError;

      // Fetch marriages involving Munasib
      const { data: marriagesData, error: marriagesError } = await supabase
        .from("marriages")
        .select(
          `
          *,
          husband:profiles!marriages_husband_id_fkey(id, name, hid, photo_url, generation),
          wife:profiles!marriages_wife_id_fkey(id, name, hid, photo_url, generation)
        `
        )
        .or(`husband_id.in.(${profiles.map((p) => p.id).join(",")}),wife_id.in.(${profiles.map((p) => p.id).join(",")})`);

      if (marriagesError) throw marriagesError;

      // Process family statistics
      const familyGroups = {};
      profiles.forEach((profile) => {
        // Extract family name (last part of name)
        const familyName = profile.name?.split(" ").pop() || "غير محدد";
        if (!familyGroups[familyName]) {
          familyGroups[familyName] = {
            name: familyName,
            count: 0,
            males: 0,
            females: 0,
            profiles: [],
          };
        }
        familyGroups[familyName].count++;
        familyGroups[familyName].profiles.push(profile.id);

        if (profile.gender === "male") {
          familyGroups[familyName].males++;
        } else {
          familyGroups[familyName].females++;
        }
      });

      // Convert to array and sort by count
      const familyStatsArray = Object.values(familyGroups).sort(
        (a, b) => b.count - a.count
      );

      setMunasibProfiles(profiles || []);
      setMarriages(marriagesData || []);
      setFamilyStats(familyStatsArray);
      setFilteredProfiles(profiles || []);
    } catch (error) {
      console.error("Error loading Munasib data:", error);
      Alert.alert("خطأ", "فشل تحميل بيانات المنتسبين");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterProfiles = () => {
    let filtered = [...munasibProfiles];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (profile) =>
          profile.name?.toLowerCase().includes(query) ||
          profile.phone?.includes(query) ||
          profile.location?.toLowerCase().includes(query)
      );
    }

    // Filter by selected family
    if (selectedFamily) {
      filtered = filtered.filter((profile) => {
        const familyName = profile.name?.split(" ").pop();
        return familyName === selectedFamily;
      });
    }

    setFilteredProfiles(filtered);
  };

  const getMarriageInfo = (profileId) => {
    const marriage = marriages.find(
      (m) => m.husband_id === profileId || m.wife_id === profileId
    );

    if (!marriage) return null;

    const isMunasibHusband = marriage.husband_id === profileId;
    const spouse = isMunasibHusband ? marriage.wife : marriage.husband;

    // Check if spouse is from Al-Qefari (has HID)
    const isSpouseAlqefari = spouse?.hid !== null;

    return {
      spouse,
      isSpouseAlqefari,
      marriageDate: marriage.marriage_date,
    };
  };

  const handleProfilePress = (profile) => {
    const marriageInfo = getMarriageInfo(profile.id);

    Alert.alert(
      profile.name || "غير معروف",
      `${profile.gender === "male" ? "ذكر" : "أنثى"}${
        profile.generation ? ` - الجيل ${toArabicNumerals(profile.generation)}` : ""
      }${profile.phone ? `\nالهاتف: ${profile.phone}` : ""}${
        profile.location ? `\nالمكان: ${profile.location}` : ""
      }${
        marriageInfo
          ? `\n\n${profile.gender === "male" ? "متزوج من" : "متزوجة من"}: ${
              marriageInfo.spouse?.name || "غير معروف"
            }${
              marriageInfo.isSpouseAlqefari
                ? ` (من عائلة القفاري - ${marriageInfo.spouse.hid})`
                : " (منتسب)"
            }`
          : ""
      }`,
      [{ text: "حسناً", style: "default" }]
    );
  };

  const handleExportMunasib = async () => {
    try {
      setExporting(true);
      await pdfExportService.exportMunasibReport();
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setExporting(false);
    }
  };

  const renderFamilyCard = ({ item, index }) => {
    const isSelected = selectedFamily === item.name;
    const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];

    return (
      <TouchableOpacity
        style={[styles.familyCard, isSelected && styles.familyCardSelected]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedFamily(isSelected ? null : item.name);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.familyRank}>
          <Text style={styles.familyRankText}>{index + 1}</Text>
        </View>

        <View style={styles.familyContent}>
          <Text style={styles.familyName}>{item.name}</Text>
          <View style={styles.familyStats}>
            <Text style={styles.familyStat}>
              {toArabicNumerals(item.count)} فرد
            </Text>
            <Text style={styles.familyStatSeparator}>•</Text>
            <Text style={styles.familyStat}>
              {toArabicNumerals(item.males)} ذكر
            </Text>
            <Text style={styles.familyStatSeparator}>•</Text>
            <Text style={styles.familyStat}>
              {toArabicNumerals(item.females)} أنثى
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.familyPercentage,
            { backgroundColor: avatarColor + "20", borderColor: avatarColor },
          ]}
        >
          <Text style={[styles.familyPercentageText, { color: avatarColor }]}>
            {toArabicNumerals(
              Math.round((item.count / munasibProfiles.length) * 100)
            )}
            %
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderProfileCard = ({ item, index }) => {
    const marriageInfo = getMarriageInfo(item.id);
    const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
    const initials = item.name ? item.name.charAt(0) : "؟";

    return (
      <TouchableOpacity
        style={styles.profileCard}
        onPress={() => handleProfilePress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.profileContent}>
          {/* Avatar */}
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}

          {/* Profile Info */}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {item.name || "غير معروف"}
            </Text>
            <View style={styles.profileMeta}>
              <View style={styles.munasibBadge}>
                <Text style={styles.munasibBadgeText}>منتسب</Text>
              </View>
              {marriageInfo && marriageInfo.isSpouseAlqefari && (
                <>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.marriageText}>
                    متزوج{item.gender === "female" ? "ة" : ""} من القفاري
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Chevron */}
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textSecondary}
          />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>إدارة المنتسبين</Text>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleExportMunasib}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="download-outline" size={24} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadMunasibData();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Statistics Card */}
        <Animated.View
          style={[
            styles.statsCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.statsTitle}>إحصائيات المنتسبين</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {toArabicNumerals(munasibProfiles.length)}
              </Text>
              <Text style={styles.statLabel}>إجمالي المنتسبين</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {toArabicNumerals(familyStats.length)}
              </Text>
              <Text style={styles.statLabel}>عائلة مختلفة</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {toArabicNumerals(
                  marriages.filter(
                    (m) =>
                      (!m.husband?.hid && m.wife?.hid) ||
                      (m.husband?.hid && !m.wife?.hid)
                  ).length
                )}
              </Text>
              <Text style={styles.statLabel}>زواج من القفاري</Text>
            </View>
          </View>
        </Animated.View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color={colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث بالاسم أو الهاتف..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        {/* Top Families */}
        {!selectedFamily && searchQuery === "" && (
          <View style={styles.familiesSection}>
            <Text style={styles.sectionTitle}>العائلات الأكثر انتساباً</Text>
            <FlatList
              data={familyStats.slice(0, 5)}
              renderItem={renderFamilyCard}
              keyExtractor={(item) => item.name}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Selected Family or Search Results */}
        {(selectedFamily || searchQuery) && (
          <View style={styles.filterHeader}>
            {selectedFamily && (
              <TouchableOpacity
                style={styles.filterChip}
                onPress={() => setSelectedFamily(null)}
              >
                <Text style={styles.filterChipText}>عائلة {selectedFamily}</Text>
                <Ionicons name="close-circle" size={18} color={colors.primary} />
              </TouchableOpacity>
            )}
            <Text style={styles.filterResultCount}>
              {toArabicNumerals(filteredProfiles.length)} نتيجة
            </Text>
          </View>
        )}

        {/* Profiles List */}
        <View style={styles.profilesSection}>
          <Text style={styles.sectionTitle}>
            {selectedFamily
              ? `أفراد عائلة ${selectedFamily}`
              : searchQuery
              ? "نتائج البحث"
              : "جميع المنتسبين"}
          </Text>
          {filteredProfiles.length > 0 ? (
            <FlatList
              data={filteredProfiles}
              renderItem={renderProfileCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name="people-outline"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyText}>لا توجد نتائج</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: 34,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
    textAlign: "center",
    marginHorizontal: 16,
  },
  exportButton: {
    padding: 4,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Stats Card
  statsCard: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.accent,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: colors.container + "40",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },

  // Sections
  familiesSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  profilesSection: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
  },

  // Family Cards
  familyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.container + "20",
  },
  familyCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + "08",
  },
  familyRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent + "20",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  familyRankText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.accent,
  },
  familyContent: {
    flex: 1,
  },
  familyName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  familyStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  familyStat: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  familyStatSeparator: {
    marginHorizontal: 6,
    color: colors.textSecondary,
  },
  familyPercentage: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  familyPercentageText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Profile Cards
  profileCard: {
    backgroundColor: "white",
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.container + "20",
    overflow: "hidden",
  },
  profileContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "white",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  profileMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  munasibBadge: {
    backgroundColor: colors.accent + "20",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  munasibBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.accent,
  },
  metaDot: {
    marginHorizontal: 6,
    color: colors.textSecondary,
    fontSize: 10,
  },
  marriageText: {
    fontSize: 12,
    color: colors.secondary,
    fontWeight: "500",
  },

  // Filter
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary + "10",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "500",
    marginRight: 4,
  },
  filterResultCount: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: "auto",
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
  },
});