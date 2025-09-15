import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { phoneAuthService } from "../../services/phoneAuth";

export default function NameChainEntryScreen({ navigation, route }) {
  const { user } = route.params;
  const [nameChain, setNameChain] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    const trimmedName = nameChain.trim();
    if (!trimmedName) {
      Alert.alert("خطأ", "يرجى إدخال الاسم الثلاثي");
      return;
    }

    const nameWords = trimmedName.split(" ").filter((w) => w.length > 0);
    if (nameWords.length < 2) {
      Alert.alert("خطأ", "يرجى إدخال اسمك واسم والدك على الأقل");
      return;
    }

    setSearching(true);
    const result =
      await phoneAuthService.searchProfilesByNameChain(trimmedName);
    setSearching(false);

    if (result.success) {
      if (result.profiles.length === 0) {
        // No matches found
        Alert.alert(
          "لم يتم العثور على ملف",
          "لم نجد ملفاً مطابقاً. يمكنك التواصل مع المشرف لإضافة ملفك.",
          [
            { text: "تواصل مع المشرف", onPress: () => handleContactAdmin() },
            { text: "المشاهدة فقط", onPress: () => navigation.replace("Main") },
            { text: "حاول مرة أخرى", style: "cancel" },
          ],
        );
      } else {
        // Found matches, go to profile selection
        navigation.navigate("ProfileMatching", {
          profiles: result.profiles,
          nameChain: trimmedName,
          user,
        });
      }
    } else {
      Alert.alert("خطأ", result.error);
    }
  };

  const handleContactAdmin = () => {
    // Navigate to contact admin screen or open WhatsApp
    navigation.navigate("ContactAdmin", { user });
  };

  const handleSkip = () => {
    Alert.alert(
      "المشاهدة فقط",
      "ستتمكن من مشاهدة الشجرة فقط دون إمكانية التعديل.",
      [
        { text: "إلغاء", style: "cancel" },
        { text: "موافق", onPress: () => navigation.replace("Main") },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.title}>البحث عن ملفك الشخصي</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.subtitle}>أدخل اسمك الثلاثي</Text>
          <Text style={styles.description}>
            اكتب اسمك الأول واسم والدك وجدك بالترتيب
          </Text>

          <View style={styles.exampleContainer}>
            <Text style={styles.exampleTitle}>مثال:</Text>
            <View style={styles.exampleBox}>
              <Text style={styles.exampleText}>أحمد محمد عبدالله القفاري</Text>
            </View>
          </View>

          <TextInput
            style={styles.nameInput}
            placeholder="اكتب اسمك الثلاثي هنا..."
            placeholderTextColor="#999"
            value={nameChain}
            onChangeText={setNameChain}
            multiline={false}
            textAlign="right"
            autoCorrect={false}
            autoCapitalize="words"
          />

          <View style={styles.tipsContainer}>
            <Text style={styles.tipsTitle}>نصائح:</Text>
            <View style={styles.tipRow}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.tipText}>
                اكتب الاسم كما هو مسجل في الشجرة
              </Text>
            </View>
            <View style={styles.tipRow}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.tipText}>لا تستخدم الألقاب أو الكنى</Text>
            </View>
            <View style={styles.tipRow}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.tipText}>افصل بين الأسماء بمسافة واحدة</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.searchButton,
              !nameChain.trim() && styles.buttonDisabled,
            ]}
            onPress={handleSearch}
            disabled={searching || !nameChain.trim()}
          >
            {searching ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="search" size={20} color="white" />
                <Text style={styles.buttonText}>البحث في الشجرة</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>أو</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.contactButton}
            onPress={handleContactAdmin}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            <Text style={styles.contactButtonText}>تواصل مع المشرف</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>تخطي - المشاهدة فقط</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    padding: 5,
    marginRight: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1a1a1a",
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  exampleContainer: {
    marginBottom: 20,
  },
  exampleTitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  exampleBox: {
    backgroundColor: "#f0f0f0",
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
  },
  exampleText: {
    fontSize: 16,
    color: "#1a1a1a",
    textAlign: "center",
  },
  nameInput: {
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 15,
    fontSize: 16,
    color: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 20,
  },
  tipsContainer: {
    backgroundColor: "#f8f9fa",
    padding: 15,
    borderRadius: 8,
    marginBottom: 25,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 10,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    color: "#666",
    marginLeft: 8,
    flex: 1,
  },
  searchButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e0e0e0",
  },
  dividerText: {
    marginHorizontal: 10,
    color: "#666",
    fontSize: 14,
  },
  contactButton: {
    backgroundColor: "white",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#25D366",
    marginBottom: 15,
  },
  contactButtonText: {
    color: "#25D366",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: 10,
  },
  skipText: {
    color: "#007AFF",
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
