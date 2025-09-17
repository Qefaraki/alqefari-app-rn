import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { phoneAuthService } from "../../services/phoneAuth";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

// Match quality colors
const MATCH_COLORS = {
  perfect: "#22C55E", // Green
  excellent: "#3B82F6", // Blue
  good: "#A855F7", // Purple
  fair: "#F59E0B", // Amber
  weak: "#64748B", // Slate
};

// Profile match card component
const ProfileMatchCard = ({ profile, isSelected, onPress }) => {
  const matchColor = MATCH_COLORS[profile.match_quality] || MATCH_COLORS.weak;

  // Get match label in Arabic
  const getMatchLabel = (quality) => {
    switch (quality) {
      case "perfect":
        return "تطابق كامل";
      case "excellent":
        return "تطابق ممتاز";
      case "good":
        return "تطابق جيد";
      case "fair":
        return "تطابق مقبول";
      default:
        return "تطابق جزئي";
    }
  };

  return (
    <TouchableOpacity
      style={[styles.profileCard, isSelected && styles.profileCardSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Match Quality Badge */}
      <View style={[styles.matchBadge, { backgroundColor: matchColor }]}>
        <Text style={styles.matchBadgeText}>{profile.match_score}%</Text>
      </View>

      {/* Profile Content */}
      <View style={styles.profileContent}>
        {/* Name with highlight if matches */}
        <Text style={styles.profileName}>{profile.name}</Text>

        {/* Full ancestral chain - exactly like profile pages */}
        <Text style={styles.fullChain}>
          {profile.full_chain || profile.name}
        </Text>

        {/* Match Quality Label */}
        <View style={styles.matchInfo}>
          <View
            style={[
              styles.matchQualityPill,
              { backgroundColor: matchColor + "20" },
            ]}
          >
            <Text style={[styles.matchQualityText, { color: matchColor }]}>
              {getMatchLabel(profile.match_quality)}
            </Text>
          </View>

          {profile.has_auth && (
            <View style={styles.linkedIndicator}>
              <Ionicons name="checkmark-circle" size={14} color="#F59E0B" />
              <Text style={styles.linkedText}>مطالب به</Text>
            </View>
          )}
        </View>

        {/* Family Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.generation || 0}</Text>
            <Text style={styles.statLabel}>الجيل</Text>
          </View>
          {profile.siblings_count > 0 && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.siblings_count}</Text>
              <Text style={styles.statLabel}>إخوة</Text>
            </View>
          )}
          {profile.children_count > 0 && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.children_count}</Text>
              <Text style={styles.statLabel}>أبناء</Text>
            </View>
          )}
        </View>
      </View>

      {/* Selection Indicator */}
      <View style={styles.selectionIndicator}>
        <View
          style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}
        >
          {isSelected && <View style={styles.radioInner} />}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function ProfileMatchingScreen({ navigation, route }) {
  const { profiles = [], nameChain, user } = route.params;
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Group profiles by match quality
  const groupedProfiles = useMemo(() => {
    const groups = {
      perfect: [],
      excellent: [],
      good: [],
      fair: [],
      weak: [],
    };

    profiles.forEach((profile) => {
      const quality = profile.match_quality || "weak";
      if (groups[quality]) {
        groups[quality].push(profile);
      }
    });

    // Convert to sections array, only include non-empty groups
    const sections = [];
    if (groups.perfect.length > 0) {
      sections.push({
        title: "تطابق كامل",
        data: groups.perfect,
        quality: "perfect",
      });
    }
    if (groups.excellent.length > 0) {
      sections.push({
        title: "تطابق ممتاز",
        data: groups.excellent,
        quality: "excellent",
      });
    }
    if (groups.good.length > 0) {
      sections.push({ title: "تطابق جيد", data: groups.good, quality: "good" });
    }
    if (groups.fair.length > 0) {
      sections.push({
        title: "تطابق مقبول",
        data: groups.fair,
        quality: "fair",
      });
    }
    if (groups.weak.length > 0) {
      sections.push({
        title: "تطابق جزئي",
        data: groups.weak,
        quality: "weak",
      });
    }

    return sections;
  }, [profiles]);

  const handleSelectProfile = useCallback((profile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedProfile(profile);
  }, []);

  const handleConfirmProfile = async () => {
    if (!selectedProfile) {
      Alert.alert("تنبيه", "يرجى اختيار ملفك الشخصي أولاً");
      return;
    }

    setSubmitting(true);
    const result = await phoneAuthService.submitProfileLinkRequest(
      selectedProfile.id,
      nameChain,
    );

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (result.temporary) {
        Alert.alert("تم الربط", "تم ربط ملفك الشخصي بنجاح!", [
          { text: "موافق", onPress: () => navigation.replace("Main") },
        ]);
      } else {
        Alert.alert("تم إرسال الطلب", result.message, [
          { text: "موافق", onPress: () => navigation.replace("Main") },
        ]);
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("خطأ", result.error);
    }

    setSubmitting(false);
  };

  const handleContactAdmin = () => {
    navigation.navigate("ContactAdmin", { user, nameChain });
  };

  const renderProfile = ({ item }) => (
    <ProfileMatchCard
      profile={item}
      isSelected={selectedProfile?.id === item.id}
      onPress={() => handleSelectProfile(item)}
      searchedName={nameChain}
    />
  );

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <View
        style={[
          styles.sectionIndicator,
          { backgroundColor: MATCH_COLORS[section.quality] },
        ]}
      />
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionCount}>{section.data.length}</Text>
    </View>
  );

  // Empty state
  if (profiles.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={["#F9F7F3", "#FFFFFF"]}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-forward" size={24} color="#242121" />
          </TouchableOpacity>
          <Text style={styles.title}>نتائج البحث</Text>
        </View>

        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="search-outline" size={64} color="#D1BBA3" />
          </View>
          <Text style={styles.emptyTitle}>لا توجد نتائج</Text>
          <Text style={styles.emptySubtitle}>
            لم نتمكن من العثور على ملفات مطابقة للاسم:
          </Text>
          <Text style={styles.searchedName}>{nameChain}</Text>

          <TouchableOpacity
            style={styles.contactAdminButton}
            onPress={handleContactAdmin}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#A13333" />
            <Text style={styles.contactAdminText}>تواصل مع المشرف</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#F9F7F3", "#FFFFFF"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-forward" size={24} color="#242121" />
        </TouchableOpacity>
        <Text style={styles.title}>اختر ملفك الشخصي</Text>
      </View>

      {/* Search Query Display */}
      <View style={styles.searchDisplay}>
        <Text style={styles.searchLabel}>البحث عن</Text>
        <Text style={styles.searchQuery}>{nameChain}</Text>
        <Text style={styles.resultsCount}>{profiles.length} نتيجة</Text>
      </View>

      {/* Results List */}
      {groupedProfiles.length > 0 ? (
        <FlatList
          data={profiles}
          renderItem={renderProfile}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={() => (
            <Text style={styles.helpText}>اضغط على الملف الذي يمثلك</Text>
          )}
        />
      ) : (
        <FlatList
          data={profiles}
          renderItem={renderProfile}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            !selectedProfile && styles.confirmButtonDisabled,
            submitting && styles.buttonLoading,
          ]}
          onPress={handleConfirmProfile}
          disabled={!selectedProfile || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text style={styles.confirmButtonText}>تأكيد الاختيار</Text>
              <Ionicons name="checkmark-circle" size={20} color="white" />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.notFoundButton}
          onPress={handleContactAdmin}
        >
          <Text style={styles.notFoundButtonText}>لم أجد ملفي</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: "#F9F7F3",
  },
  backButton: {
    padding: 8,
    marginLeft: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: "#242121",
    letterSpacing: -0.5,
  },
  searchDisplay: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1BBA340",
  },
  searchLabel: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: "#24212199",
    marginBottom: 4,
  },
  searchQuery: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#242121",
    marginBottom: 4,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: "#24212199",
  },
  helpText: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: "#242121CC",
    textAlign: "center",
    marginVertical: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  sectionIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#242121",
    flex: 1,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: "#24212199",
    backgroundColor: "#D1BBA320",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#D1BBA340",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  profileCardSelected: {
    borderColor: "#A13333",
    borderWidth: 2,
    backgroundColor: "#A1333308",
  },
  matchBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  matchBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: "white",
  },
  profileContent: {
    flex: 1,
    paddingRight: 50,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#242121",
    marginBottom: 4,
  },
  fullChain: {
    fontSize: 13,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: "#24212199",
    marginBottom: 12,
    lineHeight: 22,
    textAlign: "right",
  },
  matchInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  matchQualityPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  matchQualityText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  linkedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  linkedText: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: "#F59E0B",
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#242121",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: "#24212199",
    marginTop: 2,
  },
  selectionIndicator: {
    justifyContent: "center",
    paddingLeft: 16,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D1BBA3",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: {
    borderColor: "#A13333",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#A13333",
  },
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#F9F7F3",
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#D1BBA340",
  },
  confirmButton: {
    backgroundColor: "#A13333",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  confirmButtonDisabled: {
    backgroundColor: "#D1BBA3",
    opacity: 0.5,
  },
  buttonLoading: {
    opacity: 0.8,
  },
  confirmButtonText: {
    color: "#F9F7F3",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  notFoundButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  notFoundButtonText: {
    color: "#A13333",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SF Arabic",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#D1BBA320",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: "#242121",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: "#242121CC",
    textAlign: "center",
    marginBottom: 8,
  },
  searchedName: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#A13333",
    marginBottom: 32,
  },
  contactAdminButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "white",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#A13333",
  },
  contactAdminText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#A13333",
  },
});
