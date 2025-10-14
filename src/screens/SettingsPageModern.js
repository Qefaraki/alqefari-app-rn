import React, { useState, useEffect, useMemo } from "react";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSettings } from "../contexts/SettingsContext";
import { formatDateByPreference } from "../utils/dateDisplay";
import { gregorianToHijri } from "../utils/hijriConverter";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContextSimple";
import { accountDeletionService } from "../services/accountDeletion";
import { forceCompleteSignOut } from "../utils/forceSignOut";
import { useRouter } from "expo-router";
import ProfileLinkStatusIndicator from "../components/ProfileLinkStatusIndicator";
import { getProfileDisplayName, buildNameChain } from "../utils/nameChainBuilder";
import NotificationCenter from "../components/NotificationCenter";
import NotificationBadge from "../components/NotificationBadge";
import notificationService from "../services/notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { featureFlags } from "../config/featureFlags";
import adminContactService from "../services/adminContact";
import { formatNameWithTitle } from "../services/professionalTitleService";
import LargeTitleHeader from "../components/ios/LargeTitleHeader";

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

// Cross-platform font fallbacks to keep typography close to iOS San Francisco
const fontStyles = {
  regular: Platform.OS === "ios" ? {} : { fontFamily: "sans-serif" },
  medium: Platform.OS === "ios" ? {} : { fontFamily: "sans-serif-medium" },
  semibold: Platform.OS === "ios" ? {} : { fontFamily: "sans-serif-medium" },
};

const upcomingFeatures = [
  {
    key: "dark-mode",
    label: "الوضع الليلي",
    description: "مظهر داكن متوافق مع إعدادات النظام",
    icon: "moon-outline",
  },
  {
    key: "share-card",
    label: "مشاركة بطاقة العائلة",
    description: "شارك بطاقة العائلة كصورة أو رابط آمن",
    icon: "share-outline",
  },
  {
    key: "smart-reminders",
    label: "تذكيرات ذكية",
    description: "تنبيهات مخصصة بالمناسبات المهمّة للعائلة",
    icon: "notifications-outline",
  },
];

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
    ...fontStyles.semibold,
  },
  selectedText: {
    color: colors.primary,
  },
});

const SettingsSection = ({ title, children, footer, style }) => {
  const items = React.Children.toArray(children);

  return (
    <View style={[styles.sectionContainer, style]}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.sectionCard}>
        {items.map((child, index) => {
          if (!React.isValidElement(child)) {
            return child;
          }
          return React.cloneElement(child, {
            isLast: index === items.length - 1,
          });
        })}
      </View>
      {footer}
    </View>
  );
};

const SettingsCell = ({
  label,
  description,
  rightAccessory,
  isLast,
  onPress,
  disabled = false,
  labelStyle,
  descriptionStyle,
}) => {
  const Container = onPress ? TouchableOpacity : View;
  const containerProps = onPress
    ? {
        onPress: disabled ? undefined : onPress,
        activeOpacity: 0.7,
        disabled,
      }
    : {};

  return (
    <Container
      style={[
        styles.settingRow,
        isLast && styles.settingRowLast,
        onPress && styles.settingRowInteractive,
        disabled && styles.settingRowDisabled,
      ]}
      {...containerProps}
    >
      <View style={styles.settingTextContainer}>
        <Text style={[styles.settingLabel, labelStyle]}>{label}</Text>
        {description ? (
          <Text style={[styles.settingDescription, descriptionStyle]}>
            {description}
          </Text>
        ) : null}
      </View>
      {rightAccessory ||
        (onPress ? (
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        ) : null)}
    </Container>
  );
};

