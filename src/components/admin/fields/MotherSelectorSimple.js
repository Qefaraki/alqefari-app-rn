import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
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
  const dropdownHeight = useRef(new Animated.Value(0)).current;
  const dropdownOpacity = useRef(new Animated.Value(0)).current;

  // Load father's wives when component mounts or fatherId changes
  useEffect(() => {
    if (fatherId) {
      loadWives();
    }
  }, [fatherId]);

  // Set selected mother from value prop (only on initial load or value change from parent)
  useEffect(() => {
    if (wives.length > 0) {
      if (value) {
        const mother = wives.find((w) => w.wife_id === value);
        setSelectedMother(mother);
      } else {
        setSelectedMother(null);
      }
    }
  }, [value, wives]);

  // Removed auto-select - let user choose

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
        // Pass wives data to parent immediately after loading
        onChange(value, data);
      } else {
        // Fallback: try direct query
        const { data: marriages } = await supabase
          .from("marriages")
          .select("wife_id, wife_name, is_current, marriage_order")
          .eq("husband_id", fatherId)
          .order("marriage_order", { ascending: true });

        if (marriages) {
          setWives(marriages);
          // Pass wives data to parent immediately after loading
          onChange(value, marriages);
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
      // Closing
      Animated.parallel([
        Animated.timing(dropdownHeight, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(dropdownOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }),
      ]).start(() => setShowDropdown(false));
    } else {
      // Opening
      setShowDropdown(true);
      const height = Math.min(wives.length * 48, 200);
      Animated.parallel([
        Animated.timing(dropdownHeight, {
          toValue: height,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(dropdownOpacity, {
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
    onChange(wife?.wife_id || null, wives); // Pass wives data as second param
    toggleDropdown();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClear = (e) => {
    if (e) e.stopPropagation();
    setSelectedMother(null);
    onChange(null, wives); // Pass wives data even when clearing
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // If no father is selected, don't show anything
  if (!fatherId) {
    return null;
  }

  // If loading - show disabled state with text (no spinner)
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label || "الأم"}</Text>
        </View>
        <View style={[styles.selector, styles.disabledSelector]}>
          <Text style={styles.disabledText}>جاري التحميل...</Text>
        </View>
      </View>
    );
  }

  // If no wives available, show minimal state
  if (wives.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label || "الأم"}</Text>
        </View>
        <View style={[styles.selector, styles.disabledSelector]}>
          <Text style={styles.disabledText}>غير متاح</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label || "الأم"}</Text>
      </View>

      {/* Main Selector with PROPER RTL */}
      <View style={styles.selectorWrapper}>
        <TouchableOpacity
          style={[styles.selector, showDropdown && styles.selectorActive]}
          onPress={toggleDropdown}
          activeOpacity={0.7}
        >
          {/* RTL Container to force right-to-left */}
          <View style={styles.selectorContent}>
            {/* Text FIRST (will appear on right in RTL) */}
            <Text
              style={
                selectedMother ? styles.selectedText : styles.placeholderText
              }
              numberOfLines={1}
            >
              {selectedMother ? selectedMother.wife_name : "اختر الأم"}
            </Text>

            {/* Clear button SECOND (will appear in middle/left) */}
            {selectedMother && (
              <TouchableOpacity
                onPress={handleClear}
                style={styles.clearButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color="rgba(0,0,0,0.25)"
                />
              </TouchableOpacity>
            )}

            {/* Chevron LAST (will appear on far left in RTL) */}
            <Ionicons
              name={showDropdown ? "chevron-up" : "chevron-down"}
              size={16}
              color="rgba(0,0,0,0.3)"
            />
          </View>
        </TouchableOpacity>

        {/* Beautiful Dropdown */}
        {showDropdown && (
          <Animated.View
            style={[
              styles.dropdown,
              {
                height: dropdownHeight,
                opacity: dropdownOpacity,
              },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              bounces={false}
            >
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
                  activeOpacity={0.6}
                >
                  {/* Text FIRST for RTL */}
                  <Text
                    style={[
                      styles.optionText,
                      selectedMother?.wife_id === wife.wife_id &&
                        styles.optionTextSelected,
                    ]}
                  >
                    {wife.wife_name}
                  </Text>

                  {/* Badge LAST for RTL */}
                  {wife.is_current && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>الحالية</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    width: "100%",
  },
  labelRow: {
    flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
    justifyContent: "flex-start",
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    color: "rgba(0,0,0,0.5)",
    fontWeight: "500",
    textAlign: I18nManager.isRTL ? "right" : "left",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },

  selectorWrapper: {
    position: "relative",
    width: "100%",
  },

  // Main selector container
  selector: {
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  // Inner content with RTL-aware flex
  selectorContent: {
    flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  selectorActive: {
    backgroundColor: "#F2F2F2",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  disabledSelector: {
    opacity: 0.5,
    justifyContent: "flex-end",
  },
  selectedText: {
    fontSize: 16,
    color: "#000",
    flex: 1,
    textAlign: I18nManager.isRTL ? "right" : "left",
    fontWeight: "500",
    marginHorizontal: 8,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  placeholderText: {
    fontSize: 16,
    color: "rgba(0,0,0,0.3)",
    flex: 1,
    textAlign: I18nManager.isRTL ? "right" : "left",
    marginHorizontal: 8,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  disabledText: {
    fontSize: 16,
    color: "rgba(0,0,0,0.3)",
    textAlign: "right",
  },
  clearButton: {
    padding: 2,
  },

  // Dropdown styles
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    overflow: "hidden",
  },
  option: {
    flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  optionSelected: {
    backgroundColor: "#F8F8F8",
  },
  optionText: {
    fontSize: 15,
    color: "#000",
    textAlign: "right",
    flex: 1,
  },
  optionTextSelected: {
    fontWeight: "600",
  },
  currentBadge: {
    backgroundColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: I18nManager.isRTL ? 0 : 8,
    marginRight: I18nManager.isRTL ? 8 : 0,
  },
  currentBadgeText: {
    fontSize: 11,
    color: "rgba(0,0,0,0.6)",
    fontWeight: "600",
  },
});

export default MotherSelectorSimple;
