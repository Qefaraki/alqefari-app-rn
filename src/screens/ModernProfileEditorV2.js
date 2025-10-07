import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Switch,
  ScrollView,
  Dimensions,
} from "react-native";
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import {
  useSharedValue,
  useAnimatedReaction,
  runOnJS,
  runOnUI,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import PhotoEditor from "../components/admin/fields/PhotoEditor";
import DateEditor from "../components/admin/fields/DateEditor";
import SocialMediaEditor from "../components/admin/SocialMediaEditor";
import MarriageEditor from "../components/admin/MarriageEditor";
import profilesService from "../services/profiles";
import { supabase } from "../services/supabase";
import { useTreeStore } from "../stores/useTreeStore";
import { useAdminMode } from "../contexts/AdminModeContext";
import { useSettings } from "../contexts/SettingsContext";

const { height: screenHeight, width: screenWidth } = Dimensions.get("window");

// Tab configuration
const TABS = [
  { id: "basic", label: "أساسي", icon: "person-outline" },
  { id: "personal", label: "شخصي", icon: "heart-outline" },
  { id: "dates", label: "تواريخ", icon: "calendar-outline" },
  { id: "family", label: "عائلة", icon: "people-outline" },
  { id: "contact", label: "تواصل", icon: "call-outline" },
  { id: "social", label: "اجتماعي", icon: "share-social-outline" },
];

const ModernProfileEditorV2 = ({ visible, profile, onClose, onSave }) => {
  const bottomSheetRef = useRef(null);
  const tabScrollRef = useRef(null);
  const { isAdmin } = useAdminMode();
  const { settings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [errors, setErrors] = useState({});
  
  // Marriage related state
  const [marriages, setMarriages] = useState([]);
  const [loadingMarriages, setLoadingMarriages] = useState(false);
  const [showMarriageEditor, setShowMarriageEditor] = useState(false);
  
  // Get the global profileSheetProgress from store
  const profileSheetProgress = useTreeStore((s) => s.profileSheetProgress);
  const animatedPosition = useSharedValue(0);

  // Track sheet position
  // Note: profileSheetProgress (shared value) not in dependency array.
  // Per Reanimated docs, dependencies only needed without Babel plugin.
  // Worklet tracks .value changes internally.
  useAnimatedReaction(
    () => animatedPosition.value,
    (currentPosition, previousPosition) => {
      if (currentPosition !== previousPosition && profileSheetProgress) {
        const progress = Math.max(0, Math.min(1, 1 - currentPosition / screenHeight));
        profileSheetProgress.value = progress;
      }
    },
    [screenHeight],
  );
  
  // Form data state
  const [editedData, setEditedData] = useState(null);
  const [originalData, setOriginalData] = useState(null);

  // Initialize form data
  useEffect(() => {
    if (profile && visible && !editedData) {
      const initialData = {
        name: profile.name || "",
        kunya: profile.kunya || "",
        nickname: profile.nickname || "",
        gender: profile.gender || "male",
        status: profile.status || "alive",
        sibling_order: profile.sibling_order || 0,
        bio: profile.bio || "",
        birth_place: profile.birth_place || "",
        current_residence: profile.current_residence || "",
        occupation: profile.occupation || "",
        education: profile.education || "",
        phone: profile.phone || "",
        email: profile.email || "",
        photo_url: profile.photo_url || "",
        social_media_links: profile.social_media_links || {},
        achievements: profile.achievements || null,
        timeline: profile.timeline || null,
        dob_data: profile.dob_data || null,
        dod_data: profile.dod_data || null,
        dob_is_public: profile.dob_is_public ?? true,
        profile_visibility: profile.profile_visibility || "family",
        father_id: profile.father_id || null,
        mother_id: profile.mother_id || null,
        role: profile.role || null,
      };
      setEditedData(initialData);
      setOriginalData(initialData);
    }
  }, [profile, visible]);

  // Load marriages
  const loadMarriages = async () => {
    if (!profile?.id) return;
    setLoadingMarriages(true);
    try {
      const data = await profilesService.getPersonMarriages(profile.id);
      setMarriages(data || []);
    } catch (error) {
      console.error("Error loading marriages:", error);
      setMarriages([]);
    } finally {
      setLoadingMarriages(false);
    }
  };

  useEffect(() => {
    if (profile && visible) {
      loadMarriages();
    }
  }, [profile, visible]);

  const snapPoints = useMemo(() => ["50%", "90%", "100%"], []);
  const [currentSnapIndex, setCurrentSnapIndex] = useState(0);
  
  const handleSheetChange = useCallback((index) => {
    setCurrentSnapIndex(index);
    useTreeStore.setState({ profileSheetIndex: index });
  }, []);

  useEffect(() => {
    if (visible && bottomSheetRef.current) {
      bottomSheetRef.current.expand();
    } else if (!visible && bottomSheetRef.current) {
      bottomSheetRef.current.close();
    }
  }, [visible]);

  const hasChanges = useMemo(() => {
    if (!editedData || !originalData) return false;
    return JSON.stringify(editedData) !== JSON.stringify(originalData);
  }, [editedData, originalData]);

  const handleSave = async () => {
    if (!editedData || !profile) return;

    setSaving(true);
    try {
      if (editedData.email && editedData.email.trim()) {
        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        if (!emailRegex.test(editedData.email.trim())) {
          Alert.alert("خطأ", "البريد الإلكتروني غير صحيح");
          setSaving(false);
          return;
        }
      }

      const cleanedData = {
        ...editedData,
        email: editedData.email?.trim() || null,
        phone: editedData.phone?.trim() || null,
        kunya: editedData.kunya?.trim() || null,
        nickname: editedData.nickname?.trim() || null,
        bio: editedData.bio?.trim() || null,
        birth_place: editedData.birth_place?.trim() || null,
        current_residence: editedData.current_residence?.trim() || null,
        occupation: editedData.occupation?.trim() || null,
        education: editedData.education?.trim() || null,
        photo_url: editedData.photo_url?.trim() || null,
        name: editedData.name?.trim() || profile.name,
        gender: editedData.gender,
        status: editedData.status,
        sibling_order: editedData.sibling_order,
        social_media_links: (editedData.social_media_links && Object.keys(editedData.social_media_links).length > 0) 
          ? editedData.social_media_links 
          : null,
        achievements: editedData.achievements || null,
        timeline: editedData.timeline || null,
        dob_data: editedData.dob_data,
        dod_data: editedData.dod_data,
        dob_is_public: editedData.dob_is_public,
        profile_visibility: editedData.profile_visibility,
        father_id: editedData.father_id || null,
        mother_id: editedData.mother_id || null,
        role: editedData.role || null,
      };

      const { data, error } = await supabase
        .from("profiles")
        .update(cleanedData)
        .eq("id", profile.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        useTreeStore.getState().updateNode(profile.id, data);
      }

      onClose();
      setTimeout(() => {
        Alert.alert("تم الحفظ", "تم حفظ التغييرات بنجاح");
      }, 100);
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert("خطأ", "فشل حفظ التغييرات");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(
        "تجاهل التغييرات؟",
        "سيتم فقدان جميع التغييرات غير المحفوظة",
        [
          { text: "متابعة", style: "cancel" },
          { 
            text: "تجاهل", 
            style: "destructive", 
            onPress: () => {
              setEditedData(null);
              setOriginalData(null);
              onClose();
            }
          },
        ]
      );
    } else {
      onClose();
    }
  };

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        opacity={0.5}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  );

  const renderField = (label, value, onChange, options = {}) => {
    const { multiline, keyboardType, placeholder, maxLength, numeric } = options;
    return (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={[
            styles.fieldInput,
            multiline && styles.multilineInput,
          ]}
          value={numeric ? String(value || "") : value}
          onChangeText={(text) => onChange(numeric ? (parseInt(text) || 0) : text)}
          multiline={multiline}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor="#999"
          maxLength={maxLength}
        />
      </View>
    );
  };

  const renderTabContent = () => {
    if (!editedData) return null;

    switch (activeTab) {
      case "basic":
        return (
          <View style={styles.tabContent}>
            <View style={styles.photoSection}>
              <PhotoEditor
                value={editedData.photo_url || ""}
                onChange={(url) => setEditedData({ ...editedData, photo_url: url })}
                currentPhotoUrl={profile?.photo_url}
                personName={profile?.name}
                profileId={profile?.id}
              />
            </View>
            
            {renderField("الاسم الكامل", editedData.name, (text) =>
              setEditedData({ ...editedData, name: text })
            )}
            
            {renderField(
              editedData.gender === "female" ? "الكنية" : "الكنية", 
              editedData.kunya, 
              (text) => setEditedData({ ...editedData, kunya: text }),
              { placeholder: editedData.gender === "female" ? "أم فلان" : "أبو فلان" }
            )}
            
            {renderField("اللقب", editedData.nickname, (text) =>
              setEditedData({ ...editedData, nickname: text })
            )}
            
            {renderField("الترتيب بين الإخوة", editedData.sibling_order, (val) =>
              setEditedData({ ...editedData, sibling_order: val }),
              { numeric: true, keyboardType: "numeric" }
            )}
            
            <View style={styles.toggleGroup}>
              <Text style={styles.fieldLabel}>الجنس</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggle, editedData.gender === "male" && styles.toggleActive]}
                  onPress={() => setEditedData({ ...editedData, gender: "male" })}
                >
                  <Text style={[styles.toggleText, editedData.gender === "male" && styles.toggleTextActive]}>
                    ذكر
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggle, editedData.gender === "female" && styles.toggleActive]}
                  onPress={() => setEditedData({ ...editedData, gender: "female" })}
                >
                  <Text style={[styles.toggleText, editedData.gender === "female" && styles.toggleTextActive]}>
                    أنثى
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.toggleGroup}>
              <Text style={styles.fieldLabel}>الحالة</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggle, editedData.status === "alive" && styles.toggleActive]}
                  onPress={() => setEditedData({ ...editedData, status: "alive" })}
                >
                  <Text style={[styles.toggleText, editedData.status === "alive" && styles.toggleTextActive]}>
                    {editedData.gender === "female" ? "حية" : "حي"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggle, editedData.status === "deceased" && styles.toggleActive]}
                  onPress={() => setEditedData({ ...editedData, status: "deceased" })}
                >
                  <Text style={[styles.toggleText, editedData.status === "deceased" && styles.toggleTextActive]}>
                    {editedData.gender === "female" ? "متوفاة" : "متوفى"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );

      case "personal":
        return (
          <View style={styles.tabContent}>
            {renderField("السيرة الذاتية", editedData.bio, (text) =>
              setEditedData({ ...editedData, bio: text }),
              { multiline: true, maxLength: 500, placeholder: "نبذة شخصية..." }
            )}
            {renderField("المهنة", editedData.occupation, (text) =>
              setEditedData({ ...editedData, occupation: text })
            )}
            {renderField("التعليم", editedData.education, (text) =>
              setEditedData({ ...editedData, education: text })
            )}
            {renderField("مكان الميلاد", editedData.birth_place, (text) =>
              setEditedData({ ...editedData, birth_place: text })
            )}
            {renderField("مكان الإقامة", editedData.current_residence, (text) =>
              setEditedData({ ...editedData, current_residence: text })
            )}
          </View>
        );

      case "dates":
        return (
          <View style={styles.tabContent}>
            <View style={styles.dateCard}>
              <View style={styles.dateHeader}>
                <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                <Text style={styles.dateTitle}>الميلاد</Text>
              </View>
              <DateEditor
                label=""
                value={editedData.dob_data}
                onChange={(value) => setEditedData({ ...editedData, dob_data: value })}
              />
            </View>
            
            {editedData.status === "deceased" && (
              <View style={styles.dateCard}>
                <View style={styles.dateHeader}>
                  <Ionicons name="rose-outline" size={20} color="#666" />
                  <Text style={styles.dateTitle}>الوفاة</Text>
                </View>
                <DateEditor
                  label=""
                  value={editedData.dod_data}
                  onChange={(value) => setEditedData({ ...editedData, dod_data: value })}
                />
              </View>
            )}
            
            <View style={styles.privacyCard}>
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>إظهار تاريخ الميلاد</Text>
                  <Text style={styles.switchHint}>السماح للآخرين برؤية التاريخ</Text>
                </View>
                <Switch
                  value={editedData.dob_is_public}
                  onValueChange={(value) => setEditedData({ ...editedData, dob_is_public: value })}
                  trackColor={{ false: "#E0E0E0", true: "#007AFF" }}
                />
              </View>
            </View>
          </View>
        );

      case "family":
        return (
          <View style={styles.tabContent}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowMarriageEditor(true)}
            >
              <Ionicons name="add-circle-outline" size={22} color="#007AFF" />
              <Text style={styles.addButtonText}>
                {editedData.gender === "female" ? "إضافة زوج" : "إضافة زوجة"}
              </Text>
            </TouchableOpacity>
            
            {loadingMarriages ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : marriages.length > 0 ? (
              marriages.map((marriage) => (
                <TouchableOpacity
                  key={marriage.id}
                  style={styles.marriageCard}
                  onPress={() => {
                    const spouseName = profile?.gender === "male" 
                      ? marriage.wife_name 
                      : marriage.husband_name;
                    const statusText = marriage.status === "married" 
                      ? (editedData.gender === "female" ? "متزوجة" : "متزوج")
                      : marriage.status === "divorced" 
                      ? (editedData.gender === "female" ? "مطلقة" : "مطلق")
                      : (editedData.gender === "female" ? "أرملة" : "أرمل");
                    
                    Alert.alert(
                      "إدارة الزواج",
                      `${spouseName || "غير محدد"}\nالحالة: ${statusText}`,
                      [
                        {
                          text: "تغيير الحالة",
                          onPress: async () => {
                            const newStatus = marriage.status === "married" ? "divorced" : "married";
                            try {
                              await profilesService.updateMarriage(marriage.id, { status: newStatus });
                              loadMarriages();
                            } catch (error) {
                              Alert.alert("خطأ", "فشل تحديث الحالة");
                            }
                          },
                        },
                        {
                          text: "حذف",
                          style: "destructive",
                          onPress: () => {
                            Alert.alert(
                              "تأكيد الحذف",
                              "هل تريد حذف هذا السجل؟",
                              [
                                { text: "إلغاء", style: "cancel" },
                                {
                                  text: "حذف",
                                  style: "destructive",
                                  onPress: async () => {
                                    try {
                                      await profilesService.deleteMarriage(marriage.id);
                                      loadMarriages();
                                    } catch (error) {
                                      Alert.alert("خطأ", "فشل الحذف");
                                    }
                                  },
                                },
                              ]
                            );
                          },
                        },
                        { text: "إلغاء", style: "cancel" },
                      ]
                    );
                  }}
                >
                  <View style={styles.marriageContent}>
                    <View>
                      <Text style={styles.marriageName}>
                        {profile?.gender === "male" 
                          ? marriage.wife_name || "غير محدد"
                          : marriage.husband_name || "غير محدد"}
                      </Text>
                      <Text style={styles.marriageStatus}>
                        {marriage.status === "married" 
                          ? (editedData.gender === "female" ? "متزوجة" : "متزوج")
                          : marriage.status === "divorced" 
                          ? (editedData.gender === "female" ? "مطلقة" : "مطلق")
                          : (editedData.gender === "female" ? "أرملة" : "أرمل")}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyText}>
                {editedData.gender === "female" ? "لا توجد حالات زواج مسجلة" : "لا توجد حالات زواج مسجلة"}
              </Text>
            )}
          </View>
        );

      case "contact":
        return (
          <View style={styles.tabContent}>
            {renderField("رقم الهاتف", editedData.phone, (text) =>
              setEditedData({ ...editedData, phone: text }),
              { keyboardType: "phone-pad", placeholder: "05xxxxxxxx" }
            )}
            {renderField("البريد الإلكتروني", editedData.email, (text) =>
              setEditedData({ ...editedData, email: text }),
              { keyboardType: "email-address", placeholder: "example@email.com" }
            )}
          </View>
        );

      case "social":
        return (
          <View style={styles.tabContent}>
            <SocialMediaEditor
              links={editedData.social_media_links || {}}
              onChange={(links) => setEditedData({ ...editedData, social_media_links: links })}
            />
          </View>
        );

      default:
        return null;
    }
  };

  if (!visible || !editedData) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      animatedPosition={animatedPosition}
      onChange={handleSheetChange}
      onClose={() => {
        if (onClose) onClose();
        if (profileSheetProgress) {
          runOnUI(() => {
            'worklet';
            if (profileSheetProgress.value !== 0) {
              profileSheetProgress.value = 0;
            }
          })();
        }
        useTreeStore.setState({ profileSheetIndex: -1 });
      }}
      backdropComponent={renderBackdrop}
      handleComponent={() => (
        <View style={styles.handle}>
          <View style={styles.handleIndicator} />
        </View>
      )}
      backgroundStyle={styles.sheetBackground}
      enablePanDownToClose
      animateOnMount
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>إلغاء</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>تعديل الملف الشخصي</Text>
        
        <TouchableOpacity 
          onPress={handleSave} 
          disabled={!hasChanges || saving}
          style={styles.headerButton}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text style={[
              styles.headerButtonText,
              styles.saveText,
              (!hasChanges) && styles.disabledText,
            ]}>
              حفظ
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <ScrollView 
        ref={tabScrollRef}
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabNav}
        contentContainerStyle={styles.tabNavContent}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons 
              name={tab.icon} 
              size={20} 
              color={activeTab === tab.id ? "#007AFF" : "#999"} 
            />
            <Text style={[
              styles.tabLabel,
              activeTab === tab.id && styles.tabLabelActive
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <BottomSheetScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {renderTabContent()}
        <View style={{ height: 100 }} />
      </BottomSheetScrollView>
      
      {/* Marriage Editor Modal */}
      {profile && (
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
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: "#FFFFFF",
  },
  handle: {
    paddingVertical: 10,
    alignItems: "center",
  },
  handleIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D0D0D0",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E0E0E0",
  },
  headerButton: {
    padding: 4,
    minWidth: 44,
  },
  headerButtonText: {
    fontSize: 16,
    color: "#007AFF",
  },
  saveText: {
    fontWeight: "600",
  },
  disabledText: {
    opacity: 0.4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
  },
  tabNav: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E0E0E0",
  },
  tabNavContent: {
    paddingHorizontal: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 4,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#007AFF",
  },
  tabLabel: {
    fontSize: 14,
    color: "#999",
  },
  tabLabelActive: {
    color: "#007AFF",
    fontWeight: "500",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  tabContent: {
    gap: 16,
  },
  photoSection: {
    marginBottom: 8,
    borderRadius: 16,
    overflow: "hidden",
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: "#F8F8F8",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#000",
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  toggleGroup: {
    gap: 8,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  toggle: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F8F8F8",
    alignItems: "center",
  },
  toggleActive: {
    backgroundColor: "#007AFF",
  },
  toggleText: {
    fontSize: 15,
    color: "#666",
  },
  toggleTextActive: {
    color: "white",
    fontWeight: "500",
  },
  dateCard: {
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    padding: 16,
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  dateTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },
  privacyCard: {
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    padding: 16,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
  },
  switchHint: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 10,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "white",
  },
  marriageCard: {
    backgroundColor: "#F8F8F8",
    borderRadius: 10,
    overflow: "hidden",
  },
  marriageContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  marriageName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },
  marriageStatus: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginTop: 20,
  },
});

export default ModernProfileEditorV2;
