import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Modal,
  SafeAreaView,
  I18nManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import CardSurface from "../../ios/CardSurface";
import { supabase } from "../../../services/supabase";

// Enable RTL
I18nManager.forceRTL(true);

const MotherSelector = ({ fatherId, value, onChange, label }) => {
  const [loading, setLoading] = useState(false);
  const [wives, setWives] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedMother, setSelectedMother] = useState(null);

  // Load father's wives when component mounts or fatherId changes
  useEffect(() => {
    if (fatherId) {
      loadWives();
    }
  }, [fatherId]);

  // Set selected mother from value prop
  useEffect(() => {
    if (value && wives.length > 0) {
      const mother = wives.find((w) => w.wife_id === value);
      setSelectedMother(mother);
    }
  }, [value, wives]);

  const loadWives = async () => {
    if (!fatherId) return;

    setLoading(true);
    try {
      // Get father's wives using the admin function
      const { data, error } = await supabase.rpc("admin_get_person_wives", {
        p_person_id: fatherId,
      });

      if (error) {
        console.error("Error loading wives:", error);
        // If admin function fails, try getting marriages directly
        const { data: marriages, error: marriagesError } = await supabase
          .from("marriages")
          .select(
            `
            id,
            wife_id,
            status,
            wife:profiles!marriages_wife_id_fkey(
              id,
              name
            )
          `,
          )
          .eq("husband_id", fatherId)
          .order("created_at", { ascending: false });

        if (marriagesError) {
          console.error("Error loading marriages:", marriagesError);
          setWives([]);
        } else {
          // Transform the data to match expected format
          const transformedWives = (marriages || []).map((m) => ({
            id: m.id,
            wife_id: m.wife?.id,
            wife_name: m.wife?.name || "غير معروف",
            status: m.status,
            is_current: m.status === "married", // Derive from status
            children_count: 0, // We'll update this if needed
          }));
          setWives(transformedWives);
        }
      } else {
        setWives(data || []);
      }
    } catch (error) {
      console.error("Error in loadWives:", error);
      setWives([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = useCallback(
    (mother) => {
      setSelectedMother(mother);
      onChange(mother.wife_id);
      setShowModal(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    setSelectedMother(null);
    onChange(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onChange]);

  const openSelector = useCallback(() => {
    setShowModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // If no father is selected, show a message
  if (!fatherId) {
    return (
      <View style={styles.container}>
        <View style={{ width: "100%", alignItems: "flex-end" }}>
          <Text style={styles.label}>{label || "الأم"}</Text>
        </View>
        <CardSurface>
          <View style={styles.disabledContent}>
            <Text style={styles.disabledText}>يجب اختيار الأب أولاً</Text>
          </View>
        </CardSurface>
      </View>
    );
  }

  // If there are no wives for this father, show option to add
  if (!loading && wives.length === 0) {
    return (
      <View style={styles.container}>
        <View style={{ width: "100%", alignItems: "flex-end" }}>
          <Text style={styles.label}>{label || "الأم"}</Text>
        </View>
        <CardSurface>
          <View style={styles.noWivesContent}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#8A8A8E"
            />
            <Text style={styles.noWivesText}>
              لا توجد زوجات مسجلة لهذا الأب
            </Text>
          </View>
        </CardSurface>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={{ width: "100%", alignItems: "flex-end" }}>
        <Text style={styles.label}>{label || "الأم"}</Text>
      </View>

      <TouchableOpacity onPress={openSelector} activeOpacity={0.7}>
        <CardSurface>
          <View style={styles.selectorContent}>
            {loading ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : selectedMother ? (
              <View style={styles.selectedContent}>
                <View style={styles.selectedInfo}>
                  <Text style={styles.selectedName}>
                    {selectedMother.wife_name}
                  </Text>
                  {selectedMother.is_current && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>حالية</Text>
                    </View>
                  )}
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
                <Text style={styles.placeholderText}>اختر الأم</Text>
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
              <Text style={styles.modalTitle}>اختر الأم</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalBody}>
              {wives.map((wife) => {
                const isSelected = selectedMother?.wife_id === wife.wife_id;
                return (
                  <TouchableOpacity
                    key={wife.wife_id}
                    style={[
                      styles.optionRow,
                      isSelected && styles.optionRowSelected,
                    ]}
                    onPress={() => handleSelect(wife)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionInfo}>
                      <Text
                        style={[
                          styles.optionName,
                          isSelected && styles.optionNameSelected,
                        ]}
                      >
                        {wife.wife_name}
                      </Text>
                      <View style={styles.optionMeta}>
                        {wife.is_current ? (
                          <View style={styles.currentIndicator}>
                            <Text style={styles.currentIndicatorText}>
                              زوجة حالية
                            </Text>
                          </View>
                        ) : (
                          <Text style={styles.optionStatus}>
                            {wife.status === "divorced"
                              ? "مطلقة"
                              : wife.status === "widowed"
                                ? "أرملة"
                                : "سابقة"}
                          </Text>
                        )}
                        {wife.children_count > 0 && (
                          <Text style={styles.childrenCount}>
                            {wife.children_count} أطفال
                          </Text>
                        )}
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
              })}
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
    width: "100%",
  },
  label: {
    fontSize: 14,
    color: "#8A8A8E",
    marginBottom: 8,
    fontFamily: "SF Arabic Regular",
    textAlign: "right",
    alignSelf: "flex-end", // This will put the label on the right
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectedName: {
    fontSize: 17,
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  currentBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentBadgeText: {
    fontSize: 12,
    color: "#2E7D32",
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
  disabledContent: {
    padding: 16,
    alignItems: "center",
  },
  disabledText: {
    fontSize: 16,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  noWivesContent: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  noWivesText: {
    fontSize: 16,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
    flex: 1,
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
  modalBody: {
    padding: 16,
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
  optionStatus: {
    fontSize: 14,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  currentIndicator: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentIndicatorText: {
    fontSize: 12,
    color: "#2E7D32",
    fontFamily: "SF Arabic Regular",
  },
  childrenCount: {
    fontSize: 14,
    color: "#666666",
    fontFamily: "SF Arabic Regular",
  },
});

export default MotherSelector;
