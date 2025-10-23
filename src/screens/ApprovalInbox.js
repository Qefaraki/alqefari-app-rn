import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Modal,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import suggestionService from "../services/suggestionService";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import * as Haptics from "expo-haptics";
import { Swipeable } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SegmentedControl from '../components/ui/SegmentedControl';

// Najdi Sadu Design System Colors
const COLORS = {
  background: "#F9F7F3",
  container: "#D1BBA3",
  text: "#242121",
  primary: "#A13333",
  secondary: "#D58C4A",
  textLight: "#24212199",
  textMedium: "#242121CC",
  success: "#22C55E",
  error: "#EF4444",
  warning: "#F59E0B",
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const ApprovalInbox = ({ visible, onClose }) => {
  const [activeTab, setActiveTab] = useState("received"); // received | submitted
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState(null);
  const [profileId, setProfileId] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (profileId) {
      loadSuggestions();
    }
  }, [activeTab, profileId]);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);

        // Get the user's profile ID
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (profile) {
          setProfileId(profile.id);
        }
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      let data = [];

      if (activeTab === "received") {
        // Get suggestions on user's profiles (they need to review)
        data = await suggestionService.getProfileSuggestions(profileId, "pending");
      } else {
        // Get suggestions the user submitted
        data = await suggestionService.getUserSubmittedSuggestions(profileId);
      }

      setSuggestions(data || []);
    } catch (error) {
      console.error("Error loading suggestions:", error);
      Alert.alert("خطأ", "فشل في تحميل الاقتراحات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleApprove = async (suggestion) => {
    Alert.alert(
      "تأكيد القبول",
      `هل تريد قبول تغيير "${suggestionService.formatFieldName(suggestion.field_name)}"؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "قبول",
          style: "default",
          onPress: async () => {
            try {
              await suggestionService.approveSuggestion(suggestion.id);
              Alert.alert("نجاح", "تم قبول الاقتراح وتطبيقه");
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              loadSuggestions();
            } catch (error) {
              console.error("Error approving:", error);
              Alert.alert("خطأ", error.message || "فشل في قبول الاقتراح");
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
          },
        },
      ]
    );
  };

  const handleReject = async (suggestion) => {
    Alert.alert(
      "تأكيد الرفض",
      "هل تريد رفض هذا الاقتراح؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "رفض",
          style: "destructive",
          onPress: async () => {
            try {
              await suggestionService.rejectSuggestion(suggestion.id, "رفض من قبل صاحب الملف");
              Alert.alert("تم", "تم رفض الاقتراح");
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              loadSuggestions();
            } catch (error) {
              console.error("Error rejecting:", error);
              Alert.alert("خطأ", error.message || "فشل في رفض الاقتراح");
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "approved":
        return COLORS.success;
      case "rejected":
        return COLORS.error;
      case "pending":
        return COLORS.warning;
      default:
        return COLORS.textMedium;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "approved":
        return "مقبول";
      case "rejected":
        return "مرفوض";
      case "pending":
        return "قيد المراجعة";
      default:
        return status;
    }
  };

  const renderLeftActions = (progress, dragX, suggestion) => {
    const trans = dragX.interpolate({
      inputRange: [0, 50, 100, 101],
      outputRange: [-20, 0, 0, 1],
    });

    return (
      <TouchableOpacity
        onPress={() => handleApprove(suggestion)}
        style={[styles.swipeAction, styles.approveAction]}
      >
        <Animated.Text
          style={[
            styles.swipeActionText,
            { transform: [{ translateX: trans }] },
          ]}
        >
          <Ionicons name="checkmark-circle" size={24} color="white" />
        </Animated.Text>
      </TouchableOpacity>
    );
  };

  const renderRightActions = (progress, dragX, suggestion) => {
    const trans = dragX.interpolate({
      inputRange: [-101, -100, -50, 0],
      outputRange: [-1, 0, 0, 20],
    });

    return (
      <TouchableOpacity
        onPress={() => handleReject(suggestion)}
        style={[styles.swipeAction, styles.rejectAction]}
      >
        <Animated.Text
          style={[
            styles.swipeActionText,
            { transform: [{ translateX: trans }] },
          ]}
        >
          <Ionicons name="close-circle" size={24} color="white" />
        </Animated.Text>
      </TouchableOpacity>
    );
  };

  const renderSuggestion = (suggestion) => {
    const isReceived = activeTab === "received";
    const isPending = suggestion.status === "pending";

    // Only make received pending suggestions swipeable
    if (isReceived && isPending) {
      return (
        <Swipeable
          key={suggestion.id}
          renderLeftActions={(progress, dragX) => renderLeftActions(progress, dragX, suggestion)}
          renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, suggestion)}
        >
          {renderSuggestionContent(suggestion, isReceived, isPending)}
        </Swipeable>
      );
    }

    return renderSuggestionContent(suggestion, isReceived, isPending);
  };

  const renderSuggestionContent = (suggestion, isReceived, isPending) => {
    return (
      <View key={suggestion.id} style={styles.suggestionCard}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.fieldLabel}>
              {suggestionService.formatFieldName(suggestion.field_name)}
            </Text>
            <Text style={styles.dateText}>
              {new Date(suggestion.created_at.endsWith('Z') ? suggestion.created_at : `${suggestion.created_at  }Z`).toLocaleDateString("ar-SA")}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${getStatusColor(suggestion.status)  }20` },
            ]}
          >
            <Text
              style={[styles.statusText, { color: getStatusColor(suggestion.status) }]}
            >
              {getStatusLabel(suggestion.status)}
            </Text>
          </View>
        </View>

        {/* Change Details */}
        <View style={styles.changeSection}>
          <View style={styles.valueRow}>
            <Text style={styles.valueLabel}>القيمة الحالية:</Text>
            <Text style={styles.oldValue}>
              {suggestion.old_value ?? "فارغ"}
            </Text>
          </View>
          <View style={styles.valueRow}>
            <Text style={styles.valueLabel}>القيمة الجديدة:</Text>
            <Text style={styles.newValue}>
              {suggestion.new_value ?? ""}
            </Text>
          </View>
        </View>

        {/* Reason if provided */}
        {suggestion.reason && (
          <View style={styles.reasonSection}>
            <Text style={styles.reasonLabel}>السبب:</Text>
            <Text style={styles.reasonText}>{suggestion.reason}</Text>
          </View>
        )}

        {/* Submitter info (for received suggestions) */}
        {isReceived && suggestion.submitter && (
          <View style={styles.submitterSection}>
            <Text style={styles.submitterText}>
              اقترح بواسطة: {suggestion.submitter.display_name || "مستخدم"}
            </Text>
          </View>
        )}

        {/* Profile info (for submitted suggestions) */}
        {!isReceived && suggestion.profile && (
          <View style={styles.submitterSection}>
            <Text style={styles.submitterText}>
              الملف الشخصي: {suggestion.profile.display_name || "غير معروف"}
            </Text>
          </View>
        )}

        {/* Actions for pending received suggestions */}
        {isReceived && isPending && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleReject(suggestion)}
            >
              <Ionicons name="close-circle" size={20} color={COLORS.error} />
              <Text style={[styles.actionText, { color: COLORS.error }]}>رفض</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApprove(suggestion)}
            >
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <Text style={[styles.actionText, { color: COLORS.success }]}>قبول</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Result for processed suggestions */}
        {suggestion.status !== "pending" && (
          <View style={styles.resultSection}>
            {suggestion.status === "approved" && (
              <Text style={styles.resultText}>
                تم القبول {suggestion.reviewed_at ?
                  `في ${new Date(suggestion.reviewed_at.endsWith('Z') ? suggestion.reviewed_at : `${suggestion.reviewed_at  }Z`).toLocaleDateString("ar-SA")}` : ""}
              </Text>
            )}
            {suggestion.status === "rejected" && suggestion.rejection_reason && (
              <Text style={[styles.resultText, { color: COLORS.error }]}>
                سبب الرفض: {suggestion.rejection_reason}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 20,
        stiffness: 90,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={onClose}
          />

          <Animated.View
            style={[
              styles.contentContainer,
              { transform: [{ translateY: slideAnim }] }
            ]}
          >
            <SafeAreaView style={styles.safeArea}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={28} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.title}>صندوق الاقتراحات</Text>
                <View style={{ width: 28 }} />
              </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <SegmentedControl
          options={[
            { id: "received", label: "واردة" },
            { id: "submitted", label: "مرسلة" },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadSuggestions();
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>جاري التحميل...</Text>
          </View>
        ) : suggestions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={COLORS.textLight} />
            <Text style={styles.emptyText}>
              {activeTab === "received" ? "لا توجد اقتراحات واردة" : "لا توجد اقتراحات مرسلة"}
            </Text>
          </View>
        ) : (
          suggestions.map(renderSuggestion)
        )}
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  contentContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.9,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 15,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.container  }40`,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.container  }40`,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  suggestionCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: `${COLORS.container  }40`,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  changeSection: {
    marginBottom: 12,
  },
  valueRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  valueLabel: {
    fontSize: 14,
    color: COLORS.textMedium,
    width: 100,
  },
  oldValue: {
    fontSize: 14,
    color: COLORS.textMedium,
    flex: 1,
    textDecorationLine: "line-through",
  },
  newValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "600",
    flex: 1,
  },
  reasonSection: {
    backgroundColor: `${COLORS.container  }10`,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textMedium,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: COLORS.text,
  },
  submitterSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: `${COLORS.container  }40`,
  },
  submitterText: {
    fontSize: 12,
    color: COLORS.textMedium,
  },
  timerSection: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: `${COLORS.container  }40`,
  },
  timerText: {
    fontSize: 12,
    color: COLORS.warning,
    marginLeft: 6,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: `${COLORS.container  }40`,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  rejectButton: {
    backgroundColor: `${COLORS.error  }10`,
  },
  approveButton: {
    backgroundColor: `${COLORS.success  }10`,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  resultSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: `${COLORS.container  }40`,
  },
  resultText: {
    fontSize: 12,
    color: COLORS.textMedium,
    fontStyle: "italic",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMedium,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textMedium,
  },
  swipeAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 75,
    height: "100%",
  },
  approveAction: {
    backgroundColor: COLORS.success,
  },
  rejectAction: {
    backgroundColor: COLORS.error,
  },
  swipeActionText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ApprovalInbox;
