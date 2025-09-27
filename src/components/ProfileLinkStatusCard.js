import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import phoneAuthService from "../services/phoneAuth";
import { useAuth } from "../contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

// Najdi Sadu Color Palette
const colors = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  textSecondary: "#242121CC", // Sadu Night 80%
  textMuted: "#24212199", // Sadu Night 60%
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  success: "#4CAF50",
  warning: "#FFA000",
  error: "#F44336",
};

export default function ProfileLinkStatusCard() {
  const router = useRouter();
  const { user, hasLinkedProfile, hasPendingRequest, checkProfileStatus } = useAuth();
  const [loading, setLoading] = useState(false);
  const [linkRequest, setLinkRequest] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    loadStatus();
  }, [user, hasLinkedProfile, hasPendingRequest]);

  const loadStatus = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // If has linked profile, load it
      if (hasLinkedProfile) {
        const profileData = await phoneAuthService.checkProfileLink(user);
        setProfile(profileData);
      }
      // If has pending request, load it
      else if (hasPendingRequest) {
        const { requests } = await phoneAuthService.getUserLinkRequests();
        const pending = requests.find(r => r.status === "pending");
        setLinkRequest(pending);
      }
      // Check for rejected requests
      else {
        const { requests } = await phoneAuthService.getUserLinkRequests();
        const rejected = requests.find(r => r.status === "rejected");
        if (rejected) {
          setLinkRequest(rejected);
        }
      }
    } catch (error) {
      console.error("Error loading status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = () => {
    if (!linkRequest) return;

    Alert.alert(
      "سحب الطلب",
      "هل أنت متأكد من رغبتك في سحب طلب الربط؟",
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
              setLinkRequest(null);
              checkProfileStatus(user); // Refresh auth context
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

    Linking.openURL(url).catch(() => {
      Alert.alert("خطأ", "لا يمكن فتح WhatsApp");
    });
  };

  const handleViewProfile = () => {
    if (!profile) return;

    // Navigate to profile view
    router.push({
      pathname: "/profile",
      params: { profileId: profile.id },
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
        <View style={styles.iconRow}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <Text style={styles.statusTitle}>الملف الشخصي مرتبط</Text>
        </View>
        <Text style={styles.profileName}>{profile.name}</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleViewProfile}>
            <Text style={styles.buttonText}>عرض الملف</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleUnlinkRequest}>
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
        <View style={styles.iconRow}>
          <Ionicons name="time-outline" size={24} color={colors.warning} />
          <Text style={styles.statusTitle}>طلب قيد المراجعة</Text>
        </View>
        <Text style={styles.subtitle}>تم الإرسال {timeAgo}</Text>
        {linkRequest.profile && (
          <Text style={styles.profileName}>
            الملف المطلوب: {linkRequest.profile.name}
          </Text>
        )}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.dangerButton} onPress={handleWithdraw}>
            <Text style={styles.dangerButtonText}>سحب الطلب</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleContactAdmin}>
            <Ionicons name="logo-whatsapp" size={20} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>تواصل</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Rejected Request State
  if (linkRequest?.status === "rejected") {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <View style={styles.iconRow}>
          <Ionicons name="close-circle" size={24} color={colors.error} />
          <Text style={styles.statusTitle}>تم رفض الطلب</Text>
        </View>
        {linkRequest.review_notes && (
          <Text style={styles.rejectionReason}>
            السبب: {linkRequest.review_notes}
          </Text>
        )}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleRetry}>
            <Text style={styles.buttonText}>إعادة المحاولة</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleContactAdmin}>
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
      <View style={styles.iconRow}>
        <Ionicons name="person-outline" size={24} color={colors.textMuted} />
        <Text style={styles.statusTitle}>لا يوجد ملف مرتبط</Text>
      </View>
      <Text style={styles.subtitle}>
        اربط ملفك الشخصي لتتمكن من تعديل معلوماتك
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => router.push("/auth/NameChainEntry")}
      >
        <Text style={styles.buttonText}>البحث عن ملفي</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
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
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginLeft: 8,
    fontFamily: "SF Arabic",
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    fontFamily: "SF Arabic",
  },
  profileName: {
    fontSize: 15,
    color: colors.text,
    fontWeight: "500",
    marginBottom: 12,
    fontFamily: "SF Arabic",
  },
  rejectionReason: {
    fontSize: 14,
    color: colors.error,
    marginBottom: 12,
    fontStyle: "italic",
    fontFamily: "SF Arabic",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.container,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  dangerButton: {
    flex: 1,
    backgroundColor: colors.error,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  dangerButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
});