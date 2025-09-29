import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Alert,
  RefreshControl,
  ScrollView,
  Dimensions,
  StyleSheet,
  Linking,
  TouchableOpacity,
  Text,
  Image,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Host, Picker } from "@expo/ui/swift-ui";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { supabase } from "../../services/supabase";
import { phoneAuthService } from "../../services/phoneAuth";
import { buildNameChain } from "../../utils/nameChainBuilder";
import { useRouter } from "expo-router";
import subscriptionManager from "../../services/subscriptionManager";
import notificationService from "../../services/notifications";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Exact colors from app research
const colors = {
  // Najdi Sadu palette
  background: "#F9F7F3",      // Al-Jass White
  container: "#D1BBA3",        // Camel Hair Beige
  text: "#242121",            // Sadu Night
  textMuted: "#736372",       // Muted plum
  primary: "#A13333",         // Najdi Crimson
  secondary: "#D58C4A",       // Desert Ochre

  // Status colors (keeping brand palette)
  success: "#D58C4A",         // Desert Ochre for approve
  warning: "#D58C4A",         // Desert Ochre for pending
  error: "#A13333",           // Najdi Crimson for reject

  // System colors
  white: "#FFFFFF",
  separator: "#C6C6C8",
  whatsapp: "#A13333",  // Changed to Najdi Crimson as requested
};

// Arabic generation names
const generationNames = [
  "الجيل الأول",
  "الجيل الثاني",
  "الجيل الثالث",
  "الجيل الرابع",
  "الجيل الخامس",
  "الجيل السادس",
  "الجيل السابع",
  "الجيل الثامن",
  "الجيل التاسع",
  "الجيل العاشر",
];

const getGenerationName = (generation) => {
  if (!generation || generation < 1) return "غير محدد";
  return generationNames[generation - 1] || `الجيل ${generation}`;
};

const getInitials = (name) => {
  if (!name) return "؟";
  // Get first two characters for Arabic names
  const cleanName = name.trim();
  if (cleanName.length >= 2) {
    return cleanName.substring(0, 2);
  }
  return cleanName.charAt(0);
};

// Helper function to manage cache size
const addToCache = (cache, key, value, maxSize = 100) => {
  if (!cache) return;

  // Implement LRU cache - remove oldest if at limit
  if (cache.size >= maxSize) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }

  // If key exists, delete and re-add to make it most recent
  if (cache.has(key)) {
    cache.delete(key);
  }

  cache.set(key, value);
};

// Helper function to get full name chain with caching
const getFullNameChain = (profile, allProfiles = [], cache = null) => {
  if (!profile) return "غير محدد";

  // Check cache first
  if (cache && cache.has(profile.id)) {
    // Move to end (most recently used)
    const cached = cache.get(profile.id);
    cache.delete(profile.id);
    cache.set(profile.id, cached);
    return cached;
  }

  // Use buildNameChain utility to get the full chain
  const chain = buildNameChain(profile, allProfiles);

  // If we got a chain, ensure it has القفاري
  let fullChain;
  if (chain && chain !== profile.name) {
    fullChain = chain.includes("القفاري") ? chain : `${chain} القفاري`;
  } else {
    // Fallback to name with surname
    const name = profile.name || "غير محدد";
    fullChain = name.includes("القفاري") ? name : `${name} القفاري`;
  }

  // Store in cache with size limit
  addToCache(cache, profile.id, fullChain, 100);

  return fullChain;
};

// Debug mode - set to false in production
const DEBUG_MODE = __DEV__;
const log = (...args) => DEBUG_MODE && console.log(...args);

