import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
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
  const [expanded, setExpanded] = useState(false);
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
    setExpanded(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClear = () => {
    setSelectedMother(null);
    onChange(null);
    setExpanded(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // If no father is selected, show disabled state
  if (!fatherId) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label || "الأم (اختياري)"}</Text>
        <View style={styles.disabledSelector}>
          <Text style={styles.disabledText}>يجب اختيار الأب أولاً</Text>
        </View>
      </View>
    );
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

  // If no wives available
  if (wives.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label || "الأم (اختياري)"}</Text>
        <View style={styles.disabledSelector}>
          <Text style={styles.disabledText}>لا توجد زوجات مسجلة</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label || "الأم (اختياري)"}</Text>

      {/* Main Selector */}
      <TouchableOpacity
        style={[styles.selector, expanded && styles.selectorExpanded]}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.selectorContent}>
          {selectedMother ? (
            <>
              <Text style={styles.selectedText}>
                {selectedMother.wife_name}
              </Text>
              <TouchableOpacity
                onPress={handleClear}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color="#8E8E93" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.placeholderText}>اختر الأم</Text>
              <Ionicons name="chevron-down" size={20} color="#8E8E93" />
            </>
          )}
        </View>
      </TouchableOpacity>

      {/* Dropdown Options */}
      {expanded && (
        <View style={styles.dropdown}>
          {wives.map((wife) => (
            <TouchableOpacity
              key={wife.wife_id}
              style={[
                styles.option,
                selectedMother?.wife_id === wife.wife_id &&
                  styles.optionSelected,
              ]}
              onPress={() => handleSelect(wife)}
            >
              <Text
                style={[
                  styles.optionText,
                  selectedMother?.wife_id === wife.wife_id &&
                    styles.optionTextSelected,
                ]}
              >
                {wife.wife_name}
              </Text>
              {wife.is_current && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>الحالية</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#8E8E93",
    marginBottom: 6,
    textAlign: "right",
  },
  selector: {
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  selectorExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: "#007AFF",
    backgroundColor: "#FFF",
  },
  selectorContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedText: {
    fontSize: 16,
    color: "#000",
    flex: 1,
    textAlign: "right",
  },
  placeholderText: {
    fontSize: 16,
    color: "#8E8E93",
    flex: 1,
    textAlign: "right",
  },
  clearButton: {
    marginLeft: 8,
  },
  disabledSelector: {
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    opacity: 0.6,
  },
  disabledText: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "right",
  },
  dropdown: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#007AFF",
    borderTopWidth: 0,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: "hidden",
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
  },
  optionSelected: {
    backgroundColor: "#F0F9FF",
  },
  optionText: {
    fontSize: 16,
    color: "#000",
    flex: 1,
    textAlign: "right",
  },
  optionTextSelected: {
    color: "#007AFF",
    fontWeight: "500",
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
  },
});

export default MotherSelectorSimple;