// User-specific profile cache (Map<userId, {profile, timestamp}>)
const profileCaches = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function SettingsPageModern({ user }) {
  const router = useRouter();
  const { settings, updateSetting, resetSettings } = useSettings();
  const { isAdmin, isGuestMode, exitGuestMode, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const [currentUser, setCurrentUser] = useState(user);
  const [userProfile, setUserProfile] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // New settings states
  const [notifications, setNotifications] = useState({
    pushEnabled: true,
    profileRequests: true,
    familyUpdates: true,
    adminMessages: true,
  });
  const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(false);
  const [treeView, setTreeView] = useState({
    showPhotos: true,
    highlightMyLine: true,
  });
  const [showUpcomingFeatures, setShowUpcomingFeatures] = useState(false);

  // Sample date for preview
  const sampleGregorian = { day: 15, month: 3, year: 2024 };
  const sampleHijri = gregorianToHijri(2024, 3, 15);
  const sampleDate = {
    gregorian: sampleGregorian,
    hijri: sampleHijri || { day: 5, month: 9, year: 1445 },
  };

  // Load user profile and notification settings
  useEffect(() => {
    loadUserProfile();
    loadNotificationSettings();
    checkNotificationPermission();
  }, []);

  const loadUserProfile = async () => {
    setLoadingProfile(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (user) {
        // Check user-specific cache first
        const now = Date.now();
        const cached = profileCaches.get(user.id);
        if (cached && now - cached.timestamp < CACHE_DURATION) {
          setUserProfile(cached.profile);
          setLoadingProfile(false);
          return;
        }

        // Find profile linked to this user
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq('user_id', user.id)
          .single();

        setUserProfile(profile);

        // Build full name chain for linked profile
        if (profile) {
          const { data: allProfiles } = await supabase
            .from("profiles")
            .select("id, name, father_id");

          if (allProfiles) {
            const fullChain = buildNameChain(profile, allProfiles);
            profile.fullNameChain = fullChain;
          }
        }
        // If no linked profile, check for pending request
        else if (featureFlags.profileLinkRequests) {
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

        // Update user-specific cache
        profileCaches.set(user.id, { profile, timestamp: Date.now() });
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleSignOut = () => {
    if (isSigningOut) return; // Prevent multiple sign-out attempts

    Alert.alert("تسجيل الخروج", "هل أنت متأكد من رغبتك في تسجيل الخروج؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "تسجيل الخروج",
        style: "destructive",
        onPress: async () => {
          setIsSigningOut(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

          try {
            // Clear local settings and caches first
            resetSettings();
            if (currentUser?.id) {
              profileCaches.delete(currentUser.id);
            }

            // Clear any component-level stores
            try {
              await forceCompleteSignOut();
            } catch (e) {
              console.log('Error clearing local state:', e);
              // Continue anyway
            }

            // Use AuthContext's signOut (handles everything)
            await signOut();

            // No manual navigation - _layout.tsx handles it
          } catch (error) {
            console.error('Sign-out error:', error);

            // Try to at least clear local state
            setCurrentUser(null);
            setUserProfile(null);

            Alert.alert(
              "خطأ في تسجيل الخروج",
              "حدث خطأ أثناء تسجيل الخروج. قد تحتاج إلى إعادة تشغيل التطبيق.",
              [
                {
                  text: "حسناً",
                  style: "default"
                }
              ]
            );
          } finally {
            setIsSigningOut(false);
          }
        },
      },
    ]);
  };

  const performAccountDeletion = async () => {
    if (isDeletingAccount) return;

    setIsDeletingAccount(true);
    try {
      const result = await accountDeletionService.deleteAccount();

      if (!result.success) {
        Alert.alert("خطأ", "فشل حذف الحساب: " + (result.error || "Unknown error"));
        return;
      }

      resetSettings();
      // Clear any cached profile details for this user
      if (currentUser?.id) {
        profileCaches.delete(currentUser.id);
      } else {
        profileCaches.clear();
      }

      await forceCompleteSignOut();

      setTimeout(() => {
        router.replace("/");
      }, 100);
    } catch (error) {
      console.error("Account deletion error:", error);
      Alert.alert("خطأ", "فشل حذف الحساب");

      try {
        await forceCompleteSignOut();
        setTimeout(() => {
          router.replace("/");
        }, 100);
      } catch (signOutError) {
        console.error("Sign out fallback failed:", signOutError);
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleDeleteAccount = () => {
    if (isDeletingAccount) return;

    Alert.alert(
      "حذف الحساب",
      "هل أنت متأكد من رغبتك في حذف حسابك نهائياً؟ لا يمكن التراجع عن هذا الإجراء.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف الحساب",
          style: "destructive",
          onPress: performAccountDeletion,
        },
      ],
    );
  };

  const handleFeedback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleStartProfileLink = () => {
    handleFeedback();
    router.push("/(auth)/profile-linking");
  };

  const handleViewFamilyCard = () => {
    if (!userProfile) {
      handleStartProfileLink();
      return;
    }

    handleFeedback();
    router.push({
      pathname: "/(app)/index",
      params: {
        openProfileId: userProfile.id,
        focusOnProfile: "true",
      },
    });
  };

  const handleFollowUpLinkRequest = () => {
    handleFeedback();
    if (featureFlags.profileLinkRequests) {
      setShowNotificationCenter(true);
    } else {
      Alert.alert(
        "قيد المراجعة",
        "طلبك قيد المراجعة لدى الإدارة. سنخطرك فور اعتماد الملف."
      );
    }
  };

  const handleGuestSignIn = async () => {
    handleFeedback();

    // Clear all cached data
    profileCaches.clear();
    resetSettings();

    // Clear tree store
    try {
      const { useTreeStore } = require('../stores/useTreeStore');
      useTreeStore.getState().setNodes([]);
      useTreeStore.getState().setSelectedPersonId(null);
    } catch (e) {
      console.log('Could not clear tree store:', e);
    }

    // Clear any stored notifications
    await AsyncStorage.multiRemove([
      'notificationSettings',
      'lastNotificationCheck',
      'unreadNotificationCount'
    ]);

    // Exit guest mode - this will trigger navigation automatically
    await exitGuestMode();
    // NO manual navigation - RootLayoutNav handles it based on state change
  };

  const loadNotificationSettings = async () => {
    try {
      const savedNotifications = await AsyncStorage.getItem('notificationSettings');
      if (savedNotifications) {
        setNotifications(JSON.parse(savedNotifications));
      }
    } catch (error) {
      console.error("Error loading notification settings:", error);
    }
  };

  const checkNotificationPermission = async () => {
    const isEnabled = await notificationService.areNotificationsEnabled();
    setNotificationPermissionGranted(isEnabled);
  };

  const handleNotificationToggle = async (key, value) => {
    handleFeedback();

    // If enabling push notifications, request permission first
    if (key === 'pushEnabled' && value && !notificationPermissionGranted) {
      const granted = await notificationService.requestPermissions();
      if (!granted) {
        Alert.alert(
          "الإشعارات مطلوبة",
          "يرجى تفعيل الإشعارات من إعدادات الجهاز للحصول على التنبيهات",
          [{ text: "حسناً" }]
        );
        return;
      }
      setNotificationPermissionGranted(true);
    }

    const newNotifications = { ...notifications, [key]: value };
    setNotifications(newNotifications);

    // Save to AsyncStorage
    await AsyncStorage.setItem('notificationSettings', JSON.stringify(newNotifications));
  };

  const hasLinkedProfile = Boolean(userProfile);
  const hasPendingRequest = Boolean(pendingRequest);

  const profileStatus = useMemo(() => {
    if (loadingProfile) {
      return {
        label: "جارٍ التحديث",
        color: colors.muted,
      };
    }

    if (hasLinkedProfile) {
      return { label: null, color: colors.muted };
    }

    if (hasPendingRequest) {
      return {
        label: "طلبك قيد المراجعة",
        color: "#B45309",
      };
    }

    return {
      label: "لم يتم ربط الملف بعد",
      color: colors.primary,
    };
  }, [hasLinkedProfile, hasPendingRequest, loadingProfile]);

  const pendingHelperText = useMemo(() => {
    if (!pendingRequest) return null;
    const target =
      pendingRequest.fullNameChain ||
      pendingRequest.profile?.name ||
      "الملف المختار";

    return `تم إرسال طلب ربط ${target} وهو قيد المراجعة لدى الإدارة.`;
  }, [pendingRequest]);

  const profileCardAction = (() => {
    if (loadingProfile) {
      return {
        onPress: null,
        chevron: false,
        hint: "جارٍ تحديث بيانات الملف...",
      };
    }

    if (hasLinkedProfile && userProfile?.id) {
      return {
        onPress: handleViewFamilyCard,
        chevron: true,
        hint: null,
      };
    }

    if (hasPendingRequest) {
      return {
        onPress: handleFollowUpLinkRequest,
        chevron: featureFlags.profileLinkRequests,
        hint:
          pendingHelperText ||
          "طلبك قيد المراجعة لدى الإدارة. سنخطرك فور اعتماد الملف.",
      };
    }

    return {
      onPress: handleStartProfileLink,
      chevron: true,
      hint: "لن يستغرق الأمر سوى دقيقة لبدء عملية الربط.",
    };
  })();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 48 }]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <LargeTitleHeader
          title="الإعدادات"
          emblemSource={require("../../assets/logo/AlqefariEmblem.png")}
          rightSlot={
            !isGuestMode ? (
              <NotificationBadge
                onPress={() => {
                  requestAnimationFrame(() => {
                    setShowNotificationCenter(true);
                  });
                }}
              />
            ) : null
          }
          style={{ paddingTop: insets.top, paddingBottom: 12 }}
        />

        {/* Notification Center - Only render when needed */}
        {showNotificationCenter && (
          <NotificationCenter
            visible={showNotificationCenter}
            onClose={() => {
              console.log('🔍 [Settings] NotificationCenter onClose called');
              setShowNotificationCenter(false);
            }}
            onNavigateToAdmin={(openLinkRequests) => {
              console.log('[Settings] Navigating to admin from NotificationCenter');
              setShowNotificationCenter(false);
              // Navigate to admin with params
              router.push({
                pathname: '/(app)/admin',
                params: {
                  openLinkRequests: openLinkRequests ? 'true' : undefined
                }
              });
            }}
          />
        )}

        {/* Guest Sign In Card - Show for guest users */}
        {isGuestMode && (
          <View style={styles.guestSignInCard}>
            <View style={styles.guestIconContainer}>
              <Image
                source={require('../../assets/logo/AlqefariEmblem.png')}
                style={styles.guestEmblem}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.guestTitle}>انضم إلى شجرة القفاري</Text>
            <Text style={styles.guestSubtitle}>
              سجل دخولك لعرض شجرة العائلة الكاملة والتواصل مع أفراد العائلة
            </Text>

            <View style={styles.guestBenefitsList}>
              <View style={styles.guestBenefit}>
                <View style={styles.benefitIconContainer}>
                  <Ionicons name="people" size={20} color={colors.secondary} />
                </View>
                <Text style={styles.guestBenefitText}>عرض شجرة العائلة الكاملة</Text>
              </View>
              <View style={styles.guestBenefit}>
                <View style={styles.benefitIconContainer}>
                  <Ionicons name="newspaper" size={20} color={colors.secondary} />
                </View>
                <Text style={styles.guestBenefitText}>متابعة أخبار ومناسبات العائلة</Text>
              </View>
              <View style={[styles.guestBenefit, { marginBottom: 0 }]}>
                <View style={styles.benefitIconContainer}>
                  <Ionicons name="link" size={20} color={colors.secondary} />
                </View>
                <Text style={styles.guestBenefitText}>ربط ملفك الشخصي بالعائلة</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.guestSignInButton}
              onPress={handleGuestSignIn}
              activeOpacity={0.8}
            >
              <Ionicons name="log-in-outline" size={20} color={colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.guestSignInButtonText}>تسجيل الدخول</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Profile Section - Show for authenticated users */}
        {currentUser && !isGuestMode && (
          <View style={styles.profileSection}>
            {featureFlags.profileLinkRequests && (
              <View style={styles.profileStatusIndicatorWrapper}>
                <ProfileLinkStatusIndicator />
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.profileCard,
                profileCardAction.onPress && styles.profileCardPressable,
                !profileCardAction.onPress && styles.profileCardDisabled,
              ]}
              onPress={profileCardAction.onPress}
              activeOpacity={profileCardAction.onPress ? 0.75 : 1}
              disabled={!profileCardAction.onPress}
            >
              <View style={styles.profileIdentityRow}>
                <View style={styles.profileImageContainer}>
                  {userProfile?.photo_url ? (
                    <Image
                      source={{ uri: userProfile.photo_url }}
                      style={styles.profileImage}
                    />
                  ) : (
                    <View style={styles.profilePlaceholder}>
                      <Ionicons name="person-outline" size={28} color={colors.primary} />
                    </View>
                  )}
                </View>
                <View style={styles.profileInfo}>
                  {loadingProfile ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Text style={styles.profileName}>
                        {(() => {
                          let displayName = "";
                          if (userProfile) {
                            displayName =
                              formatNameWithTitle(userProfile) ||
                              getProfileDisplayName(userProfile);
                          } else if (pendingRequest?.profile) {
                            displayName =
                              pendingRequest.fullNameChain ||
                              pendingRequest.profile.name;
                          } else {
                            return "مستخدم جديد";
                          }

                          return displayName.includes("القفاري")
                            ? displayName
                            : `${displayName} القفاري`;
                        })()}
                      </Text>
                      {profileStatus.label ? (
                        <Text
                          style={[
                            styles.profileStatusText,
                            { color: profileStatus.color },
                          ]}
                        >
                          {profileStatus.label}
                        </Text>
                      ) : null}
                      <Text style={styles.profilePhone}>
                        {currentUser?.phone || currentUser?.email || ""}
                      </Text>
                    </>
                  )}
                </View>
                {profileCardAction.chevron ? (
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                ) : null}
              </View>

            {!loadingProfile && profileCardAction.hint ? (
              <Text style={styles.profileStatusNote}>{profileCardAction.hint}</Text>
            ) : null}
          </TouchableOpacity>
          </View>
        )}

        {/* Display Settings */}
        <SettingsSection title="العرض والمظهر">
          <View style={styles.datePreviewContainer}>
            <Text style={styles.datePreviewLabel}>مثال على التاريخ:</Text>
            <Text style={styles.datePreviewText}>
              {formatDateByPreference(sampleDate, {
                defaultCalendar:
                  settings.dateDisplay === "both"
                    ? settings.defaultCalendar
                    : settings.dateDisplay,
                showBothCalendars: settings.dateDisplay === "both",
                dateFormat: settings.dateFormat,
                arabicNumerals: settings.arabicNumerals,
              })}
            </Text>
          </View>
          <SettingsCell
            label="التقويم"
            rightAccessory={
              <SegmentedControl
                values={["هجري", "ميلادي", "كلاهما"]}
                selectedIndex={
                  settings.dateDisplay === "hijri"
                    ? 0
                    : settings.dateDisplay === "gregorian"
                      ? 1
                      : 2
                }
                onChange={(event) => {
                  handleFeedback();
                  const index = event.nativeEvent.selectedSegmentIndex;
                  updateSetting(
                    "dateDisplay",
                    index === 0 ? "hijri" : index === 1 ? "gregorian" : "both",
                  );
                }}
                style={styles.segmentedControl}
              />
            }
          />
          <SettingsCell
            label="استخدام الكلمات"
            rightAccessory={
              <Switch
                value={settings.dateFormat === "words"}
                onValueChange={(value) => {
                  handleFeedback();
                  updateSetting("dateFormat", value ? "words" : "numeric");
                }}
                trackColor={{ false: "#E5E5EA", true: colors.primary }}
                thumbColor={colors.white}
              />
            }
          />
          <SettingsCell
            label="الأرقام العربية"
            rightAccessory={
              <Switch
                value={settings.arabicNumerals}
                onValueChange={(value) => {
                  handleFeedback();
                  updateSetting("arabicNumerals", value);
                }}
                trackColor={{ false: "#E5E5EA", true: colors.primary }}
                thumbColor={colors.white}
              />
            }
          />
        </SettingsSection>

        {/* Tree View Settings - Admin Only (Not Implemented) */}
        {isAdmin && (
          <SettingsSection title="عرض الشجرة (قيد التطوير)">
            <SettingsCell
              label="إظهار الصور"
              description="عرض صور الأعضاء في الشجرة"
              rightAccessory={
                <Switch
                  value={treeView.showPhotos}
                  onValueChange={(value) => {
                    handleFeedback();
                    setTreeView({ ...treeView, showPhotos: value });
                  }}
                  trackColor={{ false: "#E5E5EA", true: colors.primary }}
                  thumbColor={colors.white}
                />
              }
            />
            <SettingsCell
              label="تمييز خطي المباشر"
              description="إبراز سلسلة النسب الخاصة بي"
              rightAccessory={
                <Switch
                  value={treeView.highlightMyLine}
                  onValueChange={(value) => {
                    handleFeedback();
                    setTreeView({ ...treeView, highlightMyLine: value });
                  }}
                  trackColor={{ false: "#E5E5EA", true: colors.primary }}
                  thumbColor={colors.white}
                />
              }
            />
          </SettingsSection>
        )}

        {/* Notifications Settings - Only for authenticated users */}
        {!isGuestMode && (
          <SettingsSection title="الإشعارات">
            <SettingsCell
              label="تفعيل الإشعارات"
              description={
                notificationPermissionGranted
                  ? "تلقي الإشعارات الفورية"
                  : "يتطلب إذن من الجهاز"
              }
              rightAccessory={
                <Switch
                  value={notifications.pushEnabled}
                  onValueChange={(value) =>
                    handleNotificationToggle("pushEnabled", value)
                  }
                  trackColor={{ false: "#E5E5EA", true: colors.primary }}
                  thumbColor={colors.white}
                />
              }
            />
            <SettingsCell
              label="طلبات ربط الملف"
              description="الموافقة أو الرفض على طلبك"
              rightAccessory={
                <Switch
                  value={notifications.profileRequests}
                  disabled={!notifications.pushEnabled}
                  onValueChange={(value) =>
                    handleNotificationToggle("profileRequests", value)
                  }
                  trackColor={{ false: "#E5E5EA", true: colors.primary }}
                  thumbColor={colors.white}
                  style={!notifications.pushEnabled ? styles.switchDisabled : null}
                />
              }
            />
            <SettingsCell
              label="تحديثات العائلة"
              description="أخبار ومناسبات العائلة"
              rightAccessory={
                <Switch
                  value={notifications.familyUpdates}
                  disabled={!notifications.pushEnabled}
                  onValueChange={(value) =>
                    handleNotificationToggle("familyUpdates", value)
                  }
                  trackColor={{ false: "#E5E5EA", true: colors.primary }}
                  thumbColor={colors.white}
                  style={!notifications.pushEnabled ? styles.switchDisabled : null}
                />
              }
            />
            <SettingsCell
              label="رسائل الإدارة"
              description="إشعارات مهمة من مدير التطبيق"
              rightAccessory={
                <Switch
                  value={notifications.adminMessages}
                  disabled={!notifications.pushEnabled}
                  onValueChange={(value) =>
                    handleNotificationToggle("adminMessages", value)
                  }
                  trackColor={{ false: "#E5E5EA", true: colors.primary }}
                  thumbColor={colors.white}
                  style={!notifications.pushEnabled ? styles.switchDisabled : null}
                />
              }
            />
          </SettingsSection>
        )}

        {/* Upcoming Features (Hidden by default) */}
        <View style={styles.sectionContainer}>
          <TouchableOpacity
            style={styles.collapsibleHeader}
            onPress={() => {
              handleFeedback();
              setShowUpcomingFeatures((prev) => !prev);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.collapsibleHeaderInfo}>
              <View style={styles.comingSoonSparkIcon}>
                <Ionicons name="star-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.collapsibleTitle}>ميزات قادمة</Text>
            </View>
            <Ionicons
              name={showUpcomingFeatures ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.muted}
            />
          </TouchableOpacity>

          {showUpcomingFeatures && (
            <View style={[styles.sectionCard, styles.sectionCardMuted]}>
              {upcomingFeatures.map((feature, index) => (
                <View
                  key={feature.key}
                  style={[
                    styles.comingSoonRow,
                    index !== upcomingFeatures.length - 1 && styles.comingSoonRowDivider,
                  ]}
                >
                  <View style={styles.comingSoonIcon}>
                    <Ionicons name={feature.icon} size={18} color={colors.secondary} />
                  </View>
                  <View style={styles.comingSoonCopy}>
                    <Text style={styles.comingSoonTitle}>{feature.label}</Text>
                    <Text style={styles.comingSoonDescription}>{feature.description}</Text>
                  </View>
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonBadgeText}>قريباً</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Account Actions */}
        <SettingsSection title="إدارة الحساب">
          {currentUser && !isGuestMode && (
            <SettingsCell
              label="تسجيل الخروج"
              description={isSigningOut ? "جاري تنفيذ تسجيل الخروج..." : "إنهاء الجلسة الحالية"}
              onPress={handleSignOut}
              rightAccessory={
                isSigningOut ? (
                  <ActivityIndicator size="small" color={colors.muted} />
                ) : (
                  <Ionicons name="log-out-outline" size={18} color={colors.muted} />
                )
              }
              disabled={isSigningOut}
            />
          )}
          <SettingsCell
            label="إعادة تعيين الإعدادات"
            description="إرجاع التفضيلات إلى القيم الافتراضية"
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
            rightAccessory={<Ionicons name="refresh-outline" size={18} color={colors.muted} />}
          />
          <SettingsCell
            label="تواصل مع الإدارة"
            description="أرسل رسالة فورية عبر الواتساب"
            onPress={async () => {
              handleFeedback();
              const savedMessage = await AsyncStorage.getItem('admin_default_message');
              const message = savedMessage || 'السلام عليكم';
              const result = await adminContactService.openAdminWhatsApp(message);
              if (!result.success) {
                Alert.alert(
                  "تعذر فتح الواتساب",
                  "يرجى التأكد من تثبيت تطبيق الواتساب على جهازك",
                  [{ text: "حسناً" }]
                );
              }
            }}
            rightAccessory={<Ionicons name="logo-whatsapp" size={18} color="#25D366" />}
          />
          {currentUser && !isGuestMode && (
            <SettingsCell
              label="حذف الحساب"
              description="إزالة حسابك وبياناتك نهائياً"
              onPress={handleDeleteAccount}
              rightAccessory={
                isDeletingAccount ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                )
              }
              disabled={isDeletingAccount}
              labelStyle={styles.destructiveLabel}
              descriptionStyle={styles.destructiveDescription}
            />
          )}
        </SettingsSection>

        {/* App Info */}
        <View style={styles.appInfoSection}>
          <Image
            source={require('../../assets/logo/Alqefari Emblem (Transparent).png')}
            style={styles.logo}
          />
          <Text style={styles.appVersion}>الإصدار 2.0.0</Text>
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
    paddingBottom: 32,
  },
  // Guest Sign In Card
  guestSignInCard: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 20,
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 5,
    borderWidth: 1.5,
    borderColor: colors.container + "30",
    alignItems: "center",
    overflow: "hidden",
  },
  guestIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary + "12",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 3,
    borderColor: colors.primary + "20",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  guestEmblem: {
    width: 56,
    height: 56,
    tintColor: colors.primary,
  },
  guestTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
    ...fontStyles.semibold,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  guestSubtitle: {
    fontSize: 16,
    color: colors.muted,
    ...fontStyles.regular,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  guestBenefitsList: {
    width: "100%",
    marginBottom: 32,
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.container + "30",
  },
  guestBenefit: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 4,
  },
  benefitIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.secondary + "15",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.secondary + "25",
  },
  guestBenefitText: {
    fontSize: 15,
    color: colors.text,
    ...fontStyles.regular,
    flex: 1,
    lineHeight: 22,
  },
  guestSignInButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  guestSignInButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
    ...fontStyles.semibold,
    textAlign: "center",
  },

  // Profile Section
  profileSection: {
    marginHorizontal: 16,
    marginVertical: 12,
  },
  profileStatusIndicatorWrapper: {
    marginBottom: 12,
  },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  profileIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  profileImageContainer: {
    marginRight: 14,
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  profilePlaceholder: {
    width: "100%",
    height: "100%",
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
    ...fontStyles.semibold,
    marginBottom: 4,
  },
  profileStatusText: {
    fontSize: 13,
    fontWeight: "600",
    ...fontStyles.semibold,
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: 14,
    color: colors.muted,
    ...fontStyles.regular,
    marginTop: 4,
  },
  profileStatusNote: {
    marginTop: 8,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
    ...fontStyles.regular,
  },
  profileCardPressable: {
    opacity: 0.95,
  },
  profileCardDisabled: {
    opacity: 0.9,
  },

  // Settings Sections
  sectionContainer: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionCardMuted: {
    opacity: 0.9,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    ...fontStyles.semibold,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  collapsibleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  collapsibleHeaderInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  comingSoonSparkIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  collapsibleTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    ...fontStyles.semibold,
  },

  // Setting Row
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingRowInteractive: {
    paddingRight: 4,
  },
  settingRowDisabled: {
    opacity: 0.5,
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: colors.text,
    ...fontStyles.semibold,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: colors.muted,
    ...fontStyles.regular,
  },
  switchDisabled: {
    opacity: 0.4,
  },
  comingSoonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  comingSoonRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  comingSoonIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.secondary + "15",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  comingSoonCopy: {
    flex: 1,
  },
  comingSoonTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    ...fontStyles.semibold,
    marginBottom: 2,
  },
  comingSoonDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    ...fontStyles.regular,
  },
  comingSoonBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primary + "12",
  },
  comingSoonBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    ...fontStyles.semibold,
  },

  // Controls
  segmentedControl: {
    width: 180,
    height: 32,
  },
  destructiveLabel: {
    color: "#DC2626",
  },
  destructiveDescription: {
    color: "#DC2626",
    opacity: 0.75,
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
    ...fontStyles.regular,
    marginBottom: 4,
  },
  developerCredit: {
    fontSize: 13,
    color: colors.primary,
    ...fontStyles.semibold,
    marginTop: 8,
    textAlign: "center",
  },

  // Date Preview
  datePreviewContainer: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  datePreviewLabel: {
    fontSize: 13,
    color: colors.muted,
    ...fontStyles.regular,
    marginBottom: 4,
  },
  datePreviewText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    ...fontStyles.semibold,
  },
});
