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
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import PhotoEditor from "../components/admin/fields/PhotoEditor";
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
  
  // Get the global profileSheetProgress from store - CRITICAL for search bar opacity
  const profileSheetProgress = useTreeStore((s) => s.profileSheetProgress);
  
  // Track sheet position for opacity animations
  const animatedPosition = useSharedValue(0);
  
  // Update global progress when sheet moves - matching ProfileSheet behavior
  useAnimatedReaction(
    () => animatedPosition.value,
    (currentPosition, previousPosition) => {
      if (currentPosition !== previousPosition && profileSheetProgress) {
        // Convert position to progress (0 = closed, 1 = fully open)
        const progress = Math.min(1, Math.max(0, 1 - currentPosition / screenHeight));
        profileSheetProgress.value = progress;
      }
    },
    [profileSheetProgress, screenHeight],
  );
  
  // Form data state - matching ProfileSheet structure
  const [formData, setFormData] = useState({
    name: "",
    kunya: "",
    nickname: "",
    gender: "male",
    status: "alive",
    birth_date: "",
    death_date: "",
    biography: "",
    occupation: "",
    location: "",
    phone: "",
    email: "",
    photo_url: "",
    twitter: "",
    instagram: "",
    snapchat: "",
    facebook: "",
    linkedin: "",
    dob_is_public: true,
  });

  // Initialize form data from profile
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        kunya: profile.kunya || "",
        nickname: profile.nickname || "",
        gender: profile.gender || "male",
        status: profile.status || "alive",
        birth_date: profile.birth_date || profile.date_of_birth || "",
        death_date: profile.death_date || profile.date_of_death || "",
        biography: profile.biography || profile.bio || "",
        occupation: profile.occupation || "",
        location: profile.location || "",
        phone: profile.phone || "",
        email: profile.email || "",
        photo_url: profile.photo_url || "",
        twitter: profile.twitter || "",
        instagram: profile.instagram || "",
        snapchat: profile.snapchat || "",
        facebook: profile.facebook || "",
        linkedin: profile.linkedin || "",
        dob_is_public: profile.dob_is_public ?? true,
      });
    }
  }, [profile]);

  // Bottom sheet snap points - matching ProfileSheet
  const snapPoints = useMemo(() => ["40%", "90%", "100%"], []);
  
  // Track sheet state changes
  const handleSheetChange = useCallback((index) => {
    // Store the current sheet index if needed
    useTreeStore.setState({
      profileSheetIndex: index,
    });
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
    if (!profile) return false;
    return Object.keys(formData).some(key => {
      const originalValue = profile[key] || "";
      const currentValue = formData[key] || "";
      return originalValue !== currentValue;
    });
  }, [formData, profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validate dates
      if (formData.birth_date || formData.death_date) {
        const dateValidation = validateDates(formData.birth_date, formData.death_date);
        if (!dateValidation.valid) {
          Alert.alert("خطأ في التواريخ", dateValidation.error);
          setSaving(false);
          return;
        }
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update(formData)
        .eq('id', profile.id);

      if (error) throw error;

      Alert.alert("تم الحفظ", "تم حفظ التغييرات بنجاح", [
        { 
          text: "موافق",
          onPress: () => {
            onSave?.(formData);
            onClose();
          }
        }
      ]);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert("خطأ", "حدث خطأ أثناء حفظ التغييرات");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
          { text: "إلغاء التغييرات", style: "destructive", onPress: onClose },
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
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
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

  if (!visible) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      animatedPosition={animatedPosition}
      onChange={handleSheetChange}
      onClose={() => {
        // Reset the shared value properly when closing
        if (profileSheetProgress) {
          profileSheetProgress.value = 0;
        }
        useTreeStore.setState({
          profileSheetIndex: -1,
        });
        onClose();
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
            value={formData.photo_url || ""}
            onChange={(url) => setFormData({ ...formData, photo_url: url })}
            currentPhotoUrl={profile?.photo_url}
            personName={profile?.name}
            profileId={profile?.id}
          />
        </View>

        {/* Basic Information */}
        {renderSection("المعلومات الأساسية", "basics", (
          <>
            {renderField("الاسم الكامل", formData.name, (text) =>
              setFormData({ ...formData, name: text }),
              { field: "name" }
            )}
            {renderField("الكنية", formData.kunya, (text) =>
              setFormData({ ...formData, kunya: text }),
              { placeholder: "أبو فلان / أم فلان" }
            )}
            {renderField("اللقب", formData.nickname, (text) =>
              setFormData({ ...formData, nickname: text })
            )}
            
            {/* Gender Toggle */}
            <View style={styles.toggleContainer}>
              <Text style={styles.fieldLabel}>الجنس</Text>
              <View style={styles.toggleButtons}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    formData.gender === "male" && styles.toggleButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, gender: "male" })}
                >
                  <Text style={[
                    styles.toggleButtonText,
                    formData.gender === "male" && styles.toggleButtonTextActive,
                  ]}>
                    ذكر
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    formData.gender === "female" && styles.toggleButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, gender: "female" })}
                >
                  <Text style={[
                    styles.toggleButtonText,
                    formData.gender === "female" && styles.toggleButtonTextActive,
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
                    formData.status === "alive" && styles.toggleButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, status: "alive" })}
                >
                  <Text style={[
                    styles.toggleButtonText,
                    formData.status === "alive" && styles.toggleButtonTextActive,
                  ]}>
                    على قيد الحياة
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    formData.status === "deceased" && styles.toggleButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, status: "deceased" })}
                >
                  <Text style={[
                    styles.toggleButtonText,
                    formData.status === "deceased" && styles.toggleButtonTextActive,
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
            {renderField("السيرة الذاتية", formData.biography, (text) =>
              setFormData({ ...formData, biography: text }),
              { multiline: true, maxLength: 500, placeholder: "اكتب نبذة عن نفسك..." }
            )}
            {renderField("المهنة", formData.occupation, (text) =>
              setFormData({ ...formData, occupation: text })
            )}
            {renderField("المدينة", formData.location, (text) =>
              setFormData({ ...formData, location: text })
            )}
          </>
        ))}

        {/* Dates */}
        {renderSection("التواريخ", "dates", (
          <>
            {renderField("تاريخ الميلاد", formData.birth_date, (text) =>
              setFormData({ ...formData, birth_date: text }),
              { placeholder: "YYYY-MM-DD" }
            )}
            {formData.status === "deceased" && (
              renderField("تاريخ الوفاة", formData.death_date, (text) =>
                setFormData({ ...formData, death_date: text }),
                { placeholder: "YYYY-MM-DD" }
              )
            )}
          </>
        ))}

        {/* Contact Information */}
        {renderSection("معلومات التواصل", "contact", (
          <>
            {renderField("رقم الهاتف", formData.phone, (text) =>
              setFormData({ ...formData, phone: text }),
              { keyboardType: "phone-pad", placeholder: "05xxxxxxxx" }
            )}
            {renderField("البريد الإلكتروني", formData.email, (text) =>
              setFormData({ ...formData, email: text }),
              { keyboardType: "email-address", placeholder: "example@email.com" }
            )}
          </>
        ))}

        {/* Social Media */}
        {renderSection("وسائل التواصل الاجتماعي", "social", (
          <>
            {renderField("تويتر", formData.twitter, (text) =>
              setFormData({ ...formData, twitter: text }),
              { placeholder: "@username" }
            )}
            {renderField("انستجرام", formData.instagram, (text) =>
              setFormData({ ...formData, instagram: text }),
              { placeholder: "@username" }
            )}
            {renderField("سناب شات", formData.snapchat, (text) =>
              setFormData({ ...formData, snapchat: text }),
              { placeholder: "username" }
            )}
            {renderField("فيسبوك", formData.facebook, (text) =>
              setFormData({ ...formData, facebook: text }),
              { placeholder: "facebook.com/username" }
            )}
            {renderField("لينكد إن", formData.linkedin, (text) =>
              setFormData({ ...formData, linkedin: text }),
              { placeholder: "linkedin.com/in/username" }
            )}
          </>
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
              value={formData.dob_is_public}
              onValueChange={(value) =>
                setFormData({ ...formData, dob_is_public: value })
              }
              trackColor={{ false: "#E0E0E0", true: "#007AFF" }}
              thumbColor="white"
            />
          </View>
        ))}

        {/* Bottom padding */}
        <View style={{ height: 100 }} />
      </BottomSheetScrollView>
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
});

export default ModernProfileEditor;