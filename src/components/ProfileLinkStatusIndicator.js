import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Animated,
  LayoutAnimation,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import phoneAuthService from "../services/phoneAuth";
import { useRouter } from "expo-router";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildNameChain } from "../utils/nameChainBuilder";
import { featureFlags } from "../config/featureFlags";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Najdi Sadu Color System
const colors = {
  background: "#F9F7F3",    // Al-Jass White
  container: "#D1BBA3",      // Camel Hair Beige
  text: "#242121",          // Sadu Night
  primary: "#A13333",       // Najdi Crimson
  secondary: "#D58C4A",     // Desert Ochre
  muted: "#24212199",       // Sadu Night 60%
  success: "#22C55E",
  warning: "#D58C4A",
  error: "#EF4444",
};

export default function ProfileLinkStatusIndicator() {
  if (!featureFlags.profileLinkRequests) {
    return null;
  }

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [linkRequest, setLinkRequest] = useState(null);
  const [hasLinkedProfile, setHasLinkedProfile] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [shouldHideLinked, setShouldHideLinked] = useState(false);
  const [profileChain, setProfileChain] = useState("");
  const [allProfiles, setAllProfiles] = useState([]);
  const [lastLoadTime, setLastLoadTime] = useState(0);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadProfileStatus();
  }, []);

  useEffect(() => {
    // Don't set up subscriptions until we have a user
    if (!user) return;

    // Debounced loader to prevent rapid successive reloads
    const debouncedLoad = () => {
      const now = Date.now();
      // Prevent reloading more than once per second
      if (now - lastLoadTime > 1000) {
        setLastLoadTime(now);
        loadProfileStatus();
      }
    };

    // Subscribe to real-time updates for THIS USER's profile_link_requests only
    const channelName = `profile-status-${user.id}`;
    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profile_link_requests',
        filter: `user_id=eq.${user.id}` // CRITICAL: Only this user's requests
      }, (payload) => {
        // Only process if this is actually a relevant change
        if (!payload.new || payload.new.user_id !== user.id) return;

        // Add haptic feedback for status changes
        if (payload.eventType === 'UPDATE' && payload.new) {
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;

          // Notify user when their request status changes
          if (oldStatus === 'pending' && (newStatus === 'approved' || newStatus === 'rejected')) {
            Haptics.notificationAsync(
              newStatus === 'approved'
                ? Haptics.NotificationFeedbackType.Success
                : Haptics.NotificationFeedbackType.Warning
            );
          }

          // Only reload if status actually changed
          if (oldStatus !== newStatus) {
            debouncedLoad();
          }
        } else if (payload.eventType === 'INSERT') {
          // New request created
          debouncedLoad();
        }
      })
      .subscribe();

    // Subscribe to profile updates for this specific user
    const profileChannelName = `profile-updates-${user.id}`;
    const profileSubscription = supabase
      .channel(profileChannelName)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        if (payload.new?.user_id === user.id) {
          // Profile just got linked!
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          debouncedLoad();
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      profileSubscription.unsubscribe();
    };
  }, [user, lastLoadTime]);

  useEffect(() => {
    // Animate entrance
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    }

    // Animate progress indicator for pending state
    if (linkRequest?.status === "pending") {
      Animated.loop(
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        })
      ).start();
    }
  }, [loading, linkRequest]);

  // Re-build name chain when allProfiles updates
  useEffect(() => {
    if (profile && allProfiles.length > 0) {
      const chain = buildNameChain(profile, allProfiles);
      const finalChain = chain.includes("القفاري") ? chain : `${chain} القفاري`;
      // console.log("[ProfileLinkStatusIndicator] Re-built chain after profiles update:", finalChain);
      setProfileChain(finalChain);
    }
  }, [allProfiles, profile]);

  const loadProfileStatus = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUser(user);

      // Check if user has a linked profile
      const { data: linkedProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (linkedProfile) {
        setProfile(linkedProfile);
        setHasLinkedProfile(true);

        // Use pre-computed chain or build from available data
        // First, check if we have a full_chain already
        if (linkedProfile.full_chain) {
          const chain = linkedProfile.full_chain;
          const finalChain = chain.includes("القفاري") ? chain : `${chain} القفاري`;
          setProfileChain(finalChain);
        } else {
          // Build basic chain from available fields without loading all profiles
          let basicChain = linkedProfile.name;

          if (linkedProfile.father_name) {
            basicChain = `${linkedProfile.name} بن ${linkedProfile.father_name}`;
            if (linkedProfile.grandfather_name) {
              basicChain += ` ${linkedProfile.grandfather_name}`;
            }
          }

          const finalChain = basicChain.includes("القفاري") ? basicChain : `${basicChain} القفاري`;
          setProfileChain(finalChain);

          // Optionally: Load only necessary profiles for chain building (not ALL profiles)
          // This should be done server-side via RPC function for efficiency
          if (linkedProfile.father_id) {
            // Load only direct ancestors for chain building (much more efficient)
            const { data: ancestors } = await supabase
              .rpc('get_ancestors_chain', { profile_id: linkedProfile.id })
              .single();

            if (ancestors?.chain) {
              const finalChain = ancestors.chain.includes("القفاري")
                ? ancestors.chain
                : `${ancestors.chain} القفاري`;
              setProfileChain(finalChain);
            }
          }
        }

        // Check if we've already shown the congratulations for this specific profile
        const congratsKey = `congratulationsShown_${linkedProfile.id}`;
        const congratsShown = await AsyncStorage.getItem(congratsKey);

        // Only show success message ONCE when first approved
        if (congratsShown !== "true") {
          // First time after approval - show success and mark as shown
          await AsyncStorage.setItem(congratsKey, "true");

          // Auto-dismiss after 5 seconds
          setTimeout(() => {
            Animated.parallel([
              Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
              }),
              Animated.timing(slideAnim, {
                toValue: -100,
                duration: 500,
                useNativeDriver: true,
              }),
            ]).start(() => {
              setShouldHideLinked(true);
            });
          }, 5000);
        } else {
          // Congratulations already shown for this profile - hide immediately
          setShouldHideLinked(true);
        }
      } else {
        // Check for pending link requests
        const { data: requests, error: reqError } = await supabase
          .from("profile_link_requests")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (requests && requests.length > 0) {
          const request = requests[0];

          // Fetch the profile separately if we have a profile_id
          if (request.profile_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("id, name")
              .eq("id", request.profile_id)
              .single();

            if (profile) {
              request.profile = profile;
            }
          }

          setLinkRequest(request);

          // Mark approval/rejection as seen if not already
          if (request.status === 'approved' && !request.approval_seen) {
            await supabase
              .from('profile_link_requests')
              .update({ approval_seen: true })
              .eq('id', request.id);
            // console.log('[ProfileLinkStatusIndicator] Marked approval as seen');
          } else if (request.status === 'rejected' && !request.rejection_seen) {
            await supabase
              .from('profile_link_requests')
              .update({ rejection_seen: true })
              .eq('id', request.id);
            // console.log('[ProfileLinkStatusIndicator] Marked rejection as seen');
          }
        }
      }
    } catch (error) {
      console.error("Error loading profile status:", error);
    }
    setLoading(false);
  };

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getFullNameWithSurname = (profileOrName) => {
    if (!profileOrName) return "غير محدد";

    // If it's an object (profile), build the chain
    if (typeof profileOrName === 'object') {
      const chain = buildNameChain(profileOrName, allProfiles);
      if (chain) {
        return chain.includes("القفاري") ? chain : `${chain} القفاري`;
      }
      const name = profileOrName.name || "غير محدد";
      return name.includes("القفاري") ? name : `${name} القفاري`;
    }

    // If it's just a string name
    const name = profileOrName;

    // Try to build name chain if we have the profile
    if (linkRequest?.profile_id && allProfiles.length > 0) {
      const fullProfile = allProfiles.find(p => p.id === linkRequest.profile_id);
      if (fullProfile) {
        const chain = buildNameChain(fullProfile, allProfiles);
        if (chain && chain !== name) {
          return chain.includes("القفاري") ? chain : `${chain} القفاري`;
        }
      }
    }

    if (name.includes("القفاري")) return name;
    return `${name} القفاري`;
  };

  const handleWithdraw = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await phoneAuthService.withdrawLinkRequest(linkRequest.id);
    if (result.success) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      loadProfileStatus();
    } else {
      Alert.alert("خطأ", result.error);
    }
  };

  const handleContactAdmin = () => {
    const adminPhone = "+966501234567";
    const displayName = linkRequest?.profile ?
      getFullNameWithSurname(linkRequest.profile) :
      getFullNameWithSurname(linkRequest?.name_chain || "غير محدد");
    const message = encodeURIComponent(`مرحباً، أحتاج مساعدة بخصوص ربط ملفي الشخصي\n\nالملف المطلوب: ${displayName}\nرقم الهاتف: ${user?.phone || ""}`);
    const url = `whatsapp://send?phone=${adminPhone}&text=${message}`;

    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        const webUrl = `https://wa.me/${adminPhone.replace('+', '')}?text=${message}`;
        Linking.openURL(webUrl);
      }
    });
  };

  const handleViewInTree = () => {
    if (!linkRequest?.profile) return;
    router.push({
      pathname: "/",
      params: {
        highlightProfileId: linkRequest.profile.id,
        focusOnProfile: true
      },
    });
  };

  const handleStartLinking = () => {
    router.push("/auth/profile-linking");
  };

  if (loading) {
    return null;
  }

  if (!user) {
    return null;
  }

  // Linked Profile State - Success message with auto-dismiss
  if (hasLinkedProfile && profile && !shouldHideLinked) {
    // Always show name chain - use profileChain if available, otherwise build from profile
    const displayChain = profileChain || (() => {
      let chain = profile.full_chain || profile.name;
      if (!chain.includes("القفاري")) {
        chain = `${chain} القفاري`;
      }
      return chain;
    })();

    // console.log("[ProfileLinkStatusIndicator] Displaying success with chain:", displayChain);

    return (
      <Animated.View
        style={[
          styles.linkedIndicator,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.linkedSuccessContent}>
          <View style={styles.successHeader}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            <Text style={styles.successMessage}>تهانينا! تم ربط حسابك</Text>
          </View>
          <Text style={styles.linkedProfileName}>{displayChain}</Text>
        </View>
      </Animated.View>
    );
  }

  // Hide indicator if already seen
  if (hasLinkedProfile && shouldHideLinked) {
    return null;
  }

  // Pending Request State - Progress strip
  if (linkRequest?.status === "pending") {
    const timeAgo = formatDistanceToNow(new Date(linkRequest.created_at), {
      addSuffix: true,
      locale: ar,
    });

    const displayName = linkRequest.profile ?
      getFullNameWithSurname(linkRequest.profile) :
      getFullNameWithSurname(linkRequest.name_chain || "غير محدد");

    return (
      <Animated.View
        style={[
          styles.pendingContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.pendingStrip}
          onPress={toggleExpanded}
          activeOpacity={0.9}
        >
          {/* Progress background animation */}
          <Animated.View
            style={[
              styles.progressBackground,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />

          <View style={styles.pendingContent}>
            <View style={styles.pendingLeft}>
              <View style={styles.pendingDot} />
              <Text style={styles.pendingText}>طلب قيد المراجعة</Text>
              <Text style={styles.pendingTime}>{timeAgo}</Text>
            </View>

            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.primary}
            />
          </View>
        </TouchableOpacity>

        {expanded && (
          <View style={styles.expandedContent}>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.textActionButton, styles.flexButton]}
                onPress={handleViewInTree}
                activeOpacity={0.8}
              >
                <Ionicons name="eye-outline" size={16} color={colors.text} />
                <Text style={styles.actionButtonText}>عرض</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.textActionButton, styles.flexButton]}
                onPress={handleWithdraw}
                activeOpacity={0.8}
              >
                <Ionicons name="close-outline" size={16} color={colors.text} />
                <Text style={styles.actionButtonText}>سحب</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.textActionButton, styles.flexButton, styles.whatsappButton]}
                onPress={handleContactAdmin}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                <Text style={styles.whatsappButtonText}>تواصل</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>
    );
  }

  // Rejected Request State - Action banner
  if (linkRequest?.status === "rejected") {
    const displayName = linkRequest.profile ?
      getFullNameWithSurname(linkRequest.profile) :
      getFullNameWithSurname(linkRequest.name_chain || "غير محدد");

    return (
      <Animated.View
        style={[
          styles.rejectedContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.rejectedContent}>
          <Ionicons name="close-circle" size={20} color={colors.error} />
          <Text style={styles.rejectedText}>تم رفض الطلب</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.push("/auth/profile-linking")}
            activeOpacity={0.8}
          >
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  // No Profile Linked State - Minimal prompt
  return (
    <Animated.View
      style={[
        styles.noLinkContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.linkPrompt}
        onPress={handleStartLinking}
        activeOpacity={0.8}
      >
        <Ionicons name="link-outline" size={18} color={colors.primary} />
        <Text style={styles.linkPromptText}>ربط ملفك الشخصي</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Linked state
  linkedIndicator: {
    backgroundColor: colors.success + "15",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.success + "30",
  },
  linkedSuccessContent: {
    alignItems: "center",
  },
  successHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.text,
  },
  linkedProfileName: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: colors.text,
    marginTop: 4,
    textAlign: "center",
  },

  // Pending state
  pendingContainer: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  pendingStrip: {
    height: 48,
    position: "relative",
    overflow: "hidden",
  },
  progressBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.warning + "10",
  },
  pendingContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 48,
  },
  pendingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warning,
  },
  pendingText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.text,
  },
  pendingTime: {
    fontSize: 12,
    fontFamily: "SF Arabic",
    color: colors.muted,
  },
  expandedContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.container + "20",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 6,
    alignItems: "stretch",
  },
  textActionButton: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.container + "40",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  flexButton: {
    flex: 1,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.text,
  },
  whatsappButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  whatsappButtonText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#FFFFFF",
  },

  // Rejected state
  rejectedContainer: {
    backgroundColor: colors.error + "10",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.error + "20",
  },
  rejectedContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rejectedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: colors.error,
  },
  retryButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.error,
    borderRadius: 14,
  },
  retryText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#FFFFFF",
  },

  // No link state
  noLinkContainer: {
    marginBottom: 12,
  },
  linkPrompt: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.primary + "08",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + "20",
    gap: 8,
  },
  linkPromptText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: colors.primary,
  },
});
