import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Switch,
  SafeAreaView,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "../contexts/SettingsContext";
import { formatDateByPreference } from "../utils/dateDisplay";

export default function SettingsModal({ visible, onClose }) {
  const { settings, updateSetting } = useSettings();
  const [expandedSection, setExpandedSection] = useState("date");

  // Sample date for preview
  const sampleDate = {
    gregorian: { day: 15, month: 3, year: 2024 },
    hijri: { day: 5, month: 9, year: 1445 },
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const renderDatePreview = () => {
    return (
      <View style={styles.previewContainer}>
        <Text style={styles.previewTitle}>معاينة:</Text>
        <Text style={styles.previewText}>
          {formatDateByPreference(sampleDate, settings)}
        </Text>
      </View>
    );
  };

  const renderSegmentedControl = (options, value, onValueChange) => {
    return (
      <View style={styles.segmentedControl}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.segment,
              value === option.value && styles.segmentActive,
            ]}
            onPress={() => onValueChange(option.value)}
          >
            <Text
              style={[
                styles.segmentText,
                value === option.value && styles.segmentTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

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

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Date Format Settings */}
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection("date")}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderContent}>
              <Text style={styles.sectionTitle}>تنسيق التاريخ</Text>
              {expandedSection !== "date" && (
                <Text style={styles.sectionSubtitle}>
                  {settings.defaultCalendar === "hijri" ? "هجري" : "ميلادي"} •{" "}
                  {settings.dateFormat === "numeric"
                    ? "رقمي"
                    : settings.dateFormat === "words"
                      ? "كلمات"
                      : "مختلط"}
                </Text>
              )}
            </View>
            <Ionicons
              name={expandedSection === "date" ? "chevron-up" : "chevron-down"}
              size={20}
              color="#6B7280"
            />
          </TouchableOpacity>

          {expandedSection === "date" && (
            <View style={styles.section}>
              {renderDatePreview()}

              {/* Calendar Type */}
              <View style={styles.optionGroup}>
                <Text style={styles.optionGroupLabel}>التقويم الافتراضي</Text>
                {renderSegmentedControl(
                  [
                    { label: "ميلادي", value: "gregorian" },
                    { label: "هجري", value: "hijri" },
                  ],
                  settings.defaultCalendar,
                  (value) => updateSetting("defaultCalendar", value),
                )}
              </View>

              {/* Date Format */}
              <View style={styles.optionGroup}>
                <Text style={styles.optionGroupLabel}>شكل التاريخ</Text>
                {renderSegmentedControl(
                  [
                    { label: "رقمي", value: "numeric" },
                    { label: "كلمات", value: "words" },
                    { label: "مختلط", value: "mixed" },
                  ],
                  settings.dateFormat,
                  (value) => updateSetting("dateFormat", value),
                )}
                <Text style={styles.optionHint}>
                  {settings.dateFormat === "numeric" && "15/03/2024"}
                  {settings.dateFormat === "words" && "15 مارس 2024"}
                  {settings.dateFormat === "mixed" && "15 Mar 2024"}
                </Text>
              </View>

              {/* Date Order (only for numeric) */}
              {settings.dateFormat === "numeric" && (
                <View style={styles.optionGroup}>
                  <Text style={styles.optionGroupLabel}>ترتيب التاريخ</Text>
                  {renderSegmentedControl(
                    [
                      { label: "يوم/شهر/سنة", value: "dmy" },
                      { label: "شهر/يوم/سنة", value: "mdy" },
                      { label: "سنة/شهر/يوم", value: "ymd" },
                    ],
                    settings.dateOrder,
                    (value) => updateSetting("dateOrder", value),
                  )}
                </View>
              )}

              {/* Separator (only for numeric) */}
              {settings.dateFormat === "numeric" && (
                <View style={styles.optionGroup}>
                  <Text style={styles.optionGroupLabel}>الفاصل</Text>
                  {renderSegmentedControl(
                    [
                      { label: "/", value: "/" },
                      { label: "-", value: "-" },
                      { label: ".", value: "." },
                    ],
                    settings.separator,
                    (value) => updateSetting("separator", value),
                  )}
                </View>
              )}

              {/* Year Format */}
              <View style={styles.optionGroup}>
                <Text style={styles.optionGroupLabel}>تنسيق السنة</Text>
                {renderSegmentedControl(
                  [
                    { label: "كاملة (2024)", value: "full" },
                    { label: "مختصرة (24)", value: "short" },
                  ],
                  settings.yearFormat,
                  (value) => updateSetting("yearFormat", value),
                )}
              </View>

              {/* Show Both Calendars */}
              <TouchableOpacity
                style={styles.switchOption}
                onPress={() =>
                  updateSetting(
                    "showBothCalendars",
                    !settings.showBothCalendars,
                  )
                }
                activeOpacity={0.7}
              >
                <View style={styles.switchOptionContent}>
                  <Text style={styles.switchOptionLabel}>
                    عرض التقويمين معاً
                  </Text>
                  <Text style={styles.switchOptionHint}>
                    عرض التاريخ الهجري والميلادي
                  </Text>
                </View>
                <Switch
                  value={settings.showBothCalendars}
                  onValueChange={(value) =>
                    updateSetting("showBothCalendars", value)
                  }
                  trackColor={{ false: "#D1D5DB", true: "#10B981" }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#D1D5DB"
                />
              </TouchableOpacity>

              {/* Arabic Numerals (for Hijri) */}
              {settings.defaultCalendar === "hijri" && (
                <TouchableOpacity
                  style={styles.switchOption}
                  onPress={() =>
                    updateSetting("arabicNumerals", !settings.arabicNumerals)
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.switchOptionContent}>
                    <Text style={styles.switchOptionLabel}>
                      الأرقام العربية
                    </Text>
                    <Text style={styles.switchOptionHint}>
                      استخدام ١٢٣ بدلاً من 123
                    </Text>
                  </View>
                  <Switch
                    value={settings.arabicNumerals}
                    onValueChange={(value) =>
                      updateSetting("arabicNumerals", value)
                    }
                    trackColor={{ false: "#D1D5DB", true: "#10B981" }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor="#D1D5DB"
                  />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Other Settings Sections (collapsed by default) */}
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection("privacy")}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderContent}>
              <Text style={styles.sectionTitle}>الخصوصية</Text>
            </View>
            <Ionicons
              name={
                expandedSection === "privacy" ? "chevron-up" : "chevron-down"
              }
              size={20}
              color="#6B7280"
            />
          </TouchableOpacity>

          {expandedSection === "privacy" && (
            <View style={styles.section}>
              <Text style={styles.optionHint}>
                إعدادات الخصوصية قادمة قريباً
              </Text>
            </View>
          )}

          {/* Reset Settings */}
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => {
              Alert.alert(
                "إعادة تعيين الإعدادات",
                "هل تريد إعادة جميع الإعدادات إلى القيم الافتراضية؟",
                [
                  { text: "إلغاء", style: "cancel" },
                  {
                    text: "إعادة تعيين",
                    style: "destructive",
                    onPress: () => {
                      updateSetting("defaultCalendar", "gregorian");
                      updateSetting("dateFormat", "numeric");
                      updateSetting("dateOrder", "dmy");
                      updateSetting("yearFormat", "full");
                      updateSetting("separator", "/");
                      updateSetting("showBothCalendars", false);
                      updateSetting("arabicNumerals", false);
                    },
                  },
                ],
                { cancelable: true },
              );
            }}
          >
            <Text style={styles.resetButtonText}>
              إعادة تعيين جميع الإعدادات
            </Text>
          </TouchableOpacity>

          <View style={{ height: 50 }} />
        </ScrollView>
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
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  sectionHeaderContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#111827",
    textAlign: "right",
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    color: "#6B7280",
    marginTop: 2,
    textAlign: "right",
  },
  section: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  previewContainer: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 20,
    alignItems: "center",
  },
  previewTitle: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: "#6B7280",
    marginBottom: 8,
  },
  previewText: {
    fontSize: 18,
    fontFamily: "SF Arabic",
    color: "#111827",
    fontWeight: "500",
  },
  optionGroup: {
    marginBottom: 20,
  },
  optionGroupLabel: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    color: "#374151",
    marginBottom: 10,
    textAlign: "right",
    fontWeight: "500",
  },
  optionHint: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    color: "#6B7280",
    fontWeight: "500",
  },
  segmentTextActive: {
    color: "#111827",
  },
  switchOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  switchOptionContent: {
    flex: 1,
    marginRight: 12,
  },
  switchOptionLabel: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    color: "#111827",
    marginBottom: 2,
    textAlign: "right",
  },
  switchOptionHint: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: "#6B7280",
    textAlign: "right",
  },
  resetButton: {
    margin: 20,
    padding: 16,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    alignItems: "center",
  },
  resetButtonText: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    color: "#EF4444",
    fontWeight: "500",
  },
});
