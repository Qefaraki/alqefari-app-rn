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
      {/* Munasib Section */}
      <View style={styles.personSection}>
        <View style={styles.personRow}>
          <SkeletonLoader width={40} height={40} borderRadius={20} />
          <View style={styles.nameColumn}>
            <SkeletonLoader width={140} height={18} style={{ marginBottom: 6 }} />
            <SkeletonLoader width={100} height={14} />
          </View>
        </View>
      </View>

      {/* Marriage Connection Icon */}
      <View style={styles.connectionSection}>
        <View style={styles.connectionIconContainer}>
          <SkeletonLoader width={32} height={32} borderRadius={16} />
        </View>
      </View>

      {/* Al-Qefari Section */}
      <View style={styles.personSection}>
        <View style={styles.personRow}>
          <SkeletonLoader width={40} height={40} borderRadius={20} />
          <View style={styles.nameColumn}>
            <SkeletonLoader width={160} height={18} style={{ marginBottom: 6 }} />
            <View style={styles.badgeRow}>
              <SkeletonLoader width={60} height={20} borderRadius={10} />
            </View>
          </View>
        </View>
      </View>

      {/* Chevron */}
      <SkeletonLoader width={20} height={20} borderRadius={4} />
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

      // Get ALL profiles to build chains properly (like ProfileSheet does)
      const { data: allProfilesData } = await supabase
        .from("profiles")
        .select("id, name, father_id, gender, generation, phone");

      // Create a Map for O(1) lookups like ProfileSheet
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
    const munasibOrigin = item.munasib?.family_origin || "";

    // Build full name chain for Al-Qefari member (like ProfileSheet does)
    let alqefariChain = "";
    if (item.alqefari) {
      const names = [];
      let currentId = item.alqefari.id;

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

      // Build the chain with proper connector
      if (names.length > 1) {
        const connector = item.alqefari.gender === "female" ? "بنت" : "بن";
        // Join all names with the connector for the first relationship
        alqefariChain = names[0] + " " + connector + " " + names.slice(1).join(" ");
      } else {
        alqefariChain = names.join(" ");
      }
    }

    return (
      <MarriageCard
        item={item}
        munasibName={munasibName}
        munasibOrigin={munasibOrigin}
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
        {/* Header - Refined */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#242121" />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>عائلة {family.family_name}</Text>
            <Text style={styles.subtitle}>
              {filteredMembers.length} علاقة زواج
            </Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        {/* Search Bar - Enhanced */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={22} color="#24212160" />
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
                <Ionicons name="close-circle" size={22} color="#24212160" />
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
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="heart-dislike-outline" size={64} color="#24212130" />
                </View>
                <Text style={styles.emptyTitle}>لا توجد علاقات زواج</Text>
                <Text style={styles.emptySubtitle}>
                  سيتم عرض علاقات الزواج هنا عند إضافتها
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
const MarriageCard = ({ item, munasibName, munasibOrigin, alqefariChain, onPress, onWhatsAppPress }) => {
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

  const getStatusConfig = (status) => {
    if (status === "divorced") {
      return {
        label: "منفصل",
        color: "#24212160",
        backgroundColor: "#24212110",
      };
    }
    // Default for "current" or any other status
    return {
      label: "نشط",
      color: "#D58C4A",
      backgroundColor: "#D58C4A20",
    };
  };

  const statusConfig = getStatusConfig(item.status);

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
          {/* Munasib Section (Top) */}
          <View style={styles.personSection}>
            <View style={styles.personRow}>
              {/* Profile Photo Placeholder */}
              <View style={[
                styles.photoPlaceholder,
                { backgroundColor: item.munasib?.gender === "male" ? "#A1333320" : "#D58C4A20" }
              ]}>
                <Ionicons
                  name={item.munasib?.gender === "male" ? "man" : "woman"}
                  size={20}
                  color={item.munasib?.gender === "male" ? "#A13333" : "#D58C4A"}
                />
              </View>

              <View style={styles.nameColumn}>
                <View style={styles.nameWithGender}>
                  <Text style={styles.personName} numberOfLines={1}>
                    {munasibName}
                  </Text>
                  <View style={styles.genderBadge}>
                    <Text style={styles.genderText}>
                      {item.munasib?.gender === "male" ? "♂" : "♀"}
                    </Text>
                  </View>
                </View>
                {munasibOrigin ? (
                  <Text style={styles.originText} numberOfLines={1}>
                    {munasibOrigin}
                  </Text>
                ) : null}
              </View>

              {/* WhatsApp Button */}
              {item.munasib?.phone && (
                <TouchableOpacity
                  style={styles.whatsappButton}
                  onPress={() => onWhatsAppPress(item.munasib.phone)}
                >
                  <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Marriage Connection Icon (Center) */}
          <View style={styles.connectionSection}>
            <View style={styles.connectionIconContainer}>
              <Ionicons name="heart" size={20} color="#A13333" />
            </View>
            <View style={styles.connectionLine} />
          </View>

          {/* Al-Qefari Section (Bottom) */}
          <View style={styles.personSection}>
            <View style={styles.personRow}>
              {/* Profile Photo Placeholder */}
              <View style={[
                styles.photoPlaceholder,
                { backgroundColor: item.alqefari?.gender === "male" ? "#A1333320" : "#D58C4A20" }
              ]}>
                <Ionicons
                  name={item.alqefari?.gender === "male" ? "man" : "woman"}
                  size={20}
                  color={item.alqefari?.gender === "male" ? "#A13333" : "#D58C4A"}
                />
              </View>

              <View style={styles.nameColumn}>
                <View style={styles.nameWithGender}>
                  <Text style={styles.personName} numberOfLines={1}>
                    {item.alqefari?.name || "غير معروف"}
                  </Text>
                  <View style={styles.genderBadge}>
                    <Text style={styles.genderText}>
                      {item.alqefari?.gender === "male" ? "♂" : "♀"}
                    </Text>
                  </View>
                </View>
                <View style={styles.badgeRow}>
                  {item.alqefari?.generation && (
                    <View style={styles.generationBadge}>
                      <Text style={styles.generationText}>
                        الجيل {item.alqefari.generation}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.backgroundColor }]}>
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Chevron Indicator */}
          <View style={styles.chevronContainer}>
            <Ionicons name="chevron-forward" size={22} color="#24212140" />
          </View>
        </View>

        {/* Full Name Chain at Bottom */}
        <View style={styles.chainContainer}>
          <Text style={styles.chainText} numberOfLines={2}>
            {alqefariChain || "غير معروف"}
          </Text>
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

  // Header - Refined (no border)
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  closeButton: {
    padding: 4,
  },
  titleContainer: {
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: "#242121", // Sadu Night
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    color: "#24212199", // Sadu Night 60%
    marginTop: 4,
  },

  // Search Bar - Enhanced
  searchContainer: {
    paddingHorizontal: 20,
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
    fontFamily: "SF Arabic",
    marginHorizontal: 8,
    color: "#242121",
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  // Marriage Card - Completely Redesigned
  memberCard: {
    backgroundColor: "#FFFFFF",
    marginVertical: 8,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  cardContent: {
    padding: 20,
    minHeight: 120,
  },

  // Person Section (Munasib or Al-Qefari)
  personSection: {
    marginBottom: 12,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  photoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  nameColumn: {
    flex: 1,
  },
  nameWithGender: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  personName: {
    fontSize: 18,
    fontFamily: "SF Arabic",
    fontWeight: "700",
    color: "#242121",
    flex: 1,
  },
  genderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#D1BBA340",
    justifyContent: "center",
    alignItems: "center",
  },
  genderText: {
    fontSize: 14,
    color: "#242121",
  },
  originText: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    color: "#242121B3", // 70% opacity
  },

  // WhatsApp Button
  whatsappButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#25D36610",
    justifyContent: "center",
    alignItems: "center",
  },

  // Badge Row
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  generationBadge: {
    backgroundColor: "#D58C4A20",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  generationText: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    fontWeight: "600",
    color: "#D58C4A",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    fontWeight: "600",
  },

  // Connection Section (Marriage Icon)
  connectionSection: {
    alignItems: "center",
    marginVertical: 12,
  },
  connectionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#A1333310",
    justifyContent: "center",
    alignItems: "center",
  },
  connectionLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#D1BBA340",
    zIndex: -1,
  },

  // Chevron Container
  chevronContainer: {
    position: "absolute",
    left: 16,
    top: "50%",
    marginTop: -11,
  },

  // Full Name Chain at Bottom
  chainContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#D1BBA320",
  },
  chainText: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: "#24212199",
    lineHeight: 20,
  },

  // Empty State - Enhanced
  emptyContainer: {
    flex: 1,
    paddingTop: 120,
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#D1BBA320",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "SF Arabic",
    fontWeight: "600",
    color: "#242121",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    color: "#24212160",
    textAlign: "center",
    lineHeight: 22,
  },
});
