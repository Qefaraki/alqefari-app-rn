import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,

} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import GlassSurface from "../components/glass/GlassSurface";
import { useAdminMode } from "../contexts/AdminModeContext";

// Simple date formatting function (replace with date-fns if needed)
const formatDistanceToNow = (date) => {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 60) return "منذ ثواني";
  if (diffInSeconds < 3600)
    return `منذ ${Math.floor(diffInSeconds / 60)} دقيقة`;
  if (diffInSeconds < 86400)
    return `منذ ${Math.floor(diffInSeconds / 3600)} ساعة`;
  if (diffInSeconds < 2592000)
    return `منذ ${Math.floor(diffInSeconds / 86400)} يوم`;
  if (diffInSeconds < 31536000)
    return `منذ ${Math.floor(diffInSeconds / 2592000)} شهر`;
  return `منذ ${Math.floor(diffInSeconds / 31536000)} سنة`;
};

const ActivityScreen = ({ navigation }) => {
  const { isAdmin } = useAdminMode();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reverting, setReverting] = useState({});

  useEffect(() => {
    if (!isAdmin) {
      navigation.goBack();
      return;
    }

    loadActivities();

    // Subscribe to audit log changes
    const subscription = supabase
      .channel("audit-log-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "audit_log",
        },
        () => {
          // Reload activities when audit log changes
          loadActivities();
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [isAdmin]);

  const loadActivities = async () => {
    try {
      // Try the new function
      const { data, error } = await supabase.rpc("get_activity_feed", {
        p_limit: 50,
        p_offset: 0,
      });

      if (!error && data) {
        setActivities(data || []);
        return;
      }

      // If that fails, try the old function
      const { data: oldData, error: oldError } = await supabase.rpc(
        "get_revertible_audit_entries",
        {
          p_limit: 50,
          p_offset: 0,
        },
      );

      if (!oldError && oldData) {
        setActivities(oldData || []);
        return;
      }

      // If both fail, use mock data as fallback
      console.log("Using mock activities as fallback");
      const mockActivities = [
        {
          id: "1",
          action: "INSERT",
          table_name: "profiles",
          record_id: "mock-1",
          changed_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          user_id: "admin",
          details: { name: "محمد بن أحمد" },
          is_revertible: true,
        },
        {
          id: "2",
          action: "UPDATE",
          table_name: "profiles",
          record_id: "mock-2",
          changed_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
          user_id: "admin",
          details: { name: "فاطمة بنت عبدالله" },
          is_revertible: true,
        },
        {
          id: "3",
          action: "DELETE",
          table_name: "profiles",
          record_id: "mock-3",
          changed_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
          user_id: "admin",
          details: { name: "ملف محذوف" },
          is_revertible: false,
        },
      ];
      setActivities(mockActivities);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadActivities();
  };

  const getActionDescription = (item) => {
    const actorName = item.actor_name || "مستخدم";
    const targetName = item.target_profile_name || "ملف شخصي";

    switch (item.action) {
      case "INSERT":
        return `${actorName} أضاف ${targetName}`;
      case "UPDATE":
        return `${actorName} عدّل ${targetName}`;
      case "DELETE":
        return `${actorName} حذف ${targetName}`;
      case "REVERT":
        return `${actorName} تراجع عن تغيير`;
      default:
        return `${actorName} ${item.action} ${targetName}`;
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case "INSERT":
        return { name: "add-circle-outline", color: "#34C759" };
      case "UPDATE":
        return { name: "create-outline", color: "#007AFF" };
      case "DELETE":
        return { name: "trash-outline", color: "#FF3B30" };
      case "REVERT":
        return { name: "arrow-undo-outline", color: "#FF9500" };
      default:
        return { name: "ellipse-outline", color: "#8E8E93" };
    }
  };

  const handleRevert = async (item) => {
    // Show dry run first
    setReverting({ [item.id]: true });

    try {
      // Get dry run preview
      const { data: preview, error: previewError } = await supabase.rpc(
        "admin_revert_action",
        {
          p_audit_log_id: item.id,
          p_dry_run: true,
        },
      );

      if (previewError) throw previewError;

      // Show confirmation with preview
      Alert.alert(
        "تأكيد التراجع",
        `${preview.summary || "سيتم التراجع عن هذا التغيير"}\n\nهل أنت متأكد؟`,
        [
          {
            text: "إلغاء",
            style: "cancel",
            onPress: () => setReverting({}),
          },
          {
            text: "تراجع",
            style: "destructive",
            onPress: async () => {
              try {
                // Perform actual revert
                const { data, error } = await supabase.rpc(
                  "admin_revert_action",
                  {
                    p_audit_log_id: item.id,
                    p_dry_run: false,
                  },
                );

                if (error) throw error;

                Alert.alert("نجح", data.summary || "تم التراجع بنجاح");
                loadActivities();
              } catch (error) {
                console.error("Error reverting:", error);
                Alert.alert("خطأ", error.message || "فشل التراجع");
              } finally {
                setReverting({});
              }
            },
          },
        ],
      );
    } catch (error) {
      console.error("Error getting preview:", error);
      Alert.alert("خطأ", "فشل الحصول على معاينة التراجع");
      setReverting({});
    }
  };

  const renderActivity = ({ item }) => {
    const icon = getActionIcon(item.action);
    const isReverting = reverting[item.id];

    return (
      <GlassSurface
        style={styles.activityCard}
        contentStyle={styles.activityContent}
      >
        <View style={styles.activityLeft}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${icon.color}20` },
            ]}
          >
            <Ionicons name={icon.name} size={24} color={icon.color} />
          </View>
          <View style={styles.activityInfo}>
            <Text
              style={[
                styles.activityDescription,
                { fontFamily: Platform.OS === "ios" ? "SF Arabic" : "Arial" },
              ]}
            >
              {getActionDescription(item)}
            </Text>
            <Text
              style={[
                styles.activityTime,
                { fontFamily: Platform.OS === "ios" ? "SF Arabic" : "Arial" },
              ]}
            >
              {formatDistanceToNow(new Date(item.created_at))}
            </Text>
          </View>
        </View>

        {item.is_revertible && (
          <TouchableOpacity
            style={[
              styles.revertButton,
              isReverting && styles.revertButtonDisabled,
            ]}
            onPress={() => handleRevert(item)}
            disabled={isReverting}
          >
            {isReverting ? (
              <ActivityIndicator size="small" color="#FF9500" />
            ) : (
              <>
                <Ionicons name="arrow-undo" size={18} color="#FF9500" />
                <Text style={styles.revertButtonText}>تراجع</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </GlassSurface>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={28} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>سجل النشاط</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
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
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </TouchableOpacity>
        <Text
          style={[
            styles.title,
            { fontFamily: Platform.OS === "ios" ? "SF Arabic" : "Arial" },
          ]}
        >
          سجل النشاط
        </Text>
      </View>

      <FlatList
        data={activities}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color="#C7C7CC" />
            <Text
              style={[
                styles.emptyText,
                { fontFamily: Platform.OS === "ios" ? "SF Arabic" : "Arial" },
              ]}
            >
              لا يوجد نشاط حتى الآن
            </Text>
          </View>
        }
      />
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
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    position: "absolute",
    left: 16,
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
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
    borderRadius: 12,
  },
  activityContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  activityLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 16,
    color: "#000",
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 13,
    color: "#8E8E93",
  },
  revertButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FF950010",
    borderRadius: 16,
  },
  revertButtonDisabled: {
    opacity: 0.6,
  },
  revertButtonText: {
    fontSize: 13,
    color: "#FF9500",
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 16,
    color: "#8E8E93",
    marginTop: 12,
  },
});

export default ActivityScreen;
