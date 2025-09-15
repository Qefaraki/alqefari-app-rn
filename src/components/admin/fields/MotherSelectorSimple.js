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
      const height = Math.min((wives.length + 1) * 48, 200); // +1 for "none" option
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
    onChange(wife?.wife_id || null);
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
        <Text style={styles.label}>{label || "الأم"}</Text>
        <View style={styles.selector}>
          <ActivityIndicator size="small" color="#000" />
        </View>
      </View>
    );
  }

  // If no wives available, show minimal state
  if (wives.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label || "الأم"}</Text>
        <View style={[styles.selector, styles.disabledSelector]}>
          <Text style={styles.disabledText}>غير متاح</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label || "الأم"}</Text>

      {/* Main Selector - PROPER RTL */}
      <View style={styles.selectorWrapper}>
        <TouchableOpacity
          style={[styles.selector, showDropdown && styles.selectorActive]}
          onPress={toggleDropdown}
          activeOpacity={0.7}
        >
          {/* Text on the RIGHT for RTL */}
          <Text
            style={
              selectedMother ? styles.selectedText : styles.placeholderText
            }
            numberOfLines={1}
          >
            {selectedMother ? selectedMother.wife_name : "بدون تحديد"}
          </Text>

          {/* Chevron on the LEFT for RTL */}
          <View style={styles.chevronContainer}>
            <Ionicons
              name={showDropdown ? "chevron-up" : "chevron-down"}
              size={16}
              color="rgba(0,0,0,0.4)"
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
              {/* None option */}
              <TouchableOpacity
                style={[
                  styles.option,
                  !selectedMother && styles.optionSelected,
                ]}
                onPress={() => handleSelect(null)}
                activeOpacity={0.6}
              >
                <Text
                  style={[
                    styles.optionText,
                    !selectedMother && styles.optionTextSelected,
                  ]}
                >
                  بدون تحديد
                </Text>
              </TouchableOpacity>

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

                    {/* Badge on LEFT if current */}
                    {wife.is_current && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>الحالية</Text>
                      </View>
                    )}
                  </View>
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
    zIndex: 1000,
  },
  label: {
    fontSize: 13,
    color: "rgba(0,0,0,0.5)",
    marginBottom: 8,
    textAlign: "right",
    fontWeight: "500",
  },

  selectorWrapper: {
    position: "relative",
  },

  // Main selector
  selector: {
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row-reverse", // FORCE RTL
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectorActive: {
    backgroundColor: "#F2F2F2",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  disabledSelector: {
    opacity: 0.5,
  },
  selectedText: {
    fontSize: 16,
    color: "#000",
    flex: 1,
    textAlign: "right",
    fontWeight: "500",
    marginLeft: 12,
  },
  placeholderText: {
    fontSize: 16,
    color: "rgba(0,0,0,0.3)",
    flex: 1,
    textAlign: "right",
    marginLeft: 12,
  },
  disabledText: {
    fontSize: 16,
    color: "rgba(0,0,0,0.3)",
    textAlign: "right",
  },
  chevronContainer: {
    width: 20,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  optionSelected: {
    backgroundColor: "#F8F8F8",
  },
  optionContent: {
    flexDirection: "row-reverse", // FORCE RTL
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionText: {
    fontSize: 15,
    color: "#000",
    flex: 1,
    textAlign: "right",
  },
  optionTextSelected: {
    fontWeight: "600",
  },
  currentBadge: {
    backgroundColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  currentBadgeText: {
    fontSize: 11,
    color: "rgba(0,0,0,0.6)",
    fontWeight: "600",
  },
});

export default MotherSelectorSimple;
