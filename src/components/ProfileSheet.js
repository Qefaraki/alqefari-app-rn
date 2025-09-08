import React, {
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Pressable,
  Dimensions,
  Platform,
  Linking,
  TextInput,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
} from "react-native";
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useTreeStore } from "../stores/useTreeStore";
import {
  familyData,
  FAMILY_NAME,
  getChildren,
  getFather,
} from "../data/family-data";
import CardSurface from "./ios/CardSurface";
import profilesService from "../services/profiles";
import {
  formatDateDisplay,
  getAllSocialMedia,
} from "../services/migrationHelpers";
import GlassMetricPill from "./GlassMetricPill";
import SectionCard from "./SectionCard";
import DefinitionList from "./DefinitionList";
import AchievementsList from "./AchievementsList";
import { LinearGradient } from "expo-linear-gradient";
import GlassTag from "./GlassTag";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { supabase } from "../services/supabase";
import { useAdminMode } from "../contexts/AdminModeContext";
import GlassButton from "./glass/GlassButton";
import SocialMediaEditor from "./admin/SocialMediaEditor";
import AchievementsEditor from "./admin/AchievementsEditor";
import TimelineEditor from "./admin/TimelineEditor";
import NameEditor from "./admin/fields/NameEditor";
import BioEditor from "./admin/fields/BioEditor";
import SiblingOrderStepper from "./admin/fields/SiblingOrderStepper";
import PhotoEditor from "./admin/fields/PhotoEditor";
import DateEditor from "./admin/fields/DateEditor";
import { validateDates } from "../utils/dateUtils";
import ProgressiveImage, {
  ProgressiveHeroImage,
  ProgressiveThumbnail,
} from "./ProgressiveImage";
import MultiAddChildrenModal from "./admin/MultiAddChildrenModal";
import MarriageEditor from "./admin/MarriageEditor";
// Direct translation of the original web ProfileSheet.jsx to Expo

// Note: RTL requires app restart to take effect
// For now, we'll use explicit right-aligned positioning

// Maintain hero image height parity between view and edit
const HERO_HEIGHT = 280;

// High-performance helper to construct full ancestry chain
const constructCommonName = (person, nodesMap) => {
  if (!person) return "";

  const names = [person.name];
  let currentId = person.father_id;

  // Build the ancestry chain using O(1) lookups
  while (currentId) {
    const ancestor = nodesMap.get(currentId);
    if (!ancestor) break;
    names.push(ancestor.name);
    currentId = ancestor.father_id;
  }

  // If there are ancestors, add connector after first name only
  if (names.length > 1) {
    const connector = person.gender === "female" ? " بنت " : " بن ";
    return names[0] + connector + names.slice(1).join(" ");
  }

  return person.name;
};

const generationNames = [
  "الأول",
  "الثاني",
  "الثالث",
  "الرابع",
  "الخامس",
  "السادس",
  "السابع",
  "الثامن",
];

