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
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "../../../services/supabase";
import tokens from "../../ui/tokens";

// Enable RTL
I18nManager.forceRTL(true);

const COLORS = tokens.colors.najdi;

/**
 * Simplifies a full name to "FirstName LastName" format.
 * Extracts only the first and last parts of a name for compact display.
 *
 * @param {string} name - Full name to simplify
 * @returns {string} Simplified name in "FirstName LastName" format
 *
 * @example
 * simplifyName("نوف بنت عبدالله بن محمد القفاري") // Returns: "نوف القفاري"
 * simplifyName("سارة")                          // Returns: "سارة"
 * simplifyName("")                              // Returns: ""
 * simplifyName(null)                            // Returns: ""
 */
const simplifyName = (name) => {
  if (!name) return "";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
};

const MotherSelectorSimple = ({ fatherId, value, onChange, label, showLabel = true }) => {
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

  /**
   * Loads all wives (current and past) for the specified father.
   * Queries the marriages table and formats the data for display.
   *
   * @returns {Promise<void>}
   *
   * @example
   * // Returns formatted array of wives:
   * [
   *   {
   *     wife_id: "uuid-123",
   *     wife_name: "نوف بنت عبدالله القفاري",      // Full name (original)
   *     display_name: "نوف القفاري",              // Simplified for UI
   *     wife_hid: "1.2.3",                        // Al Qefari ID (null for Munasib)
   *     status: "current",                        // "current" or "past"
   *     is_current: true                          // Quick boolean check
   *   },
   *   ...
   * ]
   */
  const loadWives = async () => {
    if (!fatherId) return;

    setLoading(true);
    try {
      // Query marriages table for father's wives
      const { data, error } = await supabase
        .from("marriages")
        .select(`
          id,
          wife_id,
          status,
          wife:profiles!marriages_wife_id_fkey(
            id,
            name,
            hid,
            family_origin
          )
        `)
        .eq("husband_id", fatherId)
        .in("status", ["current", "past", "married", "widowed", "divorced"]) // Support both old and new values
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading wives:", error);
        setWives([]);
        return;
      }

      // Format data for display
      const formattedWives = (data || []).map((marriage) => {
        const wife = marriage.wife;

        // Simplify all names to "FirstName LastName" format for clean display
        // For Munasib (no HID), simplify the full name with family origin
        // For Al Qefari women (with HID), simplify their name
        const displayName = wife
          ? simplifyName(wife.name) || "غير محدد"
          : "غير محدد";

        return {
          wife_id: marriage.wife_id,
          wife_name: wife?.name || "غير محدد", // Keep original for backwards compatibility
          display_name: displayName, // Simplified: "FirstName LastName" for all wives
          wife_hid: wife?.hid,
          status: marriage.status,
          is_current: marriage.status === "current" || marriage.status === "married",
        };
      });

      setWives(formattedWives);
      // Pass wives data to parent
      onChange(value, formattedWives);
    } catch (err) {
      console.error("Error loading wives:", err);
      setWives([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
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
      <View style={[styles.container, !showLabel && styles.containerCompact]}>
        {showLabel && (
          <View style={styles.labelRow}>
            <Text style={styles.label}>{label || "الأم"}</Text>
          </View>
        )}
        <View style={[styles.selector, styles.disabledSelector]}>
          <Text style={styles.disabledText}>جاري التحميل...</Text>
        </View>
      </View>
    );
  }

  // If no wives available, show minimal state
  if (wives.length === 0) {
    return (
      <View style={[styles.container, !showLabel && styles.containerCompact]}>
        {showLabel && (
          <View style={styles.labelRow}>
            <Text style={styles.label}>{label || "الأم"}</Text>
          </View>
        )}
        <View style={[styles.selector, styles.disabledSelector]}>
          <Text style={styles.disabledText}>غير متاح</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, !showLabel && styles.containerCompact]}>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label || "الأم"}</Text>
        </View>
      )}

      {/* Main Selector with PROPER RTL */}
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
            {selectedMother ? selectedMother.display_name : "اختر الأم"}
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
              color={COLORS.textMuted + "55"}
            />
          </TouchableOpacity>
        )}

        {/* Chevron LAST (will appear on far left in RTL) */}
        <Ionicons
          name={showDropdown ? "chevron-up" : "chevron-down"}
          size={16}
          color={COLORS.textMuted + "55"}
        />
      </View>
      </TouchableOpacity>

      {/* Modal Dropdown - renders outside clipping bounds */}
      <Modal
        visible={showDropdown}
        transparent
        animationType="fade"
        onRequestClose={toggleDropdown}
      >
        <Pressable style={styles.modalOverlay} onPress={toggleDropdown}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>اختيار الأم</Text>
            <ScrollView
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={false}
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
                  <View style={styles.optionContent}>
                    <View style={styles.optionTextWrapper}>
                      <Text
                        style={[
                          styles.optionText,
                          selectedMother?.wife_id === wife.wife_id &&
                            styles.optionTextSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {wife.display_name}
                      </Text>
                      {wife.wife_hid && (
                        <Text style={styles.optionHid}>
                          {wife.wife_hid}
                        </Text>
                      )}
                    </View>
                    {wife.is_current && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>حالية</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: tokens.spacing.xs,
    width: "100%",
  },
  containerCompact: {
    marginTop: 0,
  },
  labelRow: {
    flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
    justifyContent: "flex-start",
    marginBottom: tokens.spacing.xxs,
  },
  label: {
    fontSize: tokens.typography.caption1.fontSize,
    color: COLORS.textMuted,
    fontWeight: "500",
    textAlign: I18nManager.isRTL ? "right" : "left",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },

  selectorWrapper: {
    position: "relative",
    width: "100%",
    zIndex: 100,
  },

  // Main selector container
  selector: {
    backgroundColor: COLORS.background,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.container + "33",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
    minHeight: tokens.touchTarget.minimum,
  },

  // Inner content with RTL-aware flex
  selectorContent: {
    flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  selectorActive: {
    backgroundColor: COLORS.background,
    borderBottomLeftRadius: tokens.radii.lg,
    borderBottomRightRadius: tokens.radii.lg,
  },
  disabledSelector: {
    opacity: 0.5,
    justifyContent: "center",
  },
  selectedText: {
    fontSize: tokens.typography.body.fontSize,
    color: COLORS.text,
    flex: 1,
    textAlign: I18nManager.isRTL ? "right" : "left",
    fontWeight: "500",
    marginHorizontal: 8,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  placeholderText: {
    fontSize: tokens.typography.body.fontSize,
    color: COLORS.textMuted,
    flex: 1,
    textAlign: I18nManager.isRTL ? "right" : "left",
    marginHorizontal: 8,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  disabledText: {
    fontSize: tokens.typography.body.fontSize,
    color: COLORS.textMuted,
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
    backgroundColor: COLORS.background,
    borderRadius: tokens.radii.md,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 6,
    overflow: "hidden",
    zIndex: 200,
  },
  option: {
    flexDirection: I18nManager.isRTL ? "row" : "row",
    alignItems: "center",
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.container + "22",
  },
  optionSelected: {
    backgroundColor: COLORS.container + "12",
  },
  optionContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: tokens.spacing.xs,
  },
  optionTextWrapper: {
    flex: 1,
    alignItems: I18nManager.isRTL ? "flex-end" : "flex-start",
  },
  optionText: {
    fontSize: tokens.typography.subheadline.fontSize,
    color: COLORS.text,
    textAlign: "right",
  },
  optionTextSelected: {
    fontWeight: "600",
  },
  optionHid: {
    fontSize: tokens.typography.caption1.fontSize,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: "right",
  },
  currentBadge: {
    backgroundColor: COLORS.primary + "12",
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 3,
    borderRadius: tokens.radii.sm,
    marginLeft: I18nManager.isRTL ? tokens.spacing.xs : 0,
    marginRight: I18nManager.isRTL ? 0 : tokens.spacing.xs,
  },
  currentBadgeText: {
    fontSize: tokens.typography.caption1.fontSize,
    color: COLORS.primary,
    fontWeight: "600",
  },
});

export default MotherSelectorSimple;
