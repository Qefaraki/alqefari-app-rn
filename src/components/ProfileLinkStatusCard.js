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
import { buildNameChain } from "../utils/nameChainBuilder";

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
  const [allProfiles, setAllProfiles] = useState([]);

  useEffect(() => {
    loadProfileStatus();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Subscribe to real-time updates for THIS USER's requests only
    const channelName = `profile-card-${user.id}`;
    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profile_link_requests',
        filter: `user_id=eq.${user.id}` // Only this user's requests
      }, (payload) => {
        // Only reload if this is actually our request
        if (payload.new?.user_id === user.id) {
          loadProfileStatus();
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  // Removed effect for allProfiles as we're not using it anymore

  const loadProfileStatus = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUser(user);

      // Check if user has a linked profile - include all fields needed for name chain
      const { data: linkedProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // Don't load ALL profiles - it's not scalable
      // Instead, rely on the profile's existing full_chain or computed fields
      setAllProfiles([]); // Clear this as we're not using it anymore

      if (linkedProfile) {
        setProfile(linkedProfile);
        setHasLinkedProfile(true);
      } else {
        // Check for pending link requests - simplified query
        const { data: requests, error: reqError } = await supabase
          .from("profile_link_requests")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (reqError) {
          console.error("Error fetching link requests:", reqError);
        } else if (requests && requests.length > 0) {
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

  // Helper function to get full name chain
  const getFullNameChain = (profileOrName) => {
    if (!profileOrName) return "غير محدد";

    // If it's an object (profile), use its fields
    if (typeof profileOrName === 'object') {
      // Use pre-computed full_chain if available
      if (profileOrName.full_chain) {
        const chain = profileOrName.full_chain;
        return chain.includes("القفاري") ? chain : `${chain} القفاري`;
      }

      // Build basic chain from available fields
      let chain = profileOrName.name;
      if (profileOrName.father_name) {
        chain = `${profileOrName.name} بن ${profileOrName.father_name}`;
        if (profileOrName.grandfather_name) {
          chain += ` ${profileOrName.grandfather_name}`;
        }
      }

      return chain.includes("القفاري") ? chain : `${chain} القفاري`;
    }

    // If it's just a string name
    const name = profileOrName;
    return name.includes("القفاري") ? name : `${name} القفاري`;
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
    const displayName = linkRequest?.profile ?
                       getFullNameChain(linkRequest.profile) :
                       getFullNameChain(linkRequest?.name_chain || "غير محدد");

    const message = encodeURIComponent(`مرحباً، أحتاج مساعدة بخصوص ربط ملفي الشخصي

الملف المطلوب: ${displayName}
رقم الهاتف: ${user?.phone || ""}`);

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
    const nameChain = getFullNameChain(profile);

    return (
      <View style={[styles.container, styles.successContainer]}>
        <View style={styles.statusBadge}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.statusText}>الملف الشخصي مرتبط</Text>
        </View>

        <Text style={styles.profileName} numberOfLines={2}>
          {nameChain}
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleViewProfile}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>عرض في الشجرة</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.outlineButton]}
            onPress={handleUnlinkRequest}
            activeOpacity={0.8}
          >
            <Text style={styles.outlineButtonText}>إلغاء الربط</Text>
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

    // Get the full name chain or construct from profile data
    const displayName = linkRequest.profile ?
                       getFullNameChain(linkRequest.profile) :
                       getFullNameChain(linkRequest.name_chain || "غير محدد");

    return (
      <View style={[styles.container, styles.pendingContainer]}>
        <View style={styles.statusBadge}>
          <Ionicons name="time" size={20} color={colors.warning} />
          <Text style={styles.statusText}>طلب قيد المراجعة</Text>
        </View>

        <Text style={styles.timeAgo}>تم الإرسال {timeAgo}</Text>

        {linkRequest.profile && (
          <View style={styles.requestedProfileSection}>
            <Text style={styles.requestedLabel}>الملف المطلوب:</Text>
            <Text style={styles.profileName} numberOfLines={2}>
              {displayName}
            </Text>
          </View>
        )}

        <View style={styles.buttonRow}>
          {linkRequest.profile && (
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleViewInTree}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>عرض في الشجرة</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.whatsappButton}
            onPress={handleContactAdmin}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.withdrawButton}
          onPress={handleWithdraw}
          activeOpacity={0.8}
        >
          <Text style={styles.withdrawButtonText}>سحب الطلب</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Rejected Request State
  if (linkRequest?.status === "rejected") {
    const displayName = linkRequest.profile ?
                       getFullNameChain(linkRequest.profile) :
                       getFullNameChain(linkRequest.name_chain || "غير محدد");

    return (
      <View style={[styles.container, styles.errorContainer]}>
        <View style={styles.statusBadge}>
          <Ionicons name="close-circle" size={20} color={colors.error} />
          <Text style={styles.statusText}>تم رفض الطلب</Text>
        </View>

        {linkRequest.review_notes && (
          <View style={styles.rejectionSection}>
            <Text style={styles.rejectionReason}>{linkRequest.review_notes}</Text>
          </View>
        )}

        {linkRequest.profile && (
          <Text style={styles.profileName} numberOfLines={2}>
            {displayName}
          </Text>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleRetry}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>إعادة المحاولة</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.whatsappButton}
            onPress={handleContactAdmin}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // No Profile Linked State
  return (
    <View style={styles.container}>
      <View style={styles.statusBadge}>
        <Ionicons name="person-add-outline" size={20} color={colors.muted} />
        <Text style={styles.statusText}>لا يوجد ملف مرتبط</Text>
      </View>

      <Text style={styles.subtitle}>
        اربط ملفك الشخصي لتتمكن من تعديل معلوماتك
      </Text>

      <TouchableOpacity
        style={[styles.button, styles.primaryButton, styles.fullWidth]}
        onPress={() => router.push("/auth/profile-linking")}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>البحث عن ملفي</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.container + "30",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  successContainer: {
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  pendingContainer: {
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  errorContainer: {
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.text,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.text,
    marginBottom: 12,
    lineHeight: 24,
  },
  timeAgo: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: colors.muted,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    color: colors.muted,
    marginBottom: 12,
    lineHeight: 20,
  },
  requestedProfileSection: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.container + "20",
  },
  requestedLabel: {
    fontSize: 12,
    fontFamily: "SF Arabic",
    color: colors.muted,
    marginBottom: 4,
  },
  rejectionSection: {
    backgroundColor: colors.error + "10",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.error + "20",
  },
  rejectionReason: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    color: colors.error,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: "#F9F7F3",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  outlineButton: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.container,
  },
  outlineButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  whatsappButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.primary, // Najdi Crimson
    alignItems: "center",
    justifyContent: "center",
  },
  withdrawButton: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.error + "15",
    borderWidth: 1,
    borderColor: colors.error + "30",
  },
  withdrawButtonText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  fullWidth: {
    width: "100%",
  },
});