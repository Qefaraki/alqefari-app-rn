import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
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
  I18nManager,
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

// RTL is already enabled app-wide, no need to force it here

// Single row of segments - iOS style
const SEGMENTS = [
  { id: "basic", label: "عام", icon: "person" },
  { id: "details", label: "تفاصيل", icon: "document-text" },
  { id: "family", label: "عائلة", icon: "people" },
  { id: "contact", label: "تواصل", icon: "at" },
];

const ModernProfileEditorV4 = ({ visible, profile, onClose, onSave }) => {
  const bottomSheetRef = useRef(null);
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const { isAdmin } = useAdminMode();
  const { settings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [activeSegment, setActiveSegment] = useState(0);
  const [errors, setErrors] = useState({});
  const [isInitialized, setIsInitialized] = useState(false);

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

      // Initialize animations properly
      setTimeout(() => {
        setIsInitialized(true);
        fadeAnimation.setValue(1);
      }, 100);
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
      // Reset states when opening
      setActiveSegment(0);
      slideAnimation.setValue(0);
      fadeAnimation.setValue(0);

      // Animate in after a short delay
      setTimeout(() => {
        Animated.timing(fadeAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 200);
    } else if (!visible && bottomSheetRef.current) {
      bottomSheetRef.current.close();
      // Reset states when closing
      setIsInitialized(false);
      setEditedData(null);
      setOriginalData(null);
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
        social_media_links:
          editedData.social_media_links &&
          Object.keys(editedData.social_media_links).length > 0
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
            },
          },
        ],
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
    [],
  );

  const handleSegmentChange = (index) => {
    if (index === activeSegment) return; // Don't re-animate if already selected

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Fade out current content
    Animated.timing(fadeAnimation, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      // Update segment
      setActiveSegment(index);

      // Animate slide to new position
      Animated.spring(slideAnimation, {
        toValue: index,
        tension: 100,
        friction: 20,
        useNativeDriver: true,
      }).start();

      // Fade in new content
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const renderSegmentedControl = () => {
    const segmentWidth = (screenWidth - 32) / SEGMENTS.length;

    return (
      <View style={styles.segmentWrapper}>
        <View style={styles.segmentedControl}>
          <Animated.View
            style={[
              styles.segmentIndicator,
              {
                width: segmentWidth - 4,
                transform: [
                  {
                    translateX: slideAnimation.interpolate({
                      inputRange: [0, 1, 2, 3],
                      // In RTL, the segments appear in reverse visual order
                      // But we need to match the actual position of each segment
                      // Let's use negative indices from the right
                      outputRange: [
                        (SEGMENTS.length - 1 - 0) * segmentWidth + 2, // index 0 -> position 3 from left
                        (SEGMENTS.length - 1 - 1) * segmentWidth + 2, // index 1 -> position 2 from left
                        (SEGMENTS.length - 1 - 2) * segmentWidth + 2, // index 2 -> position 1 from left
                        (SEGMENTS.length - 1 - 3) * segmentWidth + 2, // index 3 -> position 0 from left
                      ],
                    }),
                  },
                ],
              },
            ]}
          />
          {SEGMENTS.map((segment, index) => (
            <TouchableOpacity
              key={segment.id}
              style={[styles.segment, { width: segmentWidth }]}
              onPress={() => handleSegmentChange(index)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={segment.icon}
                size={18}
                color={activeSegment === index ? "#000" : "#8E8E93"}
                style={styles.segmentIcon}
              />
              <Text
                style={[
                  styles.segmentText,
                  activeSegment === index && styles.segmentTextActive,
                ]}
              >
                {segment.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderField = (label, value, onChange, options = {}) => {
    const { multiline, keyboardType, placeholder, maxLength, numeric } =
      options;
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={styles.fieldInputWrapper}>
          <TextInput
            style={[styles.fieldInput, multiline && styles.multilineInput]}
            value={numeric ? String(value || "") : value}
            onChangeText={(text) =>
              onChange(numeric ? parseInt(text) || 0 : text)
            }
            multiline={multiline}
            keyboardType={keyboardType}
            placeholder={placeholder}
            placeholderTextColor="#C7C7CC"
            maxLength={maxLength}
            textAlign={I18nManager.isRTL ? "right" : "left"}
          />
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (!editedData || !isInitialized) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      );
    }

    switch (SEGMENTS[activeSegment].id) {
      case "basic":
        return (
          <Animated.View
            style={[
              styles.contentSection,
              { opacity: isInitialized ? fadeAnimation : 1 },
            ]}
          >
            <View style={styles.photoCard}>
              <PhotoEditor
                value={editedData.photo_url || ""}
                onChange={(url) =>
                  setEditedData({ ...editedData, photo_url: url })
                }
                currentPhotoUrl={profile?.photo_url}
                personName={profile?.name}
                profileId={profile?.id}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>المعلومات الأساسية</Text>
              {renderField("الاسم الكامل", editedData.name, (text) =>
                setEditedData({ ...editedData, name: text }),
              )}
              {renderField(
                "الكنية",
                editedData.kunya,
                (text) => setEditedData({ ...editedData, kunya: text }),
                {
                  placeholder:
                    editedData.gender === "female" ? "أم فلان" : "أبو فلان",
                },
              )}
              {renderField("اللقب", editedData.nickname, (text) =>
                setEditedData({ ...editedData, nickname: text }),
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>التصنيف</Text>
              <View style={styles.toggleSection}>
                <Text style={styles.toggleLabel}>الجنس</Text>
                <View style={styles.toggleContainer}>
                  <TouchableOpacity
                    style={[
                      styles.toggleOption,
                      editedData.gender === "male" && styles.toggleOptionActive,
                    ]}
                    onPress={() =>
                      setEditedData({ ...editedData, gender: "male" })
                    }
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        editedData.gender === "male" && styles.toggleTextActive,
                      ]}
                    >
                      ذكر
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleOption,
                      editedData.gender === "female" &&
                        styles.toggleOptionActive,
                    ]}
                    onPress={() =>
                      setEditedData({ ...editedData, gender: "female" })
                    }
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        editedData.gender === "female" &&
                          styles.toggleTextActive,
                      ]}
                    >
                      أنثى
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.toggleSection}>
                <Text style={styles.toggleLabel}>الحالة</Text>
                <View style={styles.toggleContainer}>
                  <TouchableOpacity
                    style={[
                      styles.toggleOption,
                      editedData.status === "alive" &&
                        styles.toggleOptionActive,
                    ]}
                    onPress={() =>
                      setEditedData({ ...editedData, status: "alive" })
                    }
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        editedData.status === "alive" &&
                          styles.toggleTextActive,
                      ]}
                    >
                      {editedData.gender === "female" ? "حية" : "حي"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleOption,
                      editedData.status === "deceased" &&
                        styles.toggleOptionActive,
                    ]}
                    onPress={() =>
                      setEditedData({ ...editedData, status: "deceased" })
                    }
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        editedData.status === "deceased" &&
                          styles.toggleTextActive,
                      ]}
                    >
                      {editedData.gender === "female" ? "متوفاة" : "متوفى"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {renderField(
                "الترتيب بين الإخوة",
                editedData.sibling_order,
                (val) => setEditedData({ ...editedData, sibling_order: val }),
                { numeric: true, keyboardType: "number-pad" },
              )}
            </View>
          </Animated.View>
        );

      case "details":
        return (
          <Animated.View
            style={[
              styles.contentSection,
              { opacity: isInitialized ? fadeAnimation : 1 },
            ]}
          >
            <View style={styles.card}>
              <Text style={styles.cardTitle}>السيرة الشخصية</Text>
              {renderField(
                "نبذة",
                editedData.bio,
                (text) => setEditedData({ ...editedData, bio: text }),
                {
                  multiline: true,
                  maxLength: 500,
                  placeholder: "اكتب نبذة شخصية...",
                },
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>المعلومات المهنية</Text>
              {renderField("المهنة", editedData.occupation, (text) =>
                setEditedData({ ...editedData, occupation: text }),
              )}
              {renderField("التعليم", editedData.education, (text) =>
                setEditedData({ ...editedData, education: text }),
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>الأماكن</Text>
              {renderField("مكان الميلاد", editedData.birth_place, (text) =>
                setEditedData({ ...editedData, birth_place: text }),
              )}
              {renderField(
                "مكان الإقامة",
                editedData.current_residence,
                (text) =>
                  setEditedData({ ...editedData, current_residence: text }),
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>التواريخ المهمة</Text>
              <View style={styles.dateSection}>
                <View style={styles.dateHeader}>
                  <Ionicons name="calendar" size={20} color="#007AFF" />
                  <Text style={styles.dateLabel}>تاريخ الميلاد</Text>
                </View>
                <DateEditor
                  label=""
                  value={editedData.dob_data}
                  onChange={(value) =>
                    setEditedData({ ...editedData, dob_data: value })
                  }
                />
              </View>

              {editedData.status === "deceased" && (
                <View style={styles.dateSection}>
                  <View style={styles.dateHeader}>
                    <Ionicons name="rose" size={20} color="#8E8E93" />
                    <Text style={styles.dateLabel}>تاريخ الوفاة</Text>
                  </View>
                  <DateEditor
                    label=""
                    value={editedData.dod_data}
                    onChange={(value) =>
                      setEditedData({ ...editedData, dod_data: value })
                    }
                  />
                </View>
              )}

              <View style={styles.privacyRow}>
                <View style={styles.privacyInfo}>
                  <Text style={styles.privacyLabel}>إظهار تاريخ الميلاد</Text>
                  <Text style={styles.privacyHint}>للعائلة فقط</Text>
                </View>
                <Switch
                  value={editedData.dob_is_public}
                  onValueChange={(value) =>
                    setEditedData({ ...editedData, dob_is_public: value })
                  }
                  trackColor={{ false: "#E5E5EA", true: "#34C759" }}
                  thumbColor="white"
                />
              </View>
            </View>
          </Animated.View>
        );

      case "family":
        return (
          <Animated.View
            style={[
              styles.contentSection,
              { opacity: isInitialized ? fadeAnimation : 1 },
            ]}
          >
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {editedData.gender === "male" ? "الزوجات" : "الأزواج"}
                </Text>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => setShowMarriageEditor(true)}
                >
                  <Ionicons name="add-circle" size={24} color="#007AFF" />
                </TouchableOpacity>
              </View>

              {loadingMarriages ? (
                <ActivityIndicator
                  size="small"
                  color="#007AFF"
                  style={styles.loader}
                />
              ) : marriages.length > 0 ? (
                <View style={styles.marriagesList}>
                  {marriages.map((marriage) => (
                    <TouchableOpacity
                      key={marriage.id}
                      style={styles.marriageRow}
                      onPress={() => {
                        const spouseName =
                          profile?.gender === "male"
                            ? marriage.wife_name
                            : marriage.husband_name;
                        const statusText =
                          marriage.status === "married"
                            ? editedData.gender === "female"
                              ? "متزوجة"
                              : "متزوج"
                            : marriage.status === "divorced"
                              ? editedData.gender === "female"
                                ? "مطلقة"
                                : "مطلق"
                              : editedData.gender === "female"
                                ? "أرملة"
                                : "أرمل";

                        Alert.alert(
                          "إدارة الزواج",
                          `${spouseName || "غير محدد"}\nالحالة: ${statusText}`,
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
                                    { status: newStatus },
                                  );
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
                                          await profilesService.deleteMarriage(
                                            marriage.id,
                                          );
                                          loadMarriages();
                                        } catch (error) {
                                          Alert.alert("خطأ", "فشل الحذف");
                                        }
                                      },
                                    },
                                  ],
                                );
                              },
                            },
                            { text: "إلغاء", style: "cancel" },
                          ],
                        );
                      }}
                    >
                      <View style={styles.marriageInfo}>
                        <Text style={styles.marriageName}>
                          {profile?.gender === "male"
                            ? marriage.wife_name || "غير محدد"
                            : marriage.husband_name || "غير محدد"}
                        </Text>
                        <Text style={styles.marriageStatus}>
                          {marriage.status === "married"
                            ? editedData.gender === "female"
                              ? "متزوجة"
                              : "متزوج"
                            : marriage.status === "divorced"
                              ? editedData.gender === "female"
                                ? "مطلقة"
                                : "مطلق"
                              : editedData.gender === "female"
                                ? "أرملة"
                                : "أرمل"}
                        </Text>
                      </View>
                      <Ionicons
                        name={
                          I18nManager.isRTL ? "chevron-back" : "chevron-forward"
                        }
                        size={20}
                        color="#C7C7CC"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>لا توجد زيجات مسجلة</Text>
              )}
            </View>
          </Animated.View>
        );

      case "contact":
        return (
          <Animated.View
            style={[
              styles.contentSection,
              { opacity: isInitialized ? fadeAnimation : 1 },
            ]}
          >
            <View style={styles.card}>
              <Text style={styles.cardTitle}>معلومات الاتصال</Text>
              {renderField(
                "رقم الهاتف",
                editedData.phone,
                (text) => setEditedData({ ...editedData, phone: text }),
                { keyboardType: "phone-pad", placeholder: "05xxxxxxxx" },
              )}
              {renderField(
                "البريد الإلكتروني",
                editedData.email,
                (text) => setEditedData({ ...editedData, email: text }),
                {
                  keyboardType: "email-address",
                  placeholder: "example@email.com",
                },
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>وسائل التواصل الاجتماعي</Text>
              <SocialMediaEditor
                links={editedData.social_media_links || {}}
                onChange={(links) =>
                  setEditedData({ ...editedData, social_media_links: links })
                }
              />
            </View>
          </Animated.View>
        );

      default:
        return null;
    }
  };

  if (!visible) return null;

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
            <Text style={[styles.saveText, !hasChanges && styles.disabledText]}>
              حفظ
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Single Segmented Control - iOS Style */}
      {renderSegmentedControl()}

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
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
  },
  handle: {
    paddingTop: 8,
    paddingBottom: 6,
    alignItems: "center",
  },
  handleIndicator: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(60, 60, 67, 0.3)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(60, 60, 67, 0.18)",
  },
  headerButton: {
    padding: 4,
    minWidth: 60,
  },
  cancelText: {
    fontSize: 17,
    color: "#007AFF",
    fontWeight: "400",
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
    letterSpacing: -0.4,
  },
  segmentWrapper: {
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(60, 60, 67, 0.18)",
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "rgba(118, 118, 128, 0.12)",
    borderRadius: 9,
    padding: 2,
    position: "relative",
  },
  segmentIndicator: {
    position: "absolute",
    height: 32,
    backgroundColor: "white",
    borderRadius: 7,
    top: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    zIndex: 1,
    gap: 6,
  },
  segmentIcon: {
    marginTop: 1,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
    letterSpacing: -0.08,
  },
  segmentTextActive: {
    color: "#000",
  },
  scrollContent: {
    paddingTop: 20,
  },
  contentSection: {
    paddingHorizontal: 16,
    gap: 16,
  },
  photoCard: {
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 2,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
    marginBottom: 20,
    letterSpacing: -0.45,
    textAlign: I18nManager.isRTL ? "right" : "left",
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
    marginBottom: 8,
    marginLeft: I18nManager.isRTL ? 0 : 4,
    marginRight: I18nManager.isRTL ? 4 : 0,
    letterSpacing: -0.08,
    textTransform: "uppercase",
    textAlign: I18nManager.isRTL ? "right" : "left",
  },
  fieldInputWrapper: {
    backgroundColor: "rgba(118, 118, 128, 0.06)",
    borderRadius: 10,
    overflow: "hidden",
  },
  fieldInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: "#000",
    letterSpacing: -0.4,
  },
  multilineInput: {
    minHeight: 120,
    textAlignVertical: "top",
    paddingTop: 14,
  },
  toggleSection: {
    marginBottom: 20,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
    marginBottom: 8,
    marginLeft: I18nManager.isRTL ? 0 : 4,
    marginRight: I18nManager.isRTL ? 4 : 0,
    letterSpacing: -0.08,
    textTransform: "uppercase",
    textAlign: I18nManager.isRTL ? "right" : "left",
  },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(118, 118, 128, 0.06)",
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  toggleOptionActive: {
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#8E8E93",
    letterSpacing: -0.24,
  },
  toggleTextActive: {
    color: "#000",
    fontWeight: "600",
  },
  dateSection: {
    marginBottom: 20,
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  dateLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    letterSpacing: -0.24,
    textAlign: I18nManager.isRTL ? "right" : "left",
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(60, 60, 67, 0.18)",
  },
  privacyInfo: {
    flex: 1,
  },
  privacyLabel: {
    fontSize: 17,
    fontWeight: "400",
    color: "#000",
    letterSpacing: -0.4,
    textAlign: I18nManager.isRTL ? "right" : "left",
  },
  privacyHint: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 2,
    letterSpacing: -0.08,
    textAlign: I18nManager.isRTL ? "right" : "left",
  },
  addButton: {
    padding: 4,
  },
  marriagesList: {
    gap: 1,
    backgroundColor: "rgba(60, 60, 67, 0.18)",
    borderRadius: 10,
    overflow: "hidden",
  },
  marriageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    padding: 16,
  },
  marriageInfo: {
    flex: 1,
  },
  marriageName: {
    fontSize: 17,
    fontWeight: "400",
    color: "#000",
    letterSpacing: -0.4,
  },
  marriageStatus: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 2,
    letterSpacing: -0.08,
  },
  loader: {
    marginVertical: 20,
  },
  emptyText: {
    fontSize: 15,
    color: "#8E8E93",
    textAlign: I18nManager.isRTL ? "right" : "center",
    marginVertical: 30,
    letterSpacing: -0.24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
  },
});

export default ModernProfileEditorV4;
