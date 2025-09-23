import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  I18nManager,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "../contexts/SettingsContext";
import { formatDateByPreference } from "../utils/dateDisplay";
import { gregorianToHijri } from "../utils/hijriConverter";
import { supabase } from "../services/supabase";
import { useTreeStore } from "../stores/useTreeStore";
import appConfig from "../config/appConfig";

// Family Logo
const AlqefariLogo = require("../../assets/logo/Alqefari Emblem (Transparent).png");

// Profile cache to avoid repeated calls
let profileCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function SettingsModal({ visible, onClose }) {
  const { settings, updateSetting, clearSettings } = useSettings();
  const [expandedSection, setExpandedSection] = useState("date");
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Sample date for preview - using a valid date
  const sampleGregorian = { day: 15, month: 3, year: 2024 };
  const sampleHijri = gregorianToHijri(2024, 3, 15);

  const sampleDate = {
    gregorian: sampleGregorian,
    hijri: sampleHijri || { day: 5, month: 9, year: 1445 }, // Fallback if conversion fails
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Load user profile
  useEffect(() => {
    if (visible) {
      loadUserProfile();
    }
  }, [visible]);

  const loadUserProfile = async () => {
    setLoadingProfile(true);
    
    // Check cache first
    const now = Date.now();
    if (profileCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
      setCurrentUser(profileCache.user);
      setUserProfile(profileCache.profile);
      setLoadingProfile(false);
      return;
    }
    
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (user) {
        // Try to find matching profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .or(`email.eq.${user.email},phone.eq.${user.phone}`)
          .single();

        setUserProfile(profile);
        
        // Update cache
        profileCache = { user, profile };
        cacheTimestamp = Date.now();
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      "تسجيل الخروج",
      "هل أنت متأكد من تسجيل الخروج؟",
      [
        {
          text: "إلغاء",
          style: "cancel",
        },
        {
          text: "تسجيل الخروج",
          style: "destructive",
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              // Clear cache on sign out
              profileCache = null;
              cacheTimestamp = null;
              // Clear any local state
              useTreeStore.getState().setSelectedPersonId(null);
              onClose();
            } catch (error) {
              Alert.alert("خطأ", "فشل تسجيل الخروج");
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "⚠️ حذف الحساب",
      "هل أنت متأكد من حذف حسابك؟\n\nسيتم:\n• إلغاء ربط الحساب بالملف الشخصي\n• حذف جميع طلبات الربط\n• حذف بيانات المستخدم\n\nيمكنك إنشاء حساب جديد لاحقاً",
      [
        {
          text: "إلغاء",
          style: "cancel",
        },
        {
          text: "حذف الحساب نهائياً",
          style: "destructive",
          onPress: () => {
            // Second confirmation for safety
            Alert.alert(
              "تأكيد نهائي",
              "اكتب 'حذف' للتأكيد",
              [
                {
                  text: "إلغاء",
                  style: "cancel",
                },
                {
                  text: "حذف",
                  style: "destructive",
                  onPress: performAccountDeletion,
                },
              ],
              { cancelable: true },
            );
          },
        },
      ],
      { cancelable: true },
    );
  };

  const performAccountDeletion = async () => {
    try {
      // Show loading
      Alert.alert("جاري الحذف", "يتم حذف الحساب...");

      // Call the RPC function to unlink and delete
      const { error: unlinkError } = await supabase.rpc(
        "delete_user_account_and_unlink",
      );

      if (unlinkError) {
        console.error("Error deleting account:", unlinkError);
        Alert.alert("خطأ", "فشل حذف الحساب: " + unlinkError.message);
        return;
      }

      // Sign out the user
      await supabase.auth.signOut();
              // Clear cache on sign out
              profileCache = null;
              cacheTimestamp = null;

      // Clear any local state
      useTreeStore.getState().setSelectedPersonId(null);
      clearSettings();

      Alert.alert("✅ تم الحذف", "تم حذف الحساب بنجاح", [
        {
          text: "موافق",
          onPress: () => {
            onClose();
          },
        },
      ]);
    } catch (error) {
      console.error("Error in account deletion:", error);
      Alert.alert("خطأ", "حدث خطأ أثناء حذف الحساب");
    }
  };

  const renderDatePreview = () => {
    const previewText = formatDateByPreference(sampleDate, settings);

    return (
      <View style={styles.previewContainer}>
        <Text style={styles.previewTitle}>معاينة:</Text>
        <Text style={styles.previewText}>{previewText || "15/03/2024"}</Text>
      </View>
    );
  };

  const renderSegmentedControl = (options, value, onValueChange) => {
    return (
      <View style={styles.segmentedControl}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.segment,
              value === option.value && styles.segmentActive,
            ]}
            onPress={() => onValueChange(option.value)}
          >
            <Text
              style={[
                styles.segmentText,
                value === option.value && styles.segmentTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#242121" />
          </TouchableOpacity>
          <Text style={styles.title}>الإعدادات</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Section - Beautiful World-Class Design */}
          {loadingProfile ? (
            <View style={styles.profileCard}>
              <View style={styles.profileContent}>
                <View style={styles.profileImageContainer}>
                  <View style={[styles.profileImagePlaceholder, {backgroundColor: "#D1BBA340"}]} />
                </View>
                <View style={styles.profileTextContainer}>
                  <View style={{height: 18, width: 120, backgroundColor: "#D1BBA340", borderRadius: 9, marginBottom: 8}} />
                  <View style={{height: 14, width: 180, backgroundColor: "#D1BBA340", borderRadius: 7}} />
                </View>
              </View>
            </View>
          ) : currentUser ? (
            <TouchableOpacity
              style={styles.profileCard}
              activeOpacity={0.95}
              onPress={() => {
                if (userProfile) {
                  // Open profile editor
                  useTreeStore.getState().setSelectedPersonId(userProfile.id);
                  onClose();
                }
              }}
            >
              <View style={styles.profileContent}>
                <View style={styles.profileImageContainer}>
                  {userProfile?.photo_url ? (
                    <Image
                      source={{ uri: userProfile.photo_url }}
                      style={styles.profileImage}
                    />
                  ) : (
                    <View style={styles.profileImagePlaceholder}>
                      <Text style={styles.profileInitial}>
                        {(userProfile?.name ||
                          currentUser.email ||
                          "U")[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.onlineBadge} />
                </View>

                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>
                    {userProfile?.name || "مستخدم جديد"}
                  </Text>
                  <Text style={styles.profileDetail}>
                    {currentUser.phone
                      ? `${currentUser.phone.substring(0, 4)} ••• ${currentUser.phone.slice(-4)}`
                      : currentUser.email || ""}
                  </Text>
                  {userProfile && (
                    <View style={styles.profileLinkContainer}>
                      <Text style={styles.profileViewLink}>
                        عرض الملف الشخصي
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={14}
                        color="#007AFF"
                      />
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.signInPromptCard}>
              <View style={styles.signInIconContainer}>
                <View style={styles.signInIconBackground}>
                  <Image
                    source={AlqefariLogo}
                    style={styles.signInLogo}
                    resizeMode="contain"
                  />
                </View>
              </View>

              <Text style={styles.signInTitle}>حياك الله في شجرة القفاري</Text>
              <Text style={styles.signInSubtitle}>لصلة الرحم وحفظ الأنساب</Text>

              <TouchableOpacity
                style={styles.signInButton}
                onPress={() => {
                  // Close settings and trigger re-authentication
                  onClose();
                  // Force sign out to show onboarding/auth flow
                  setTimeout(async () => {
                    await supabase.auth.signOut();
              // Clear cache on sign out
              profileCache = null;
              cacheTimestamp = null;
                    // This will trigger the auth state change listener
                    // and show the onboarding screen
                  }, 100);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.signInButtonText}>تسجيل الدخول</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.signInFeatures}>
                <View style={styles.signInFeature}>
                  <Ionicons
                    name="git-network-outline"
                    size={18}
                    color="#D58C4A"
                  />
                  <Text style={styles.signInFeatureText}>صلة رحم</Text>
                </View>
                <View style={styles.signInFeatureDivider} />
                <View style={styles.signInFeature}>
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color="#D58C4A"
                  />
                  <Text style={styles.signInFeatureText}>توثيق</Text>
                </View>
                <View style={styles.signInFeatureDivider} />
                <View style={styles.signInFeature}>
                  <Ionicons name="heart-outline" size={18} color="#D58C4A" />
                  <Text style={styles.signInFeatureText}>ذكرى</Text>
                </View>
              </View>
            </View>
          )}

          {/* Date Format Settings */}
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection("date")}
            activeOpacity={0.7}
          >
            <Ionicons
              name={expandedSection === "date" ? "chevron-up" : "chevron-down"}
              size={20}
              color="#24212199"
            />
            <View style={styles.sectionHeaderContent}>
              <Text style={styles.sectionTitle}>تنسيق التاريخ</Text>
              {expandedSection !== "date" && (
                <Text style={styles.sectionSubtitle}>
                  {settings.defaultCalendar === "hijri" ? "هجري" : "ميلادي"} •{" "}
                  {settings.dateFormat === "numeric"
                    ? "رقمي"
                    : settings.dateFormat === "words"
                      ? "كلمات"
                      : "مختلط"}
                </Text>
              )}
            </View>
          </TouchableOpacity>

          {expandedSection === "date" && (
            <View style={styles.section}>
              {renderDatePreview()}

              {/* Calendar Type */}
              <View style={styles.optionGroup}>
                <Text style={styles.optionGroupLabel}>التقويم الافتراضي</Text>
                {renderSegmentedControl(
                  [
                    { label: "ميلادي", value: "gregorian" },
                    { label: "هجري", value: "hijri" },
                  ],
                  settings.defaultCalendar,
                  (value) => updateSetting("defaultCalendar", value),
                )}
              </View>

              {/* Date Format */}
              <View style={styles.optionGroup}>
                <Text style={styles.optionGroupLabel}>شكل التاريخ</Text>
                {renderSegmentedControl(
                  [
                    { label: "رقمي", value: "numeric" },
                    { label: "كلمات", value: "words" },
                  ],
                  settings.dateFormat,
                  (value) => updateSetting("dateFormat", value),
                )}
                <Text style={styles.optionHint}>
                  {settings.dateFormat === "numeric" && "15/03/2024"}
                  {settings.dateFormat === "words" && "15 مارس 2024"}
                </Text>
              </View>

              {/* Show Both Calendars */}
              <View style={styles.switchOption}>
                <Switch
                  value={settings.showBothCalendars}
                  onValueChange={(value) =>
                    updateSetting("showBothCalendars", value)
                  }
                  trackColor={{ false: "#D1D5DB", true: "#10B981" }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#D1D5DB"
                />
                <View style={styles.switchOptionContent}>
                  <Text style={styles.switchOptionLabel}>
                    عرض التقويمين معاً
                  </Text>
                  <Text style={styles.switchOptionHint}>
                    عرض التاريخ الهجري والميلادي
                  </Text>
                </View>
              </View>

              {/* Arabic Numerals (for both calendar types) */}
              <View style={styles.switchOption}>
                <Switch
                  value={settings.arabicNumerals}
                  onValueChange={(value) =>
                    updateSetting("arabicNumerals", value)
                  }
                  trackColor={{ false: "#D1D5DB", true: "#10B981" }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#D1D5DB"
                />
                <View style={styles.switchOptionContent}>
                  <Text style={styles.switchOptionLabel}>الأرقام العربية</Text>
                  <Text style={styles.switchOptionHint}>
                    استخدام ١٢٣ بدلاً من 123
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Other Settings Sections (collapsed by default) */}
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection("privacy")}
            activeOpacity={0.7}
          >
            <Ionicons
              name={
                expandedSection === "privacy" ? "chevron-up" : "chevron-down"
              }
              size={20}
              color="#6B7280"
            />
            <View style={styles.sectionHeaderContent}>
              <Text style={styles.sectionTitle}>الخصوصية</Text>
            </View>
          </TouchableOpacity>

          {expandedSection === "privacy" && (
            <View style={styles.section}>
              <Text style={styles.optionHint}>
                إعدادات الخصوصية قادمة قريباً
              </Text>
            </View>
          )}

          {/* Reset Settings */}
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => {
              Alert.alert(
                "إعادة تعيين الإعدادات",
                "هل تريد إعادة جميع الإعدادات إلى القيم الافتراضية؟",
                [
                  { text: "إلغاء", style: "cancel" },
                  {
                    text: "إعادة تعيين",
                    style: "destructive",
                    onPress: clearSettings,
                  },
                ],
                { cancelable: true },
              );
            }}
          >
            <Text style={styles.resetButtonText}>
              إعادة تعيين جميع الإعدادات
            </Text>
          </TouchableOpacity>

          {/* Sign Out Button - Beautiful Design */}
          {currentUser && (
            <View style={styles.signOutSection}>
              <TouchableOpacity
                style={styles.signOutButton}
                onPress={handleSignOut}
                activeOpacity={0.9}
              >
                <View style={styles.signOutContent}>
                  <View style={styles.signOutIconContainer}>
                    <Ionicons
                      name="log-out-outline"
                      size={22}
                      color="#A13333"
                    />
                  </View>
                  <Text style={styles.signOutButtonText}>تسجيل الخروج</Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.signOutHint}>
                سيتم حفظ جميع إعداداتك محلياً
              </Text>
            </View>
          )}

          {/* Delete Account Button - Danger Zone */}
          {currentUser && userProfile && (
            <View style={styles.dangerSection}>
              <TouchableOpacity
                style={styles.deleteAccountButton}
                onPress={handleDeleteAccount}
                activeOpacity={0.9}
              >
                <View style={styles.deleteAccountContent}>
                  <View style={styles.deleteAccountIconContainer}>
                    <Ionicons name="trash-outline" size={22} color="#F44336" />
                  </View>
                  <Text style={styles.deleteAccountButtonText}>حذف الحساب</Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.deleteAccountHint}>
                سيتم إلغاء ربط الحساب بالملف الشخصي
              </Text>
            </View>
          )}

          <View style={{ height: 50 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3", // Al-Jass White
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#F9F7F3", // Al-Jass White
    borderBottomWidth: 1,
    borderBottomColor: "#D1BBA340", // Camel Hair Beige 40%
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#242121", // Sadu Night
  },
  content: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: "row-reverse", // RTL: chevron on left, content on right
    alignItems: "center",
    backgroundColor: "#F9F7F3", // Al-Jass White
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#D1BBA340", // Camel Hair Beige 40%
    borderBottomWidth: 1,
    borderBottomColor: "#D1BBA340",
  },
  sectionHeaderContent: {
    flex: 1,
    marginLeft: 12, // Space from chevron
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#111827",
    textAlign: I18nManager.isRTL ? "right" : "left",
    writingDirection: "rtl",
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    color: "#6B7280",
    marginTop: 2,
    textAlign: I18nManager.isRTL ? "right" : "left",
    writingDirection: "rtl",
  },
  section: {
    backgroundColor: "#F9F7F3", // Al-Jass White
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  previewContainer: {
    backgroundColor: "#D1BBA320", // Camel Hair Beige 20%
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1BBA340",
  },
  previewTitle: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: "#6B7280",
    marginBottom: 8,
  },
  previewText: {
    fontSize: 18,
    fontFamily: "SF Arabic",
    color: "#111827",
    fontWeight: "500",
    textAlign: "center",
  },
  optionGroup: {
    marginBottom: 24,
  },
  optionGroupLabel: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    color: "#374151",
    fontWeight: "500",
    marginBottom: 12,
    textAlign: I18nManager.isRTL ? "right" : "left",
    writingDirection: "rtl",
  },
  optionHint: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: "#6B7280",
    marginTop: 8,
    textAlign: I18nManager.isRTL ? "right" : "left",
    writingDirection: "rtl",
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#D1BBA320", // Camel Hair Beige 20%
    borderRadius: 10,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: "#A13333", // Najdi Crimson for active state
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    color: "#24212199", // Sadu Night 60%
    fontWeight: "500",
  },
  segmentTextActive: {
    color: "#F9F7F3", // Al-Jass White for contrast on crimson
    fontWeight: "600",
  },
  switchOption: {
    flexDirection: "row-reverse", // RTL: switch on left, text on right
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  switchOptionContent: {
    flex: 1,
    marginLeft: 12,
  },
  switchOptionLabel: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    color: "#111827",
    fontWeight: "500",
    textAlign: I18nManager.isRTL ? "right" : "left",
    writingDirection: "rtl",
  },
  switchOptionHint: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: "#6B7280",
    marginTop: 2,
    textAlign: I18nManager.isRTL ? "right" : "left",
    writingDirection: "rtl",
  },
  resetButton: {
    margin: 20,
    padding: 16,
    backgroundColor: "#A1333310", // Najdi Crimson 10%
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#A1333330", // Najdi Crimson 30%
  },
  resetButtonText: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    color: "#A13333", // Najdi Crimson
    fontWeight: "500",
  },
  profileCard: {
    backgroundColor: "#F9F7F3", // Al-Jass White
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#D1BBA340", // Camel Hair Beige 40%
  },
  profileCardLoading: {
    backgroundColor: "#F9F7F3", // Al-Jass White
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 20,
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1BBA340",
  },
  profileContent: {
    flexDirection: "row-reverse", // RTL: image on right, text on left
    alignItems: "center",
    padding: 20,
  },
  profileImageContainer: {
    marginLeft: 16, // Changed for RTL
    marginRight: 0,
    position: "relative",
  },
  profileImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F3F4F6",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profileImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    backgroundColor: "#A13333", // Najdi Crimson instead of blue
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  profileInitial: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#10B981",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  profileInfo: {
    flex: 1,
    marginRight: 8,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#242121", // Sadu Night
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  profileDetail: {
    fontSize: 15,
    color: "#24212199", // Sadu Night 60%
    marginBottom: 6,
    fontWeight: "500",
  },
  profileLinkContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  profileViewLink: {
    fontSize: 14,
    fontWeight: "600",
    color: "#A13333", // Najdi Crimson
  },
  signInPrompt: {
    backgroundColor: "#F9F7F3", // Al-Jass White
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 20,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1BBA340",
  },
  signInPromptText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 12,
    fontWeight: "500",
  },
  signOutSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  signOutButton: {
    backgroundColor: "#F9F7F3", // Al-Jass White
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: "#A13333",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: "#A1333330", // Najdi Crimson 30%
    overflow: "hidden",
  },
  signOutContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 10,
  },
  signOutIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#A1333310", // Najdi Crimson 10%
    alignItems: "center",
    justifyContent: "center",
  },
  signOutButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#A13333", // Najdi Crimson
    letterSpacing: -0.3,
  },
  signOutHint: {
    fontSize: 13,
    color: "#24212166", // Sadu Night 40%
    textAlign: "center",
    marginTop: 8,
    fontWeight: "500",
  },
  signInPromptCard: {
    backgroundColor: "#F9F7F3", // Al-Jass White
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#D1BBA340", // Camel Hair Beige 40%
  },
  signInIconContainer: {
    marginBottom: 20,
  },
  signInIconBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#D1BBA320", // Camel Hair Beige 20% opacity
    alignItems: "center",
    justifyContent: "center",
    padding: 5,
    borderWidth: 1,
    borderColor: "#D1BBA340", // Camel Hair Beige 40%
  },
  signInLogo: {
    width: 90,
    height: 90,
    // No tintColor - keep logo in its original black
  },
  signInTitle: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: "#242121", // Sadu Night
    marginBottom: 8,
    textAlign: "center",
  },
  signInSubtitle: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    color: "#242121CC", // Sadu Night 80%
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  signInButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#A13333", // Najdi Crimson
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginBottom: 24,
    minWidth: 200,
    shadowColor: "#A13333",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  signInButtonText: {
    color: "#F9F7F3", // Al-Jass White
    fontSize: 16,
    fontFamily: "SF Arabic",
    fontWeight: "600",
  },
  signInFeatures: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  signInFeature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  signInFeatureText: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: "#24212199", // Sadu Night 60%
  },
  signInFeatureDivider: {
    width: 1,
    height: 16,
    backgroundColor: "#D1BBA340", // Camel Hair Beige 40%
  },
  profileLinkContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  dangerSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  deleteAccountButton: {
    backgroundColor: "#FEF2F2", // Light red background
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: "#F44336",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: "#F4433630", // Red 30%
    overflow: "hidden",
  },
  deleteAccountContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 10,
  },
  deleteAccountIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F4433610", // Red 10%
    alignItems: "center",
    justifyContent: "center",
  },
  deleteAccountButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#F44336", // Red
    letterSpacing: -0.3,
  },
  deleteAccountHint: {
    fontSize: 13,
    color: "#9B1C1C", // Dark red
    marginTop: 8,
    textAlign: "center",
    marginHorizontal: 20,
  },
});
