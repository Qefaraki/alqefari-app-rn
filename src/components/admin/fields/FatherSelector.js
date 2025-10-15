import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Modal,
  
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import CardSurface from "../../ios/CardSurface";
import { supabase } from "../../../services/supabase";

const FatherSelector = ({
  value,
  onChange,
  label,
  currentProfileId,
  currentGeneration,
}) => {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [fathers, setFathers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedFather, setSelectedFather] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  // Load current father if value is provided
  useEffect(() => {
    if (value) {
      loadFather(value);
    }
  }, [value]);

  const loadFather = async (fatherId) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, hid, generation")
        .eq("id", fatherId)
        .single();

      if (!error && data) {
        setSelectedFather(data);
      }
    } catch (error) {
      console.error("Error loading father:", error);
    }
  };

  const searchFathers = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      // Search for male profiles that could be fathers (earlier generation)
      let queryBuilder = supabase
        .from("profiles")
        .select("id, name, hid, generation, photo_url")
        .eq("gender", "male")
        .is("deleted_at", null)
        .or(`name.ilike.%${query}%,hid.ilike.%${query}%`)
        .order("generation", { ascending: true })
        .limit(20);

      // If we have current generation, only show earlier generations
      if (currentGeneration) {
        queryBuilder = queryBuilder.lt("generation", currentGeneration);
      }

      // Exclude current profile to prevent self-parent
      if (currentProfileId) {
        queryBuilder = queryBuilder.neq("id", currentProfileId);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } else {
        // Check for circular relationships
        const validFathers = await filterCircularRelationships(data || []);
        setSearchResults(validFathers);
      }
    } catch (error) {
      console.error("Error searching fathers:", error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Filter out potential circular relationships
  const filterCircularRelationships = async (candidates) => {
    if (!currentProfileId) return candidates;

    // Check if any candidate is a descendant of current profile
    const validCandidates = [];
    for (const candidate of candidates) {
      const isDescendant = await checkIfDescendant(
        candidate.id,
        currentProfileId,
      );
      if (!isDescendant) {
        validCandidates.push(candidate);
      }
    }
    return validCandidates;
  };

  // Check if profileId is a descendant of ancestorId
  const checkIfDescendant = async (profileId, ancestorId) => {
    try {
      // Use recursive CTE to check ancestry
      const { data, error } = await supabase.rpc("is_descendant_of", {
        p_profile_id: profileId,
        p_ancestor_id: ancestorId,
      });

      return data || false;
    } catch (error) {
      console.error("Error checking descendant:", error);
      return false; // Assume not descendant if check fails
    }
  };

  const handleSelect = useCallback(
    (father) => {
      setSelectedFather(father);
      onChange(father.id);
      setShowModal(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    setSelectedFather(null);
    onChange(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onChange]);

  const openSelector = useCallback(() => {
    setShowModal(true);
    setSearchQuery("");
    setSearchResults([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchFathers(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label || "الأب"}</Text>

      <TouchableOpacity onPress={openSelector} activeOpacity={0.7}>
        <CardSurface>
          <View style={styles.selectorContent}>
            {loading ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : selectedFather ? (
              <View style={styles.selectedContent}>
                <View style={styles.selectedInfo}>
                  <Text style={styles.selectedName}>{selectedFather.name}</Text>
                  <Text style={styles.selectedMeta}>
                    HID: {selectedFather.hid} • الجيل:{" "}
                    {selectedFather.generation}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleClear}
                  style={styles.clearButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={20} color="#8A8A8E" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.placeholderContent}>
                <Text style={styles.placeholderText}>اختر الأب</Text>
                <Ionicons name="chevron-down" size={20} color="#8A8A8E" />
              </View>
            )}
          </View>
        </CardSurface>
      </TouchableOpacity>

      {/* Selection Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>اختر الأب</Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color="#8A8A8E" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="ابحث بالاسم أو HID..."
                  placeholderTextColor="#8A8A8E"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
              </View>
            </View>

            <ScrollView style={styles.modalBody}>
              {searching ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.loadingText}>جارِ البحث...</Text>
                </View>
              ) : searchResults.length === 0 && searchQuery ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color="#8A8A8E" />
                  <Text style={styles.emptyText}>لا توجد نتائج</Text>
                  <Text style={styles.emptyHint}>
                    جرب البحث باسم آخر أو HID
                  </Text>
                </View>
              ) : (
                searchResults.map((father) => {
                  const isSelected = selectedFather?.id === father.id;
                  return (
                    <TouchableOpacity
                      key={father.id}
                      style={[
                        styles.optionRow,
                        isSelected && styles.optionRowSelected,
                      ]}
                      onPress={() => handleSelect(father)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.optionInfo}>
                        <Text
                          style={[
                            styles.optionName,
                            isSelected && styles.optionNameSelected,
                          ]}
                        >
                          {father.name}
                        </Text>
                        <View style={styles.optionMeta}>
                          <Text style={styles.optionMetaText}>
                            HID: {father.hid}
                          </Text>
                          <Text style={styles.optionMetaText}>
                            الجيل: {father.generation}
                          </Text>
                        </View>
                      </View>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={24}
                          color="#007AFF"
                        />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: "#8A8A8E",
    marginBottom: 8,
    fontFamily: "SF Arabic Regular",
  },
  selectorContent: {
    padding: 16,
    minHeight: 56,
    justifyContent: "center",
  },
  selectedContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontSize: 17,
    color: "#000000",
    fontFamily: "SF Arabic Regular",
    marginBottom: 2,
  },
  selectedMeta: {
    fontSize: 14,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  clearButton: {
    padding: 4,
  },
  placeholderContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  placeholderText: {
    fontSize: 17,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F7FA",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  modalBody: {
    padding: 16,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 18,
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  emptyHint: {
    marginTop: 4,
    fontSize: 14,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F7F7FA",
    borderRadius: 12,
    marginBottom: 8,
  },
  optionRowSelected: {
    backgroundColor: "#E3F2FD",
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  optionInfo: {
    flex: 1,
  },
  optionName: {
    fontSize: 17,
    color: "#000000",
    fontFamily: "SF Arabic Regular",
    marginBottom: 4,
  },
  optionNameSelected: {
    color: "#007AFF",
    fontWeight: "500",
  },
  optionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionMetaText: {
    fontSize: 14,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
});

export default FatherSelector;
