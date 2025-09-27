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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [linkRequest, setLinkRequest] = useState(null);
  const [hasLinkedProfile, setHasLinkedProfile] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadProfileStatus();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('profile-status')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profile_link_requests'
      }, loadProfileStatus)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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

  const getFullNameWithSurname = (name) => {
    if (!name) return "غير محدد";
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
    const displayName = linkRequest?.name_chain || linkRequest?.profile?.name || "غير محدد";
    const message = encodeURIComponent(`مرحباً، أحتاج مساعدة بخصوص ربط ملفي الشخصي\n\nالملف المطلوب: ${getFullNameWithSurname(displayName)}\nرقم الهاتف: ${user?.phone || ""}`);
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
    router.push("/auth/NameChainEntry");
  };

  if (loading) {
    return null;
  }

  if (!user) {
    return null;
  }

  // Linked Profile State - Minimal success indicator
  if (hasLinkedProfile && profile) {
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
        <View style={styles.linkedContent}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.linkedText}>
            {getFullNameWithSurname(profile.name)}
          </Text>
        </View>
      </Animated.View>
    );
  }

  // Pending Request State - Progress strip
  if (linkRequest?.status === "pending") {
    const timeAgo = formatDistanceToNow(new Date(linkRequest.created_at), {
      addSuffix: true,
      locale: ar,
    });

    const displayName = linkRequest.name_chain || linkRequest.profile?.name || "غير محدد";

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
            <Text style={styles.requestedName} numberOfLines={1}>
              {getFullNameWithSurname(displayName)}
            </Text>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.textActionButton}
                onPress={handleViewInTree}
                activeOpacity={0.8}
              >
                <Text style={styles.actionButtonText}>عرض في الشجرة</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.textActionButton}
                onPress={handleWithdraw}
                activeOpacity={0.8}
              >
                <Text style={styles.withdrawButtonText}>سحب الطلب</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.iconActionButton, styles.whatsappButton]}
                onPress={handleContactAdmin}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>
    );
  }

  // Rejected Request State - Action banner
  if (linkRequest?.status === "rejected") {
    const displayName = linkRequest.name_chain || linkRequest.profile?.name || "غير محدد";

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
            onPress={() => router.push("/auth/NameChainEntry")}
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
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.success + "15",
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  linkedContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  linkedText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.text,
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.container + "20",
  },
  requestedName: {
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: colors.text,
    marginTop: 8,
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  textActionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.container + "20",
    borderWidth: 1,
    borderColor: colors.container + "40",
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.primary,
  },
  withdrawButtonText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.error,
  },
  iconActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  whatsappButton: {
    backgroundColor: colors.primary,
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