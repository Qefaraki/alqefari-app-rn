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
import { useTreeStore } from "../../stores/useTreeStore";

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
        .select("id, name, father_id, gender");

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
          husband:profiles!marriages_husband_id_fkey(id, name, hid, father_id, gender, generation),
          wife:profiles!marriages_wife_id_fkey(id, name, hid, father_id, gender, generation)
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

  const renderMemberCard = ({ item }) => {
    // Get Munasib name (spouse from other family)
    const munasibName = item.munasib ? item.munasib.name : "غير معروف";

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
      <TouchableOpacity
        style={styles.memberCard}
        onPress={() => handleMemberPress(item)}
        activeOpacity={0.95}
      >
        <View style={styles.memberContent}>
          <View style={styles.memberInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.munasibName} numberOfLines={1}>
                {munasibName}
              </Text>
              <Ionicons
                name="link-outline"
                size={16}
                color="#A13333"
                style={styles.linkIcon}
              />
            </View>
            <Text style={styles.alqefariName} numberOfLines={2}>
              {alqefariChain || "غير معروف"}
            </Text>
            {item.status === "divorced" && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>منفصل</Text>
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color="#24212160" />
        </View>
      </TouchableOpacity>
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#242121" />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>عائلة {family.family_name}</Text>
            <Text style={styles.subtitle}>{family.count} فرد</Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        {/* Search Bar */}
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
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={20} color="#24212160" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Members List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#A13333" />
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
                <Ionicons name="people-outline" size={48} color="#24212140" />
                <Text style={styles.emptyText}>لا توجد علاقات عائلية نشطة</Text>
              </View>
            }
          />
        )}
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
  titleContainer: {
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#242121", // Sadu Night
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    color: "#24212199", // Sadu Night 60%
    marginTop: 2,
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
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  memberCard: {
    backgroundColor: "#F9F7F3",
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1BBA340",
    overflow: "hidden",
  },
  memberContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  memberInfo: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  munasibName: {
    fontSize: 17,
    fontFamily: "SF Arabic",
    fontWeight: "600",
    color: "#242121",
  },
  linkIcon: {
    marginHorizontal: 8,
  },
  alqefariName: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    color: "#24212199", // Sadu Night 60%
    marginTop: 4,
    lineHeight: 20,
  },
  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#24212110",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "SF Arabic",
    color: "#242121",
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
