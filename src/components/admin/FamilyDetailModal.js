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
import { supabase } from "../../services/supabase";
import { buildNameChain } from "../../utils/nameChainBuilder";
import { useTreeStore } from "../../stores/useTreeStore";
import SkeletonLoader from "../ui/SkeletonLoader";

// Skeleton loader for marriage cards
const MarriageCardSkeleton = () => (
  <View style={styles.memberCard}>
    <View style={styles.cardContent}>
      <View style={styles.personInfoContainer}>
        <SkeletonLoader width={140} height={20} style={{ marginBottom: 8 }} />
        <SkeletonLoader width={180} height={16} style={{ marginBottom: 4 }} />
        <SkeletonLoader width={100} height={14} />
      </View>
    </View>
  </View>
);

export default function FamilyDetailModal({ visible, family, onClose }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]); // For name chain building

  const { setSelectedPersonId } = useTreeStore();

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
    // Open the Al-Qefari member's profile
    if (member.alqefari?.id) {
      setSelectedPersonId(member.alqefari.id);
      onClose();
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        {/* Header with Count Badge */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#242121" />
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
            <Ionicons name="search" size={20} color="#24212160" />
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث عن شخص..."
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
                <Ionicons name="people-outline" size={64} color="#24212130" />
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

// Separate MarriageCard component for better organization and animations
const MarriageCard = ({ item, munasibName, alqefariChain, onPress, onWhatsAppPress }) => {
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
          styles.memberCard,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        <View style={styles.cardContent}>
          {/* Munasib Name (Full Name) */}
          <View style={styles.personInfoContainer}>
            <View style={styles.nameRow}>
              <Text style={styles.munasibName} numberOfLines={1}>
                {munasibName}
              </Text>
              {/* WhatsApp Button */}
              {item.munasib?.phone && (
                <TouchableOpacity
                  style={styles.whatsappButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    onWhatsAppPress(item.munasib.phone);
                  }}
                >
                  <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                </TouchableOpacity>
              )}
            </View>

            {/* Al-Qefari Name Chain with Inline Generation Badge */}
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
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3", // Al-Jass White
  },

  // Header with Count Badge
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -8,
  },
  titleContainer: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
    color: "#242121",
  },
  countBadge: {
    backgroundColor: "#A13333",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  countText: {
    fontSize: 15,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
    fontWeight: "700",
    color: "#F9F7F3",
  },

  // Search Bar - Matches MunasibManager
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
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
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
    marginHorizontal: 8,
    color: "#242121",
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 32,
  },

  // Marriage Card - Clean iOS Design
  memberCard: {
    backgroundColor: "#FFFFFF",
    marginVertical: 6,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContent: {
    padding: 20,
  },

  // Person Info Container
  personInfoContainer: {
    gap: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  munasibName: {
    flex: 1,
    fontSize: 20,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
    fontWeight: "600",
    color: "#242121",
  },

  // WhatsApp Button
  whatsappButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#25D36615",
    justifyContent: "center",
    alignItems: "center",
  },

  // Chain Row (text + generation inline)
  chainRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  // Chain Text
  chainText: {
    flex: 1,
    fontSize: 16,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
    color: "#242121B3",
    lineHeight: 24,
  },

  // Generation Badge - iOS Style (Inline, Subtle)
  generationBadge: {
    backgroundColor: "#D1BBA330",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  generationText: {
    fontSize: 11,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
    fontWeight: "500",
    color: "#24212199",
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    paddingTop: 120,
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
    fontWeight: "600",
    color: "#242121",
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
    color: "#24212160",
    textAlign: "center",
    lineHeight: 22,
  },
});
