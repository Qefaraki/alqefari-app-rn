import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  I18nManager,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  withTiming,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import CardSurface from "../ios/CardSurface";
import FatherSelector from "./fields/FatherSelector";
import MotherSelector from "./fields/MotherSelector";
import DraggableChildrenList from "./DraggableChildrenList";
import MarriageEditor from "./MarriageEditor";
import { supabase } from "../../services/supabase";
import { useAdminMode } from "../../contexts/AdminModeContext";
import { useTreeStore } from "../../stores/useTreeStore";

// Enable RTL
I18nManager.forceRTL(true);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const RelationshipManagerV2 = ({ profile, onUpdate, visible, onClose }) => {
  const { isAdmin } = useAdminMode();

  // State Management with proper defaults
  const [editedProfile, setEditedProfile] = useState({
    id: null,
    father_id: null,
    mother_id: null,
    generation: 1,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [marriages, setMarriages] = useState([]);
  const [children, setChildren] = useState([]);
  const [showMarriageEditor, setShowMarriageEditor] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [activeSection, setActiveSection] = useState("parents");

  // Animation values
  const contentOpacity = useSharedValue(0);
  const scrollViewRef = useRef(null);

  // Initialize data when modal opens
  useEffect(() => {
    if (visible && profile) {
      initializeData();
    } else if (!visible) {
      // Reset state when closing
      resetState();
    }
  }, [visible, profile]);

  const initializeData = async () => {
    // Only show loading spinner on first load
    if (!editedProfile.id) {
      setLoading(true);
      contentOpacity.value = 0;
    }

    try {
      // Set edited profile with proper defaults
      setEditedProfile({
        id: profile?.id || null,
        father_id: profile?.father_id || null,
        mother_id: profile?.mother_id || null,
        generation: profile?.generation || 1,
        gender: profile?.gender || "male",
        name: profile?.name || "",
      });

      // Load related data in parallel
      await Promise.all([loadMarriages(), loadChildren()]);

      // Animate content in only if we were loading
      if (!editedProfile.id) {
        contentOpacity.value = withTiming(1, { duration: 300 });
      }
    } catch (error) {
      console.error("Error initializing data:", error);
      Alert.alert("خطأ", "فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setEditedProfile({
      id: null,
      father_id: null,
      mother_id: null,
      generation: 1,
    });
    setMarriages([]);
    setChildren([]);
    setIsDirty(false);
    setActiveSection("parents");
  };

  // Load marriages with proper error handling
  const loadMarriages = async () => {
    if (!profile?.id || !profile?.gender) return;

    try {
      const column = profile.gender === "male" ? "husband_id" : "wife_id";
      const partnerColumn =
        profile.gender === "male" ? "wife_id" : "husband_id";

      const { data, error } = await supabase
        .from("marriages")
        .select(
          `
          id,
          ${partnerColumn},
          status,
          start_date,
          end_date,
          partner:profiles!marriages_${partnerColumn}_fkey(
            id,
            name,
            hid,
            photo_url
          )
        `,
        )
        .eq(column, profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMarriages(data || []);
    } catch (error) {
      console.error("Error loading marriages:", error);
      setMarriages([]);
    }
  };

  // Load children with proper grouping
  const loadChildren = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          `
          id,
          hid,
          name,
          gender,
          status,
          generation,
          sibling_order,
          photo_url,
          mother_id,
          mother:profiles!mother_id(id, name)
        `,
        )
        .or(`father_id.eq.${profile.id},mother_id.eq.${profile.id}`)
        .is("deleted_at", null)
        .order("sibling_order", { ascending: true });

      if (error) throw error;
      setChildren(data || []);
    } catch (error) {
      console.error("Error loading children:", error);
      setChildren([]);
    }
  };

  // Track changes properly
  useEffect(() => {
    if (profile && editedProfile.id) {
      const hasChanges =
        profile.father_id !== editedProfile.father_id ||
        profile.mother_id !== editedProfile.mother_id;
      setIsDirty(hasChanges);
    }
  }, [profile, editedProfile]);

  // Handle parent changes
  const handleParentChange = useCallback((field, value) => {
    setEditedProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Save parent changes
  const handleSaveParents = async () => {
    if (!isDirty || !editedProfile.id) return;

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Validate generation hierarchy
      const validations = [];

      if (editedProfile.father_id) {
        validations.push(
          supabase
            .from("profiles")
            .select("generation")
            .eq("id", editedProfile.father_id)
            .single(),
        );
      }

      if (editedProfile.mother_id) {
        validations.push(
          supabase
            .from("profiles")
            .select("generation")
            .eq("id", editedProfile.mother_id)
            .single(),
        );
      }

      const results = await Promise.all(validations);

      // Check generation constraints
      for (const result of results) {
        if (result.data && result.data.generation >= editedProfile.generation) {
          Alert.alert("خطأ", "يجب أن يكون الوالدان من جيل سابق");
          setSaving(false);
          return;
        }
      }

      // Update profile
      const { error } = await supabase
        .from("profiles")
        .update({
          father_id: editedProfile.father_id,
          mother_id: editedProfile.mother_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;

      // Update the tree store to reflect changes
      const treeStore = useTreeStore.getState();
      const updatedTreeData = treeStore.treeData.map((node) => {
        if (node.id === profile.id) {
          return {
            ...node,
            father_id: editedProfile.father_id,
            mother_id: editedProfile.mother_id,
          };
        }
        return node;
      });
      treeStore.setTreeData(updatedTreeData);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("نجح", "تم حفظ التغييرات");
      setIsDirty(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("خطأ", "فشل حفظ التغييرات");
      console.error("Save error:", error);
    } finally {
      setSaving(false);
    }
  };

  // Handle children reorder
  const handleChildrenReorder = async (newOrder) => {
    // Update local state immediately for responsive UI
    setChildren(newOrder);

    // Update sibling order in database
    try {
      const updates = newOrder.map((child, index) =>
        supabase
          .from("profiles")
          .update({ sibling_order: index })
          .eq("id", child.id),
      );

      await Promise.all(updates);

      // Update the tree store to reflect new order
      const treeStore = useTreeStore.getState();

      // Create updated tree data with new sibling_order values
      const updatedTreeData = treeStore.treeData.map((node) => {
        const childIndex = newOrder.findIndex((child) => child.id === node.id);
        if (childIndex !== -1) {
          return { ...node, sibling_order: childIndex };
        }
        return node;
      });

      // Set the updated tree data which will trigger layout recalculation
      treeStore.setTreeData(updatedTreeData);

      // Don't trigger onUpdate to avoid disruptive reloads
      // The tree will update automatically from the store change

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error updating order:", error);
      Alert.alert("خطأ", "فشل تحديث الترتيب");
      // Don't reload children - just show error
      // This avoids disrupting the UI
    }
  };

  // Section navigation with animation
  const navigateToSection = (section) => {
    setActiveSection(section);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Scroll to top when changing sections
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  // Animated content style
  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  // Render section tabs
  const renderSectionTabs = () => (
    <View style={styles.tabContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabContent}
      >
        <TouchableOpacity
          style={[styles.tab, activeSection === "parents" && styles.activeTab]}
          onPress={() => navigateToSection("parents")}
        >
          <Ionicons
            name="people-outline"
            size={20}
            color={activeSection === "parents" ? "#007AFF" : "#8A8A8E"}
          />
          <Text
            style={[
              styles.tabText,
              activeSection === "parents" && styles.activeTabText,
            ]}
          >
            الوالدين
          </Text>
        </TouchableOpacity>

        {isAdmin && (
          <TouchableOpacity
            style={[
              styles.tab,
              activeSection === "marriages" && styles.activeTab,
            ]}
            onPress={() => navigateToSection("marriages")}
          >
            <Ionicons
              name="heart-outline"
              size={20}
              color={activeSection === "marriages" ? "#007AFF" : "#8A8A8E"}
            />
            <Text
              style={[
                styles.tabText,
                activeSection === "marriages" && styles.activeTabText,
              ]}
            >
              {profile?.gender === "male" ? "الزوجات" : "الأزواج"}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.tab, activeSection === "children" && styles.activeTab]}
          onPress={() => navigateToSection("children")}
        >
          <Ionicons
            name="git-branch-outline"
            size={20}
            color={activeSection === "children" ? "#007AFF" : "#8A8A8E"}
          />
          <Text
            style={[
              styles.tabText,
              activeSection === "children" && styles.activeTabText,
            ]}
          >
            الأبناء
          </Text>
          {children.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{children.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // Render active section content
  const renderSectionContent = () => {
    switch (activeSection) {
      case "parents":
        return (
          <Animated.View entering={FadeIn} exiting={FadeOut}>
            <CardSurface>
              <View style={styles.sectionContent}>
                <FatherSelector
                  value={editedProfile.father_id}
                  onChange={(value) => handleParentChange("father_id", value)}
                  currentProfileId={profile?.id}
                  currentGeneration={profile?.generation}
                />

                <View style={styles.fieldSpacer} />

                <MotherSelector
                  fatherId={editedProfile.father_id || profile?.father_id}
                  value={editedProfile.mother_id}
                  onChange={(value) => handleParentChange("mother_id", value)}
                />
              </View>
            </CardSurface>
          </Animated.View>
        );

      case "marriages":
        return (
          <Animated.View entering={FadeIn} exiting={FadeOut}>
            <CardSurface>
              <View style={styles.sectionContent}>
                {marriages.length > 0 ? (
                  marriages.map((marriage) => renderMarriage(marriage))
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="heart-outline" size={48} color="#C7C7CC" />
                    <Text style={styles.emptyText}>
                      لا يوجد {profile?.gender === "male" ? "زوجات" : "أزواج"}
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyActionButton}
                      onPress={() => setShowMarriageEditor(true)}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={20}
                        color="#007AFF"
                      />
                      <Text style={styles.emptyActionText}>إضافة</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </CardSurface>
          </Animated.View>
        );

      case "children":
        return (
          <Animated.View entering={FadeIn} exiting={FadeOut}>
            <View style={{ flex: 1 }} pointerEvents="box-none">
              <DraggableChildrenList
                children={children}
                onReorder={handleChildrenReorder}
                onUpdate={() => loadChildren()}
                parentProfile={profile}
                isAdmin={isAdmin}
              />
            </View>
          </Animated.View>
        );

      default:
        return null;
    }
  };

  // Render marriage item
  const renderMarriage = (marriage) => {
    const partner = marriage.partner;
    if (!partner) return null;

    return (
      <View key={marriage.id} style={styles.marriageItem}>
        <View style={styles.marriageInfo}>
          <Text style={styles.partnerName}>{partner.name}</Text>
          <View style={styles.marriageMeta}>
            <Text style={styles.partnerHid}>HID: {partner.hid}</Text>
            {marriage.is_current ? (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>حالي</Text>
              </View>
            ) : (
              <Text style={styles.marriageStatus}>
                {marriage.status === "divorced" ? "مطلق" : "سابق"}
              </Text>
            )}
          </View>
        </View>
        {isAdmin && (
          <TouchableOpacity
            onPress={() => handleDeleteMarriage(marriage.id)}
            style={styles.deleteButton}
          >
            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const handleDeleteMarriage = async (marriageId) => {
    Alert.alert("تأكيد الحذف", "هل تريد حذف هذا الزواج؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("marriages")
              .delete()
              .eq("id", marriageId);

            if (error) throw error;

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            loadMarriages();
          } catch (error) {
            Alert.alert("خطأ", "فشل حذف الزواج");
            console.error("Delete error:", error);
          }
        },
      },
    ]);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>

              <View style={styles.titleContainer}>
                <Text style={styles.title}>إدارة العلاقات</Text>
                {profile?.name && (
                  <Text style={styles.subtitle}>{profile.name}</Text>
                )}
              </View>

              {isDirty && (
                <TouchableOpacity
                  onPress={handleSaveParents}
                  style={styles.saveButton}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>حفظ</Text>
                  )}
                </TouchableOpacity>
              )}

              {!isDirty && <View style={styles.saveButton} />}
            </View>

            {/* Section Tabs */}
            {renderSectionTabs()}

            {/* Content */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>جارِ التحميل...</Text>
              </View>
            ) : (
              <ScrollView
                ref={scrollViewRef}
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
              >
                <Animated.View style={animatedContentStyle}>
                  {renderSectionContent()}
                </Animated.View>
              </ScrollView>
            )}

            {/* Marriage Editor Modal */}
            {showMarriageEditor && (
              <MarriageEditor
                visible={showMarriageEditor}
                onClose={() => setShowMarriageEditor(false)}
                person={profile}
                onCreated={() => {
                  setShowMarriageEditor(false);
                  loadMarriages();
                }}
              />
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
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
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  titleContainer: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  subtitle: {
    fontSize: 14,
    color: "#8A8A8E",
    marginTop: 2,
    fontFamily: "SF Arabic Regular",
  },
  saveButton: {
    width: 60,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#007AFF",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "SF Arabic Regular",
  },
  tabContainer: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  tabContent: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 16,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F7F7FA",
    gap: 6,
  },
  activeTab: {
    backgroundColor: "#E3F2FD",
  },
  tabText: {
    fontSize: 15,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  activeTabText: {
    color: "#007AFF",
    fontWeight: "500",
  },
  badge: {
    backgroundColor: "#007AFF",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  badgeText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  sectionContent: {
    padding: 16,
  },
  fieldSpacer: {
    height: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 18,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  emptyActionButton: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#F0F9FF",
    borderRadius: 20,
  },
  emptyActionText: {
    fontSize: 15,
    color: "#007AFF",
    fontFamily: "SF Arabic Regular",
  },
  marriageItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  marriageInfo: {
    flex: 1,
  },
  partnerName: {
    fontSize: 17,
    color: "#000000",
    fontFamily: "SF Arabic Regular",
    marginBottom: 4,
  },
  marriageMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  partnerHid: {
    fontSize: 14,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  currentBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentBadgeText: {
    fontSize: 12,
    color: "#2E7D32",
    fontFamily: "SF Arabic Regular",
  },
  marriageStatus: {
    fontSize: 14,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF5F5",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default RelationshipManagerV2;