export default function ProfileConnectionManagerV2({ onBack }) {
  log("🚀 ProfileConnectionManagerV2 MOUNTED");
  const router = useRouter();
  const [requests, setRequests] = useState({
    pending: [],
    approved: [],
    rejected: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0); // 0: pending, 1: approved, 2: rejected
  const [allProfiles, setAllProfiles] = useState([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [processingRequests, setProcessingRequests] = useState(new Set()); // Track processing requests
  const profilesLoadedRef = useRef(false);
  const updateDebounceRef = useRef(null);
  const nameChainCache = useRef(new Map());
  const mountedRef = useRef(true);
  const previousRequestsRef = useRef(null);
  const retryTimersRef = useRef(new Map()); // Track all retry timers

  // Cache configuration
  const MAX_CACHE_SIZE = 100;
  const DEBOUNCE_DELAY = 500;

  const tabOptions = ["في الانتظار", "موافق عليها", "مرفوضة"];
  const tabKeys = ["pending", "approved", "rejected"];

  useEffect(() => {
    log("🚀 ProfileConnectionManagerV2 useEffect running");
    loadPendingRequests();

    // Subscribe using the memory-safe subscription manager
    const subscriptionPromise = subscriptionManager.subscribe({
      channelName: 'admin-link-requests',
      table: 'profile_link_requests',
      event: '*',
      onUpdate: (payload) => {
        log('📡 Real-time update received:', payload);

        // Show real-time notification for new requests
        if (payload.eventType === 'INSERT' && payload.new.status === 'pending') {
          notificationService.scheduleLocalNotification(
            'طلب ربط جديد',
            `طلب جديد من ${payload.new.phone || 'مستخدم'}`,
            { type: 'new_link_request', requestId: payload.new.id }
          );
        }

        // Optimistic update with deduplication and error handling
        try {
          setRequests(currentRequests => {
            const updated = { ...currentRequests };

            if (payload.eventType === 'UPDATE') {
              // Remove request from all status groups
              Object.keys(updated).forEach(status => {
                updated[status] = updated[status].filter(r => r.id !== payload.new.id);
              });

              // Add to new status group with updated data
              const newStatus = payload.new.status;
              if (updated[newStatus]) {
                // Merge the payload with profile data if we have it
                const existingRequest = Object.values(currentRequests).flat()
                  .find(r => r.id === payload.new.id);

                const updatedRequest = {
                  ...payload.new,
                  profiles: existingRequest?.profiles || payload.new.profiles
                };

                // Check for duplicates before adding
                const exists = updated[newStatus].some(r => r.id === updatedRequest.id);
                if (!exists) {
                  updated[newStatus] = [updatedRequest, ...updated[newStatus]];
                }
              }
            } else if (payload.eventType === 'INSERT') {
              // Add new request to pending with duplicate check
              if (payload.new.status === 'pending') {
                const exists = updated.pending.some(r => r.id === payload.new.id);
                if (!exists) {
                  updated.pending = [payload.new, ...updated.pending];
                }
              }
            } else if (payload.eventType === 'DELETE') {
              // Remove from all groups
              Object.keys(updated).forEach(status => {
                updated[status] = updated[status].filter(r => r.id !== payload.old.id);
              });
            }

            // Store for potential rollback
            previousRequestsRef.current = currentRequests;
            return updated;
          });
        } catch (error) {
          log('❌ Error in optimistic update:', error);
          // Restore previous state on error
          if (previousRequestsRef.current) {
            setRequests(previousRequestsRef.current);
          }
        }
      },
      onError: (error) => {
        log('❌ Subscription error:', error);
        // Show user-friendly error
        Alert.alert(
          'تنبيه',
          'حدث خطأ في التحديثات التلقائية. سيتم المحاولة مرة أخرى.',
          [{ text: 'حسناً' }]
        );
      }
      // Removed component: this as it's not needed in functional component
    });

    // Handle async subscription
    subscriptionPromise.then(sub => {
      log('✅ Subscription established:', sub?.channelName);
    }).catch(err => {
      log('❌ Failed to establish subscription:', err);
    });

    // Store subscription reference for cleanup
    let subscriptionRef = null;
    subscriptionPromise.then(sub => {
      subscriptionRef = sub;
    });

    // Cleanup function
    return () => {
      mountedRef.current = false; // Mark as unmounted

      if (subscriptionRef) {
        subscriptionRef.unsubscribe();
      }
      if (updateDebounceRef.current) {
        clearTimeout(updateDebounceRef.current);
      }
      // Clean up all retry timers
      retryTimersRef.current.forEach(timer => clearTimeout(timer));
      retryTimersRef.current.clear();
    };
  }, []);

  // Load only profiles needed for current requests
  const loadNeededProfiles = async (requests) => {
    if (isLoadingProfiles) return;

    setIsLoadingProfiles(true);
    try {
      // Collect all profile IDs we need for name chains
      const profileIds = new Set();

      requests.forEach(request => {
        if (request.profile_id) profileIds.add(request.profile_id);
        if (request.profiles?.father_id) profileIds.add(request.profiles.father_id);
      });

      if (profileIds.size === 0) return;

      // Load profiles and their ancestors for name chain building
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, father_id")
        .or(Array.from(profileIds).map(id => `id.eq.${id}`).join(','));

      if (profiles) {
        log(`🔍 DEBUG: Loaded ${profiles.length} relevant profiles for name chains`);

        // Load ancestors recursively to build complete chains
        const ancestorIds = new Set();
        profiles.forEach(p => {
          if (p.father_id) ancestorIds.add(p.father_id);
        });

        if (ancestorIds.size > 0) {
          const { data: ancestors } = await supabase
            .from("profiles")
            .select("id, name, father_id")
            .in("id", Array.from(ancestorIds));

          if (ancestors) {
            setAllProfiles([...profiles, ...ancestors]);
          } else {
            setAllProfiles(profiles);
          }
        } else {
          setAllProfiles(profiles);
        }
        profilesLoadedRef.current = true;
      }
    } catch (error) {
      log('❌ Error loading profiles:', error);
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  // Load only requests (lightweight operation)
  const loadRequestsOnly = async () => {
    log("🔍 DEBUG: Loading requests only...");
    try {
      const { data, error } = await supabase
        .from("profile_link_requests")
        .select(
          `
          *,
          profiles:profile_id (
            id,
            name,
            father_id,
            generation,
            photo_url,
            gender,
            hid
          )
        `
        )
        .in("status", ["pending", "approved", "rejected"])
        .order("created_at", { ascending: false });

      log("🔍 DEBUG: Query response:", { data, error });

      if (error) {
        log("❌ Error loading profile link requests:", error);
        log("❌ Error details:", JSON.stringify(error, null, 2));
        throw error;
      }

      console.log(`🔍 DEBUG: Received ${data?.length || 0} requests`);
      if (data && data.length > 0) {
        log("🔍 DEBUG: First request:", JSON.stringify(data[0], null, 2));
      }

      // Group by status
      const grouped = {
        pending: [],
        approved: [],
        rejected: [],
      };

      data?.forEach((request) => {
        grouped[request.status].push(request);
      });

      log("🔍 DEBUG: Grouped requests:", {
        pending: grouped.pending.length,
        approved: grouped.approved.length,
        rejected: grouped.rejected.length
      });

      setRequests(grouped);

      // Load only the profiles needed for these requests
      const allRequests = [...grouped.pending, ...grouped.approved, ...grouped.rejected];
      await loadNeededProfiles(allRequests);
    } catch (error) {
      log("❌ Error in loadPendingRequests:", error);
      log("❌ Stack trace:", error.stack);
      Alert.alert("خطأ", "فشل تحميل الطلبات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Full load (requests first, then only needed profiles)
  const loadPendingRequests = async () => {
    log("🔍 DEBUG: Starting full load...");
    setLoading(true);

    // Load requests which will also load needed profiles
    await loadRequestsOnly();
  };


  // Retry logic helper
  const retryWithBackoff = async (operation, operationName, requestId, maxRetries = 3) => {
    let retryCount = 0;

    const attempt = async () => {
      if (!mountedRef.current) return; // Don't proceed if unmounted

      try {
        const result = await operation();

        // Clear timer reference on success
        retryTimersRef.current.delete(`${operationName}-${requestId}`);

        // Remove from processing set
        setProcessingRequests(prev => {
          const newSet = new Set(prev);
          newSet.delete(requestId);
          return newSet;
        });

        return result;
      } catch (error) {
        retryCount++;
        log(`❌ ${operationName} attempt ${retryCount} failed:`, error.message);

        if (!mountedRef.current) return; // Check again after async operation

        if (retryCount < maxRetries && !error.message?.includes('Unauthorized')) {
          const delay = Math.min(Math.pow(2, retryCount) * 1000, 8000); // Cap at 8 seconds
          log(`⏳ Retrying ${operationName} in ${delay}ms...`);

          // Store timer reference for cleanup
          const timerId = setTimeout(attempt, delay);
          retryTimersRef.current.set(`${operationName}-${requestId}`, timerId);
        } else {
          // Final failure - clean up
          retryTimersRef.current.delete(`${operationName}-${requestId}`);
          setProcessingRequests(prev => {
            const newSet = new Set(prev);
            newSet.delete(requestId);
            return newSet;
          });
          throw error;
        }
      }
    };

    return attempt();
  };

  const handleApprove = async (request) => {
    // Prevent multiple clicks
    if (processingRequests.has(request.id)) {
      log('⚠️ Request already being processed');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      "تأكيد الموافقة",
      `موافقة على ربط "${request.profiles ? getFullNameChain(request.profiles, allProfiles, nameChainCache.current) : request.name_chain}"؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "موافقة",
          style: "default",
          onPress: async () => {
            // Add to processing set
            setProcessingRequests(prev => new Set(prev).add(request.id));

            // Store previous state for rollback
            const previousState = requests;

            const approveOperation = async () => {
              if (!mountedRef.current) return;

              // Optimistic update - move to approved immediately
              setRequests(prev => ({
                ...prev,
                pending: prev.pending.filter(r => r.id !== request.id),
                approved: [{ ...request, status: 'approved', reviewed_at: new Date().toISOString() }, ...prev.approved]
              }));

              const result = await phoneAuthService.approveProfileLink(
                request.id
              );

              if (!result.success) {
                // Rollback on failure
                if (mountedRef.current) {
                  setRequests(previousState);
                }
                throw new Error(result.error || "فشلت الموافقة على الطلب");
              }

              if (mountedRef.current) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Show success notification
                notificationService.scheduleLocalNotification(
                  'تمت الموافقة ✅',
                  `تم قبول طلب ${request.profiles?.name || request.name_chain}`,
                  { type: 'approval_success' }
                );

                // Clear cache for this profile to refresh name chain
                if (nameChainCache.current && request.profiles?.id) {
                  nameChainCache.current.delete(request.profiles.id);
                }
              }

              return result;
            };

            try {
              await retryWithBackoff(approveOperation, 'approve', request.id);
            } catch (error) {
              if (mountedRef.current) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert(
                  "خطأ",
                  error.message || "فشلت الموافقة على الطلب",
                  [
                    { text: "إلغاء", style: "cancel" },
                    {
                      text: "إعادة المحاولة",
                      onPress: () => handleApprove(request)
                    }
                  ]
                );
              }
            }
          },
        },
      ]
    );
  };

  const handleReject = async (request) => {
    // Prevent multiple clicks
    if (processingRequests.has(request.id)) {
      log('⚠️ Request already being processed');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const performRejection = async (reason = "رفض من قبل المسؤول") => {
      // Add to processing set
      setProcessingRequests(prev => new Set(prev).add(request.id));

      // Store previous state for rollback
      const previousState = requests;

      const rejectOperation = async () => {
        if (!mountedRef.current) return;

        // Optimistic update - move to rejected immediately
        setRequests(prev => ({
          ...prev,
          pending: prev.pending.filter(r => r.id !== request.id),
          rejected: [{ ...request, status: 'rejected', reviewed_at: new Date().toISOString(), review_notes: reason }, ...prev.rejected]
        }));

        const result = await phoneAuthService.rejectProfileLink(
          request.id,
          reason
        );

        if (!result.success) {
          // Rollback on failure
          if (mountedRef.current) {
            setRequests(previousState);
          }
          throw new Error(result.error || "فشل رفض الطلب");
        }

        if (mountedRef.current) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

          // Show rejection notification
          notificationService.scheduleLocalNotification(
            'تم الرفض ❌',
            `تم رفض طلب ${request.profiles?.name || request.name_chain}`,
            { type: 'rejection_success' }
          );

          // Clear cache for this profile to refresh name chain
          if (nameChainCache.current && request.profiles?.id) {
            nameChainCache.current.delete(request.profiles.id);
          }
        }

        return result;
      };

      try {
        await retryWithBackoff(rejectOperation, 'reject', request.id);
      } catch (error) {
        if (mountedRef.current) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(
            "خطأ",
            error.message || "فشل رفض الطلب",
            [
              { text: "إلغاء", style: "cancel" },
              {
                text: "إعادة المحاولة",
                onPress: () => handleReject(request)
              }
            ]
          );
        }
      }
    };

    // Platform-specific rejection flow
    if (Platform.OS === 'android') {
      // Android: Can't use prompt, so provide preset options
      Alert.alert(
        "تأكيد الرفض",
        `رفض طلب ربط "${request.profiles ? getFullNameChain(request.profiles, allProfiles, nameChainCache.current) : request.name_chain}"؟`,
        [
          { text: "إلغاء", style: "cancel" },
          {
            text: "رفض مع سبب",
            onPress: () => {
              Alert.alert(
                "اختر سبب الرفض",
                "",
                [
                  { text: "إلغاء", style: "cancel" },
                  { text: "معلومات غير صحيحة", onPress: () => performRejection("معلومات غير صحيحة") },
                  { text: "طلب مكرر", onPress: () => performRejection("طلب مكرر") },
                  { text: "غير مؤهل", onPress: () => performRejection("غير مؤهل") },
                  { text: "رفض بدون سبب", onPress: () => performRejection("رفض من قبل المسؤول") }
                ]
              );
            }
          },
          {
            text: "رفض سريع",
            style: "destructive",
            onPress: () => performRejection("رفض من قبل المسؤول")
          }
        ]
      );
    } else {
      // iOS: Can use prompt
      Alert.alert(
        "تأكيد الرفض",
        `رفض طلب ربط "${request.profiles ? getFullNameChain(request.profiles, allProfiles, nameChainCache.current) : request.name_chain}"؟`,
        [
          { text: "إلغاء", style: "cancel" },
          {
            text: "رفض مع سبب",
            onPress: () => {
              Alert.prompt(
                "سبب الرفض",
                "يمكنك إضافة سبب الرفض (اختياري)",
                [
                  { text: "إلغاء", style: "cancel" },
                  {
                    text: "رفض",
                    style: "destructive",
                    onPress: (reason) => performRejection(reason || "رفض من قبل المسؤول")
                  }
                ],
                "plain-text",
                ""
              );
            }
          },
          {
            text: "رفض سريع",
            style: "destructive",
            onPress: () => performRejection("رفض من قبل المسؤول")
          }
        ]
      );
    }
  };

  const handleWhatsApp = (phone) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const message = encodeURIComponent(
      "مرحباً، بخصوص طلب ربط ملفك الشخصي في شجرة العائلة..."
    );
    const url = `whatsapp://send?phone=${phone}&text=${message}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("خطأ", "تعذر فتح WhatsApp");
    });
  };

  const handleNavigateToProfile = (profileId) => {
    if (!profileId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Close the current screen if needed
    if (onBack) {
      onBack();
    }

    // Navigate to tree view with profile highlighted
    router.push({
      pathname: "/",
      params: {
        highlightProfileId: profileId,
        focusOnProfile: 'true'
      }
    });
  };

  const currentRequests = requests[tabKeys[selectedTab]] || [];
  const totalRequests = requests.pending.length + requests.approved.length + requests.rejected.length;

  // Status color helper
  const getStatusColor = (status) => {
    switch (status) {
      case "pending": return colors.warning;
      case "approved": return colors.success;
      case "rejected": return colors.error;
      default: return colors.textMuted;
    }
  };

  // Skeleton component for loading state
  const RequestSkeleton = () => (
    <View style={styles.requestCard}>
      <View style={[styles.statusIndicatorLine, { backgroundColor: colors.separator }]} />
      <View style={styles.cardContent}>
        <View style={styles.photoContainer}>
          <SkeletonLoader width={60} height={60} borderRadius={30} />
        </View>
        <View style={styles.profileInfo}>
          <SkeletonLoader width={180} height={18} style={{ marginBottom: 8 }} />
          <SkeletonLoader width={140} height={14} style={{ marginBottom: 6 }} />
          <SkeletonLoader width={100} height={14} />
        </View>
      </View>
      {selectedTab === 0 && (
        <View style={styles.actionButtons}>
          <SkeletonLoader width={90} height={36} borderRadius={18} style={{ marginRight: 8 }} />
          <SkeletonLoader width={90} height={36} borderRadius={18} />
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header with emblem - matching SettingsPage pattern */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Image
            source={require('../../../assets/logo/AlqefariEmblem.png')}
            style={styles.emblem}
            resizeMode="contain"
          />
          <View style={styles.titleContent}>
            <Text style={styles.title}>الربط</Text>
          </View>
          {onBack && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onBack();
              }}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={28} color="#242121" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentedControlContainer}>
        <Host style={{ width: "100%", height: 36 }}>
          <Picker
            label=""
            options={tabOptions}
            variant="segmented"
            selectedIndex={selectedTab}
            onOptionSelected={({ nativeEvent: { index } }) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedTab(index);
            }}
          />
        </Host>
      </View>


      {/* List */}
      <ScrollView
        style={[styles.scrollView, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadPendingRequests();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.background}
            title="اسحب للتحديث"
            titleColor={colors.textMuted}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {currentRequests.length > 0 ? (
          <View style={styles.listContainer}>
            {currentRequests.map((request, index) => {
              const profile = request.profiles;
              const displayName = profile ? getFullNameChain(profile, allProfiles, nameChainCache.current) : request.name_chain || "غير معروف";
              const statusColor = getStatusColor(tabKeys[selectedTab]);

              return (
                <TouchableOpacity
                  key={request.id}
                  onPress={() => profile?.id && handleNavigateToProfile(profile.id)}
                  activeOpacity={0.7}
                >
                <Animated.View
                  entering={FadeInDown.delay(index * 30).springify().damping(15)}
                  layout={Layout.springify()}
                  style={styles.requestCard}
                >
                  {/* Status indicator line */}
                  <View style={[styles.statusIndicatorLine, { backgroundColor: statusColor }]} />

                  <View style={styles.cardContent}>
                    <View style={styles.profileRow}>
                      {/* Profile photo with border */}
                      <View style={styles.photoContainer}>
                        {profile?.photo_url ? (
                          <Image
                            source={{ uri: profile.photo_url }}
                            style={styles.profilePhoto}
                          />
                        ) : (
                          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                            <Text style={styles.avatarText}>
                              {getInitials(profile?.name || request.name_chain || "غير معروف")}
                            </Text>
                          </View>
                        )}
                        <View style={styles.photoBorder} />
                      </View>

                      {/* Name and details */}
                      <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>{displayName}</Text>
                        <Text style={styles.profileMeta}>
                          {getGenerationName(profile?.generation)}
                        </Text>
                        <Text style={[styles.profileMeta, { fontSize: 13, color: "#73637299", fontWeight: "400" }]}>
                          {request.phone || "لا يوجد رقم"}
                        </Text>
                      </View>
                    </View>

                    {/* Actions for pending */}
                    {tabKeys[selectedTab] === "pending" && (
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          onPress={() => handleApprove(request)}
                          style={[
                            styles.pillButton,
                            styles.approveButton,
                            processingRequests.has(request.id) && styles.disabledButton
                          ]}
                          activeOpacity={0.7}
                          disabled={processingRequests.has(request.id)}
                        >
                          {processingRequests.has(request.id) ? (
                            <ActivityIndicator size="small" color="#F9F7F3" />
                          ) : (
                            <>
                              <Ionicons name="checkmark" size={18} color="#F9F7F3" />
                              <Text style={styles.approveButtonText}>قبول</Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleReject(request)}
                          style={[
                            styles.pillButton,
                            styles.rejectButton,
                            processingRequests.has(request.id) && styles.disabledButton
                          ]}
                          activeOpacity={0.7}
                          disabled={processingRequests.has(request.id)}
                        >
                          {processingRequests.has(request.id) ? (
                            <ActivityIndicator size="small" color="#242121" />
                          ) : (
                            <>
                              <Ionicons name="close" size={18} color="#242121" />
                              <Text style={styles.rejectButtonText}>رفض</Text>
                            </>
                          )}
                        </TouchableOpacity>

                        {request.phone && (
                          <TouchableOpacity
                            onPress={() => handleWhatsApp(request.phone)}
                            style={[
                              styles.pillButton,
                              styles.whatsappButton,
                              processingRequests.has(request.id) && styles.disabledButton
                            ]}
                            activeOpacity={0.7}
                            disabled={processingRequests.has(request.id)}
                          >
                            <Ionicons name="logo-whatsapp" size={18} color="#242121" />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* Status indicators and WhatsApp for approved/rejected */}
                    {tabKeys[selectedTab] === "approved" && (
                      <View style={styles.actionButtons}>
                        <View style={styles.statusIcon}>
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color={colors.success}
                          />
                        </View>
                        {request.phone && (
                          <TouchableOpacity
                            onPress={() => handleWhatsApp(request.phone)}
                            style={[styles.pillButton, styles.whatsappButton]}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="logo-whatsapp" size={18} color="#242121" />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {tabKeys[selectedTab] === "rejected" && (
                      <View style={styles.actionButtons}>
                        <View style={styles.rejectedInfo}>
                          <Ionicons
                            name="close-circle"
                            size={22}
                            color={colors.error}
                          />
                          {request.review_notes && (
                            <Text style={styles.rejectionNote} numberOfLines={1}>
                              {request.review_notes}
                            </Text>
                          )}
                        </View>
                        {request.phone && (
                          <TouchableOpacity
                            onPress={() => handleWhatsApp(request.phone)}
                            style={[styles.pillButton, styles.whatsappButton]}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="logo-whatsapp" size={18} color="#242121" />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                </Animated.View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : !loading ? (
          <View style={styles.emptyState}>
            <Image
              source={require('../../../assets/sadu_patterns/png/42.png')}
              style={styles.emptyPattern}
              resizeMode="contain"
            />
            <Ionicons
              name="document-text-outline"
              size={48}
              color={colors.container}
            />
            <Text style={styles.emptyText}>
              {selectedTab === 0
                ? "لا توجد طلبات في الانتظار"
                : selectedTab === 1
                ? "لا توجد طلبات موافق عليها"
                : "لا توجد طلبات مرفوضة"}
            </Text>
            <Text style={styles.refreshHint}>
              اسحب للأسفل للتحديث
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingIndicator: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
  },

  // Header - matching SettingsPage pattern
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 10 : 20, // Reduced for iOS since SafeAreaView handles it
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  backButton: {
    padding: 8,
    marginLeft: 8,
    marginRight: -8,
  },
  emblem: {
    width: 52,
    height: 52,
    tintColor: colors.text,
    marginRight: 3,
    marginTop: -5,
    marginLeft: -5,
  },
  titleContent: {
    flex: 1,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
  },

  // Segmented Control
  segmentedControlContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.separator,
  },

  // Stats

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // List
  listContainer: {
    paddingTop: 16,
  },

  // Card - Modern floating style
  requestCard: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "#D1BBA320", // Camel Hair Beige 20%
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  statusIndicatorLine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  cardContent: {
    paddingTop: 14,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  // Photo
  photoContainer: {
    position: "relative",
  },
  profilePhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.background,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
    fontFamily: "SF Arabic",
  },
  photoBorder: {
    position: "absolute",
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: colors.container + "30",
    top: -1,
    left: -1,
  },

  // Info
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#242121",
    fontFamily: "SF Arabic",
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  metaRow: {
    marginBottom: 2,
  },
  profileMeta: {
    fontSize: 13,
    color: "#24212160", // Sadu Night 40%
    fontFamily: "SF Arabic",
    fontWeight: "400",
    marginBottom: 3,
  },
  metaSeparator: {
    fontSize: 14,
    color: colors.textMuted,
    marginHorizontal: 6,
  },

  // Actions
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  pillButton: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  approveButton: {
    backgroundColor: "#D58C4A", // Desert Ochre
  },
  approveButtonText: {
    color: "#F9F7F3",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: Platform.select({ ios: "SF Arabic", default: "System" }),
  },
  rejectButton: {
    backgroundColor: "transparent",
    borderWidth: 0.5,
    borderColor: "#D1BBA330", // Camel Hair Beige 30%
  },
  rejectButtonText: {
    color: "#24212180", // Sadu Night 50%
    fontSize: 14,
    fontWeight: "500",
    fontFamily: Platform.select({ ios: "SF Arabic", default: "System" }),
  },
  whatsappButton: {
    backgroundColor: "#D1BBA320", // Camel Hair Beige 20%
    minWidth: 40,
    paddingHorizontal: 11,
  },
  disabledButton: {
    opacity: 0.6,
  },
  statusIcon: {
    padding: 4,
  },
  rejectedInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rejectionNote: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
    marginTop: 2,
    maxWidth: 100,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyPattern: {
    position: "absolute",
    width: 200,
    height: 200,
    opacity: 0.05,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
    marginTop: 16,
    marginBottom: 8,
  },
  refreshHint: {
    fontSize: 13,
    color: colors.textMuted + "80",
    fontFamily: "SF Arabic",
  },
});