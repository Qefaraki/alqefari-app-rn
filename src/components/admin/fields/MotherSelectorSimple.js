import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
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
  const [showDropdown, setShowDropdown] = useState(false);
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
    setShowDropdown(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClear = () => {
    setSelectedMother(null);
    onChange(null);
    setShowDropdown(false);
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
    <View style={styles.container}>
      <Text style={styles.label}>{label || "الأم (اختياري)"}</Text>

      {/* Main Selector Button */}
      <TouchableOpacity
        style={[styles.selector, showDropdown && styles.selectorActive]}
        onPress={() => setShowDropdown(!showDropdown)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={showDropdown ? "chevron-up" : "chevron-down"}
          size={20}
          color="#8E8E93"
        />
        <Text
          style={selectedMother ? styles.selectedText : styles.placeholderText}
        >
          {selectedMother ? selectedMother.wife_name : "اختر الأم"}
        </Text>
        {selectedMother && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            style={styles.clearButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={18} color="#C7C7CC" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Dropdown */}
      {showDropdown && (
        <View style={styles.dropdown}>
          <ScrollView
            style={styles.dropdownScroll}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={false}
          >
            {/* Option to clear selection */}
            {selectedMother && (
              <TouchableOpacity style={styles.option} onPress={handleClear}>
                <Text style={[styles.optionText, styles.clearOptionText]}>
                  إلغاء التحديد
                </Text>
              </TouchableOpacity>
            )}

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
                  {wife.is_current && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>الحالية</Text>
                    </View>
                  )}
                  <Text
                    style={[
                      styles.optionText,
                      selectedMother?.wife_id === wife.wife_id &&
                        styles.optionTextSelected,
                    ]}
                  >
                    {wife.wife_name}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    zIndex: 1000,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  selectorActive: {
    borderColor: "#007AFF",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  disabledSelector: {
    opacity: 0.5,
  },
  selectedText: {
    fontSize: 17,
    color: "#000",
    flex: 1,
    textAlign: "right",
    marginHorizontal: 8,
  },
  placeholderText: {
    fontSize: 17,
    color: "#C7C7CC",
    flex: 1,
    textAlign: "right",
    marginHorizontal: 8,
  },
  clearButton: {
    marginRight: 8,
  },

  // Dropdown styles
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#007AFF",
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    maxHeight: 200,
    zIndex: 1001,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  lastOption: {
    borderBottomWidth: 0,
  },
  optionSelected: {
    backgroundColor: "#F0F9FF",
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  optionText: {
    fontSize: 16,
    color: "#000",
    textAlign: "right",
  },
  optionTextSelected: {
    color: "#007AFF",
    fontWeight: "500",
  },
  clearOptionText: {
    color: "#8E8E93",
    fontStyle: "italic",
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
