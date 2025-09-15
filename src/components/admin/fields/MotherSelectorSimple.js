import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ActionSheetIOS,
  Platform,
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

  const showPicker = () => {
    if (Platform.OS === "ios") {
      // iOS native action sheet
      const options = ["إلغاء"];
      const cancelButtonIndex = 0;

      // Add wife options
      wives.forEach((wife) => {
        options.push(wife.wife_name + (wife.is_current ? " (الحالية)" : ""));
      });

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          title: "اختر الأم",
        },
        (buttonIndex) => {
          if (buttonIndex !== cancelButtonIndex) {
            const wife = wives[buttonIndex - 1];
            setSelectedMother(wife);
            onChange(wife?.wife_id || null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        },
      );
    }
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

      {/* Clean minimal selector */}
      <TouchableOpacity
        style={styles.selector}
        onPress={showPicker}
        activeOpacity={0.6}
      >
        <Text
          style={selectedMother ? styles.selectedText : styles.placeholderText}
          numberOfLines={1}
        >
          {selectedMother ? selectedMother.wife_name : "غير محدد"}
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
            <Ionicons name="close-circle" size={18} color="rgba(0,0,0,0.3)" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  label: {
    fontSize: 13,
    color: "rgba(0,0,0,0.5)",
    marginBottom: 8,
    textAlign: "right",
    fontWeight: "500",
  },

  // Clean minimal selector
  selector: {
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    paddingLeft: 16,
    paddingRight: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  },
  placeholderText: {
    fontSize: 16,
    color: "rgba(0,0,0,0.3)",
    flex: 1,
    textAlign: "right",
  },
  disabledText: {
    fontSize: 16,
    color: "rgba(0,0,0,0.3)",
    textAlign: "right",
  },
  clearButton: {
    marginRight: 8,
  },
});

export default MotherSelectorSimple;
