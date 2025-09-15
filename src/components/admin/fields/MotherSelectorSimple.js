import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  I18nManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "../../../services/supabase";

// Enable RTL
I18nManager.forceRTL(true);

const MotherSelectorSimple = ({ fatherId, value, onChange, label }) => {
  const [loading, setLoading] = useState(false);
  const [wives, setWives] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
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

  // Auto-select if only one wife
  useEffect(() => {
    if (wives.length === 1 && !value) {
      const singleWife = wives[0];
      setSelectedMother(singleWife);
      onChange(singleWife.wife_id);
    }
  }, [wives, value, onChange]);

  const loadWives = async () => {
    if (!fatherId) return;

    setLoading(true);
    try {
      // Get father's wives
      const { data, error } = await supabase.rpc("admin_get_person_wives", {
        p_person_id: fatherId,
      });

      if (!error && data) {
        setWives(data);
      } else {
        // Fallback: try direct query
        const { data: marriages } = await supabase
          .from("marriages")
          .select("wife_id, wife_name, is_current, marriage_order")
          .eq("husband_id", fatherId)
          .order("marriage_order", { ascending: true });

        if (marriages) {
          setWives(marriages);
        }
      }
    } catch (err) {
      console.error("Error loading wives:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (wife) => {
    setSelectedMother(wife);
    onChange(wife?.wife_id || null);
    setShowPicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClear = () => {
    setSelectedMother(null);
    onChange(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // If no father is selected, don't show anything
  if (!fatherId) {
    return null;
  }

  // If loading
  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label || "الأم (اختياري)"}</Text>
        <View style={styles.selector}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      </View>
    );
  }

  // If no wives available, show disabled state
  if (wives.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label || "الأم (اختياري)"}</Text>
        <View style={[styles.selector, styles.disabledSelector]}>
          <Text style={styles.placeholderText}>لا توجد زوجات مسجلة</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        <Text style={styles.label}>{label || "الأم (اختياري)"}</Text>

        {/* Main Selector Button */}
        <TouchableOpacity
          style={styles.selector}
          onPress={() => setShowPicker(true)}
          activeOpacity={0.7}
        >
          <View style={styles.selectorContent}>
            <Text
              style={
                selectedMother ? styles.selectedText : styles.placeholderText
              }
            >
              {selectedMother ? selectedMother.wife_name : "اختر الأم"}
            </Text>
            {selectedMother ? (
              <TouchableOpacity
                onPress={handleClear}
                style={styles.clearButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={20} color="#C7C7CC" />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-back" size={20} color="#C7C7CC" />
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* iOS-style Modal Picker */}
      <Modal
        visible={showPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPicker(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <SafeAreaView>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  onPress={() => setShowPicker(false)}
                  style={styles.modalCloseButton}
                >
                  <Text style={styles.modalCloseText}>إلغاء</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>اختر الأم</Text>
                <View style={styles.modalCloseButton}>
                  <Text style={[styles.modalCloseText, { opacity: 0 }]}>
                    إلغاء
                  </Text>
                </View>
              </View>

              {/* Options List */}
              <View style={styles.optionsList}>
                {/* Option to clear selection */}
                <TouchableOpacity
                  style={[
                    styles.option,
                    !selectedMother && styles.optionSelected,
                  ]}
                  onPress={() => {
                    handleClear();
                    setShowPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { fontStyle: "italic", color: "#8E8E93" },
                    ]}
                  >
                    بدون تحديد
                  </Text>
                  {!selectedMother && (
                    <Ionicons name="checkmark" size={22} color="#007AFF" />
                  )}
                </TouchableOpacity>

                {/* Wife Options */}
                {wives.map((wife, index) => (
                  <TouchableOpacity
                    key={wife.wife_id}
                    style={[
                      styles.option,
                      selectedMother?.wife_id === wife.wife_id &&
                        styles.optionSelected,
                      index === wives.length - 1 && styles.lastOption,
                    ]}
                    onPress={() => handleSelect(wife)}
                  >
                    <View style={styles.optionContent}>
                      <Text style={styles.optionText}>{wife.wife_name}</Text>
                      {wife.is_current && (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>الحالية</Text>
                        </View>
                      )}
                    </View>
                    {selectedMother?.wife_id === wife.wife_id && (
                      <Ionicons name="checkmark" size={22} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </SafeAreaView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  label: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 8,
    textAlign: "right",
  },
  selector: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  disabledSelector: {
    opacity: 0.5,
  },
  selectorContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedText: {
    fontSize: 17,
    color: "#000",
    flex: 1,
    textAlign: "right",
  },
  placeholderText: {
    fontSize: 17,
    color: "#C7C7CC",
    flex: 1,
    textAlign: "right",
  },
  clearButton: {
    marginLeft: 8,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#F2F2F7",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: "50%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 17,
    color: "#007AFF",
  },
  optionsList: {
    backgroundColor: "#FFFFFF",
    marginTop: 1,
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  lastOption: {
    borderBottomWidth: 0,
  },
  optionSelected: {
    backgroundColor: "#F9F9F9",
  },
  optionContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  optionText: {
    fontSize: 17,
    color: "#000",
    textAlign: "right",
  },
  currentBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  currentBadgeText: {
    fontSize: 12,
    color: "#2E7D32",
    fontWeight: "500",
  },
});

export default MotherSelectorSimple;
