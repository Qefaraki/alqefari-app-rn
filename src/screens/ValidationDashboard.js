import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,

} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GlassSurface from "../components/glass/GlassSurface";
import GlassButton from "../components/glass/GlassButton";
import profilesService from "../services/profiles";
import { handleSupabaseError } from "../services/supabase";

const ValidationDashboard = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);
  const [validationData, setValidationData] = useState([]);
  const [lastRunTime, setLastRunTime] = useState(null);
  const [fixResults, setFixResults] = useState(null);

  useEffect(() => {
    loadValidationData();
  }, []);

  const loadValidationData = async () => {
    setLoading(true);
    try {
      const { data, error } = await profilesService.getValidationDashboard();

      if (error) throw new Error(error);

      setValidationData(data || []);
      setLastRunTime(new Date());
    } catch (error) {
      Alert.alert(
        "خطأ",
        handleSupabaseError(error) || "فشل تحميل بيانات التحقق",
      );
    } finally {
      setLoading(false);
    }
  };

  const runAutoFix = async () => {
    Alert.alert(
      "تأكيد الإصلاح التلقائي",
      "سيقوم هذا الإجراء بإصلاح المشكلات الشائعة تلقائياً. هل تريد المتابعة؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "إصلاح",
          style: "default",
          onPress: async () => {
            setFixing(true);
            try {
              const { data, error } = await profilesService.runAutoFix();

              if (error) throw new Error(error);

              setFixResults(data);
              Alert.alert("نجح", "تم إصلاح المشكلات بنجاح");

              // Reload validation data
              await loadValidationData();
            } catch (error) {
              Alert.alert(
                "خطأ",
                handleSupabaseError(error) || "فشل إصلاح المشكلات",
              );
            } finally {
              setFixing(false);
            }
          },
        },
      ],
    );
  };

  const getCategoryInfo = (category) => {
    const categoryMap = {
      missing_layout: {
        title: "تخطيطات مفقودة",
        description: "ملفات شخصية بدون مواضع تخطيط",
        icon: "grid-outline",
        color: "#D58C4A", // Desert Ochre
      },
      invalid_gender: {
        title: "قيم جنس غير صحيحة",
        description: "ملفات بقيم جنس غير صحيحة",
        icon: "alert-circle-outline",
        color: "#A13333", // Najdi Crimson
      },
      orphaned_child: {
        title: "أطفال أيتام",
        description: "أطفال بمراجع والدين محذوفة",
        icon: "people-outline",
        color: "#D58C4A", // Desert Ochre
      },
      missing_hid: {
        title: "معرفات مفقودة",
        description: "ملفات بدون معرف HID",
        icon: "barcode-outline",
        color: "#D58C4A", // Desert Ochre
      },
      duplicate_hid: {
        title: "معرفات مكررة",
        description: "ملفات بنفس معرف HID",
        icon: "copy-outline",
        color: "#A13333", // Najdi Crimson
      },
    };

    return (
      categoryMap[category] || {
        title: category,
        description: "مشكلة غير معروفة",
        icon: "help-outline",
        color: "#24212166", // Sadu Night 40%
      }
    );
  };

  const renderIssueCard = (issue) => {
    const info = getCategoryInfo(issue.category);

    return (
      <GlassSurface key={issue.category} style={styles.issueCard}>
        <View style={styles.issueHeader}>
          <View
            style={[styles.issueIcon, { backgroundColor: `${info.color}20` }]}
          >
            <Ionicons name={info.icon} size={24} color={info.color} />
          </View>
          <View style={styles.issueInfo}>
            <Text style={styles.issueTitle}>{info.title}</Text>
            <Text style={styles.issueDescription}>{info.description}</Text>
          </View>
          <View style={styles.issueCount}>
            <Text style={[styles.issueCountText, { color: info.color }]}>
              {issue.issue_count}
            </Text>
          </View>
        </View>

        {issue.sample_ids && issue.sample_ids.length > 0 && (
          <View style={styles.sampleIds}>
            <Text style={styles.sampleIdsLabel}>عينة معرفات:</Text>
            <Text style={styles.sampleIdsText} numberOfLines={1}>
              {issue.sample_ids.slice(0, 3).join(", ")}
              {issue.sample_ids.length > 3 && "..."}
            </Text>
          </View>
        )}
      </GlassSurface>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>جاري تحميل بيانات التحقق...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalIssues = Array.isArray(validationData)
    ? validationData.reduce((sum, item) => sum + (item.issue_count || 0), 0)
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color="#242121" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>لوحة التحقق</Text>
        <TouchableOpacity
          onPress={loadValidationData}
          style={styles.refreshButton}
        >
          <Ionicons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <GlassSurface style={styles.summary}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>إجمالي المشكلات</Text>
            <Text
              style={[
                styles.summaryValue,
                { color: totalIssues > 0 ? "#A13333" : "#D58C4A" }, // Najdi Crimson : Desert Ochre
              ]}
            >
              {totalIssues}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>الفئات</Text>
            <Text style={styles.summaryValue}>
              {Array.isArray(validationData) ? validationData.length : 0}
            </Text>
          </View>
        </View>

        {lastRunTime && (
          <Text style={styles.lastRunText}>
            آخر تحديث: {lastRunTime.toLocaleTimeString("ar-SA")}
          </Text>
        )}
      </GlassSurface>

      {/* Issues List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {!Array.isArray(validationData) || validationData.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={64} color="#34C759" />
            <Text style={styles.emptyStateTitle}>لا توجد مشكلات</Text>
            <Text style={styles.emptyStateText}>
              قاعدة البيانات في حالة جيدة
            </Text>
          </View>
        ) : (
          <>
            {validationData.map(renderIssueCard)}

            {/* Fix Results */}
            {fixResults && (
              <GlassSurface style={styles.fixResults}>
                <Text style={styles.fixResultsTitle}>نتائج الإصلاح</Text>
                {Object.entries(fixResults).map(([key, value]) => (
                  <View key={key} style={styles.fixResultRow}>
                    <Text style={styles.fixResultKey}>{key}:</Text>
                    <Text style={styles.fixResultValue}>{value}</Text>
                  </View>
                ))}
              </GlassSurface>
            )}
          </>
        )}
      </ScrollView>

      {/* Action Button */}
      {totalIssues > 0 && (
        <View style={styles.actionContainer}>
          <GlassButton
            title={fixing ? "جاري الإصلاح..." : "إصلاح المشكلات الشائعة"}
            onPress={runAutoFix}
            disabled={fixing}
            style={styles.fixButton}
            icon={fixing ? null : "construct"}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3", // Al-Jass White
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F9F7F3", // Al-Jass White
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#242121", // Sadu Night
  },
  refreshButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#24212199", // Sadu Night 60%
  },
  summary: {
    margin: 16,
    padding: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 14,
    color: "#24212199", // Sadu Night 60%
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#242121", // Sadu Night
  },
  lastRunText: {
    fontSize: 12,
    color: "#24212166", // Sadu Night 40%
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  issueCard: {
    marginBottom: 12,
    padding: 16,
  },
  issueHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  issueIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  issueInfo: {
    flex: 1,
  },
  issueTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#242121", // Sadu Night
    marginBottom: 2,
  },
  issueDescription: {
    fontSize: 13,
    color: "#24212199", // Sadu Night 60%
  },
  issueCount: {
    minWidth: 40,
    alignItems: "center",
  },
  issueCountText: {
    fontSize: 24,
    fontWeight: "bold",
  },
  sampleIds: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
  },
  sampleIdsLabel: {
    fontSize: 12,
    color: "#24212166", // Sadu Night 40%
    marginBottom: 4,
  },
  sampleIdsText: {
    fontSize: 11,
    color: "#24212199", // Sadu Night 60%
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#242121", // Sadu Night
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#24212199", // Sadu Night 60%
    marginTop: 8,
  },
  fixResults: {
    marginTop: 12,
    padding: 16,
  },
  fixResultsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#242121", // Sadu Night
    marginBottom: 12,
  },
  fixResultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  fixResultKey: {
    fontSize: 14,
    color: "#24212199", // Sadu Night 60%
  },
  fixResultValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#D58C4A", // Desert Ochre
  },
  actionContainer: {
    padding: 16,
    backgroundColor: "#F9F7F3", // Al-Jass White
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
  },
  fixButton: {
    height: 50,
  },
});

export default ValidationDashboard;
