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
  Animated,
} from "react-native";
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import {
  useSharedValue,
  useAnimatedReaction,
  runOnJS,
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

// Segment groups - iOS style with grouped related sections
const SEGMENT_GROUPS = [
  {
    id: "basics",
    segments: ["معلومات", "شخصي", "تواريخ"],
    tabs: ["basic", "personal", "dates"],
  },
  {
    id: "relationships",
    segments: ["عائلة", "تواصل", "روابط"],
    tabs: ["family", "contact", "social"],
  },
];

const ModernProfileEditorV3 = ({ visible, profile, onClose, onSave }) => {
  const bottomSheetRef = useRef(null);
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const { isAdmin } = useAdminMode();
  const { settings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [activeGroup, setActiveGroup] = useState("basics");
  const [activeSegment, setActiveSegment] = useState(0);
  const [errors, setErrors] = useState({});
  
  // Marriage related state
  const [marriages, setMarriages] = useState([]);
  const [loadingMarriages, setLoadingMarriages] = useState(false);
  const [showMarriageEditor, setShowMarriageEditor] = useState(false);
  
  // Get the global profileSheetProgress from store
  const profileSheetProgress = useTreeStore((s) => s.profileSheetProgress);
  const animatedPosition = useSharedValue(0);
  
  // Track sheet position
  useAnimatedReaction(
    () => animatedPosition.value,
    (currentPosition, previousPosition) => {
      if (currentPosition !== previousPosition && profileSheetProgress) {
        const progress = 1 - currentPosition / screenHeight;
        profileSheetProgress.value = progress;
      }
    },
    [profileSheetProgress, screenHeight],
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

  const handleSegmentChange = (groupId, index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Animate the slide
    Animated.timing(slideAnimation, {
      toValue: index,
      duration: 250,
      useNativeDriver: true,
    }).start();
    
    setActiveGroup(groupId);
    setActiveSegment(index);
  };

  const renderSegmentedControl = (group) => {
    const segmentWidth = (screenWidth - 32) / group.segments.length;
    const isActive = activeGroup === group.id;
    
    return (
      <View style={styles.segmentContainer}>
        <View style={styles.segmentedControl}>
          <Animated.View 
            style={[
              styles.segmentIndicator,
              {
                width: segmentWidth - 4,
                transform: [{
                  translateX: isActive ? 
                    slideAnimation.interpolate({
                      inputRange: [0, 1, 2],
                      outputRange: [2, segmentWidth + 2, segmentWidth * 2 + 2],
                    }) : 2
                }],
              },
            ]}
          />
          {group.segments.map((segment, index) => (
            <TouchableOpacity
              key={segment}
              style={[styles.segment, { width: segmentWidth }]}
              onPress={() => handleSegmentChange(group.id, index)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.segmentText,
                isActive && activeSegment === index && styles.segmentTextActive,
              ]}>
                {segment}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

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

  const getCurrentTab = () => {
    const group = SEGMENT_GROUPS.find(g => g.id === activeGroup);
    return group ? group.tabs[activeSegment] : "basic";
  };

  const renderContent = () => {
    if (!editedData) return null;
    const currentTab = getCurrentTab();

    switch (currentTab) {
      case "basic":
        return (
          <View style={styles.content}>
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
              <View style={styles.pillContainer}>
                <TouchableOpacity
                  style={[styles.pill, editedData.gender === "male" && styles.pillActive]}
                  onPress={() => setEditedData({ ...editedData, gender: "male" })}
                >
                  <Text style={[styles.pillText, editedData.gender === "male" && styles.pillTextActive]}>
                    ذكر
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pill, editedData.gender === "female" && styles.pillActive]}
                  onPress={() => setEditedData({ ...editedData, gender: "female" })}
                >
                  <Text style={[styles.pillText, editedData.gender === "female" && styles.pillTextActive]}>
                    أنثى
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.toggleGroup}>
              <Text style={styles.fieldLabel}>الحالة</Text>
              <View style={styles.pillContainer}>
                <TouchableOpacity
                  style={[styles.pill, editedData.status === "alive" && styles.pillActive]}
                  onPress={() => setEditedData({ ...editedData, status: "alive" })}
                >
                  <Text style={[styles.pillText, editedData.status === "alive" && styles.pillTextActive]}>
                    {editedData.gender === "female" ? "حية" : "حي"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pill, editedData.status === "deceased" && styles.pillActive]}
                  onPress={() => setEditedData({ ...editedData, status: "deceased" })}
                >
                  <Text style={[styles.pillText, editedData.status === "deceased" && styles.pillTextActive]}>
                    {editedData.gender === "female" ? "متوفاة" : "متوفى"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );

      case "personal":
        return (
          <View style={styles.content}>
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
          <View style={styles.content}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                <Text style={styles.cardTitle}>تاريخ الميلاد</Text>
              </View>
              <DateEditor
                label=""
                value={editedData.dob_data}
                onChange={(value) => setEditedData({ ...editedData, dob_data: value })}
              />
            </View>
            
            {editedData.status === "deceased" && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="rose-outline" size={20} color="#666" />
                  <Text style={styles.cardTitle}>تاريخ الوفاة</Text>
                </View>
                <DateEditor
                  label=""
                  value={editedData.dod_data}
                  onChange={(value) => setEditedData({ ...editedData, dod_data: value })}
                />
              </View>
            )}
            
            <View style={styles.card}>
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
          <View style={styles.content}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setShowMarriageEditor(true)}
            >
              <Ionicons name="add-circle-outline" size={22} color="white" />
              <Text style={styles.primaryButtonText}>
                {editedData.gender === "female" ? "إضافة زوج" : "إضافة زوجة"}
              </Text>
            </TouchableOpacity>
            
            {loadingMarriages ? (
              <ActivityIndicator size="small" color="#007AFF" style={styles.loader} />
            ) : marriages.length > 0 ? (
              marriages.map((marriage) => (
                <TouchableOpacity
                  key={marriage.id}
                  style={styles.card}
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
                  <View style={styles.cardContent}>
                    <View>
                      <Text style={styles.cardMainText}>
                        {profile?.gender === "male" 
                          ? marriage.wife_name || "غير محدد"
                          : marriage.husband_name || "غير محدد"}
                      </Text>
                      <Text style={styles.cardSubText}>
                        {marriage.status === "married" 
                          ? (editedData.gender === "female" ? "متزوجة" : "متزوج")
                          : marriage.status === "divorced" 
                          ? (editedData.gender === "female" ? "مطلقة" : "مطلق")
                          : (editedData.gender === "female" ? "أرملة" : "أرمل")}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyText}>
                لا توجد زيجات مسجلة
              </Text>
            )}
          </View>
        );

      case "contact":
        return (
          <View style={styles.content}>
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
          <View style={styles.content}>
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
        if (profileSheetProgress) profileSheetProgress.value = 0;
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
          <Text style={styles.cancelText}>إلغاء</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>تعديل الملف</Text>
        
        <TouchableOpacity 
          onPress={handleSave} 
          disabled={!hasChanges || saving}
          style={styles.headerButton}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text style={[
              styles.saveText,
              (!hasChanges) && styles.disabledText,
            ]}>
              حفظ
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Segmented Controls */}
      <View style={styles.segmentSection}>
        {renderSegmentedControl(SEGMENT_GROUPS[0])}
        {renderSegmentedControl(SEGMENT_GROUPS[1])}
      </View>

      {/* Content */}
      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
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
    backgroundColor: "#F2F2F7",
  },
  handle: {
    paddingVertical: 12,
    alignItems: "center",
  },
  handleIndicator: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#C7C7CC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C7C7CC",
  },
  headerButton: {
    padding: 4,
    minWidth: 50,
  },
  cancelText: {
    fontSize: 17,
    color: "#007AFF",
  },
  saveText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#007AFF",
  },
  disabledText: {
    opacity: 0.3,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
  },
  segmentSection: {
    backgroundColor: "white",
    paddingVertical: 12,
    gap: 12,
  },
  segmentContainer: {
    paddingHorizontal: 16,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
    padding: 2,
    position: "relative",
  },
  segmentIndicator: {
    position: "absolute",
    height: 28,
    backgroundColor: "white",
    borderRadius: 6,
    top: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  segment: {
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
  },
  segmentTextActive: {
    color: "#000",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  content: {
    gap: 16,
  },
  photoSection: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "white",
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  fieldInput: {
    backgroundColor: "white",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: "#000",
  },
  multilineInput: {
    minHeight: 120,
    textAlignVertical: "top",
    paddingTop: 14,
  },
  toggleGroup: {
    gap: 8,
  },
  pillContainer: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  pill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  pillActive: {
    backgroundColor: "#007AFF",
  },
  pillText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#666",
  },
  pillTextActive: {
    color: "white",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardMainText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
  },
  cardSubText: {
    fontSize: 14,
    color: "#8E8E93",
    marginTop: 2,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
  },
  switchHint: {
    fontSize: 14,
    color: "#8E8E93",
    marginTop: 2,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    borderRadius: 10,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "white",
  },
  loader: {
    marginTop: 20,
  },
  emptyText: {
    fontSize: 15,
    color: "#8E8E93",
    textAlign: "center",
    marginTop: 30,
  },
});

export default ModernProfileEditorV3;