const ProfileSheet = ({ editMode = false }) => {
  // console.log('ProfileSheet: Received editMode prop:', editMode);
  const selectedPersonId = useTreeStore((s) => s.selectedPersonId);
  const setSelectedPersonId = useTreeStore((s) => s.setSelectedPersonId);
  const treeData = useTreeStore((s) => s.treeData);
  const nodesMap = useTreeStore((s) => s.nodesMap);
  const bottomSheetRef = useRef(null);
  const scrollRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [currentSnapIndex, setCurrentSnapIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const headerHeight = 44;
  const scrollY = useRef(new Animated.Value(0)).current;
  const [bioExpanded, setBioExpanded] = useState(false);
  const [familySectionY, setFamilySectionY] = useState(0);
  const [marriages, setMarriages] = useState([]);
  const [loadingMarriages, setLoadingMarriages] = useState(false);
  const [showChildrenModal, setShowChildrenModal] = useState(false);
  const [showMarriageModal, setShowMarriageModal] = useState(false);

  // Admin mode
  const { isAdminMode } = useAdminMode();
  const isEditing = editMode;
  // console.log('ProfileSheet: editMode prop received:', editMode);
  // console.log('ProfileSheet: isAdminMode from context:', isAdminMode);
  // console.log('ProfileSheet: isEditing value:', isEditing);

  // Edit mode state
  const [saving, setSaving] = useState(false);
  const [editedData, setEditedData] = useState(null);
  const [originalData, setOriginalData] = useState(null);
  const [dateErrors, setDateErrors] = useState({ dob: null, dod: null });

  // Detect if there are unsaved changes
  const hasChanges = useMemo(() => {
    if (!editedData || !originalData) return false;
    return JSON.stringify(editedData) !== JSON.stringify(originalData);
  }, [editedData, originalData]);

  // Animation for death date field
  const deathDateHeight = useRef(new Animated.Value(0)).current;

  // Snap points matching original (0.4, 0.9, 1)
  const snapPoints = useMemo(() => ["40%", "90%", "100%"], []);

  // Get person data - try tree data first, fall back to familyData
  const person = useMemo(() => {
    if (treeData && treeData.length > 0) {
      return treeData.find((p) => p.id === selectedPersonId);
    }
    return familyData.find((p) => p.id === selectedPersonId);
  }, [selectedPersonId, treeData]);

  const father = useMemo(() => {
    if (!person) return null;
    const dataSource = treeData.length > 0 ? treeData : familyData;

    // If using backend data, find by father_id
    if (person.father_id && treeData.length > 0) {
      return dataSource.find((p) => p.id === person.father_id);
    }

    // Fall back to old method
    return getFather(person.id, dataSource);
  }, [person, treeData]);

  const children = useMemo(() => {
    if (!person) return [];
    const dataSource = treeData.length > 0 ? treeData : familyData;

    // If using backend data, find by father_id
    if (treeData.length > 0 && person.gender === "male") {
      return dataSource.filter((p) => p.father_id === person.id);
    }

    // Fall back to old method
    return getChildren(person.id, dataSource);
  }, [person, treeData]);

  // Oldest to youngest based on hierarchical HID suffix (higher number = older)
  const sortedChildren = useMemo(() => {
    const getOrder = (p) => {
      const parts = String(p.hid || "").split(".");
      const last = parts.length > 0 ? Number(parts[parts.length - 1]) : 0;
      return isNaN(last) ? 0 : last;
    };
    return [...children].sort((a, b) => getOrder(b) - getOrder(a));
  }, [children]);

  // Calculate metrics
  const descendantsCount = useMemo(() => {
    if (!person) return 0;

    // If backend data has descendants_count, use it
    if (treeData.length > 0 && person.descendants_count !== undefined) {
      return person.descendants_count;
    }

    // Otherwise calculate it
    const dataSource = treeData.length > 0 ? treeData : familyData;
    let count = 0;
    const countDescendants = (id) => {
      const kids = dataSource.filter((p) => p.father_id === id);
      count += kids.length;
      kids.forEach((child) => countDescendants(child.id));
    };
    countDescendants(person.id);
    return count;
  }, [person, treeData]);

  const siblingsCount = useMemo(() => {
    if (!person || !father) return 0;
    const dataSource = treeData.length > 0 ? treeData : familyData;
    const siblings = dataSource.filter((p) => p.father_id === father.id) || [];
    return Math.max(0, siblings.length - 1);
  }, [person, father, treeData]);

  const handleMarriageCreated = useCallback(() => {
    // Refresh marriages list after creating a new one
    loadMarriages();
  }, []);

  // Full name exactly as in original web version (include person's name + connector)
  const fullName = useMemo(() => {
    if (!person) return "";

    const names = [];
    let currentId = person.id;

    // Use the high-performance nodesMap
    while (currentId) {
      const p = nodesMap.get(currentId);
      if (!p) break;
      names.push(p.name);
      currentId = p.father_id;
    }

    names.push(FAMILY_NAME);

    if (names.length > 1) {
      const connector = person.gender === "female" ? "بنت" : "بن";
      // Omit the person's own first name to avoid duplication with the title
      return connector + " " + names.slice(1).join(" ");
    }
    return names.join(" ");
  }, [person, nodesMap]);

  // Handle sheet changes
  const handleSheetChange = useCallback((index) => {
    setCurrentSnapIndex(index);
    if (index !== -1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  // Custom handle: subtle edit affordance without text
  const renderHandle = useCallback(
    () => (
      <View style={styles.handleContainer}>
        <View style={styles.handleBar} />
      </View>
    ),
    [isEditing],
  );

  // Handle copy name
  const handleCopyName = useCallback(async () => {
    await Clipboard.setStringAsync(fullName);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  }, [fullName]);

  // Handle share
  const handleShare = useCallback(async () => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync("", {
        message: fullName,
      });
    }
  }, [fullName]);

  // Scroll helpers
  const scrollToFamily = useCallback(() => {
    if (!scrollRef.current) return;
    try {
      scrollRef.current.scrollTo({
        y: Math.max(0, familySectionY - 16),
        animated: true,
      });
    } catch (e) {}
  }, [familySectionY]);

  // Navigate to another person
  const navigateToPerson = useCallback(
    (personId) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedPersonId(personId);
    },
    [setSelectedPersonId],
  );

  // Custom backdrop
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

  // Show/hide sheet based on selection and load marriages
  useEffect(() => {
    if (selectedPersonId) {
      bottomSheetRef.current?.expand();
      // Try to load marriages - will handle errors gracefully
      loadMarriages();
    } else {
      bottomSheetRef.current?.close();
      setMarriages([]);
    }
  }, [selectedPersonId]);

  // Initialize edit data when entering edit mode
  useEffect(() => {
    if (isEditing && person && !editedData) {
      const initialData = {
        // Personal Identity
        name: person.name || "",
        kunya: person.kunya || "",
        nickname: person.nickname || "",
        gender: person.gender || "male",
        status: person.status || "alive",

        // Family Structure
        father_id: person.father_id || null,
        mother_id: person.mother_id || null,
        sibling_order: person.sibling_order || 0,

        // Dates
        dob_data: person.dob_data || null,
        dod_data: person.dod_data || null,

        // Biography & Location
        bio: person.bio || person.biography || "",
        birth_place: person.birth_place || "",
        current_residence: person.current_residence || "",
        occupation: person.occupation || "",
        education: person.education || "",

        // Contact & Media
        phone: person.phone || "",
        email: person.email || "",
        photo_url: person.photo_url || "",
        social_media_links: person.social_media_links || {},

        // Achievements & Timeline
        achievements: person.achievements || [],
        timeline: person.timeline || [],

        // Privacy & Admin
        dob_is_public: person.dob_is_public || false,
        profile_visibility: person.profile_visibility || "public",
        role: person.role || null,
      };
      setEditedData(initialData);
      setOriginalData(initialData);
    }
  }, [isEditing, person]);

  // Animate death date field visibility
  useEffect(() => {
    Animated.timing(deathDateHeight, {
      toValue: editedData?.status === "deceased" ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [editedData?.status]);

  // Handle date changes with validation
  const handleDateChange = (field, value) => {
    if (!editedData) return;

    const newEditedData = { ...editedData, [field]: value };
    setEditedData(newEditedData);

    // Validate dates
    const errors = validateDates(
      newEditedData.dob_data,
      newEditedData.dod_data,
    );
    setDateErrors(errors);
  };

  // Handle save
  const handleSave = async () => {
    if (!editedData || !person) return;

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
        name: editedData.name?.trim() || person.name, // Name is required
        gender: editedData.gender,
        status: editedData.status,
        sibling_order: editedData.sibling_order,
        // Keep complex fields as is
        social_media_links: editedData.social_media_links,
        achievements: editedData.achievements,
        timeline: editedData.timeline,
        dob_data: editedData.dob_data,
        dod_data: editedData.dod_data,
        dob_is_public: editedData.dob_is_public,
        profile_visibility: editedData.profile_visibility,
        father_id: editedData.father_id,
        mother_id: editedData.mother_id,
        role: editedData.role,
      };

      const { data, error } = await supabase
        .from("profiles")
        .update(cleanedData)
        .eq("id", person.id)
        .select()
        .single();

      if (error) throw error;

      // Update the node in the tree immediately
      if (data) {
        useTreeStore.getState().updateNode(person.id, data);
      }

      // Close sheet first
      setSelectedPersonId(null);

      // Show success message after closing
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

  // Handle cancel
  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(
        "هل تريد إلغاء التغييرات؟",
        "سيتم فقدان جميع التغييرات غير المحفوظة",
        [
          {
            text: "متابعة التحرير",
            style: "cancel",
          },
          {
            text: "إلغاء التغييرات",
            style: "destructive",
            onPress: () => {
              setEditedData(null);
              setOriginalData(null);
              setSelectedPersonId(null);
            },
          },
        ],
      );
    } else {
      setEditedData(null);
      setOriginalData(null);
      setSelectedPersonId(null);
    }
  };

  // Load marriage data
  const loadMarriages = async () => {
    if (!person?.id) return;
    setLoadingMarriages(true);
    try {
      const data = await profilesService.getPersonMarriages(person.id);
      setMarriages(data || []);
    } catch (error) {
      console.error("Error loading marriages:", error);
      setMarriages([]);
    } finally {
      setLoadingMarriages(false);
    }
  };

  if (!person) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      onChange={handleSheetChange}
      onClose={() => setSelectedPersonId(null)}
      backdropComponent={renderBackdrop}
      handleComponent={renderHandle}
      backgroundStyle={[
        styles.sheetBackground,
        isEditing && styles.sheetBackgroundEditing,
      ]}
      enablePanDownToClose
      animateOnMount
    >
      <BottomSheetScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        ref={scrollRef}
        onScroll={(event) => {
          setScrollOffset(event.nativeEvent.contentOffset.y);
        }}
        scrollEventThrottle={16}
      >
        <View style={{ flex: 1 }}>
          {/* Edit mode header with save/cancel - sticky when scrolling */}
          {isEditing && (
            <View
              style={[
                styles.editHeader,
                scrollOffset > 10 && {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  zIndex: 1000,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                  elevation: 4,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleCancel}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.headerButtonText, styles.cancelText]}>
                  إلغاء
                </Text>
              </TouchableOpacity>

              <Text style={styles.headerTitle}>تعديل الملف</Text>

              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleSave}
                disabled={
                  !hasChanges || saving || !!dateErrors.dob || !!dateErrors.dod
                }
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Text
                    style={[
                      styles.headerButtonText,
                      styles.saveText,
                      (!hasChanges || !!dateErrors.dob || !!dateErrors.dod) &&
                        styles.disabledText,
                    ]}
                  >
                    حفظ
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Spacer when header is sticky to prevent content jump */}
          {isEditing && scrollOffset > 10 && (
            <View style={{ height: headerHeight }} />
          )}

          {/* Unified hero card: image + description + metrics */}
          <View style={styles.cardWrapper}>
            {isEditing ? (
              <PhotoEditor
                value={editedData?.photo_url || ""}
                onChange={(url) =>
                  setEditedData({ ...editedData, photo_url: url })
                }
                currentPhotoUrl={person.photo_url}
                personName={person.name}
                profileId={person.id}
              />
            ) : person.photo_url ? (
              <View style={styles.photoSection}>
                <ProgressiveHeroImage
                  source={{ uri: person.photo_url }}
                  style={styles.heroImage}
                  resizeMode="cover"
                />
                <>
                  {/* Top gradient for legibility of the close control */}
                  <LinearGradient
                    colors={["rgba(0,0,0,0.24)", "rgba(0,0,0,0)"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={[StyleSheet.absoluteFill, { height: 120 }]}
                  />
                  <LinearGradient
                    colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.12)"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </>
              </View>
            ) : null}

            <View style={styles.descSection}>
              {isEditing ? (
                <NameEditor
                  value={editedData?.name || ""}
                  onChange={(text) =>
                    setEditedData({ ...editedData, name: text })
                  }
                  placeholder={person.name}
                />
              ) : (
                <Text style={styles.nameText}>{person.name}</Text>
              )}
              <Pressable
                onPress={handleCopyName}
                style={{ width: "100%" }}
                accessibilityLabel="نسخ الاسم الكامل"
              >
                <Text style={styles.fullName}>
                  {fullName}
                  {copied && <Text style={styles.copiedText}> • تم النسخ</Text>}
                </Text>
              </Pressable>
              {/* Header highlight chips */}
              {/* Chips removed; occupation and city moved into metrics grid */}
              {isEditing ? (
                <BioEditor
                  value={editedData?.bio || ""}
                  onChange={(text) =>
                    setEditedData({ ...editedData, bio: text })
                  }
                  maxLength={500}
                />
              ) : person.biography ? (
                <>
                  <Text
                    style={styles.biographyText}
                    numberOfLines={bioExpanded ? undefined : 3}
                  >
                    {person.biography}
                  </Text>
                  {person.biography.length > 120 && (
                    <Pressable
                      onPress={() => setBioExpanded((v) => !v)}
                      accessibilityLabel="عرض المزيد من السيرة"
                    >
                      <Text style={styles.readMore}>
                        {bioExpanded ? "عرض أقل" : "عرض المزيد"}
                      </Text>
                    </Pressable>
                  )}
                </>
              ) : null}

              {/* Metrics row inside hero */}
              <View style={styles.metricsGrid}>
                <GlassMetricPill
                  value={
                    generationNames[person.generation - 1] || person.generation
                  }
                  label="الجيل"
                  onPress={scrollToFamily}
                  style={[styles.pill, styles.metricItem]}
                />
                {children.length > 0 && (
                  <GlassMetricPill
                    value={children.length}
                    label="الأبناء"
                    onPress={scrollToFamily}
                    style={[styles.pill, styles.metricItem]}
                  />
                )}
                {siblingsCount > 0 && (
                  <GlassMetricPill
                    value={siblingsCount}
                    label="الإخوة"
                    onPress={scrollToFamily}
                    style={[styles.pill, styles.metricItem]}
                  />
                )}
                {descendantsCount > 0 && (
                  <GlassMetricPill
                    value={descendantsCount}
                    label="الذرية"
                    onPress={scrollToFamily}
                    style={[styles.pill, styles.metricItem]}
                  />
                )}
                {person.occupation ? (
                  <GlassMetricPill
                    value={person.occupation}
                    label="المهنة"
                    style={[styles.pill, styles.metricItem]}
                  />
                ) : null}
                {person.current_residence ? (
                  <GlassMetricPill
                    value={person.current_residence}
                    label="المدينة"
                    style={[styles.pill, styles.metricItem]}
                  />
                ) : null}
              </View>

              {/* Primary action removed per request */}
            </View>
          </View>

          {/* Information section */}
          <SectionCard title="المعلومات">
            {isEditing ? (
              <View style={{ gap: 16 }}>
                {/* Personal Identity Fields */}
                <View>
                  <Text style={styles.fieldLabel}>الكنية</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editedData?.kunya || ""}
                    onChangeText={(text) =>
                      setEditedData({ ...editedData, kunya: text })
                    }
                    placeholder="أبو فلان"
                    textAlign="right"
                  />
                </View>

                <View>
                  <Text style={styles.fieldLabel}>اللقب</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editedData?.nickname || ""}
                    onChangeText={(text) =>
                      setEditedData({ ...editedData, nickname: text })
                    }
                    placeholder="لقب اختياري"
                    textAlign="right"
                  />
                </View>

                {/* Sibling Order - HIGH PRIORITY */}
                <View>
                  <Text style={styles.fieldLabel}>ترتيب بين الإخوة</Text>
                  <SiblingOrderStepper
                    value={editedData?.sibling_order || 0}
                    onChange={(value) =>
                      setEditedData({ ...editedData, sibling_order: value })
                    }
                    siblingCount={siblingsCount}
                  />
                </View>

                {/* Gender & Status */}
                <View>
                  <Text style={styles.fieldLabel}>الجنس</Text>
                  <View style={styles.toggleRow}>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        editedData?.gender === "male" && styles.toggleActive,
                      ]}
                      onPress={() =>
                        setEditedData({ ...editedData, gender: "male" })
                      }
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          editedData?.gender === "male" &&
                            styles.toggleTextActive,
                        ]}
                      >
                        ذكر
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        editedData?.gender === "female" && styles.toggleActive,
                      ]}
                      onPress={() =>
                        setEditedData({ ...editedData, gender: "female" })
                      }
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          editedData?.gender === "female" &&
                            styles.toggleTextActive,
                        ]}
                      >
                        أنثى
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View>
                  <Text style={styles.fieldLabel}>الحالة</Text>
                  <View style={styles.toggleRow}>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        editedData?.status === "alive" && styles.toggleActive,
                      ]}
                      onPress={() =>
                        setEditedData({ ...editedData, status: "alive" })
                      }
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          editedData?.status === "alive" &&
                            styles.toggleTextActive,
                        ]}
                      >
                        حي
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        editedData?.status === "deceased" &&
                          styles.toggleActive,
                      ]}
                      onPress={() =>
                        setEditedData({ ...editedData, status: "deceased" })
                      }
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          editedData?.status === "deceased" &&
                            styles.toggleTextActive,
                        ]}
                      >
                        متوفى
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Date Fields */}
                {editedData && (
                  <>
                    <View style={{ marginTop: 16 }}>
                      <DateEditor
                        label="تاريخ الميلاد"
                        value={editedData?.dob_data}
                        onChange={(value) =>
                          handleDateChange("dob_data", value)
                        }
                        error={dateErrors.dob}
                      />
                    </View>

                    <Animated.View
                      style={{
                        marginTop: 16,
                        opacity: deathDateHeight,
                        maxHeight: deathDateHeight.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 500],
                        }),
                        overflow: "hidden",
                      }}
                    >
                      <DateEditor
                        label="تاريخ الوفاة"
                        value={editedData?.dod_data}
                        onChange={(value) =>
                          handleDateChange("dod_data", value)
                        }
                        error={dateErrors.dod}
                      />
                    </Animated.View>
                  </>
                )}

                {/* Location Fields */}
                <View>
                  <Text style={styles.fieldLabel}>مكان الميلاد</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editedData?.birth_place || ""}
                    onChangeText={(text) =>
                      setEditedData({ ...editedData, birth_place: text })
                    }
                    placeholder="المدينة أو الدولة"
                    textAlign="right"
                  />
                </View>

                <View>
                  <Text style={styles.fieldLabel}>مكان الإقامة الحالي</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editedData?.current_residence || ""}
                    onChangeText={(text) =>
                      setEditedData({ ...editedData, current_residence: text })
                    }
                    placeholder="المدينة الحالية"
                    textAlign="right"
                  />
                </View>

                <View>
                  <Text style={styles.fieldLabel}>المهنة</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editedData?.occupation || ""}
                    onChangeText={(text) =>
                      setEditedData({ ...editedData, occupation: text })
                    }
                    placeholder="الوظيفة أو العمل"
                    textAlign="right"
                  />
                </View>

                <View>
                  <Text style={styles.fieldLabel}>التعليم</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editedData?.education || ""}
                    onChangeText={(text) =>
                      setEditedData({ ...editedData, education: text })
                    }
                    placeholder="المؤهل العلمي"
                    textAlign="right"
                  />
                </View>

                {/* Contact Fields */}
                <View>
                  <Text style={styles.fieldLabel}>رقم الهاتف</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editedData?.phone || ""}
                    onChangeText={(text) =>
                      setEditedData({ ...editedData, phone: text })
                    }
                    placeholder="05xxxxxxxx"
                    textAlign="right"
                    keyboardType="phone-pad"
                  />
                </View>

                <View>
                  <Text style={styles.fieldLabel}>البريد الإلكتروني</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editedData?.email || ""}
                    onChangeText={(text) =>
                      setEditedData({ ...editedData, email: text })
                    }
                    placeholder="example@email.com"
                    textAlign="right"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                {/* Privacy Settings */}
                <View>
                  <Text style={styles.fieldLabel}>إعدادات الخصوصية</Text>
                  <View style={styles.privacyRow}>
                    <Text style={styles.privacyLabel}>إظهار تاريخ الميلاد</Text>
                    <Switch
                      value={editedData?.dob_is_public || false}
                      onValueChange={(value) =>
                        setEditedData({ ...editedData, dob_is_public: value })
                      }
                    />
                  </View>
                  <View style={styles.toggleRow}>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        editedData?.profile_visibility === "public" &&
                          styles.toggleActive,
                      ]}
                      onPress={() =>
                        setEditedData({
                          ...editedData,
                          profile_visibility: "public",
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          editedData?.profile_visibility === "public" &&
                            styles.toggleTextActive,
                        ]}
                      >
                        عام
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        editedData?.profile_visibility === "family" &&
                          styles.toggleActive,
                      ]}
                      onPress={() =>
                        setEditedData({
                          ...editedData,
                          profile_visibility: "family",
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          editedData?.profile_visibility === "family" &&
                            styles.toggleTextActive,
                        ]}
                      >
                        العائلة فقط
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        editedData?.profile_visibility === "private" &&
                          styles.toggleActive,
                      ]}
                      onPress={() =>
                        setEditedData({
                          ...editedData,
                          profile_visibility: "private",
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          editedData?.profile_visibility === "private" &&
                            styles.toggleTextActive,
                        ]}
                      >
                        خاص
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <DefinitionList
                items={[
                  {
                    label: "تاريخ الميلاد",
                    value: formatDateDisplay(person.dob_data) || "—",
                  },
                  ...(person.dod_data
                    ? [
                        {
                          label: "تاريخ الوفاة",
                          value: formatDateDisplay(person.dod_data),
                        },
                      ]
                    : []),
                  ...(person.birth_place
                    ? [{ label: "مكان الميلاد", value: person.birth_place }]
                    : []),
                  ...(person.current_residence
                    ? [
                        {
                          label: "مكان الإقامة",
                          value: person.current_residence,
                        },
                      ]
                    : []),
                  ...(person.education
                    ? [{ label: "التعليم", value: person.education }]
                    : []),
                  ...(marriages.length > 0
                    ? [
                        {
                          label: "الحالة الاجتماعية",
                          value:
                            marriages.map((m) => m.spouse_name).join("، ") ||
                            `${marriages.length} أزواج`,
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </SectionCard>

          {/* Social Media Links */}
          {isEditing && (
            <SectionCard>
              <SocialMediaEditor
                links={editedData?.social_media_links || {}}
                onChange={(links) =>
                  setEditedData({ ...editedData, social_media_links: links })
                }
              />
            </SectionCard>
          )}

          {/* Contact/Social links (optional, shown only if any present) */}
          {!isEditing &&
            (() => {
              const socialMedia = getAllSocialMedia(person);
              const hasSocialLinks =
                person.phone ||
                person.email ||
                Object.keys(socialMedia).length > 0;

              if (!hasSocialLinks) return null;

              return (
                <SectionCard title="روابط التواصل">
                  <View style={styles.linksGrid}>
                    {person.phone && (
                      <Pressable
                        onPress={() => Linking.openURL(`tel:${person.phone}`)}
                        style={styles.linkItem}
                      >
                        <Text style={styles.linkText}>{person.phone}</Text>
                      </Pressable>
                    )}
                    {person.email && (
                      <Pressable
                        onPress={() =>
                          Linking.openURL(`mailto:${person.email}`)
                        }
                        style={styles.linkItem}
                      >
                        <Text style={styles.linkText}>{person.email}</Text>
                      </Pressable>
                    )}
                    {socialMedia.twitter && (
                      <Pressable
                        onPress={() => Linking.openURL(socialMedia.twitter)}
                        style={styles.linkItem}
                      >
                        <Text style={styles.linkText}>Twitter/X</Text>
                      </Pressable>
                    )}
                    {socialMedia.instagram && (
                      <Pressable
                        onPress={() => Linking.openURL(socialMedia.instagram)}
                        style={styles.linkItem}
                      >
                        <Text style={styles.linkText}>Instagram</Text>
                      </Pressable>
                    )}
                    {socialMedia.linkedin && (
                      <Pressable
                        onPress={() => Linking.openURL(socialMedia.linkedin)}
                        style={styles.linkItem}
                      >
                        <Text style={styles.linkText}>LinkedIn</Text>
                      </Pressable>
                    )}
                    {socialMedia.website && (
                      <Pressable
                        onPress={() => Linking.openURL(socialMedia.website)}
                        style={styles.linkItem}
                      >
                        <Text style={styles.linkText}>Website</Text>
                      </Pressable>
                    )}
                  </View>
                </SectionCard>
              );
            })()}

          {/* Achievements */}
          {isEditing ? (
            <SectionCard>
              <AchievementsEditor
                achievements={editedData?.achievements || []}
                onChange={(achievements) =>
                  setEditedData({ ...editedData, achievements })
                }
              />
            </SectionCard>
          ) : (
            person.achievements &&
            person.achievements.length > 0 && (
              <SectionCard title="الإنجازات">
                <AchievementsList items={person.achievements} />
              </SectionCard>
            )
          )}

          {/* Timeline */}
          {isEditing ? (
            <SectionCard>
              <TimelineEditor
                timeline={editedData?.timeline || []}
                onChange={(timeline) =>
                  setEditedData({ ...editedData, timeline })
                }
              />
            </SectionCard>
          ) : (
            person.timeline &&
            person.timeline.length > 0 && (
              <SectionCard title="الأحداث المهمة">
                <View style={{ gap: 12 }}>
                  {person.timeline.map((event, index) => (
                    <View key={index} style={styles.timelineRow}>
                      <View style={styles.timelineDot} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.timelineHeader}>
                          <Text style={styles.timelineYear}>
                            {event.year}هـ
                          </Text>
                          <Text style={styles.timelineEvent}>
                            {event.event}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </SectionCard>
            )
          )}

          {/* Family list */}
          <View
            style={{ marginHorizontal: 20 }}
            onLayout={(e) => setFamilySectionY(e.nativeEvent.layout.y)}
          >
            <SectionCard
              title="العائلة"
              style={{ marginBottom: 12 }}
              contentStyle={{ paddingHorizontal: 0 }}
            >
              {isEditing && (
                <View style={styles.familyActionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.familyActionBtn,
                      {
                        backgroundColor: "rgba(52,199,89,0.12)",
                        borderColor: "#34C759",
                      },
                    ]}
                    onPress={() => setShowChildrenModal(true)}
                  >
                    <Ionicons
                      name="person-add"
                      size={18}
                      color="#34C759"
                      style={{ marginLeft: 8 }}
                    />
                    <Text
                      style={[styles.familyActionText, { color: "#34C759" }]}
                    >
                      إضافة أطفال
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.familyActionBtn,
                      {
                        backgroundColor: "rgba(0,122,255,0.12)",
                        borderColor: "#007AFF",
                      },
                    ]}
                    onPress={() => setShowMarriageModal(true)}
                  >
                    <Ionicons
                      name="heart-outline"
                      size={18}
                      color="#007AFF"
                      style={{ marginLeft: 8 }}
                    />
                    <Text
                      style={[styles.familyActionText, { color: "#007AFF" }]}
                    >
                      إضافة زواج
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {father && (
                <CardSurface radius={12} style={styles.familyCard}>
                  <Pressable
                    onPress={() => navigateToPerson(father.id)}
                    style={[styles.familyRow]}
                  >
                    <View style={styles.familyInfo}>
                      <ProgressiveThumbnail
                        source={{ uri: father.photo_url }}
                        size={48}
                        style={styles.familyPhoto}
                      />
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.familyName}>{father.name}</Text>
                        <Text style={styles.familyRelation}>الوالد</Text>
                      </View>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                </CardSurface>
              )}
              {sortedChildren && sortedChildren.length > 0 && (
                <CardSurface
                  radius={12}
                  style={[styles.familyCard, { marginTop: 12 }]}
                >
                  <View>
                    {sortedChildren.map((child, idx) => (
                      <Pressable
                        key={child.id}
                        onPress={() => navigateToPerson(child.id)}
                        style={[
                          styles.familyRow,
                          idx < sortedChildren.length - 1 && styles.rowDivider,
                        ]}
                      >
                        <View style={styles.familyInfo}>
                          <ProgressiveThumbnail
                            source={{ uri: child.photo_url }}
                            size={48}
                            style={styles.familyPhoto}
                          />
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={styles.familyName}>{child.name}</Text>
                            <Text style={styles.familyRelation}>
                              {child.gender === "male" ? "ابن" : "ابنة"}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                      </Pressable>
                    ))}
                  </View>
                </CardSurface>
              )}
              {/* Spouses list */}
              {!isEditing && marriages && marriages.length > 0 && (
                <CardSurface
                  radius={12}
                  style={[styles.familyCard, { marginTop: 12 }]}
                >
                  <View>
                    {marriages.map((m, idx) => (
                      <Pressable
                        key={m.marriage_id || m.spouse_id || idx}
                        onPress={() => navigateToPerson(m.spouse_id)}
                        style={[
                          styles.familyRow,
                          idx < marriages.length - 1 && styles.rowDivider,
                        ]}
                      >
                        <View style={styles.familyInfo}>
                          <ProgressiveThumbnail
                            source={{ uri: m.spouse_photo }}
                            size={48}
                            style={styles.familyPhoto}
                          />
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={styles.familyName}>
                              {m.spouse_name}
                            </Text>
                            <Text style={styles.familyRelation}>زوج/زوجة</Text>
                          </View>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                      </Pressable>
                    ))}
                  </View>
                </CardSurface>
              )}
            </SectionCard>
          </View>

          {/* Bottom padding for safe area */}
          <View style={{ height: 100 }} />
        </View>
      </BottomSheetScrollView>
      {/* Family modals: Add Children & Add Marriage */}
      {isEditing && (
        <>
          {person && (
            <MultiAddChildrenModal
              visible={showChildrenModal}
              onClose={() => setShowChildrenModal(false)}
              parentId={person.id}
              parentName={person.name}
              parentGender={person.gender}
            />
          )}
          {person && (
            <MarriageEditor
              visible={showMarriageModal}
              onClose={() => setShowMarriageModal(false)}
              person={person}
              onCreated={handleMarriageCreated}
            />
          )}
        </>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetBackground: {
    backgroundColor: "#FFFFFF",
  },
  sheetBackgroundEditing: {
    // Removed blue border for cleaner look
  },
  handleIndicator: {
    backgroundColor: "#d0d0d0",
    width: 48,
    height: 5,
  },

  // Card header (image + description)
  cardWrapper: {
    marginTop: 12,
    borderRadius: 48,
    overflow: "hidden",
    backgroundColor: "#F7F7F8",
  },
  photoSection: {
    height: HERO_HEIGHT,
    backgroundColor: "#EEE",
  },
  photoEditSection: {
    paddingVertical: 20,
    backgroundColor: "#F7F7F8",
    alignItems: "center",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  descSection: {
    backgroundColor: "#F7F7F8",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  nameText: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
    fontFamily: "SF Arabic",
    textAlign: "right",
    writingDirection: "rtl",
  },
  fullName: {
    fontSize: 17,
    color: "#374151",
    fontFamily: "SF Arabic",
    textAlign: "right",
    lineHeight: 24,
    writingDirection: "rtl",
  },
  copiedText: {
    color: "#059669",
    fontWeight: "600",
  },
  chipsRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(17,24,39,0.05)",
  },
  chipText: {
    fontSize: 13,
    color: "#111827",
    fontFamily: "SF Arabic",
  },

  // Metrics grid
  metricsRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 10,
  },
  metricsGrid: {
    marginTop: 12,
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 10,
  },
  familyActionsRow: {
    flexDirection: "row-reverse",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  familyActionBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  familyActionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  pill: {
    flexGrow: 1,
  },
  metricItem: {
    flexBasis: "30%",
    flexGrow: 1,
  },

  // Content Sections
  sectionBlock: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
    color: "#1a1a1a",
    fontFamily: "SF Arabic",
    textAlign: "right",
    writingDirection: "rtl",
  },
  biographyText: {
    fontSize: 16,
    lineHeight: 26,
    color: "#333",
    fontFamily: "SF Arabic",
    textAlign: "right",
    writingDirection: "rtl",
  },
  readMore: {
    marginTop: 6,
    fontSize: 14,
    color: "#2563eb",
    fontFamily: "SF Arabic",
    textAlign: "right",
  },

  // Grouped info card
  groupedCard: {
    marginTop: 12,
    marginHorizontal: 20,
  },
  groupedRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(15,23,42,0.06)",
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontSize: 13,
    color: "#64748b",
    fontFamily: "SF Arabic",
  },
  rowValue: {
    fontSize: 14,
    color: "#0f172a",
    fontFamily: "SF Arabic",
    textAlign: "right",
  },

  // Links grid
  linksGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 12,
  },
  linkItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(17,24,39,0.04)",
  },
  linkText: {
    fontSize: 15,
    color: "#2563eb",
    fontFamily: "SF Arabic",
  },

  // Achievements
  achievementRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
    marginTop: 2,
  },
  bodyText: {
    fontSize: 15,
    color: "#1f2937",
    fontFamily: "SF Arabic",
    textAlign: "right",
  },

  // Timeline
  timelineRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563eb",
    marginTop: 4,
  },
  timelineHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timelineYear: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "SF Arabic",
  },
  timelineEvent: {
    fontSize: 15,
    color: "#111827",
    fontFamily: "SF Arabic",
    textAlign: "right",
    flexShrink: 1,
  },

  // Family list
  familyCard: {
    marginTop: 8,
  },
  familyRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  familyRowInset: {
    paddingHorizontal: 16,
  },
  familyInfo: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  familyPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginLeft: 12,
  },
  photoPlaceholder: {
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  noPhotoContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  familyName: {
    fontSize: 17,
    fontWeight: "500",
    color: "#1a1a1a",
    marginBottom: 2,
    fontFamily: "SF Arabic",
    textAlign: "right",
    writingDirection: "rtl",
  },
  familyRelation: {
    fontSize: 14,
    color: "#666",
    fontFamily: "SF Arabic",
    textAlign: "right",
    writingDirection: "rtl",
  },
  chevron: {
    fontSize: 22,
    color: "#9ca3af",
    transform: [{ scaleX: -1 }],
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(15,23,42,0.06)",
  },
  parentChildrenSeparator: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(15,23,42,0.08)",
  },

  closeButtonText: {
    fontSize: 20,
    color: "#FFFFFF",
    fontWeight: "600",
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#111827",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "SF Arabic",
  },

  // Edit mode styles
  editableInput: {
    borderBottomWidth: 1,
    borderBottomColor: "#007AFF",
    paddingBottom: 4,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },

  saveButton: {
    backgroundColor: "#34C759",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "600",
  },

  // Field editing styles
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666666",
    marginBottom: 8,
    textAlign: "right",
  },
  fieldInput: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#000000",
    textAlign: "right",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    alignItems: "center",
  },
  toggleActive: {
    backgroundColor: "#007AFF",
  },
  toggleText: {
    fontSize: 15,
    color: "#666666",
    fontWeight: "500",
  },
  toggleTextActive: {
    color: "#FFFFFF",
  },
  privacyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  privacyLabel: {
    fontSize: 15,
    color: "#000000",
  },

  // Handle styles with subtle edit indicator
  handleContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingBottom: 6,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
  },
  handleEditIcon: {
    position: "absolute",
    top: 6,
    right: 16,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(37,99,235,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(37,99,235,0.30)",
  },

  // New edit header styles
  editHeader: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
    backgroundColor: "rgba(255,255,255,0.97)",
    backdropFilter: "blur(10px)",
  },
  headerButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerButtonText: {
    fontSize: 17,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  cancelText: {
    color: "#007AFF",
  },
  saveText: {
    color: "#007AFF",
    fontWeight: "500",
  },
  disabledText: {
    color: "#9CA3AF",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
});

export default ProfileSheet;
