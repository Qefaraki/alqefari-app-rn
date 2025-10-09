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
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "../../../services/supabase";
import { getShortNameChain } from "../../../utils/nameChainUtils";

// Enable RTL
I18nManager.forceRTL(true);

const FatherSelectorSimple = ({ motherId, value, onChange, label, required = false }) => {
  const [loading, setLoading] = useState(false);
  const [husbands, setHusbands] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedFather, setSelectedFather] = useState(null);
  const dropdownHeight = useRef(new Animated.Value(0)).current;
  const dropdownOpacity = useRef(new Animated.Value(0)).current;

  // Load mother's husbands when component mounts or motherId changes
  useEffect(() => {
    if (motherId) {
      loadHusbands();
    }
  }, [motherId]);

  // Set selected father from value prop
  useEffect(() => {
    if (husbands.length > 0) {
      if (value) {
        const father = husbands.find((h) => h.husband_id === value);
        setSelectedFather(father);
      } else {
        setSelectedFather(null);
      }
    }
  }, [value, husbands]);

  // Auto-select if only one husband
  useEffect(() => {
    if (husbands.length === 1 && !value) {
      const singleHusband = husbands[0];
      setSelectedFather(singleHusband);
      onChange(singleHusband.husband_id, husbands);
    }
  }, [husbands]);

  const loadHusbands = async () => {
    if (!motherId) return;

    setLoading(true);
    try {
      // Query marriages table for woman's husbands
      const { data, error } = await supabase
        .from("marriages")
        .select(`
          id,
          husband_id,
          marriage_date,
          status,
          husband:profiles!marriages_husband_id_fkey(
            id,
            name,
            hid,
            name_chain,
            lineage_preview,
            full_name_chain,
            name_chain_snapshot,
            full_name,
            family_origin,
            family_name
          )
        `)
        .eq("wife_id", motherId)
        .in("status", ["current", "past", "married", "widowed", "divorced"]) // Support both old and new values
        .order("marriage_date", { ascending: false, nullsFirst: false });

      if (error) {
        console.error("Error loading husbands:", error);
        setHusbands([]);
        return;
      }

      // Format data for display
      const formattedHusbands = (data || []).map((marriage) => {
        const husband = marriage.husband;

        // Use same logic as view mode - getShortNameChain handles all edge cases
        const displayName = husband ? (getShortNameChain(husband) || husband.name || "غير محدد") : "غير محدد";

        return {
          husband_id: marriage.husband_id,
          husband_name: husband?.name || "غير محدد", // Keep original for backwards compatibility
          display_name: displayName, // Shows up to 5 names from chain (same as view mode)
          husband_hid: husband?.hid,
          status: marriage.status,
          is_current: marriage.status === "current" || marriage.status === "married",
        };
      });

      setHusbands(formattedHusbands);
      // Pass husbands data to parent
      onChange(value, formattedHusbands);
    } catch (err) {
      console.error("Error loading husbands:", err);
      setHusbands([]);
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
      const height = Math.min(husbands.length * 48, 200);
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

  const handleSelect = (husband) => {
    setSelectedFather(husband);
    onChange(husband?.husband_id || null, husbands);
    toggleDropdown();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClear = (e) => {
    if (e) e.stopPropagation();
    if (required) {
      Alert.alert("خطأ", "يجب اختيار والد الطفل");
      return;
    }
    setSelectedFather(null);
    onChange(null, husbands);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // If no mother is selected, don't show anything
  if (!motherId) {
    return null;
  }

  // If loading
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {label || "الأب"}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        </View>
        <View style={[styles.selector, styles.disabledSelector]}>
          <Text style={styles.disabledText}>جاري التحميل...</Text>
        </View>
      </View>
    );
  }

  // If no husbands available - show error state
  if (husbands.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {label || "الأب"}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        </View>
        <View style={[styles.selector, styles.errorSelector]}>
          <View style={styles.errorContent}>
            <Ionicons name="alert-circle" size={18} color="#A13333" />
            <Text style={styles.errorText}>يجب إضافة زوج أولاً</Text>
          </View>
        </View>
        <Text style={styles.hintText}>
          لإضافة طفل للمرأة، يجب أولاً إضافة زوج في قسم "الأزواج"
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label || "الأب"}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      </View>

      {/* Main Selector with PROPER RTL */}
      <View style={styles.selectorWrapper}>
        <TouchableOpacity
          style={[
            styles.selector,
            showDropdown && styles.selectorActive,
            required && !selectedFather && styles.requiredSelector,
          ]}
          onPress={toggleDropdown}
          activeOpacity={0.7}
        >
          {/* RTL Container */}
          <View style={styles.selectorContent}>
            {/* Text FIRST (appears on right in RTL) */}
            <Text
              style={
                selectedFather ? styles.selectedText : styles.placeholderText
              }
              numberOfLines={1}
            >
              {selectedFather ? selectedFather.display_name : "اختر الأب"}
            </Text>

            {/* Clear button (if not required) */}
            {selectedFather && !required && (
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

            {/* Chevron LAST (appears on left in RTL) */}
            <Ionicons
              name={showDropdown ? "chevron-up" : "chevron-down"}
              size={16}
              color="rgba(0,0,0,0.3)"
            />
          </View>
        </TouchableOpacity>

        {/* Dropdown */}
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
              {husbands.map((husband) => (
                <TouchableOpacity
                  key={husband.husband_id}
                  style={[
                    styles.option,
                    selectedFather?.husband_id === husband.husband_id &&
                      styles.optionSelected,
                  ]}
                  onPress={() => handleSelect(husband)}
                  activeOpacity={0.6}
                >
                  {/* Text FIRST for RTL */}
                  <View style={styles.optionContent}>
                    <Text
                      style={[
                        styles.optionText,
                        selectedFather?.husband_id === husband.husband_id &&
                          styles.optionTextSelected,
                      ]}
                    >
                      {husband.display_name}
                    </Text>
                    {husband.husband_hid && (
                      <Text style={styles.optionHid}>
                        {husband.husband_hid}
                      </Text>
                    )}
                  </View>

                  {/* Badge for current marriage */}
                  {husband.is_current && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>الحالي</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}
      </View>

      {/* Hint text if required */}
      {required && !selectedFather && (
        <Text style={styles.hintText}>يجب اختيار والد الطفل</Text>
      )}
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
  required: {
    color: "#A13333",
    fontSize: 15,
    fontWeight: "700",
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
  requiredSelector: {
    borderWidth: 1,
    borderColor: "#A13333",
    borderStyle: "dashed",
  },
  disabledSelector: {
    opacity: 0.5,
    justifyContent: "flex-end",
  },
  errorSelector: {
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#A13333",
  },
  errorContent: {
    flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#A13333",
    fontWeight: "500",
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
  hintText: {
    fontSize: 12,
    color: "rgba(0,0,0,0.4)",
    marginTop: 6,
    textAlign: I18nManager.isRTL ? "right" : "left",
    paddingHorizontal: 4,
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  optionSelected: {
    backgroundColor: "#F8F8F8",
  },
  optionContent: {
    flex: 1,
    alignItems: I18nManager.isRTL ? "flex-end" : "flex-start",
  },
  optionText: {
    fontSize: 15,
    color: "#000",
    textAlign: "right",
  },
  optionTextSelected: {
    fontWeight: "600",
  },
  optionHid: {
    fontSize: 12,
    color: "rgba(0,0,0,0.4)",
    marginTop: 2,
    textAlign: "right",
  },
  currentBadge: {
    backgroundColor: "rgba(161, 51, 51, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: I18nManager.isRTL ? 0 : 8,
    marginRight: I18nManager.isRTL ? 8 : 0,
  },
  currentBadgeText: {
    fontSize: 11,
    color: "#A13333",
    fontWeight: "600",
  },
});

export default FatherSelectorSimple;
