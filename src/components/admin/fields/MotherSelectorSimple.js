import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
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
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const animatedOpacity = useRef(new Animated.Value(0)).current;

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

  const toggleDropdown = () => {
    if (showDropdown) {
      // Closing animation
      Animated.parallel([
        Animated.timing(animatedHeight, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }),
      ]).start(() => setShowDropdown(false));
    } else {
      // Opening animation
      setShowDropdown(true);
      Animated.parallel([
        Animated.timing(animatedHeight, {
          toValue: Math.min(wives.length * 56 + (selectedMother ? 56 : 0), 280),
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSelect = (wife) => {
    setSelectedMother(wife);
    onChange(wife?.wife_id || null);
    toggleDropdown();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClear = () => {
    setSelectedMother(null);
    onChange(null);
    toggleDropdown();
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

      {/* Main Selector Button - Beautiful iOS style */}
      <TouchableOpacity
        style={[styles.selector, showDropdown && styles.selectorActive]}
        onPress={toggleDropdown}
        activeOpacity={0.95}
      >
        <View style={styles.selectorContent}>
          {/* Text on the RIGHT side for RTL */}
          <Text
            style={
              selectedMother ? styles.selectedText : styles.placeholderText
            }
          >
            {selectedMother ? selectedMother.wife_name : "اختر الأم"}
          </Text>

          {/* Icons on the LEFT side for RTL */}
          <View style={styles.iconsContainer}>
            {selectedMother && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                style={styles.clearButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={20}
                  color="#8E8E93"
                />
              </TouchableOpacity>
            )}
            <Ionicons
              name={showDropdown ? "chevron-up" : "chevron-down"}
              size={18}
              color="#8E8E93"
              style={styles.chevron}
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* Beautiful Animated Dropdown */}
      {showDropdown && (
        <Animated.View
          style={[
            styles.dropdown,
            {
              height: animatedHeight,
              opacity: animatedOpacity,
            },
          ]}
        >
          {/* Option to clear selection */}
          {selectedMother && (
            <TouchableOpacity
              style={styles.clearOption}
              onPress={handleClear}
              activeOpacity={0.7}
            >
              <Text style={styles.clearOptionText}>إلغاء التحديد</Text>
              <View style={styles.clearIcon}>
                <Ionicons name="close" size={18} color="#FF3B30" />
              </View>
            </TouchableOpacity>
          )}

          {/* Wife Options */}
          {wives.map((wife) => (
            <TouchableOpacity
              key={wife.wife_id}
              style={[
                styles.option,
                selectedMother?.wife_id === wife.wife_id &&
                  styles.optionSelected,
              ]}
              onPress={() => handleSelect(wife)}
              activeOpacity={0.7}
            >
              <View style={styles.optionContent}>
                {/* Text on RIGHT */}
                <Text
                  style={[
                    styles.optionText,
                    selectedMother?.wife_id === wife.wife_id &&
                      styles.optionTextSelected,
                  ]}
                >
                  {wife.wife_name}
                </Text>

                {/* Badge and checkmark on LEFT */}
                <View style={styles.optionLeftContent}>
                  {wife.is_current && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>الحالية</Text>
                    </View>
                  )}
                  {selectedMother?.wife_id === wife.wife_id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#007AFF"
                      style={styles.checkmark}
                    />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>
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
    fontWeight: "500",
  },

  // Main selector styles
  selector: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "#E5E5EA",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  selectorActive: {
    borderColor: "#007AFF",
    backgroundColor: "#FAFAFA",
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  disabledSelector: {
    opacity: 0.5,
    backgroundColor: "#F2F2F7",
  },
  selectorContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedText: {
    fontSize: 16,
    color: "#000",
    flex: 1,
    textAlign: "right",
    fontWeight: "500",
  },
  placeholderText: {
    fontSize: 16,
    color: "#8E8E93",
    flex: 1,
    textAlign: "right",
  },
  iconsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  clearButton: {
    marginLeft: 8,
  },
  chevron: {
    marginLeft: 4,
  },

  // Dropdown styles
  dropdown: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    overflow: "hidden",
  },

  // Clear option
  clearOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFF5F5",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#FFE5E5",
  },
  clearOptionText: {
    fontSize: 15,
    color: "#FF3B30",
    textAlign: "right",
    flex: 1,
  },
  clearIcon: {
    marginRight: 8,
  },

  // Regular options
  option: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F2F2F7",
  },
  optionSelected: {
    backgroundColor: "#F0F9FF",
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionText: {
    fontSize: 16,
    color: "#000",
    textAlign: "right",
    flex: 1,
  },
  optionTextSelected: {
    color: "#007AFF",
    fontWeight: "600",
  },
  optionLeftContent: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  currentBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  currentBadgeText: {
    fontSize: 11,
    color: "#2E7D32",
    fontWeight: "600",
  },
  checkmark: {
    marginLeft: 4,
  },
});

export default MotherSelectorSimple;
