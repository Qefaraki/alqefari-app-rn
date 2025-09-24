import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "../contexts/SettingsContext";
import { formatDateByPreference } from "../utils/dateDisplay";
import { gregorianToHijri } from "../utils/hijriConverter";
import { supabase } from "../services/supabase";
import { accountDeletionService } from "../services/accountDeletion";
import { useRouter } from "expo-router";
import appConfig from "../config/appConfig";

// Native SwiftUI settings temporarily disabled due to missing Expo UI native module
const NativeSettingsView = null;

// Family Logo
const AlqefariLogo = require("../../assets/logo/Alqefari Emblem (Transparent).png");

// Profile cache to avoid repeated calls
let profileCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function SettingsPage({ user }) {
  const router = useRouter();
  const { settings, updateSetting, clearSettings } = useSettings();

  // Check if we can use native SwiftUI view
  const useNativeView = false;
  const [expandedSection, setExpandedSection] = useState("date");
  const [currentUser, setCurrentUser] = useState(user);
  const [userProfile, setUserProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Check for native view availability

  // Sample date for preview
  const sampleGregorian = { day: 15, month: 3, year: 2024 };
  const sampleHijri = gregorianToHijri(2024, 3, 15);

  const sampleDate = {
    gregorian: sampleGregorian,
    hijri: sampleHijri || { day: 5, month: 9, year: 1445 },
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Load user profile
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    setLoadingProfile(true);

    // Check cache first
    const now = Date.now();
    if (
      profileCache &&
      cacheTimestamp &&
      now - cacheTimestamp < CACHE_DURATION
    ) {
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
    Alert.alert("تسجيل الخروج", "هل أنت متأكد من رغبتك في تسجيل الخروج؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "تسجيل الخروج",
        style: "destructive",
        onPress: async () => {
          clearSettings();
          profileCache = null;
          cacheTimestamp = null;
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  const renderSFSymbol = (name, fallback, color = "#736372", size = 24) => {
    if (Platform.OS === "ios") {
      // Map to SF Symbol names
      const sfMap = {
        "calendar.badge.clock": "calendar",
        globe: "globe-outline",
        "person.crop.circle": "person-circle-outline",
        gearshape: "settings-outline",
        "rectangle.portrait.and.arrow.right": "log-out-outline",
        "chevron.down": "chevron-down",
        "chevron.forward": "chevron-forward",
        "arrow.clockwise": "refresh",
        trash: "trash-outline",
      };
      return (
        <Ionicons name={sfMap[name] || fallback} size={size} color={color} />
      );
    }
    return <Ionicons name={fallback} size={size} color={color} />;
  };

  // Use native iOS Settings view if available
  // Fallback to React Native implementation
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>الإعدادات</Text>
        </View>

        {/* Profile Section */}
        {currentUser && (
          <View style={styles.profileSection}>
            <View style={styles.profileCard}>
              <View style={styles.profileImageContainer}>
                {userProfile?.profile_photo_url ? (
                  <Image
                    source={{ uri: userProfile.profile_photo_url }}
                    style={styles.profileImage}
                  />
                ) : (
                  <View style={styles.profilePlaceholder}>
                    {renderSFSymbol(
                      "person.crop.circle",
                      "person-circle",
                      "#A13333",
                      40,
                    )}
                  </View>
                )}
              </View>
              <View style={styles.profileInfo}>
                {loadingProfile ? (
                  <ActivityIndicator size="small" color="#A13333" />
                ) : (
                  <>
                    <Text style={styles.profileName}>
                      {userProfile?.name_ar || "مستخدم جديد"}
                    </Text>
                    <Text style={styles.profilePhone}>
                      {currentUser?.phone || currentUser?.email || ""}
                    </Text>
                  </>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
            >
              {renderSFSymbol(
                "rectangle.portrait.and.arrow.right",
                "log-out-outline",
                "#F9F7F3",
              )}
              <Text style={styles.signOutText}>تسجيل الخروج</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Settings Sections */}
        <View style={styles.settingsContainer}>
          {/* Date Display Section */}
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection("date")}
            activeOpacity={0.7}
          >
            {renderSFSymbol("calendar.badge.clock", "calendar", "#A13333")}
            <Text style={styles.sectionTitle}>عرض التاريخ</Text>
            {renderSFSymbol(
              expandedSection === "date" ? "chevron.down" : "chevron.forward",
              expandedSection === "date" ? "chevron-down" : "chevron-forward",
              "#736372",
              20,
            )}
          </TouchableOpacity>

          {expandedSection === "date" && (
            <View style={styles.sectionContent}>
              <View style={styles.datePreview}>
                <Text style={styles.previewLabel}>معاينة:</Text>
                <Text style={styles.previewDate}>
                  {formatDateByPreference(sampleDate, settings)}
                </Text>
              </View>

              {/* Calendar Selection */}
              <Text style={styles.subSectionTitle}>التقويم</Text>
              <View style={styles.optionsList}>
                {[
                  { value: "hijri", label: "هجري فقط" },
                  { value: "gregorian", label: "ميلادي فقط" },
                  { value: "both", label: "هجري (ميلادي)" },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={styles.optionRow}
                    onPress={() => updateSetting("dateDisplay", option.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.optionText}>{option.label}</Text>
                    <View style={styles.radioContainer}>
                      <View
                        style={[
                          styles.radio,
                          settings.dateDisplay === option.value &&
                            styles.radioSelected,
                        ]}
                      >
                        {settings.dateDisplay === option.value && (
                          <View style={styles.radioDot} />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Date Format Type */}
              <Text style={styles.subSectionTitle}>تنسيق التاريخ</Text>
              <View style={styles.switchRow}>
                <View style={styles.switchTextContainer}>
                  <Text style={styles.switchLabel}>استخدام الكلمات</Text>
                  <Text style={styles.switchDescription}>
                    {settings.dateFormat === "words"
                      ? "١٥ رمضان ١٤٤٥"
                      : "15/09/1445"}
                  </Text>
                </View>
                <Switch
                  value={settings.dateFormat === "words"}
                  onValueChange={(value) =>
                    updateSetting("dateFormat", value ? "words" : "numeric")
                  }
                  trackColor={{ false: "#E5E5EA", true: "#A13333" }}
                  thumbColor="#F9F7F3"
                  ios_backgroundColor="#E5E5EA"
                />
              </View>

              {/* Arabic Numerals */}
              <View style={styles.switchRow}>
                <View style={styles.switchTextContainer}>
                  <Text style={styles.switchLabel}>الأرقام العربية</Text>
                  <Text style={styles.switchDescription}>
                    {settings.arabicNumerals ? "١٥/٩/١٤٤٥" : "15/9/1445"}
                  </Text>
                </View>
                <Switch
                  value={settings.arabicNumerals}
                  onValueChange={(value) =>
                    updateSetting("arabicNumerals", value)
                  }
                  trackColor={{ false: "#E5E5EA", true: "#A13333" }}
                  thumbColor="#F9F7F3"
                  ios_backgroundColor="#E5E5EA"
                />
              </View>
            </View>
          )}

          {/* Names Display Section */}
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection("names")}
            activeOpacity={0.7}
          >
            {renderSFSymbol("globe", "globe-outline", "#A13333")}
            <Text style={styles.sectionTitle}>عرض الأسماء</Text>
            {renderSFSymbol(
              expandedSection === "names" ? "chevron.down" : "chevron.forward",
              expandedSection === "names" ? "chevron-down" : "chevron-forward",
              "#736372",
              20,
            )}
          </TouchableOpacity>

          {expandedSection === "names" && (
            <View style={styles.sectionContent}>
              <View style={styles.switchRow}>
                <View style={styles.switchTextContainer}>
                  <Text style={styles.switchLabel}>إظهار الأسماء الإنجليزية</Text>
                  <Text style={styles.switchDescription}>
                    عرض الأسماء باللغة الإنجليزية في الشجرة
                  </Text>
                </View>
                <Switch
                  value={settings.showEnglishNames}
                  onValueChange={(value) =>
                    updateSetting("showEnglishNames", value)
                  }
                  trackColor={{ false: "#E5E5EA", true: "#A13333" }}
                  thumbColor="#F9F7F3"
                  ios_backgroundColor="#E5E5EA"
                />
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                Alert.alert(
                  "إعادة تعيين الإعدادات",
                  "سيتم إرجاع جميع الإعدادات إلى القيم الافتراضية",
                  [
                    { text: "إلغاء", style: "cancel" },
                    {
                      text: "إعادة تعيين",
                      style: "destructive",
                      onPress: clearSettings,
                    },
                  ],
                );
              }}
              activeOpacity={0.8}
            >
              {renderSFSymbol("arrow.clockwise", "refresh", "#736372")}
              <Text style={styles.secondaryButtonText}>إعادة تعيين الإعدادات</Text>
            </TouchableOpacity>

            {currentUser && (
              <TouchableOpacity
                style={styles.dangerButton}
                onPress={() => {
                  Alert.alert(
                    "حذف الحساب",
                    "هل أنت متأكد من رغبتك في حذف حسابك نهائياً؟ لا يمكن التراجع عن هذا الإجراء.",
                    [
                      { text: "إلغاء", style: "cancel" },
                      {
                        text: "حذف الحساب",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            Alert.alert("جاري الحذف", "يتم حذف الحساب...");
                            const result = await accountDeletionService.deleteAccount();

                            if (!result.success) {
                              Alert.alert("خطأ", "فشل حذف الحساب: " + (result.error || "Unknown error"));
                              return;
                            }

                            clearSettings();
                            profileCache = null;
                            cacheTimestamp = null;

                            // Navigate to onboarding
                            router.replace("/");
                          } catch (error) {
                            Alert.alert("خطأ", "فشل حذف الحساب");
                            // Sign out anyway for security
                            await supabase.auth.signOut();
                            router.replace("/");
                          }
                        },
                      },
                    ],
                  );
                }}
                activeOpacity={0.8}
              >
                {renderSFSymbol("trash", "trash", "#DC2626")}
                <Text style={styles.dangerButtonText}>حذف الحساب</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* App Information */}
          <View style={styles.appInfoSection}>
            <View style={styles.logoContainer}>
              <Image source={AlqefariLogo} style={styles.logo} />
            </View>
            <Text style={styles.appVersion}>الإصدار {appConfig.version}</Text>
            <Text style={styles.buildInfo}>Build {appConfig.buildNumber}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#242121",
    fontFamily: "SF Arabic",
  },
  profileSection: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  profileImageContainer: {
    marginRight: 12,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F2F2F7",
  },
  profilePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#242121",
    fontFamily: "SF Arabic",
    marginBottom: 4,
  },
  profilePhone: {
    fontSize: 14,
    color: "#736372",
    fontFamily: "SF Arabic",
  },
  signOutButton: {
    backgroundColor: "#A13333",
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: {
    color: "#F9F7F3",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    marginLeft: 8,
  },
  settingsContainer: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: "#242121",
    fontFamily: "SF Arabic",
    marginLeft: 12,
  },
  sectionContent: {
    backgroundColor: "#FFFFFF",
    marginTop: -8,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  datePreview: {
    backgroundColor: "#F2F2F7",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  previewLabel: {
    fontSize: 12,
    color: "#736372",
    fontFamily: "SF Arabic",
    marginBottom: 4,
  },
  previewDate: {
    fontSize: 16,
    color: "#242121",
    fontFamily: "SF Arabic",
    fontWeight: "500",
  },
  optionsList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#F9F7F3",
    borderRadius: 8,
    marginBottom: 8,
  },
  optionText: {
    fontSize: 16,
    color: "#242121",
    fontFamily: "SF Arabic",
  },
  radioContainer: {
    padding: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1BBA3",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: "#A13333",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#A13333",
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#736372",
    fontFamily: "SF Arabic",
    marginTop: 16,
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#F9F7F3",
    borderRadius: 8,
    marginBottom: 8,
  },
  switchTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  switchLabel: {
    fontSize: 16,
    color: "#242121",
    fontFamily: "SF Arabic",
  },
  switchDescription: {
    fontSize: 13,
    color: "#736372",
    fontFamily: "SF Arabic",
    marginTop: 2,
  },
  actionButtonsContainer: {
    paddingHorizontal: 16,
    marginTop: 32,
    gap: 12,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#D1BBA3",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#242121",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    marginLeft: 8,
  },
  dangerButton: {
    backgroundColor: "#DC262610",
    borderWidth: 1.5,
    borderColor: "#DC2626",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: {
    color: "#DC2626",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    marginLeft: 8,
  },
  appInfoSection: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 20,
  },
  logoContainer: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  logo: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  appVersion: {
    fontSize: 14,
    color: "#736372",
    fontFamily: "SF Arabic",
    marginBottom: 4,
  },
  buildInfo: {
    fontSize: 12,
    color: "#73637280",
    fontFamily: "SF Arabic",
  },
});
