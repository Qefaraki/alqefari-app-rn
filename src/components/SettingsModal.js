import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Switch,
  SafeAreaView,
  ScrollView,
  Alert,
  I18nManager,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "../contexts/SettingsContext";
import { formatDateByPreference } from "../utils/dateDisplay";
import { gregorianToHijri } from "../utils/hijriConverter";
import { supabase } from "../services/supabase";
import { useTreeStore } from "../stores/useTreeStore";
import appConfig from "../config/appConfig";

// Family Logo
const AlqefariLogo = require("../../assets/logo/Alqefari Emblem (Transparent).png");

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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      
      if (user) {
        // Try to find matching profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .or(`email.eq.${user.email},phone.eq.${user.phone}`)
          .single();
        
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
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
          style: "cancel"
        },
        {
          text: "تسجيل الخروج",
          style: "destructive",
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              // Clear any local state
              useTreeStore.getState().setSelectedPersonId(null);
              onClose();
            } catch (error) {
              Alert.alert("خطأ", "فشل تسجيل الخروج");
            }
          }
        }
      ],
      { cancelable: true }
    );
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
            <Ionicons name="close" size={28} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>الإعدادات</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Section - Beautiful World-Class Design */}
          {loadingProfile ? (
            <View style={styles.profileCardLoading}>
              <ActivityIndicator size="small" color="#007AFF" />
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
                        {(userProfile?.name || currentUser.email || 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.onlineBadge} />
                </View>
                
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>
                    {userProfile?.name || 'مستخدم جديد'}
                  </Text>
                  <Text style={styles.profileDetail}>
                    {currentUser.phone ? 
                      `${currentUser.phone.substring(0, 4)} ••• ${currentUser.phone.slice(-4)}` :
                      currentUser.email || ''
                    }
                  </Text>
                  {userProfile && (
                    <View style={styles.profileLinkContainer}>
                      <Text style={styles.profileViewLink}>عرض الملف الشخصي</Text>
                      <Ionicons name="arrow-forward" size={14} color="#007AFF" />
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
              <Text style={styles.signInSubtitle}>
                لصلة الرحم وحفظ الأنساب
              </Text>
              
              <TouchableOpacity 
                style={styles.signInButton}
                onPress={() => {
                  // Navigate to sign in
                  onClose();
                  // TODO: Open auth modal
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.signInButtonText}>تسجيل الدخول</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              
              <View style={styles.signInFeatures}>
                <View style={styles.signInFeature}>
                  <Ionicons name="cloud-outline" size={18} color="#6B7280" />
                  <Text style={styles.signInFeatureText}>مزامنة</Text>
                </View>
                <View style={styles.signInFeatureDivider} />
                <View style={styles.signInFeature}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#6B7280" />
                  <Text style={styles.signInFeatureText}>آمن</Text>
                </View>
                <View style={styles.signInFeatureDivider} />
                <View style={styles.signInFeature}>
                  <Ionicons name="people-outline" size={18} color="#6B7280" />
                  <Text style={styles.signInFeatureText}>عائلي</Text>
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
              color="#6B7280"
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
                    <Ionicons name="log-out-outline" size={22} color="#DC2626" />
                  </View>
                  <Text style={styles.signOutButtonText}>تسجيل الخروج</Text>
                </View>
              </TouchableOpacity>
              
              <Text style={styles.signOutHint}>
                سيتم حفظ جميع إعداداتك محلياً
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
    backgroundColor: "#F7F7F8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#111827",
  },
  content: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end", // RTL alignment
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
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
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  previewContainer: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 20,
    alignItems: "center",
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
    backgroundColor: "#F3F4F6",
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
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    color: "#6B7280",
    fontWeight: "500",
  },
  segmentTextActive: {
    color: "#111827",
  },
  switchOption: {
    flexDirection: "row",
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
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    alignItems: "center",
  },
  resetButtonText: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    color: "#DC2626",
    fontWeight: "500",
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    overflow: 'hidden',
  },
  profileCardLoading: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 20,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },
  profileImageContainer: {
    marginRight: 16,
    position: 'relative',
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
    backgroundColor: "#007AFF",
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
    position: 'absolute',
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
    color: "#1F2937",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  profileDetail: {
    fontSize: 15,
    color: "#6B7280",
    marginBottom: 6,
    fontWeight: "500",
  },
  profileLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profileViewLink: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
  },
  signInPrompt: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 20,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    borderRadius: 14,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: "#FEE2E2",
    overflow: 'hidden',
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
    backgroundColor: "#FEF2F2",
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#DC2626",
    letterSpacing: -0.3,
  },
  signOutHint: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: 'center',
    marginTop: 8,
    fontWeight: "500",
  },
  signInPromptCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  signInIconContainer: {
    marginBottom: 20,
  },
  signInIconBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F5F3F7", // Use our background color
    alignItems: "center",
    justifyContent: "center",
    padding: 5,
    borderWidth: 1,
    borderColor: "#957EB520", // Subtle border with primary color
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
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  signInSubtitle: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    color: "#6B7280",
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
    backgroundColor: "#957EB5", // Primary violet color
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 24,
    minWidth: 200,
    shadowColor: "#957EB5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  signInButtonText: {
    color: "#FFFFFF",
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
    color: "#6B7280",
  },
  signInFeatureDivider: {
    width: 1,
    height: 16,
    backgroundColor: "#E5E7EB",
  },
  profileLinkContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
});
