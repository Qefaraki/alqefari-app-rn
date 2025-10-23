import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Alert,
  RefreshControl,
  FlatList,
  StyleSheet,
  Linking,
  TouchableOpacity,
  Pressable,
  Text,
  Image,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "../../services/supabase";
import { phoneAuthService } from "../../services/phoneAuth";
import { buildNameChain } from "../../utils/nameChainBuilder";
import { useRouter } from "expo-router";
import subscriptionManager from "../../services/subscriptionManager";
import notificationService from "../../services/notifications";
import SkeletonLoader from "../ui/SkeletonLoader";
import Toast from "../ui/Toast";
import TabBar from "../ui/TabBar";
import tokens from "../ui/tokens";
import { featureFlags } from "../../config/featureFlags";
import { formatRelativeTime } from "../../utils/formatTimestamp";

// Exact colors from app research
const palette = tokens.colors.najdi;
const spacing = tokens.spacing;
const typography = tokens.typography;

const colors = {
  background: palette.background,
  container: palette.container,
  text: palette.text,
  textMuted: palette.textMuted,
  primary: palette.primary,
  secondary: palette.secondary,
  success: palette.secondary,
  warning: palette.secondary,
  error: palette.primary,
  white: tokens.colors.surface,
  separator: tokens.colors.divider,
  whatsapp: palette.primary,
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
  if (!featureFlags.profileLinkRequests) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>إدارة طلبات الربط</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          <Text style={styles.emptyStateTitle}>لا توجد طلبات ربط</Text>
          <Text style={styles.emptyStateText}>
            تم إيقاف نظام طلبات الربط في الإصدار الحالي. يمكن للمستخدمين التواصل مع المشرف مباشرةً لإدارة الحسابات.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  log("🚀 ProfileConnectionManagerV2 MOUNTED");
  const router = useRouter();
  const [requests, setRequests] = useState({
    pending: [],
    approved: [],
    rejected: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState("pending"); // Changed from index to ID-based
  const [allProfiles, setAllProfiles] = useState([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [processingRequests, setProcessingRequests] = useState(new Set()); // Track processing requests
  const profilesLoadedRef = useRef(false);
  const updateDebounceRef = useRef(null);
  const nameChainCache = useRef(new Map());
  const mountedRef = useRef(true);
  const previousRequestsRef = useRef(null);
  const retryTimersRef = useRef(new Map()); // Track all retry timers
  const operationInProgressRef = useRef(null); // Prevent concurrent operations
  const [toastState, setToastState] = useState({
    visible: false,
    message: "",
    type: "success",
  });

  // Cache configuration
  const MAX_CACHE_SIZE = 100;
  const DEBOUNCE_DELAY = 500;

  const tabs = [
    { id: "pending", label: "في الانتظار" },
    { id: "approved", label: "موافق عليها" },
    { id: "rejected", label: "مرفوضة" },
  ];

  const showToast = useCallback((message, type = "success") => {
    setToastState({ visible: true, message, type });
  }, []);

  const dismissToast = useCallback(() => {
    setToastState((prev) => ({ ...prev, visible: false }));
  }, []);

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
            'طلب انضمام جديد',
            `${payload.new.name_chain || 'عضو من العائلة'} يطلب ربط حسابه بالشجرة`,
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
      const ids = Array.from(profileIds);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, father_id")
        .in("id", ids);

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


  // Create timeout promise with proper cleanup
  const withTimeout = (promise, timeoutMs = 30000) => {
    let timeoutId;
    return Promise.race([
      promise.then(result => {
        clearTimeout(timeoutId); // Clear timeout on success
        return result;
      }).catch(error => {
        clearTimeout(timeoutId); // Clear timeout on error too
        throw error;
      }),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
      })
    ]);
  };

  // Retry logic helper
  const retryWithBackoff = async (operation, operationName, requestId, maxRetries = 3) => {
    let retryCount = 0;

    const attempt = async () => {
      if (!mountedRef.current) {
        return Promise.reject(new Error('Component unmounted')); // Reject instead of silent return
      }

      try {
        const result = await withTimeout(operation(), 30000); // Add 30 second timeout

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

        if (!mountedRef.current) {
          return Promise.reject(new Error('Component unmounted'));
        }

        if (retryCount < maxRetries && !error.message?.includes('Unauthorized')) {
          const delay = Math.min(Math.pow(2, retryCount) * 1000, 8000); // Cap at 8 seconds
          log(`⏳ Retrying ${operationName} in ${delay}ms...`);

          // Return a promise that resolves after delay
          return new Promise((resolve, reject) => {
            const timerId = setTimeout(async () => {
              retryTimersRef.current.delete(`${operationName}-${requestId}`);
              try {
                const result = await attempt();
                resolve(result);
              } catch (retryError) {
                reject(retryError);
              }
            }, delay);

            // Store timer reference for cleanup
            retryTimersRef.current.set(`${operationName}-${requestId}`, timerId);
          });
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
    // Atomic check and set to prevent race condition
    if (operationInProgressRef.current === request.id) {
      log('⚠️ Request already being processed');
      return;
    }
    operationInProgressRef.current = request.id;

    // Also check the processing set for UI state
    if (processingRequests.has(request.id)) {
      log('⚠️ Request in processing state');
      operationInProgressRef.current = null;
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      "تأكيد الموافقة",
      `موافقة على ربط "${request.profiles ? getFullNameChain(request.profiles, allProfiles, nameChainCache.current) : request.name_chain}"؟`,
      [
        {
          text: "إلغاء",
          style: "cancel",
          onPress: () => {
            operationInProgressRef.current = null; // Clear on cancel
          }
        },
        {
          text: "موافقة",
          style: "default",
          onPress: async () => {
            // Add to processing set for UI
            setProcessingRequests(prev => new Set(prev).add(request.id));

            // Store only the specific request for rollback (not entire state)
            const originalRequest = { ...request };

            const approveOperation = async () => {
              if (!mountedRef.current) {
                return Promise.reject(new Error('Component unmounted'));
              }

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
                // Surgical rollback - only restore the specific request
                if (mountedRef.current) {
                  setRequests(prev => ({
                    ...prev, // Keep any concurrent real-time updates
                    pending: [...prev.pending, originalRequest], // Restore original request
                    approved: prev.approved.filter(r => r.id !== request.id) // Remove from approved
                  }));
                }
                throw new Error(result.error || "فشلت الموافقة على الطلب");
              }

              if (mountedRef.current) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showToast("تم قبول الطلب", "success");

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
                showToast(error.message || "فشلت الموافقة على الطلب", "error");
                Alert.alert(
                  "خطأ",
                  error.message || "فشلت الموافقة على الطلب",
                  [
                    {
            text: "إلغاء",
            style: "cancel",
            onPress: () => {
              operationInProgressRef.current = null; // Clear on cancel
            }
          },
                    {
                      text: "إعادة المحاولة",
                      onPress: () => handleApprove(request)
                    }
                  ]
                );
              }
            } finally {
              // Always clear the operation lock
              operationInProgressRef.current = null;
            }
          },
        },
      ]
    );
  };

  const handleReject = async (request) => {
    // Atomic check and set to prevent race condition
    if (operationInProgressRef.current === request.id) {
      log('⚠️ Request already being processed');
      return;
    }
    operationInProgressRef.current = request.id;

    // Also check the processing set for UI state
    if (processingRequests.has(request.id)) {
      log('⚠️ Request in processing state');
      operationInProgressRef.current = null;
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const performRejection = async (reason = "رفض من قبل المسؤول") => {
      // Add to processing set
      setProcessingRequests(prev => new Set(prev).add(request.id));

      // Store only the specific request for rollback (not entire state)
      const originalRequest = { ...request };

      const rejectOperation = async () => {
        if (!mountedRef.current) {
          return Promise.reject(new Error('Component unmounted'));
        }

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
          // Surgical rollback - only restore the specific request
          if (mountedRef.current) {
            setRequests(prev => ({
              ...prev, // Keep any concurrent real-time updates
              pending: [...prev.pending, originalRequest], // Restore original request
              rejected: prev.rejected.filter(r => r.id !== request.id) // Remove from rejected
            }));
          }
          throw new Error(result.error || "فشل رفض الطلب");
        }

        if (mountedRef.current) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          showToast("تم رفض الطلب", "info");

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
          showToast(error.message || "فشل رفض الطلب", "error");
          Alert.alert(
            "خطأ",
            error.message || "فشل رفض الطلب",
            [
              {
            text: "إلغاء",
            style: "cancel",
            onPress: () => {
              operationInProgressRef.current = null; // Clear on cancel
            }
          },
              {
                text: "إعادة المحاولة",
                onPress: () => handleReject(request)
              }
            ]
          );
        }
      } finally {
        // Always clear the operation lock
        operationInProgressRef.current = null;
      }
    };

    // Platform-specific rejection flow
    if (Platform.OS === 'android') {
      // Android: Can't use prompt, so provide preset options
      Alert.alert(
        "تأكيد الرفض",
        `رفض طلب ربط "${request.profiles ? getFullNameChain(request.profiles, allProfiles, nameChainCache.current) : request.name_chain}"؟`,
        [
          {
            text: "إلغاء",
            style: "cancel",
            onPress: () => {
              operationInProgressRef.current = null; // Clear on cancel
            }
          },
          {
            text: "رفض مع سبب",
            onPress: () => {
              Alert.alert(
                "اختر سبب الرفض",
                "",
                [
                  {
            text: "إلغاء",
            style: "cancel",
            onPress: () => {
              operationInProgressRef.current = null; // Clear on cancel
            }
          },
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
          {
            text: "إلغاء",
            style: "cancel",
            onPress: () => {
              operationInProgressRef.current = null; // Clear on cancel
            }
          },
          {
            text: "رفض مع سبب",
            onPress: () => {
              Alert.prompt(
                "سبب الرفض",
                "يمكنك إضافة سبب الرفض (اختياري)",
                [
                  {
            text: "إلغاء",
            style: "cancel",
            onPress: () => {
              operationInProgressRef.current = null; // Clear on cancel
            }
          },
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

    const sanitizedPhone = phone?.replace(/[^\d+]/g, "");

    if (!sanitizedPhone || sanitizedPhone.length < 8) {
      showToast("رقم الواتساب غير صالح", "error");
      return;
    }

    const message = encodeURIComponent(
      "مرحباً، بخصوص طلب ربط ملفك الشخصي في شجرة العائلة..."
    );
    const url = `whatsapp://send?phone=${sanitizedPhone}&text=${message}`;
    Linking.openURL(url).catch(() => {
      showToast("تعذر فتح WhatsApp", "error");
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

  // Status color helper
  const getStatusColor = (status) => {
    switch (status) {
      case "pending": return colors.warning;
      case "approved": return colors.success;
      case "rejected": return colors.error;
      default: return colors.textMuted;
    }
  };

  // Render individual request card for FlatList
  const renderRequestCard = useCallback(({ item: request }) => {
    const profile = request.profiles;
    const displayName = profile ? getFullNameChain(profile, allProfiles, nameChainCache.current) : request.name_chain || "غير معروف";
    const statusColor = getStatusColor(tabKeys[selectedTab]);
    const isProcessing = processingRequests.has(request.id);

    return (
      <TouchableOpacity
        onPress={() => profile?.id && handleNavigateToProfile(profile.id)}
        activeOpacity={0.7}
      >
        <View style={styles.requestCard}>
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
                <Text style={styles.profilePhone}>
                  {request.phone || "لا يوجد رقم"}
                </Text>
              </View>
            </View>

            {/* Actions for pending */}
            {tabKeys[selectedTab] === "pending" && (
              <View style={styles.actionButtons}>
                <Pressable
                  onPress={() => handleApprove(request)}
                  style={({ pressed }) => [
                    styles.primaryAction,
                    (pressed || isProcessing) && styles.primaryActionPressed,
                    isProcessing && styles.actionDisabled,
                  ]}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color={colors.background} />
                      <Text style={styles.primaryActionText}>قبول</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => handleReject(request)}
                  style={({ pressed }) => [
                    styles.secondaryAction,
                    (pressed || isProcessing) && styles.secondaryActionPressed,
                    isProcessing && styles.actionDisabled,
                  ]}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <>
                      <Ionicons name="close" size={18} color={colors.text} />
                      <Text style={styles.secondaryActionText}>رفض</Text>
                    </>
                  )}
                </Pressable>

                {request.phone && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="مراسلة عبر واتساب"
                    onPress={() => handleWhatsApp(request.phone)}
                    style={({ pressed }) => [
                      styles.utilityAction,
                      (pressed || isProcessing) && styles.utilityActionPressed,
                      isProcessing && styles.actionDisabled,
                    ]}
                    disabled={isProcessing}
                  >
                    <Ionicons name="logo-whatsapp" size={20} color={colors.text} />
                  </Pressable>
                )}
              </View>
            )}

            {/* Status indicators and WhatsApp for approved/rejected */}
            {tabKeys[selectedTab] === "approved" && (
              <View style={styles.actionButtons}>
                <View style={[styles.statusCapsule, { backgroundColor: `${colors.success}1A` }]}>
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={colors.success}
                  />
                  <Text style={styles.statusText}>تمت الموافقة</Text>
                </View>
                {request.reviewed_at && (
                  <View style={styles.timelineChip}>
                    <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                    <Text style={styles.timelineChipText}>
                      {formatRelativeTime(request.reviewed_at)}
                    </Text>
                  </View>
                )}
                {request.phone && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="مراسلة عبر واتساب"
                    onPress={() => handleWhatsApp(request.phone)}
                    style={({ pressed }) => [
                      styles.utilityAction,
                      pressed && styles.utilityActionPressed,
                    ]}
                  >
                    <Ionicons name="logo-whatsapp" size={20} color={colors.text} />
                  </Pressable>
                )}
              </View>
            )}

            {tabKeys[selectedTab] === "rejected" && (
              <View style={styles.actionButtons}>
                <View style={[styles.statusCapsule, { backgroundColor: `${colors.error}12` }]}>
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
                {request.reviewed_at && (
                  <View style={styles.timelineChip}>
                    <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                    <Text style={styles.timelineChipText}>
                      {formatRelativeTime(request.reviewed_at)}
                    </Text>
                  </View>
                )}
                {request.phone && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="مراسلة عبر واتساب"
                    onPress={() => handleWhatsApp(request.phone)}
                    style={({ pressed }) => [
                      styles.utilityAction,
                      pressed && styles.utilityActionPressed,
                    ]}
                  >
                    <Ionicons name="logo-whatsapp" size={20} color={colors.text} />
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [selectedTab, allProfiles, processingRequests, handleApprove, handleReject, handleWhatsApp, handleNavigateToProfile]);

  // Empty state component
  const handleManualRefresh = useCallback(() => {
    setRefreshing(true);
    loadPendingRequests();
  }, [loadPendingRequests]);

  const renderEmptyState = useCallback(() => {
    if (loading) {
      return (
        <View style={styles.skeletonContainer}>
          {Array.from({ length: 3 }).map((_, index) => (
            <View style={styles.skeletonItem} key={`skeleton-${index}`}>
              <RequestSkeleton />
            </View>
          ))}
        </View>
      );
    }

    const copyByTab = {
      pending: {
        title: "ما فيه طلبات جديدة",
        description: "بنرسل لك تنبيه أول ما يجي طلب ربط جديد. تقدر تحدث القائمة في أي وقت.",
      },
      approved: {
        title: "كل الروابط معتمدة",
        description: "ما وصلنا طلبات جديدة للقبول. لما نعتمد طلب بيظهر هنا مباشرة.",
      },
      rejected: {
        title: "ما فيه طلبات مرفوضة",
        description: "إلى الآن ما رفضنا أي طلب. لو رفضنا، بيظهر هنا مع سبب الرفض.",
      },
    };

    const content = copyByTab[tabKeys[selectedTab]] || copyByTab.pending;

    return (
      <View style={styles.emptyState}>
        <Image
          source={require('../../../assets/sadu_patterns/png/42.png')}
          style={styles.emptyPattern}
          resizeMode="contain"
        />
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconBadge}>
            <Image
              source={require("../../../assets/logo/AlqefariEmblem.png")}
              style={styles.emptyEmblem}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.emptyTitle}>{content.title}</Text>
          <Text style={styles.emptyDescription}>{content.description}</Text>
          <Pressable
            onPress={handleManualRefresh}
            style={({ pressed }) => [
              styles.emptyAction,
              pressed && styles.emptyActionPressed,
            ]}
          >
            <Text style={styles.emptyActionText}>تحديث الطلبات</Text>
          </Pressable>
        </View>
      </View>
    );
  }, [loading, selectedTab, handleManualRefresh]);

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
          <SkeletonLoader
            width="100%"
            height={tokens.touchTarget.minimum}
            borderRadius={tokens.radii.md}
            style={{ flex: 1, marginEnd: spacing.sm }}
          />
          <SkeletonLoader
            width="100%"
            height={tokens.touchTarget.minimum}
            borderRadius={tokens.radii.md}
            style={{ flex: 1, marginEnd: spacing.sm }}
          />
          <SkeletonLoader
            width={tokens.touchTarget.minimum}
            height={tokens.touchTarget.minimum}
            borderRadius={tokens.radii.md}
          />
        </View>
      )}
    </View>
  );

  return (
    <>
      <SafeAreaView style={styles.container} edges={["top", "bottom", "left", "right"]}>
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
                <Ionicons name="chevron-back" size={28} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBarContainer}>
          <TabBar
            tabs={tabs}
            activeTab={selectedTab}
            onTabChange={(tabId) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedTab(tabId);
            }}
            showDivider={true}
          />
        </View>

        {/* List */}
        <FlatList
        data={currentRequests}
        renderItem={renderRequestCard}
        keyExtractor={item => String(item.id)}
        style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            currentRequests.length === 0 && { flex: 1 }
          ]}
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
          ListHeaderComponent={
            currentRequests.length > 0 ? (
              <View style={styles.listHeaderSpacer} />
            ) : null
          }
          ListEmptyComponent={renderEmptyState}
          windowSize={10}
          maxToRenderPerBatch={20}
          initialNumToRender={10}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={50}
        />
      </SafeAreaView>

      <Toast
        visible={toastState.visible}
        message={toastState.message}
        type={toastState.type}
        onDismiss={dismissToast}
      />
    </>
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
    marginBottom: spacing.md,
  },
  loadingText: {
    ...typography.subheadline,
    fontFamily: "SF Arabic",
    color: colors.textMuted,
  },
  skeletonContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
  },
  skeletonItem: {
    marginBottom: spacing.sm,
  },

  // Header - matching SettingsPage pattern
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === "ios" ? spacing.md : spacing.lg,
    paddingBottom: spacing.xs,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  backButton: {
    padding: spacing.xs,
    marginStart: spacing.xs,
    marginEnd: -spacing.xs,
  },
  emblem: {
    width: 48,
    height: 48,
    tintColor: colors.text,
    marginEnd: spacing.xs / 2,
    marginTop: -spacing.xs / 2,
    marginStart: -spacing.xs / 2,
  },
  titleContent: {
    flex: 1,
  },
  title: {
    ...typography.largeTitle,
    fontFamily: "SF Arabic",
    color: colors.text,
  },

  // Tab Bar
  tabBarContainer: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },

  // Stats

  // Scroll
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xxl + spacing.md,
  },

  // List
  listContainer: {
    paddingTop: spacing.md,
  },
  listHeaderSpacer: {
    height: spacing.lg + spacing.sm,
  },

  // Card - Modern floating style
  requestCard: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: tokens.radii.md,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.container}33`,
    ...Platform.select({
      ios: tokens.shadow.ios,
      android: tokens.shadow.android,
    }),
  },
  statusIndicatorLine: {
    position: "absolute",
    start: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  cardContent: {
    paddingTop: spacing.sm,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
  },

  // Photo
  photoContainer: {
    position: "relative",
  },
  profilePhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    ...typography.callout,
    fontFamily: "SF Arabic",
    fontWeight: "700",
    color: colors.white,
  },
  photoBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: `${colors.container}4D`,
  },

  // Info
  profileInfo: {
    flex: 1,
    marginStart: spacing.sm,
  },
  profileName: {
    ...typography.body,
    fontFamily: "SF Arabic",
    color: colors.text,
    fontWeight: "600",
    marginBottom: spacing.xs / 2,
  },
  metaRow: {
    marginBottom: spacing.xs / 2,
  },
  profileMeta: {
    ...typography.footnote,
    fontFamily: "SF Arabic",
    color: `${colors.text}66`,
    marginBottom: spacing.xs / 2,
  },
  profilePhone: {
    ...typography.footnote,
    fontFamily: "SF Arabic",
    color: `${colors.textMuted}CC`,
  },
  metaSeparator: {
    ...typography.footnote,
    color: colors.textMuted,
    marginHorizontal: spacing.xs / 2,
  },

  // Actions
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  primaryAction: {
    flex: 1,
    minHeight: tokens.touchTarget.minimum,
    borderRadius: tokens.radii.md,
    backgroundColor: colors.secondary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  primaryActionPressed: {
    opacity: 0.85,
  },
  primaryActionText: {
    ...typography.headline,
    fontFamily: Platform.select({ ios: "SF Arabic", default: "System" }),
    color: colors.background,
    marginStart: spacing.xs,
  },
  secondaryAction: {
    flex: 1,
    minHeight: tokens.touchTarget.minimum,
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.container}80`,
    backgroundColor: `${colors.container}1A`,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  secondaryActionPressed: {
    backgroundColor: `${colors.container}33`,
  },
  secondaryActionText: {
    ...typography.headline,
    fontFamily: Platform.select({ ios: "SF Arabic", default: "System" }),
    color: colors.text,
    marginStart: spacing.xs,
  },
  utilityAction: {
    width: tokens.touchTarget.minimum,
    minHeight: tokens.touchTarget.minimum,
    borderRadius: tokens.radii.md,
    backgroundColor: `${colors.container}26`,
    alignItems: "center",
    justifyContent: "center",
  },
  utilityActionPressed: {
    backgroundColor: `${colors.container}40`,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  statusCapsule: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: tokens.radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    backgroundColor: `${colors.container}20`,
    flexShrink: 1,
  },
  statusText: {
    ...typography.subheadline,
    fontFamily: "SF Arabic",
    color: colors.text,
    fontWeight: "600",
  },
  timelineChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: tokens.radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: `${colors.container}20`,
    gap: spacing.xs / 2,
    flexShrink: 1,
  },
  timelineChipText: {
    ...typography.footnote,
    fontFamily: "SF Arabic",
    color: colors.textMuted,
  },
  rejectionNote: {
    ...typography.footnote,
    fontFamily: "SF Arabic",
    color: colors.textMuted,
    maxWidth: 160,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl * 2,
  },
  emptyPattern: {
    position: "absolute",
    width: 200,
    height: 200,
    opacity: 0.05,
  },
  emptyCard: {
    width: "80%",
    maxWidth: 360,
    backgroundColor: colors.background,
    borderRadius: tokens.radii.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.container}33`,
    ...Platform.select({
      ios: tokens.shadow.ios,
      android: tokens.shadow.android,
    }),
  },
  emptyIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.container}26`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.container}80`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyEmblem: {
    width: 32,
    height: 32,
    tintColor: colors.primary,
  },
  emptyTitle: {
    ...typography.title3,
    fontFamily: "SF Arabic",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    ...typography.subheadline,
    fontFamily: "SF Arabic",
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: typography.subheadline.lineHeight,
  },
  emptyAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.white,
    borderRadius: tokens.radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.primary}66`,
  },
  emptyActionPressed: {
    backgroundColor: `${colors.primary}10`,
  },
  emptyActionText: {
    ...typography.subheadline,
    fontFamily: "SF Arabic",
    color: colors.primary,
    fontWeight: "600",
  },
});
