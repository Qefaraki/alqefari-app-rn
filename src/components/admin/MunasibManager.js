import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  Platform,
  Image,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "../../services/supabase";
import { buildNameChain } from "../../utils/nameChainBuilder";
import FamilyDetailModal from "./FamilyDetailModal";
import SkeletonLoader from "../ui/SkeletonLoader";

// Separate FamilyCard component to properly use hooks
const FamilyCard = ({ item, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

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
          styles.familyCard,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        <View style={styles.familyContent}>
          <Text style={styles.familyName} numberOfLines={1}>
            عائلة {item.family_name}
          </Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{item.count}</Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Skeleton loader for stats card
const StatsCardSkeleton = () => (
  <View style={styles.statsContainer}>
    <View style={styles.statsCard}>
      <View style={styles.statItem}>
        <SkeletonLoader width={48} height={48} borderRadius={24} />
        <View style={styles.statTextContainer}>
          <SkeletonLoader width={40} height={22} style={{ marginBottom: 4 }} />
          <SkeletonLoader width={100} height={13} />
        </View>
      </View>

      <View style={styles.statDivider} />

      <View style={styles.statItem}>
        <SkeletonLoader width={48} height={48} borderRadius={24} />
        <View style={styles.statTextContainer}>
          <SkeletonLoader width={40} height={22} style={{ marginBottom: 4 }} />
          <SkeletonLoader width={100} height={13} />
        </View>
      </View>
    </View>
  </View>
);

// Skeleton loader for family cards
const FamilyCardSkeleton = () => (
  <View style={styles.familyCard}>
    <View style={styles.familyContent}>
      <SkeletonLoader width="60%" height={20} />
      <SkeletonLoader width={44} height={36} borderRadius={14} />
    </View>
  </View>
);

export default function MunasibManager({ onClose }) {
  const [familyStats, setFamilyStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredStats, setFilteredStats] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [showFamilyDetail, setShowFamilyDetail] = useState(false);

  useEffect(() => {
    loadFamilyStats();
  }, []);

  useEffect(() => {
    filterFamilies();
  }, [searchQuery, familyStats]);

  const loadFamilyStats = async () => {
    try {
      setLoading(true);

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
      setFilteredStats(statsArray);
    } catch (error) {
      console.error("Error loading family stats:", error);
    } finally {
      setLoading(false);
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
        {/* Header - Standard Pattern with Emblem */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Image
              source={require('../../../assets/logo/AlqefariEmblem.png')}
              style={styles.emblem}
              resizeMode="contain"
            />
            <View style={styles.titleContent}>
              <Text style={styles.title}>المناسبين</Text>
            </View>
            {onClose && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                }}
                style={styles.backButton}
              >
                <Ionicons name="chevron-back" size={28} color="#242121" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search Bar - Enhanced */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#24212160" />
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث عن عائلة..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#24212160"
            />
            {searchQuery !== "" && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Ionicons name="close-circle" size={20} color="#24212160" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stats Summary - Prominent Cards or Skeleton */}
        {loading ? (
          <StatsCardSkeleton />
        ) : (
          <View style={styles.statsContainer}>
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="albums-outline" size={24} color="#D58C4A" />
                </View>
                <View style={styles.statTextContainer}>
                  <Text style={styles.statValue}>{familyStats.length}</Text>
                  <Text style={styles.statLabel}>إجمالي العائلات</Text>
                </View>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="people-outline" size={24} color="#A13333" />
                </View>
                <View style={styles.statTextContainer}>
                  <Text style={styles.statValue}>
                    {familyStats.reduce((sum, f) => sum + f.count, 0)}
                  </Text>
                  <Text style={styles.statLabel}>إجمالي الأفراد</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Family List */}
        {loading ? (
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
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color="#24212140" />
                <Text style={styles.emptyText}>لا توجد عائلات</Text>
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
        />
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3", // Al-Jass White
  },

  // Header - Standard Pattern
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
  emblem: {
    width: 52,
    height: 52,
    tintColor: "#242121",
    marginRight: 3,
    marginTop: -5,
    marginLeft: -5,
  },
  titleContent: {
    flex: 1,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#242121",
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
  },
  backButton: {
    padding: 8,
    marginLeft: 8,
    marginRight: -8,
  },

  // Search Bar - Enhanced
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "SF Arabic",
    marginHorizontal: 8,
    color: "#242121",
  },

  // Stats Container - Prominent Cards
  statsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  statsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#D1BBA320",
    justifyContent: "center",
    alignItems: "center",
  },
  statTextContainer: {
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontFamily: "SF Arabic",
    fontWeight: "700",
    color: "#242121",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: "#24212199", // Sadu Night 60%
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#D1BBA340",
    marginHorizontal: 16,
  },

  // Family List
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },

  // Family Cards - Enhanced
  familyCard: {
    backgroundColor: "#FFFFFF",
    marginVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D1BBA340",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  familyContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 20,
    paddingHorizontal: 20,
    minHeight: 88,
  },
  familyName: {
    flex: 1,
    fontSize: 20,
    fontFamily: "SF Arabic",
    fontWeight: "600",
    color: "#242121",
  },
  countBadge: {
    backgroundColor: "#A13333", // Najdi Crimson
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    minWidth: 44,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: 17,
    fontFamily: "SF Arabic",
    fontWeight: "700",
    color: "#F9F7F3", // Al-Jass White
  },

  // Loading & Empty States
  emptyContainer: {
    flex: 1,
    paddingTop: 100,
    alignItems: "center",
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: "SF Arabic",
    color: "#24212160",
  },
});
