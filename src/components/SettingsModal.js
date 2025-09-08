import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Switch,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "../contexts/SettingsContext";

export default function SettingsModal({ visible, onClose }) {
  const { settings, toggleCalendar } = useSettings();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>الإعدادات</Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>عرض التاريخ</Text>

            <TouchableOpacity
              style={styles.option}
              onPress={toggleCalendar}
              activeOpacity={0.7}
            >
              <View style={styles.optionContent}>
                <Text style={styles.optionLabel}>التقويم الافتراضي</Text>
                <Text style={styles.optionValue}>
                  {settings.defaultCalendar === "hijri" ? "هجري" : "ميلادي"}
                </Text>
              </View>
              <Switch
                value={settings.defaultCalendar === "hijri"}
                onValueChange={toggleCalendar}
                trackColor={{ false: "#D1D5DB", true: "#10B981" }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#D1D5DB"
              />
            </TouchableOpacity>

            <Text style={styles.hint}>
              سيتم عرض التواريخ بالتقويم المختار في جميع أنحاء التطبيق. لن يؤثر
              هذا على إدخال التواريخ حيث يمكنك دائماً الاختيار بين التقويمين.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#111827",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#111827",
    marginBottom: 16,
    textAlign: "right",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  optionContent: {
    flex: 1,
    alignItems: "flex-end",
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontFamily: "SF Arabic",
    color: "#111827",
    marginBottom: 4,
  },
  optionValue: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    color: "#6B7280",
  },
  hint: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: "#6B7280",
    marginTop: 12,
    textAlign: "right",
    lineHeight: 20,
  },
});
