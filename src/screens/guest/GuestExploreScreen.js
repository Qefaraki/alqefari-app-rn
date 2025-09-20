import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function GuestExploreScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>استكشف شجرة العائلة</Text>
          <Text style={styles.subtitle}>
            أنت في وضع الضيف - سجل الدخول لرؤية المزيد
          </Text>
        </View>

        {/* Limited Preview Card */}
        <View style={styles.previewCard}>
          <Ionicons name="lock-closed" size={48} color="#A13333" />
          <Text style={styles.lockTitle}>محتوى محدود</Text>
          <Text style={styles.lockDescription}>
            يمكنك استكشاف بعض المعلومات الأساسية فقط
          </Text>
        </View>

        {/* Sample Tree Preview */}
        <TouchableOpacity
          style={styles.treePreviewCard}
          onPress={() => navigation.navigate("TreeView", { isGuest: true })}
        >
          <Ionicons name="git-network" size={32} color="#A13333" />
          <View style={styles.treeInfo}>
            <Text style={styles.treeTitle}>عرض شجرة العائلة</Text>
            <Text style={styles.treeSubtitle}>نسخة محدودة للضيوف</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#736372" />
        </TouchableOpacity>

        {/* Features List */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>مع التسجيل ستحصل على:</Text>

          {[
            { icon: "person-add", text: "إضافة معلوماتك الشخصية" },
            { icon: "images", text: "رفع الصور العائلية" },
            { icon: "chatbubbles", text: "التواصل مع أفراد العائلة" },
            { icon: "notifications", text: "تلقي التحديثات المباشرة" },
          ].map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Ionicons name={feature.icon} size={20} color="#D58C4A" />
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>

        {/* Sign Up CTA */}
        <TouchableOpacity
          style={styles.signUpButton}
          onPress={() => navigation.navigate("Auth")}
        >
          <Text style={styles.signUpButtonText}>
            سجل الآن للحصول على الوصول الكامل
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3",
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: "center",
    marginVertical: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#242121",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#24212199",
    textAlign: "center",
  },
  previewCard: {
    backgroundColor: "#D1BBA320",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#D1BBA340",
  },
  lockTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#242121",
    marginTop: 16,
    marginBottom: 8,
  },
  lockDescription: {
    fontSize: 14,
    color: "#24212199",
    textAlign: "center",
  },
  treePreviewCard: {
    backgroundColor: "#F9F7F3",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#D1BBA340",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  treeInfo: {
    flex: 1,
    marginLeft: 16,
  },
  treeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#242121",
    marginBottom: 4,
  },
  treeSubtitle: {
    fontSize: 13,
    color: "#24212199",
  },
  featuresSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#242121",
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  featureText: {
    fontSize: 15,
    color: "#242121",
    marginLeft: 12,
  },
  signUpButton: {
    backgroundColor: "#A13333",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  signUpButtonText: {
    color: "#F9F7F3",
    fontSize: 16,
    fontWeight: "600",
  },
});
