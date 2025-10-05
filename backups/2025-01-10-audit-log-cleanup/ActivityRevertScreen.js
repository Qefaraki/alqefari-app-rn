import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,

} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import { useAdminMode } from "../contexts/AdminModeContext";
import GlassSurface from "../components/glass/GlassSurface";
import GlassButton from "../components/glass/GlassButton";
import useStore from "../hooks/useStore";

const ActivityRevertScreen = ({ navigation, route }) => {
  const { rootId } = route.params || {};
  const { isAdminMode } = useAdminMode();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reverting, setReverting] = useState(null);
  const { refreshProfile } = useStore();

  useEffect(() => {
    fetchActivities();
  }, [rootId]);

  const fetchActivities = async (isRefreshing = false) => {
    if (isRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await supabase.rpc(
        "get_revertible_audit_entries",
        {
          p_limit: 50,
          p_offset: 0,
          p_root_id: rootId || null,
        },
      );

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error("Error fetching activities:", error);
      Alert.alert("خطأ", "فشل في تحميل السجل");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatAction = (action) => {
    const actions = {
      INSERT: "إضافة",
      UPDATE: "تحديث",
      DELETE: "حذف",
      REVERT: "تراجع",
      BULK_INSERT: "إضافة متعددة",
    };
    return actions[action] || action;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "الآن";
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffMins < 1440) return `منذ ${Math.floor(diffMins / 60)} ساعة`;
    return date.toLocaleDateString("ar-SA");
  };

  const getActionDescription = (item) => {
    const actorName = item.actor_name || "مستخدم";
    const targetName = item.target_profile_name || "شخص";

    switch (item.action) {
      case "INSERT":
        return `${actorName} أضاف ${targetName}`;
      case "UPDATE":
        return `${actorName} حدّث بيانات ${targetName}`;
      case "DELETE":
        return `${actorName} حذف ${targetName}`;
      case "BULK_INSERT":
        const count = item.details?.children_count || 0;
        return `${actorName} أضاف ${count} أطفال`;
      default:
        return `${actorName} ${formatAction(item.action)} ${targetName}`;
    }
  };

  const handleRevert = async (item) => {
    // First, get dry run preview
    try {
      const { data: preview, error } = await supabase.rpc(
        "admin_revert_action",
        {
          p_audit_log_id: item.id,
          p_dry_run: true,
        },
      );

      if (error) throw error;

      Alert.alert(
        "تأكيد التراجع",
        `${preview.summary}\n\nهل أنت متأكد من التراجع عن هذا الإجراء؟`,
        [
          { text: "إلغاء", style: "cancel" },
          {
            text: "تراجع",
            style: "destructive",
            onPress: () => performRevert(item),
          },
        ],
      );
    } catch (error) {
      Alert.alert("خطأ", error.message || "فشل في معاينة التراجع");
    }
  };

  const performRevert = async (item) => {
    setReverting(item.id);

    try {
      const { data, error } = await supabase.rpc("admin_revert_action", {
        p_audit_log_id: item.id,
        p_dry_run: false,
      });

      if (error) throw error;

      Alert.alert("نجح", data.summary || "تم التراجع بنجاح");

      // Refresh activities
      fetchActivities();

      // Refresh affected profile if available
      if (item.target_profile_id && refreshProfile) {
        await refreshProfile(item.target_profile_id);
      }
    } catch (error) {
      Alert.alert("خطأ", error.message || "فشل في التراجع");
    } finally {
      setReverting(null);
    }
  };

  const renderActivity = ({ item }) => {
    const isReverting = reverting === item.id;

    return (
      <GlassSurface style={styles.activityCard}>
        <View style={styles.activityHeader}>
          <View style={styles.actionBadge}>
            <Text style={styles.actionText}>{formatAction(item.action)}</Text>
          </View>
          <Text style={styles.timeText}>{formatDate(item.created_at)}</Text>
        </View>

        <Text style={styles.descriptionText}>{getActionDescription(item)}</Text>

        {item.is_revertible && (
          <View style={styles.revertContainer}>
            <TouchableOpacity
              style={[
                styles.revertButton,
                isReverting && styles.revertButtonDisabled,
              ]}
              onPress={() => handleRevert(item)}
              disabled={isReverting}
            >
              {isReverting ? (
                <ActivityIndicator size="small" color="#FF3B30" />
              ) : (
                <>
                  <Ionicons name="arrow-undo" size={16} color="#FF3B30" />
                  <Text style={styles.revertText}>تراجع</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </GlassSurface>
    );
  };

  if (!isAdminMode) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>هذه الصفحة متاحة للمسؤولين فقط</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>سجل النشاط</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={activities}
          renderItem={renderActivity}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchActivities(true)}
              tintColor="#007AFF"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="document-text-outline"
                size={64}
                color="#C7C7CC"
              />
              <Text style={styles.emptyText}>لا يوجد نشاط مسجل</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
  },
  activityCard: {
    marginBottom: 12,
    padding: 16,
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  actionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(0, 122, 255, 0.1)",
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#007AFF",
  },
  timeText: {
    fontSize: 12,
    color: "#8E8E93",
  },
  descriptionText: {
    fontSize: 16,
    color: "#000000",
    marginBottom: 8,
    textAlign: "right",
  },
  revertContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  revertButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
  },
  revertButtonDisabled: {
    opacity: 0.5,
  },
  revertText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FF3B30",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: "#8E8E93",
    marginTop: 16,
    textAlign: "center",
  },
});

export default ActivityRevertScreen;
