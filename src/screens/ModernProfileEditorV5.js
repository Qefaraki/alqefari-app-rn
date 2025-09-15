import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  StyleSheet,
  I18nManager,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import BottomSheet from "@gorhom/bottom-sheet";
import profilesService from "../services/profiles";
import SocialMediaEditor from "../components/SocialMediaEditor";
import SpouseEditor from "../components/SpouseEditor";
import SpouseProfileEditor from "../components/SpouseProfileEditor";
import { formatHijriDate } from "../utils/arabicUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ModernProfileEditorV5({
  visible,
  profile,
  onClose,
  animatedPosition,
}) {
  // Core states
  const [editedData, setEditedData] = useState({
    name: "",
    gender: "male",
    date_of_birth: null,
    date_of_death: null,
    dob_is_public: true,
    story: "",
    location: "",
    phone: "",
    email: "",
    social_media_links: {},
  });

  // UI states
  const [selectedTab, setSelectedTab] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState("birth");

  // Marriage states
  const [marriages, setMarriages] = useState([]);
  const [loadingMarriages, setLoadingMarriages] = useState(false);
  const [showSpouseEditor, setShowSpouseEditor] = useState(false);
  const [editingSpouse, setEditingSpouse] = useState(null);
  const [showSpouseProfile, setShowSpouseProfile] = useState(false);
  const [selectedSpouse, setSelectedSpouse] = useState(null);

  // Animation states
  const tabIndicatorPosition = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const bottomSheetRef = useRef(null);

  // Tab configuration
  const tabs = [
    { title: "عام", icon: "person-outline" },
    { title: "تفاصيل", icon: "document-text-outline" },
    { title: "عائلة", icon: "people-outline" },
    { title: "تواصل", icon: "at-outline" },
  ];

  // Initialize data
  useEffect(() => {
    if (profile && visible) {
      setEditedData({
        name: profile.name || "",
        gender: profile.gender || "male",
        date_of_birth: profile.date_of_birth,
        date_of_death: profile.date_of_death,
        dob_is_public: profile.dob_is_public ?? true,
        story: profile.story || "",
        location: profile.location || "",
        phone: profile.phone || "",
        email: profile.email || "",
        social_media_links: profile.social_media_links || {},
      });
      loadMarriages();
      setIsInitialized(true);

      // Start fade-in animation
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [profile, visible]);

  // Load marriages
  const loadMarriages = async () => {
    if (!profile?.id) return;

    setLoadingMarriages(true);
    try {
      const { data, error } = await profilesService.getMarriages(profile.id);
      if (error) throw error;
      setMarriages(data || []);
    } catch (error) {
      console.error("Error loading marriages:", error);
    } finally {
      setLoadingMarriages(false);
    }
  };

  // Tab animation
  useEffect(() => {
    const totalTabs = tabs.length;
    const tabWidth = SCREEN_WIDTH / totalTabs;
    const targetPosition = I18nManager.isRTL
      ? (totalTabs - 1 - selectedTab) * tabWidth
      : selectedTab * tabWidth;

    Animated.spring(tabIndicatorPosition, {
      toValue: targetPosition,
      useNativeDriver: true,
      tension: 68,
      friction: 12,
    }).start();
  }, [selectedTab]);

  // Save handler
  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await profilesService.updateProfile(
        profile.id,
        editedData,
      );
      if (error) throw error;

      Alert.alert("نجح", "تم حفظ التغييرات بنجاح");
      if (onClose) onClose();
    } catch (error) {
      Alert.alert("خطأ", "فشل حفظ التغييرات");
    } finally {
      setLoading(false);
    }
  };

  // Render field helper
  const renderField = (label, value, onChange, options = {}) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, options.multiline && styles.textArea]}
        value={value}
        onChangeText={onChange}
        placeholder={options.placeholder || `أدخل ${label}`}
        keyboardType={options.keyboardType || "default"}
        multiline={options.multiline}
        numberOfLines={options.numberOfLines || 1}
        editable={!options.disabled}
        textAlign={I18nManager.isRTL ? "right" : "left"}
      />
    </View>
  );

  // Render date field
  const renderDateField = (label, value, mode) => (
    <TouchableOpacity
      style={styles.fieldContainer}
      onPress={() => {
        setDatePickerMode(mode);
        setShowDatePicker(true);
      }}
    >
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.dateFieldInput}>
        <Text style={styles.dateText}>
          {value ? formatHijriDate(value) : "غير محدد"}
        </Text>
        <Ionicons name="calendar-outline" size={20} color="#007AFF" />
      </View>
    </TouchableOpacity>
  );

  // Render marriage item with improved UI
  const renderMarriageItem = (marriage) => {
    const spouseName =
      profile?.gender === "male" ? marriage.wife_name : marriage.husband_name;

    const getStatusDisplay = () => {
      if (marriage.status === "divorced") {
        return {
          text: profile?.gender === "male" ? "سابقة" : "سابق",
          color: "#8E8E93",
        };
      }
      if (marriage.status === "widowed") {
        return {
          text: profile?.gender === "male" ? "رحمها الله" : "رحمه الله",
          color: "#8E8E93",
        };
      }
      return null;
    };

    const statusDisplay = getStatusDisplay();

    return (
      <TouchableOpacity
        key={marriage.id}
        style={styles.marriageCard}
        onPress={() => {
          setSelectedSpouse(marriage);
          setShowSpouseProfile(true);
        }}
      >
        <View style={styles.marriageCardContent}>
          <View style={styles.marriageInfo}>
            <Text style={styles.marriageName}>{spouseName || "غير محدد"}</Text>
            {statusDisplay && (
              <Text
                style={[styles.marriageSubtext, { color: statusDisplay.color }]}
              >
                {statusDisplay.text}
              </Text>
            )}
            {marriage.marriage_date && (
              <Text style={styles.marriageDate}>
                {formatHijriDate(marriage.marriage_date)}
              </Text>
            )}
          </View>
          <View style={styles.marriageActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                setEditingSpouse(marriage);
                setShowSpouseEditor(true);
              }}
            >
              <Ionicons name="create-outline" size={20} color="#007AFF" />
            </TouchableOpacity>
            <Ionicons
              name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"}
              size={20}
              color="#C7C7CC"
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render content based on selected tab
  const renderContent = () => {
    switch (selectedTab) {
      case 0: // General
        return (
          <Animated.View
            style={[styles.contentSection, { opacity: fadeAnimation }]}
          >
            <View style={styles.card}>
              <Text style={styles.cardTitle}>المعلومات الأساسية</Text>
              {renderField("الاسم الكامل", editedData.name, (text) =>
                setEditedData({ ...editedData, name: text }),
              )}

              <View style={styles.genderSelector}>
                <Text style={styles.fieldLabel}>النوع</Text>
                <View style={styles.genderButtons}>
                  <TouchableOpacity
                    style={[
                      styles.genderButton,
                      editedData.gender === "male" && styles.genderButtonActive,
                    ]}
                    onPress={() =>
                      setEditedData({ ...editedData, gender: "male" })
                    }
                  >
                    <Text
                      style={[
                        styles.genderButtonText,
                        editedData.gender === "male" &&
                          styles.genderButtonTextActive,
                      ]}
                    >
                      ذكر
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.genderButton,
                      editedData.gender === "female" &&
                        styles.genderButtonActive,
                    ]}
                    onPress={() =>
                      setEditedData({ ...editedData, gender: "female" })
                    }
                  >
                    <Text
                      style={[
                        styles.genderButtonText,
                        editedData.gender === "female" &&
                          styles.genderButtonTextActive,
                      ]}
                    >
                      أنثى
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Animated.View>
        );

      case 1: // Details
        return (
          <Animated.View
            style={[styles.contentSection, { opacity: fadeAnimation }]}
          >
            <View style={styles.card}>
              <Text style={styles.cardTitle}>التواريخ</Text>
              {renderDateField(
                "تاريخ الميلاد",
                editedData.date_of_birth,
                "birth",
              )}
              {renderDateField(
                "تاريخ الوفاة",
                editedData.date_of_death,
                "death",
              )}

              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>إظهار تاريخ الميلاد</Text>
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

            <View style={styles.card}>
              <Text style={styles.cardTitle}>معلومات إضافية</Text>
              {renderField(
                "الموقع",
                editedData.location,
                (text) => setEditedData({ ...editedData, location: text }),
                { placeholder: "المدينة، البلد" },
              )}
              {renderField(
                "القصة",
                editedData.story,
                (text) => setEditedData({ ...editedData, story: text }),
                {
                  multiline: true,
                  numberOfLines: 4,
                  placeholder: "أضف قصة أو سيرة ذاتية...",
                },
              )}
            </View>
          </Animated.View>
        );

      case 2: // Family
        return (
          <Animated.View
            style={[styles.contentSection, { opacity: fadeAnimation }]}
          >
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {editedData.gender === "male" ? "الزوجات" : "الأزواج"}
                </Text>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => {
                    setEditingSpouse(null);
                    setShowSpouseEditor(true);
                  }}
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
                  {marriages.map(renderMarriageItem)}
                </View>
              ) : (
                <Text style={styles.emptyText}>
                  {editedData.gender === "male"
                    ? "لا توجد زوجات مسجلة"
                    : "لا يوجد أزواج مسجلون"}
                </Text>
              )}
            </View>
          </Animated.View>
        );

      case 3: // Contact
        return (
          <Animated.View
            style={[styles.contentSection, { opacity: fadeAnimation }]}
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
    <>
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={["90%"]}
        animatedPosition={animatedPosition}
        onClose={onClose}
        backdropComponent={({ animatedIndex, style }) => (
          <Animated.View
            style={[
              style,
              {
                backgroundColor: "rgba(0,0,0,0.5)",
                opacity: animatedIndex,
              },
            ]}
          />
        )}
        handleComponent={() => (
          <View style={styles.handle}>
            <View style={styles.handleIndicator} />
          </View>
        )}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>إلغاء</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>تعديل الملف الشخصي</Text>
            <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
              {loading ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text style={styles.saveButtonText}>حفظ</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <View style={styles.tabs}>
              {tabs.map((tab, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.tab}
                  onPress={() => setSelectedTab(index)}
                >
                  <Ionicons
                    name={tab.icon}
                    size={20}
                    color={selectedTab === index ? "#007AFF" : "#8E8E93"}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      selectedTab === index && styles.tabTextActive,
                    ]}
                  >
                    {tab.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Animated.View
              style={[
                styles.tabIndicator,
                {
                  transform: [{ translateX: tabIndicatorPosition }],
                  width: SCREEN_WIDTH / tabs.length,
                },
              ]}
            />
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {renderContent()}
          </ScrollView>
        </View>
      </BottomSheet>

      {/* Spouse Editor Modal */}
      <SpouseEditor
        visible={showSpouseEditor}
        onClose={() => {
          setShowSpouseEditor(false);
          setEditingSpouse(null);
        }}
        person={profile}
        marriage={editingSpouse}
        onSave={() => {
          loadMarriages();
          setShowSpouseEditor(false);
          setEditingSpouse(null);
        }}
      />

      {/* Spouse Profile Modal */}
      <SpouseProfileEditor
        visible={showSpouseProfile}
        onClose={() => {
          setShowSpouseProfile(false);
          setSelectedSpouse(null);
        }}
        spouse={selectedSpouse}
        person={profile}
        onSave={() => {
          loadMarriages();
        }}
      />

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={
            datePickerMode === "birth"
              ? editedData.date_of_birth
                ? new Date(editedData.date_of_birth)
                : new Date()
              : editedData.date_of_death
                ? new Date(editedData.date_of_death)
                : new Date()
          }
          mode="date"
          display="spinner"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              if (datePickerMode === "birth") {
                setEditedData({
                  ...editedData,
                  date_of_birth: selectedDate.toISOString().split("T")[0],
                });
              } else {
                setEditedData({
                  ...editedData,
                  date_of_death: selectedDate.toISOString().split("T")[0],
                });
              }
            }
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  handle: {
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "white",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  handleIndicator: {
    width: 36,
    height: 5,
    backgroundColor: "#D1D1D6",
    borderRadius: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C6C6C8",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 17,
    color: "#007AFF",
  },
  saveButton: {
    padding: 4,
  },
  saveButtonText: {
    fontSize: 17,
    color: "#007AFF",
    fontWeight: "600",
  },
  tabsContainer: {
    backgroundColor: "white",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C6C6C8",
  },
  tabs: {
    flexDirection: "row",
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  tabText: {
    fontSize: 10,
    marginTop: 4,
    color: "#8E8E93",
  },
  tabTextActive: {
    color: "#007AFF",
  },
  tabIndicator: {
    height: 2,
    backgroundColor: "#007AFF",
    marginTop: 8,
  },
  content: {
    flex: 1,
  },
  contentSection: {
    paddingVertical: 16,
  },
  card: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 8,
  },
  fieldInput: {
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
    padding: 12,
    fontSize: 17,
    color: "#000",
    textAlign: I18nManager.isRTL ? "right" : "left",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  dateFieldInput: {
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateText: {
    fontSize: 17,
    color: "#000",
  },
  genderSelector: {
    marginBottom: 16,
  },
  genderButtons: {
    flexDirection: "row",
    gap: 12,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
  },
  genderButtonActive: {
    backgroundColor: "#007AFF",
  },
  genderButtonText: {
    fontSize: 17,
    color: "#000",
  },
  genderButtonTextActive: {
    color: "white",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  addButton: {
    padding: 4,
  },
  marriagesList: {
    gap: 12,
  },
  marriageCard: {
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  marriageCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  marriageInfo: {
    flex: 1,
  },
  marriageName: {
    fontSize: 17,
    fontWeight: "500",
    color: "#000",
  },
  marriageSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  marriageDate: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 2,
  },
  marriageActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  emptyText: {
    fontSize: 15,
    color: "#8E8E93",
    textAlign: "center",
    paddingVertical: 20,
  },
  loader: {
    paddingVertical: 20,
  },
});
