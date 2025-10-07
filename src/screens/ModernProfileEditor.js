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
  Animated,
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
import { validateDates } from "../utils/dateUtils";
import { useTreeStore } from "../stores/useTreeStore";
import { useAdminMode } from "../contexts/AdminModeContext";
import { useSettings } from "../contexts/SettingsContext";

const { height: screenHeight } = Dimensions.get("window");

const ModernProfileEditor = ({ visible, profile, onClose, onSave }) => {
  const bottomSheetRef = useRef(null);
  const { isAdmin } = useAdminMode();
  const { settings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState("basics");
  const [errors, setErrors] = useState({});
  
  // Marriage related state
  const [marriages, setMarriages] = useState([]);
  const [loadingMarriages, setLoadingMarriages] = useState(false);
  const [showMarriageEditor, setShowMarriageEditor] = useState(false);
  
  // Get the global profileSheetProgress from store - CRITICAL for search bar opacity
  const profileSheetProgress = useTreeStore((s) => s.profileSheetProgress);
  
  // Create local animated position for the sheet - will be provided by BottomSheet
  const animatedPosition = useSharedValue(0);
  
  // Track sheet position and update global store for SearchBar to react
  useAnimatedReaction(
    () => animatedPosition.value,
    (currentPosition, previousPosition) => {
      if (currentPosition !== previousPosition && profileSheetProgress) {
        // The animatedPosition is the top of the sheet from the BOTTOM of the screen.
        const progress = 1 - currentPosition / screenHeight;
        profileSheetProgress.value = progress;
      }
    },
    [profileSheetProgress, screenHeight],
  );
  
  // Form data state - EXACTLY matching ProfileSheet structure
  const [editedData, setEditedData] = useState(null);
  const [originalData, setOriginalData] = useState(null);

  // Load marriages data
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

  // Initialize form data from profile - matching ProfileSheet exactly
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

  // Load marriages when profile changes
  useEffect(() => {
    if (profile && visible) {
      loadMarriages();
    }
  }, [profile, visible]);

  // Bottom sheet snap points - matching ProfileSheet
  const snapPoints = useMemo(() => ["40%", "90%", "100%"], []);
  
  // Track current snap index
  const [currentSnapIndex, setCurrentSnapIndex] = useState(0);
  
  // Handle sheet changes - EXACT copy from ProfileSheet
  const handleSheetChange = useCallback((index) => {
    setCurrentSnapIndex(index);
    
    // Store sheet state globally so SearchBar can react (fade at 80% open)
    useTreeStore.setState({ profileSheetIndex: index });
  }, []);

  // Open/close sheet based on visible prop
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

  // EXACT copy of ProfileSheet's handleSave
  const handleSave = async () => {
    if (!editedData || !profile) return;

    setSaving(true);
    try {
      // Validate email if provided
      if (editedData.email && editedData.email.trim()) {
        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        if (!emailRegex.test(editedData.email.trim())) {
          Alert.alert("خطأ", "البريد الإلكتروني غير صالح");
          setSaving(false);
          return;
        }
      }

      // Clean data before saving - convert empty strings to null for nullable fields
      const cleanedData = {
        ...editedData,
        // Convert empty strings to null for nullable fields
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
        // Keep non-nullable fields as is
        name: editedData.name?.trim() || profile.name, // Name is required
        gender: editedData.gender,
        status: editedData.status,
        sibling_order: editedData.sibling_order,
        // Handle social_media_links - convert empty object to null
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

      // Debug log to see what we're sending
      console.log("Saving profile with data:", JSON.stringify(cleanedData, null, 2));
      
      const { data, error } = await supabase
        .from("profiles")
        .update(cleanedData)
        .eq("id", profile.id)
        .select()
        .single();

      if (error) {
        console.error("Supabase error details:", error);
        throw error;
      }

      // Update the node in the tree immediately
      if (data) {
        useTreeStore.getState().updateNode(profile.id, data);
      }

      // Close and show success
      onClose();
      setTimeout(() => {
        Alert.alert("نجح", "تم حفظ التغييرات");
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
        "هل تريد إلغاء التغييرات؟",
        "سيتم فقدان جميع التغييرات غير المحفوظة",
        [
          { text: "متابعة التحرير", style: "cancel" },
          { 
            text: "إلغاء التغييرات", 
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

  const renderHandle = useCallback(() => (
    <View style={styles.handle}>
      <View style={styles.handleIndicator} />
    </View>
  ), []);

  const renderField = (label, value, onChange, options = {}) => {
    const { multiline, keyboardType, placeholder, maxLength } = options;
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={[
            styles.fieldInput,
            multiline && styles.multilineInput,
            errors[options.field] && styles.errorInput,
          ]}
          value={value}
          onChangeText={onChange}
          multiline={multiline}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor="#999"
          maxLength={maxLength}
        />
        {errors[options.field] && (
          <Text style={styles.errorText}>{errors[options.field]}</Text>
        )}
      </View>
    );
  };

  const renderSection = (title, expanded, children) => {
    const isExpanded = activeSection === expanded;
    return (
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setActiveSection(isExpanded ? null : expanded)}
        >
          <Text style={styles.sectionTitle}>{title}</Text>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color="#666"
          />
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.sectionContent}>
            {children}
          </View>
        )}
      </View>
    );
  };

  if (!visible || !editedData) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      animatedPosition={animatedPosition}
      onChange={handleSheetChange}
      onClose={() => {
        // Call the prop onClose (which sets selectedPersonId to null)
        if (onClose) {
          onClose();
        }
        // Reset the shared value properly, don't overwrite it
        if (profileSheetProgress) {
          runOnUI(() => {
            'worklet';
            profileSheetProgress.value = 0;
          })();
        }
        useTreeStore.setState({
          profileSheetIndex: -1,
        });
      }}
      backdropComponent={renderBackdrop}
      handleComponent={renderHandle}
      backgroundStyle={styles.sheetBackground}
      enablePanDownToClose
      animateOnMount
    >
      {/* Simple header with save/cancel - matching ProfileSheet style */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleCancel}
        >
          <Text style={styles.headerButtonText}>إلغاء</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>تعديل الملف الشخصي</Text>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleSave}
          disabled={!hasChanges || saving}
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

      <BottomSheetScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo Editor - from ProfileSheet */}
        <View style={styles.photoSection}>
          <PhotoEditor
            value={editedData.photo_url || ""}
            onChange={(url) => setEditedData({ ...editedData, photo_url: url })}
            currentPhotoUrl={profile?.photo_url}
            personName={profile?.name}
            profileId={profile?.id}
          />
        </View>

        {/* Basic Information */}
        {renderSection("المعلومات الأساسية", "basics", (
          <>
            {renderField("الاسم الكامل", editedData.name, (text) =>
              setEditedData({ ...editedData, name: text }),
              { field: "name" }
            )}
            {renderField("الكنية", editedData.kunya, (text) =>
              setEditedData({ ...editedData, kunya: text }),
              { placeholder: "أبو فلان / أم فلان" }
            )}
            {renderField("اللقب", editedData.nickname, (text) =>
              setEditedData({ ...editedData, nickname: text })
            )}
            
            {/* Sibling Order */}
            {renderField("ترتيب الميلاد", String(editedData.sibling_order || ""), (text) =>
              setEditedData({ ...editedData, sibling_order: parseInt(text) || 0 }),
              { keyboardType: "numeric", placeholder: "الترتيب بين الإخوة" }
            )}
            
            {/* Gender Toggle */}
            <View style={styles.toggleContainer}>
              <Text style={styles.fieldLabel}>الجنس</Text>
              <View style={styles.toggleButtons}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    editedData.gender === "male" && styles.toggleButtonActive,
                  ]}
                  onPress={() => setEditedData({ ...editedData, gender: "male" })}
                >
                  <Text style={[
                    styles.toggleButtonText,
                    editedData.gender === "male" && styles.toggleButtonTextActive,
                  ]}>
                    ذكر
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    editedData.gender === "female" && styles.toggleButtonActive,
                  ]}
                  onPress={() => setEditedData({ ...editedData, gender: "female" })}
                >
                  <Text style={[
                    styles.toggleButtonText,
                    editedData.gender === "female" && styles.toggleButtonTextActive,
                  ]}>
                    أنثى
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Status Toggle */}
            <View style={styles.toggleContainer}>
              <Text style={styles.fieldLabel}>الحالة</Text>
              <View style={styles.toggleButtons}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    editedData.status === "alive" && styles.toggleButtonActive,
                  ]}
                  onPress={() => setEditedData({ ...editedData, status: "alive" })}
                >
                  <Text style={[
                    styles.toggleButtonText,
                    editedData.status === "alive" && styles.toggleButtonTextActive,
                  ]}>
                    حي
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    editedData.status === "deceased" && styles.toggleButtonActive,
                  ]}
                  onPress={() => setEditedData({ ...editedData, status: "deceased" })}
                >
                  <Text style={[
                    styles.toggleButtonText,
                    editedData.status === "deceased" && styles.toggleButtonTextActive,
                  ]}>
                    متوفى
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ))}

        {/* Personal Information */}
        {renderSection("المعلومات الشخصية", "personal", (
          <>
            {renderField("السيرة الذاتية", editedData.bio, (text) =>
              setEditedData({ ...editedData, bio: text }),
              { multiline: true, maxLength: 500, placeholder: "اكتب نبذة عن نفسك..." }
            )}
            {renderField("المهنة", editedData.occupation, (text) =>
              setEditedData({ ...editedData, occupation: text })
            )}
            {renderField("التعليم", editedData.education, (text) =>
              setEditedData({ ...editedData, education: text }),
              { placeholder: "المؤهل العلمي" }
            )}
            {renderField("مكان الميلاد", editedData.birth_place, (text) =>
              setEditedData({ ...editedData, birth_place: text })
            )}
            {renderField("مكان الإقامة الحالي", editedData.current_residence, (text) =>
              setEditedData({ ...editedData, current_residence: text })
            )}
          </>
        ))}

        {/* Dates with Hijri/Gregorian support */}
        {renderSection("التواريخ المهمة", "dates", (
          <View>
            {/* Birth Date Section */}
            <View style={styles.dateSection}>
              <View style={styles.dateSectionHeader}>
                <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                <Text style={styles.dateSectionTitle}>الميلاد</Text>
              </View>
              <DateEditor
                label=""
                value={editedData.dob_data}
                onChange={(value) => setEditedData({ ...editedData, dob_data: value })}
                error={errors.birth_date}
              />
            </View>
            
            {/* Death Date Section - only show if deceased */}
            {editedData.status === "deceased" && (
              <View style={[styles.dateSection, { marginTop: 16 }]}>
                <View style={styles.dateSectionHeader}>
                  <Ionicons name="rose-outline" size={20} color="#666" />
                  <Text style={styles.dateSectionTitle}>الوفاة</Text>
                </View>
                <DateEditor
                  label=""
                  value={editedData.dod_data}
                  onChange={(value) => setEditedData({ ...editedData, dod_data: value })}
                  error={errors.death_date}
                />
              </View>
            )}
          </View>
        ))}

        {/* Marriages Section */}
        {renderSection(profile?.gender === "female" ? "الأزواج" : "الزوجات", "marriages", (
          <View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowMarriageEditor(true)}
            >
              <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
              <Text style={styles.addButtonText}>
                {profile?.gender === "female" ? "إضافة زوج" : "إضافة زوجة"}
              </Text>
            </TouchableOpacity>
            
            {loadingMarriages ? (
              <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 10 }} />
            ) : marriages.length > 0 ? (
              <View style={styles.marriagesList}>
                {marriages.map((marriage) => (
                  <TouchableOpacity
                    key={marriage.id}
                    style={styles.marriageItem}
                    onPress={() => {
                      Alert.alert(
                        "تعديل الزواج",
                        `${
                          profile?.gender === "male"
                            ? marriage.wife_name || "غير محدد"
                            : marriage.husband_name || "غير محدد"
                        }\n${marriage.status === "married" ? "متزوج" : marriage.status === "divorced" ? "مطلق" : "أرمل"}`,
                        [
                          {
                            text: "تغيير الحالة",
                            onPress: async () => {
                              const newStatus =
                                marriage.status === "married"
                                  ? "divorced"
                                  : "married";
                              try {
                                await profilesService.updateMarriage(
                                  marriage.id,
                                  { status: newStatus }
                                );
                                loadMarriages();
                              } catch (error) {
                                Alert.alert("خطأ", "فشل تحديث حالة الزواج");
                              }
                            },
                          },
                          {
                            text: "حذف",
                            style: "destructive",
                            onPress: () => {
                              Alert.alert(
                                "تأكيد الحذف",
                                "هل أنت متأكد من حذف هذا الزواج؟",
                                [
                                  { text: "إلغاء", style: "cancel" },
                                  {
                                    text: "حذف",
                                    style: "destructive",
                                    onPress: async () => {
                                      try {
                                        await profilesService.deleteMarriage(
                                          marriage.id
                                        );
                                        loadMarriages();
                                      } catch (error) {
                                        Alert.alert("خطأ", "فشل حذف الزواج");
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
                    <View style={styles.marriageItemContent}>
                      <View>
                        <Text style={styles.marriageName}>
                          {profile?.gender === "male"
                            ? marriage.wife_name || "غير محدد"
                            : marriage.husband_name || "غير محدد"}
                        </Text>
                        <Text style={styles.marriageStatus}>
                          {marriage.status === "married"
                            ? "متزوج"
                            : marriage.status === "divorced"
                            ? "مطلق"
                            : "أرمل"}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color="#999"
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>لا توجد حالات زواج مسجلة</Text>
            )}
          </View>
        ))}

        {/* Contact Information */}
        {renderSection("معلومات التواصل", "contact", (
          <>
            {renderField("رقم الهاتف", editedData.phone, (text) =>
              setEditedData({ ...editedData, phone: text }),
              { keyboardType: "phone-pad", placeholder: "05xxxxxxxx" }
            )}
            {renderField("البريد الإلكتروني", editedData.email, (text) =>
              setEditedData({ ...editedData, email: text }),
              { keyboardType: "email-address", placeholder: "example@email.com" }
            )}
          </>
        ))}

        {/* Social Media - using the proper SocialMediaEditor component */}
        {renderSection("وسائل التواصل الاجتماعي", "social", (
          <SocialMediaEditor
            links={editedData.social_media_links || {}}
            onChange={(links) => setEditedData({ ...editedData, social_media_links: links })}
          />
        ))}

        {/* Privacy Settings */}
        {renderSection("إعدادات الخصوصية", "privacy", (
          <View style={styles.switchRow}>
            <View style={styles.switchContent}>
              <Text style={styles.switchLabel}>إظهار تاريخ الميلاد</Text>
              <Text style={styles.switchDescription}>
                السماح للآخرين برؤية تاريخ ميلادك
              </Text>
            </View>
            <Switch
              value={editedData.dob_is_public}
              onValueChange={(value) =>
                setEditedData({ ...editedData, dob_is_public: value })
              }
              trackColor={{ false: "#E0E0E0", true: "#007AFF" }}
              thumbColor="white"
            />
          </View>
        ))}

        {/* Bottom padding */}
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
  handle: {
    padding: 14,
    alignItems: "center",
  },
  handleIndicator: {
    backgroundColor: "#d0d0d0",
    width: 48,
    height: 5,
    borderRadius: 3,
  },
  sheetBackground: {
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  headerButton: {
    padding: 4,
  },
  headerButtonText: {
    fontSize: 16,
    color: "#007AFF",
  },
  saveText: {
    fontWeight: "600",
  },
  disabledText: {
    opacity: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  photoSection: {
    marginBottom: 24,
    borderRadius: 24,
    overflow: "hidden",
  },
  section: {
    marginBottom: 20,
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#F8F8F8",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  sectionContent: {
    padding: 16,
    paddingTop: 0,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    marginBottom: 8,
  },
  fieldInput: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#1A1A1A",
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  errorInput: {
    borderColor: "#DC3545",
  },
  errorText: {
    color: "#DC3545",
    fontSize: 12,
    marginTop: 4,
  },
  toggleContainer: {
    marginBottom: 16,
  },
  toggleButtons: {
    flexDirection: "row",
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "white",
    alignItems: "center",
  },
  toggleButtonActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  toggleButtonText: {
    fontSize: 14,
    color: "#666",
  },
  toggleButtonTextActive: {
    color: "white",
    fontWeight: "600",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  switchContent: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 14,
    color: "#666",
  },
  dateSection: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  dateSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  dateSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F0F8FF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  marriagesList: {
    gap: 8,
  },
  marriageItem: {
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    marginBottom: 8,
  },
  marriageItemContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  marriageName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  marriageStatus: {
    fontSize: 14,
    color: "#666",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginTop: 10,
  },
});

export default ModernProfileEditor;
