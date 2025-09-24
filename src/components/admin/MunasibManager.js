import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  FlatList,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "../../services/supabase";
import { buildNameChain } from "../../utils/nameChainBuilder";
import FamilyDetailModal from "./FamilyDetailModal";

export default function MunasibManager({ visible, onClose }) {
  const [familyStats, setFamilyStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredStats, setFilteredStats] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [showFamilyDetail, setShowFamilyDetail] = useState(false);

  useEffect(() => {
    if (visible) {
      loadFamilyStats();
    }
  }, [visible]);

  useEffect(() => {
    filterFamilies();
  }, [searchQuery, familyStats]);

  const loadFamilyStats = async () => {
    try {
      setLoading(true);

      // Get all Munasib profiles with family_origin
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .is("hid", null)
        .not("family_origin", "is", null);

      if (error) throw error;

      // Group by family_origin
      const familyGroups = {};
      profiles?.forEach((profile) => {
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

  const renderFamilyCard = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.familyCard}
        onPress={() => handleFamilyPress(item)}
        activeOpacity={0.95}
      >
        <View style={styles.familyContent}>
          <Text style={styles.familyName} numberOfLines={1}>
            عائلة {item.family_name}
          </Text>
          <View style={styles.familyRight}>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{item.count}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#24212160" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#242121" />
          </TouchableOpacity>
          <Text style={styles.title}>عائلات المناسيب</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Search Bar */}
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
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={20} color="#24212160" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stats Summary */}
        {!loading && (
          <View style={styles.statsContainer}>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>إجمالي العائلات</Text>
              <Text style={styles.statValue}>{familyStats.length}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>إجمالي الأفراد</Text>
              <Text style={styles.statValue}>
                {familyStats.reduce((sum, f) => sum + f.count, 0)}
              </Text>
            </View>
          </View>
        )}

        {/* Family List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#A13333" />
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3", // Al-Jass White
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#D1BBA340", // Camel Hair Beige 40%
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#242121", // Sadu Night
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D1BBA320", // Camel Hair Beige 20%
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "SF Arabic",
    marginHorizontal: 8,
    color: "#242121",
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D1BBA320",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: "#24212199", // Sadu Night 60%
  },
  statValue: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    fontWeight: "600",
    color: "#242121",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  familyCard: {
    backgroundColor: "#F9F7F3",
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1BBA340",
    overflow: "hidden",
  },
  familyContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    height: 64, // Fixed height for compact cards
  },
  familyName: {
    flex: 1,
    fontSize: 17,
    fontFamily: "SF Arabic",
    fontWeight: "500",
    color: "#242121",
  },
  familyRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  countBadge: {
    backgroundColor: "#A13333", // Najdi Crimson
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 32,
    alignItems: "center",
  },
  countText: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    fontWeight: "600",
    color: "#F9F7F3", // Al-Jass White
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
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
