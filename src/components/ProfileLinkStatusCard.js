import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import phoneAuthService from "../services/phoneAuth";
import { useRouter } from "expo-router";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

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

export default function ProfileLinkStatusCard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [linkRequest, setLinkRequest] = useState(null);
  const [hasLinkedProfile, setHasLinkedProfile] = useState(false);

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
        const { data: requests } = await supabase
          .from("profile_link_requests")
          .select(`
            *,
            profile:profiles!profile_link_requests_profile_id_fkey(*)
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (requests && requests.length > 0) {
          setLinkRequest(requests[0]);
        }
      }
    } catch (error) {
      console.error("Error loading profile status:", error);
    }
    setLoading(false);
  };

  const handleWithdraw = () => {
    Alert.alert(
      "سحب الطلب",
      "هل أنت متأكد من رغبتك في سحب الطلب؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "سحب",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            const result = await phoneAuthService.withdrawLinkRequest(linkRequest.id);
            if (result.success) {
              Alert.alert("نجح", result.message);
              loadProfileStatus();
            } else {
              Alert.alert("خطأ", result.error);
            }
            setLoading(false);
          },
        },
      ]
    );
  };

  const handleUnlinkRequest = () => {
    Alert.alert(
      "إلغاء الربط",
      "سيتم إرسال طلب للمشرف لإلغاء ربط ملفك الشخصي. هل تريد المتابعة؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "إرسال الطلب",
          onPress: async () => {
            setLoading(true);
            const result = await phoneAuthService.requestUnlinkProfile();
            if (result.success) {
              Alert.alert("نجح", result.message);
            } else {
              Alert.alert("خطأ", result.error);
            }
            setLoading(false);
          },
        },
      ]
    );
  };

  const handleRetry = () => {
    // Navigate to profile matching screen to try again
    router.push({
      pathname: "/auth/ProfileMatching",
      params: {
        nameChain: linkRequest?.name_chain || user?.user_metadata?.name || "",
        fromRetry: true,
      },
    });
  };

  const handleContactAdmin = () => {
    // Open WhatsApp with admin number
    const adminPhone = "+966501234567"; // Replace with actual admin number
    const message = encodeURIComponent("مرحباً، أحتاج مساعدة بخصوص ربط ملفي الشخصي");
    const url = `whatsapp://send?phone=${adminPhone}&text=${message}`;

    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // Fallback to web WhatsApp
        const webUrl = `https://wa.me/${adminPhone.replace('+', '')}?text=${message}`;
        Linking.openURL(webUrl);
      }
    }).catch(() => {
      Alert.alert("خطأ", "لا يمكن فتح WhatsApp");
    });
  };

  const handleViewInTree = () => {
    if (!linkRequest?.profile) return;

    // Navigate to tree view with the requested profile highlighted
    router.push({
      pathname: "/tree",
      params: {
        highlightProfileId: linkRequest.profile.id,
        focusOnProfile: true
      },
    });
  };

  const handleViewProfile = () => {
    if (!profile) return;

    // Navigate to tree view with user's linked profile
    router.push({
      pathname: "/tree",
      params: {
        highlightProfileId: profile.id,
        focusOnProfile: true
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return null;
  }

  // Linked Profile State
  if (hasLinkedProfile && profile) {
    return (
      <View style={[styles.container, styles.successContainer]}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle" size={28} color={colors.success} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.statusTitle}>الملف الشخصي مرتبط</Text>
            <Text style={styles.profileName}>{profile.name || profile.name_ar || "غير محدد"}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleViewProfile}
            activeOpacity={0.8}
          >
            <Ionicons name="eye" size={20} color="#F9F7F3" />
            <Text style={styles.primaryButtonText}>عرض في الشجرة</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleUnlinkRequest}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>إلغاء الربط</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Pending Request State
  if (linkRequest?.status === "pending") {
    const timeAgo = formatDistanceToNow(new Date(linkRequest.created_at), {
      addSuffix: true,
      locale: ar,
    });

    return (
      <View style={[styles.container, styles.pendingContainer]}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="time" size={28} color={colors.warning} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.statusTitle}>طلب قيد المراجعة</Text>
            <Text style={styles.subtitle}>تم الإرسال {timeAgo}</Text>
          </View>
        </View>

        {linkRequest.profile && (
          <View style={styles.requestedProfileCard}>
            <Text style={styles.requestedProfileLabel}>الملف المطلوب:</Text>
            <Text style={styles.requestedProfileName}>{linkRequest.profile.name || linkRequest.profile.name_ar}</Text>
          </View>
        )}

        <View style={styles.actions}>
          {linkRequest.profile && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleViewInTree}
              activeOpacity={0.8}
            >
              <Ionicons name="git-branch" size={20} color="#F9F7F3" />
              <Text style={styles.primaryButtonText}>عرض في الشجرة</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleContactAdmin}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={20} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>تواصل</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleWithdraw}
            activeOpacity={0.8}
          >
            <Text style={styles.dangerButtonText}>سحب الطلب</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Rejected Request State
  if (linkRequest?.status === "rejected") {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="close-circle" size={28} color={colors.error} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.statusTitle}>تم رفض الطلب</Text>
            {linkRequest.review_notes && (
              <Text style={styles.rejectionReason}>السبب: {linkRequest.review_notes}</Text>
            )}
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleRetry}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={20} color="#F9F7F3" />
            <Text style={styles.primaryButtonText}>إعادة المحاولة</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleContactAdmin}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={20} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>تواصل</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // No Profile Linked State
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="person-add" size={28} color={colors.muted} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.statusTitle}>لا يوجد ملف مرتبط</Text>
          <Text style={styles.subtitle}>اربط ملفك الشخصي لتتمكن من تعديل معلوماتك</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => router.push("/auth/NameChainEntry")}
        activeOpacity={0.8}
      >
        <Ionicons name="search" size={20} color="#F9F7F3" />
        <Text style={styles.primaryButtonText}>البحث عن ملفي</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: colors.container + "40",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  successContainer: {
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  pendingContainer: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  errorContainer: {
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: colors.text,
    marginBottom: 4,
  },
  profileName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    color: colors.muted,
  },
  requestedProfileCard: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.container + "20",
  },
  requestedProfileLabel: {
    fontSize: 12,
    fontFamily: "SF Arabic",
    color: colors.muted,
    marginBottom: 4,
  },
  requestedProfileName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.text,
  },
  rejectionReason: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    color: colors.error,
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#F9F7F3",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  secondaryButton: {
    flex: 1,
    minWidth: 100,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.container,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  dangerButton: {
    minWidth: 100,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.error + "40",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
});