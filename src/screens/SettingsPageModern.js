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
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import { useSettings } from "../contexts/SettingsContext";
import { formatDateByPreference } from "../utils/dateDisplay";
import { gregorianToHijri } from "../utils/hijriConverter";
import { supabase } from "../services/supabase";
import { accountDeletionService } from "../services/accountDeletion";
import { forceCompleteSignOut } from "../utils/forceSignOut";
import { useRouter } from "expo-router";
import ProfileLinkStatusIndicator from "../components/ProfileLinkStatusIndicator";
import { getProfileDisplayName, buildNameChain } from "../utils/nameChainBuilder";

// Najdi Sadu Color Palette
const colors = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  muted: "#73637280", // Muted text
  border: "#D1BBA320", // Light border
  white: "#FFFFFF",
};

// Custom Segmented Control Component
const SegmentedControl = ({ values, selectedIndex, onChange, style }) => {
  const handlePress = (index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange({ nativeEvent: { selectedSegmentIndex: index } });
  };

  return (
    <View style={[segmentedStyles.container, style]}>
      {values.map((value, index) => (
        <TouchableOpacity
          key={index}
          style={[
            segmentedStyles.segment,
            index === selectedIndex && segmentedStyles.selectedSegment,
            index === 0 && segmentedStyles.firstSegment,
            index === values.length - 1 && segmentedStyles.lastSegment,
          ]}
          onPress={() => handlePress(index)}
          activeOpacity={0.8}
        >
          <Text
            style={[
              segmentedStyles.text,
              index === selectedIndex && segmentedStyles.selectedText,
            ]}
          >
            {value}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const segmentedStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 32,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 2,
  },
  segment: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  selectedSegment: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  firstSegment: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  lastSegment: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    fontFamily: 'SF Arabic',
  },
  selectedText: {
    color: colors.primary,
  },
});

// Profile cache
let profileCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function SettingsPageModern({ user }) {
  const router = useRouter();
  const { settings, updateSetting, resetSettings } = useSettings();

  const [currentUser, setCurrentUser] = useState(user);
  const [userProfile, setUserProfile] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // New settings states
  const [fontSize, setFontSize] = useState(0.5); // 0-1 range for slider
  const [notifications, setNotifications] = useState({
    newMembers: true,
    familyUpdates: true,
    adminMessages: true,
  });
  const [privacy, setPrivacy] = useState({
    showPhone: true,
    showLocation: false,
    profileVisibility: 1, // 0=Nobody, 1=Family, 2=Everyone
  });
  const [treeView, setTreeView] = useState({
    showPhotos: true,
    highlightMyLine: true,
    animationSpeed: 1, // 0=Slow, 1=Normal, 2=Fast
    defaultZoom: 1, // 0=Close, 1=Medium, 2=Far
  });

  // Sample date for preview
  const sampleGregorian = { day: 15, month: 3, year: 2024 };
  const sampleHijri = gregorianToHijri(2024, 3, 15);
  const sampleDate = {
    gregorian: sampleGregorian,
    hijri: sampleHijri || { day: 5, month: 9, year: 1445 },
  };

  // Load user profile
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    setLoadingProfile(true);

    // Check cache first
    const now = Date.now();
    if (profileCache && cacheTimestamp && now - cacheTimestamp < CACHE_DURATION) {
      setCurrentUser(profileCache.user);
      setUserProfile(profileCache.profile);
      setLoadingProfile(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (user) {
        // Find profile linked to this user
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq('user_id', user.id)
          .single();

        setUserProfile(profile);

        // If no linked profile, check for pending request
        if (!profile) {
          const { data: requests } = await supabase
            .from("profile_link_requests")
            .select(`
              *,
              profile:profile_id(*)
            `)
            .eq("user_id", user.id)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1);

          if (requests && requests.length > 0) {
            setPendingRequest(requests[0]);

            // Build full name chain
            if (requests[0].profile) {
              const { data: allProfiles } = await supabase
                .from("profiles")
                .select("id, name, father_id");

              if (allProfiles) {
                const fullChain = buildNameChain(requests[0].profile, allProfiles);
                requests[0].fullNameChain = fullChain;
              }
            }
          }
        }

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
          resetSettings();
          profileCache = null;
          cacheTimestamp = null;

          try {
            const { useTreeStore } = require('../stores/useTreeStore');
            useTreeStore.getState().setNodes([]);
            useTreeStore.getState().setSelectedPersonId(null);
          } catch (e) {
            console.log('Could not clear tree store:', e);
          }

          await forceCompleteSignOut();
          setTimeout(() => {
            router.replace("/");
          }, 100);
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
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

              resetSettings();
              profileCache = null;
              cacheTimestamp = null;

              setTimeout(() => {
                router.replace("/");
              }, 100);
            } catch (error) {
              Alert.alert("خطأ", "فشل حذف الحساب");
              await supabase.auth.signOut();
              setTimeout(() => {
                router.replace("/");
              }, 100);
            }
          },
        },
      ],
    );
  };

  const handleFeedback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/logo/AlqefariEmblem.png')}
            style={styles.emblem}
            resizeMode="contain"
          />
          <Text style={styles.title}>الإعدادات</Text>
        </View>

        {/* Profile Section */}
        {currentUser && (
          <View style={styles.profileSection}>
            <ProfileLinkStatusIndicator />

            <View style={styles.profileCard}>
              <View style={styles.profileImageContainer}>
                {userProfile?.profile_photo_url ? (
                  <Image
                    source={{ uri: userProfile.profile_photo_url }}
                    style={styles.profileImage}
                  />
                ) : (
                  <View style={styles.profilePlaceholder}>
                    <Ionicons name="person-circle" size={40} color={colors.primary} />
                  </View>
                )}
              </View>
              <View style={styles.profileInfo}>
                {loadingProfile ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Text style={styles.profileName}>
                      {userProfile ?
                        (getProfileDisplayName(userProfile).includes("القفاري") ?
                          getProfileDisplayName(userProfile) :
                          `${getProfileDisplayName(userProfile)} القفاري`)
                        : pendingRequest?.fullNameChain ?
                          (pendingRequest.fullNameChain.includes("القفاري") ?
                            pendingRequest.fullNameChain :
                            `${pendingRequest.fullNameChain} القفاري`)
                        : pendingRequest?.profile?.name ?
                          (pendingRequest.profile.name.includes("القفاري") ?
                            pendingRequest.profile.name :
                            `${pendingRequest.profile.name} القفاري`)
                        : "مستخدم جديد"}
                    </Text>
                    <Text style={styles.profilePhone}>
                      {currentUser?.phone || currentUser?.email || ""}
                    </Text>
                  </>
                )}
              </View>
            </View>

            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={20} color={colors.white} />
              <Text style={styles.signOutText}>تسجيل الخروج</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Display Settings */}
        <View style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>العرض والمظهر</Text>

          {/* Calendar Type */}
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>التقويم</Text>
            <SegmentedControl
              values={['هجري', 'ميلادي', 'كلاهما']}
              selectedIndex={settings.dateDisplay === 'hijri' ? 0 : settings.dateDisplay === 'gregorian' ? 1 : 2}
              onChange={(event) => {
                handleFeedback();
                const index = event.nativeEvent.selectedSegmentIndex;
                updateSetting('dateDisplay', index === 0 ? 'hijri' : index === 1 ? 'gregorian' : 'both');
              }}
              style={styles.segmentedControl}
            />
          </View>

          {/* Date Format */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>استخدام الكلمات</Text>
              <Text style={styles.settingDescription}>
                {settings.dateFormat === "words" ? "١٥ رمضان ١٤٤٥" : "15/09/1445"}
              </Text>
            </View>
            <Switch
              value={settings.dateFormat === "words"}
              onValueChange={(value) => {
                handleFeedback();
                updateSetting("dateFormat", value ? "words" : "numeric");
              }}
              trackColor={{ false: "#E5E5EA", true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          {/* Arabic Numerals */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>الأرقام العربية</Text>
              <Text style={styles.settingDescription}>
                {settings.arabicNumerals ? "١٥/٩/١٤٤٥" : "15/9/1445"}
              </Text>
            </View>
            <Switch
              value={settings.arabicNumerals}
              onValueChange={(value) => {
                handleFeedback();
                updateSetting("arabicNumerals", value);
              }}
              trackColor={{ false: "#E5E5EA", true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          {/* English Names */}
          <View style={[styles.settingRow, styles.lastRow]}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>إظهار الأسماء الإنجليزية</Text>
              <Text style={styles.settingDescription}>في عرض الشجرة</Text>
            </View>
            <Switch
              value={settings.showEnglishNames}
              onValueChange={(value) => {
                handleFeedback();
                updateSetting("showEnglishNames", value);
              }}
              trackColor={{ false: "#E5E5EA", true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          {/* Font Size */}
          <View style={[styles.settingRow, styles.lastRow]}>
            <Text style={styles.settingLabel}>حجم الخط</Text>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>صغير</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                value={fontSize}
                onValueChange={setFontSize}
                onSlidingComplete={handleFeedback}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
              <Text style={styles.sliderLabel}>كبير</Text>
            </View>
          </View>
        </View>

        {/* Tree View Settings */}
        <View style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>عرض الشجرة</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>إظهار الصور</Text>
              <Text style={styles.settingDescription}>عرض صور الأعضاء في الشجرة</Text>
            </View>
            <Switch
              value={treeView.showPhotos}
              onValueChange={(value) => {
                handleFeedback();
                setTreeView({ ...treeView, showPhotos: value });
              }}
              trackColor={{ false: "#E5E5EA", true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>تمييز خطي المباشر</Text>
              <Text style={styles.settingDescription}>إبراز سلسلة النسب الخاصة بي</Text>
            </View>
            <Switch
              value={treeView.highlightMyLine}
              onValueChange={(value) => {
                handleFeedback();
                setTreeView({ ...treeView, highlightMyLine: value });
              }}
              trackColor={{ false: "#E5E5EA", true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>سرعة الحركة</Text>
            <SegmentedControl
              values={['بطيء', 'عادي', 'سريع']}
              selectedIndex={treeView.animationSpeed}
              onChange={(event) => {
                handleFeedback();
                setTreeView({ ...treeView, animationSpeed: event.nativeEvent.selectedSegmentIndex });
              }}
              style={styles.segmentedControl}
            />
          </View>

          <View style={[styles.settingRow, styles.lastRow]}>
            <Text style={styles.settingLabel}>التكبير الافتراضي</Text>
            <SegmentedControl
              values={['قريب', 'متوسط', 'بعيد']}
              selectedIndex={treeView.defaultZoom}
              onChange={(event) => {
                handleFeedback();
                setTreeView({ ...treeView, defaultZoom: event.nativeEvent.selectedSegmentIndex });
              }}
              style={styles.segmentedControl}
            />
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>الإشعارات</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>أعضاء جدد</Text>
              <Text style={styles.settingDescription}>إشعارات عند انضمام أعضاء جدد</Text>
            </View>
            <Switch
              value={notifications.newMembers}
              onValueChange={(value) => {
                handleFeedback();
                setNotifications({ ...notifications, newMembers: value });
              }}
              trackColor={{ false: "#E5E5EA", true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>تحديثات العائلة</Text>
              <Text style={styles.settingDescription}>أخبار ومناسبات العائلة</Text>
            </View>
            <Switch
              value={notifications.familyUpdates}
              onValueChange={(value) => {
                handleFeedback();
                setNotifications({ ...notifications, familyUpdates: value });
              }}
              trackColor={{ false: "#E5E5EA", true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          <View style={[styles.settingRow, styles.lastRow]}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>رسائل الإدارة</Text>
              <Text style={styles.settingDescription}>إشعارات من مدير التطبيق</Text>
            </View>
            <Switch
              value={notifications.adminMessages}
              onValueChange={(value) => {
                handleFeedback();
                setNotifications({ ...notifications, adminMessages: value });
              }}
              trackColor={{ false: "#E5E5EA", true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        {/* Privacy Settings */}
        <View style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>الخصوصية</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>إظهار رقم الهاتف</Text>
              <Text style={styles.settingDescription}>السماح للأعضاء برؤية رقمي</Text>
            </View>
            <Switch
              value={privacy.showPhone}
              onValueChange={(value) => {
                handleFeedback();
                setPrivacy({ ...privacy, showPhone: value });
              }}
              trackColor={{ false: "#E5E5EA", true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>إظهار الموقع</Text>
              <Text style={styles.settingDescription}>مشاركة موقعي مع العائلة</Text>
            </View>
            <Switch
              value={privacy.showLocation}
              onValueChange={(value) => {
                handleFeedback();
                setPrivacy({ ...privacy, showLocation: value });
              }}
              trackColor={{ false: "#E5E5EA", true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          <View style={[styles.settingRow, styles.lastRow]}>
            <Text style={styles.settingLabel}>من يمكنه رؤية ملفي</Text>
            <SegmentedControl
              values={['لا أحد', 'العائلة', 'الجميع']}
              selectedIndex={privacy.profileVisibility}
              onChange={(event) => {
                handleFeedback();
                setPrivacy({ ...privacy, profileVisibility: event.nativeEvent.selectedSegmentIndex });
              }}
              style={styles.segmentedControl}
            />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
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
                    onPress: resetSettings,
                  },
                ],
              );
            }}
          >
            <Ionicons name="refresh-outline" size={20} color={colors.text} />
            <Text style={styles.secondaryButtonText}>إعادة تعيين الإعدادات</Text>
          </TouchableOpacity>

          {currentUser && (
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={handleDeleteAccount}
            >
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
              <Text style={styles.dangerButtonText}>حذف الحساب</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* App Info */}
        <View style={styles.appInfoSection}>
          <Image
            source={require('../../assets/logo/Alqefari Emblem (Transparent).png')}
            style={styles.logo}
          />
          <Text style={styles.appVersion}>الإصدار 2.0.0</Text>
          <Text style={styles.developerCredit}>
            بتصميم وبرمجة: محمد عبدالله سليمان القفاري
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  emblem: {
    width: 44,
    height: 44,
    tintColor: colors.text,
    marginRight: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
  },

  // Profile Section
  profileSection: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 16,
    padding: 16,
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
    color: colors.text,
    fontFamily: "SF Arabic",
    marginBottom: 4,
  },
  profilePhone: {
    fontSize: 14,
    color: colors.muted,
    fontFamily: "SF Arabic",
  },
  signOutButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  signOutText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },

  // Settings Card
  settingsCard: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    fontFamily: "SF Arabic",
    marginTop: 8,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Setting Row
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: colors.text,
    fontFamily: "SF Arabic",
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: colors.muted,
    fontFamily: "SF Arabic",
  },

  // Controls
  segmentedControl: {
    width: 180,
    height: 32,
  },
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  slider: {
    width: 120,
    height: 40,
  },
  sliderLabel: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: "SF Arabic",
  },

  // Actions
  actionsContainer: {
    paddingHorizontal: 16,
    marginTop: 20,
    gap: 12,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.container,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  dangerButton: {
    backgroundColor: "#DC262610",
    borderWidth: 1.5,
    borderColor: "#DC2626",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dangerButtonText: {
    color: "#DC2626",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },

  // App Info
  appInfoSection: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 20,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  appVersion: {
    fontSize: 14,
    color: colors.muted,
    fontFamily: "SF Arabic",
    marginBottom: 4,
  },
  developerCredit: {
    fontSize: 13,
    color: colors.primary,
    fontFamily: "SF Arabic",
    marginTop: 8,
    textAlign: "center",
  },
});