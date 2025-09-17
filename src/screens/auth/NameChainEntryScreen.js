import React, { useState, useRef, useEffect } from "react";
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
  ScrollView,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { phoneAuthService } from "../../services/phoneAuth";

// Najdi Sadu Design System Colors
const colors = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  success: "#4CAF50",
  error: "#F44336",
  inputBg: "rgba(209, 187, 163, 0.1)", // Container 10%
  inputBorder: "rgba(209, 187, 163, 0.4)", // Container 40%
  inputFocusBorder: "#A13333", // Primary
  textSecondary: "rgba(36, 33, 33, 0.6)", // Text 60%
  textHint: "rgba(36, 33, 33, 0.4)", // Text 40%
};

export default function NameChainEntryScreen({ navigation, route }) {
  const { user } = route.params;
  const [nameChain, setNameChain] = useState("");
  const [searching, setSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef(null);

  // Animation on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleSearch = async () => {
    const trimmedName = nameChain.trim();

    // Remove family names like القفاري
    const familyNames = ["القفاري", "الدوسري", "العتيبي", "الشمري", "العنزي"];
    let cleanedName = trimmedName;
    familyNames.forEach((family) => {
      cleanedName = cleanedName.replace(family, "").trim();
    });

    if (!cleanedName) {
      Alert.alert("خطأ", "يرجى إدخال الاسم الثلاثي");
      return;
    }

    const nameWords = cleanedName.split(" ").filter((w) => w.length > 0);
    if (nameWords.length < 2) {
      Alert.alert("خطأ", "يرجى إدخال اسمك واسم والدك على الأقل");
      return;
    }

    setSearching(true);
    const result =
      await phoneAuthService.searchProfilesByNameChain(cleanedName);
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
    Alert.alert(
      "هل تحتاج مساعدة؟",
      "تواصل مع المشرف لإضافة ملفك الشخصي إلى الشجرة",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "واتساب",
          onPress: () => {
            // TODO: Open WhatsApp with admin number
            Alert.alert("قريباً", "سيتم إضافة رابط واتساب المشرف قريباً");
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            {/* Header with Progress - RTL Layout */}
            <View style={styles.header}>
              {/* Back button on the LEFT for RTL, pointing LEFT */}
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="chevron-back" size={28} color={colors.text} />
              </TouchableOpacity>

              {/* Progress Dots on the right for RTL */}
              <View style={styles.progressContainer}>
                <View style={styles.progressDot} />
                <View style={styles.progressDot} />
                <View style={[styles.progressDot, styles.progressDotActive]} />
                <View
                  style={[styles.progressDot, styles.progressDotCompleted]}
                />
                <View
                  style={[styles.progressDot, styles.progressDotCompleted]}
                />
              </View>
            </View>

            {/* Main Content */}
            <View style={styles.mainContent}>
              <Text style={styles.title}>البحث عن ملفك الشخصي</Text>
              <Text style={styles.subtitle}>
                ادخل الأسماء للبحث في شجرة العائلة
              </Text>

              {/* Example Section - Better UI Element */}
              <View style={styles.exampleContainer}>
                <View style={styles.exampleCard}>
                  <View style={styles.exampleBadge}>
                    <Text style={styles.exampleBadgeText}>مثال</Text>
                  </View>
                  <Text style={styles.exampleText}>محمد عبدالله سليمان</Text>
                </View>
              </View>

              {/* Input Field with Better Styling */}
              <View
                style={[
                  styles.inputContainer,
                  isFocused && styles.inputContainerFocused,
                ]}
              >
                <TextInput
                  ref={inputRef}
                  style={styles.nameInput}
                  placeholder="اكتب اسمك الثلاثي هنا..."
                  placeholderTextColor={colors.textHint}
                  value={nameChain}
                  onChangeText={setNameChain}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  multiline={false}
                  textAlign="right"
                  autoCorrect={false}
                  autoCapitalize="words"
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                />
              </View>

              {/* Search Button - Primary Action */}
              <TouchableOpacity
                style={[
                  styles.searchButton,
                  (!nameChain.trim() || searching) && styles.buttonDisabled,
                ]}
                onPress={handleSearch}
                disabled={searching || !nameChain.trim()}
                activeOpacity={0.8}
              >
                {searching ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.buttonText}>البحث في الشجرة</Text>
                    <Ionicons
                      name="search"
                      size={22}
                      color={colors.background}
                    />
                  </View>
                )}
              </TouchableOpacity>

              {/* Help Link - Subtle */}
              <TouchableOpacity
                style={styles.helpLink}
                onPress={handleContactAdmin}
                activeOpacity={0.7}
              >
                <Text style={styles.helpText}>هل تحتاج مساعدة؟</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background, // Al-Jass White
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: "row", // RTL: Back button on LEFT
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8, // Space after back button
  },
  progressContainer: {
    flexDirection: "row",
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.inputBorder, // Container 40%
  },
  progressDotCompleted: {
    backgroundColor: colors.success,
  },
  progressDotActive: {
    backgroundColor: colors.primary, // Najdi Crimson
    width: 24,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: colors.text,
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  exampleContainer: {
    marginBottom: 24,
  },
  exampleCard: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderStyle: "dashed",
    padding: 16,
    position: "relative",
    alignItems: "flex-end", // Align content to right for RTL
  },
  exampleBadge: {
    position: "absolute",
    top: -10,
    right: 20,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  exampleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.textSecondary,
  },
  exampleText: {
    fontSize: 18,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: colors.text,
    textAlign: "right", // Right align the text for RTL
  },
  inputContainer: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    marginBottom: 12,
    overflow: "hidden",
  },
  inputContainerFocused: {
    borderColor: colors.primary, // Najdi Crimson on focus
    backgroundColor: colors.background,
  },
  nameInput: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: colors.text,
    minHeight: 56,
  },

  searchButton: {
    backgroundColor: colors.primary, // Najdi Crimson
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    minHeight: 56,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: colors.inputBorder,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonContent: {
    flexDirection: "row-reverse", // RTL: Icon on right
    alignItems: "center",
    gap: 10,
  },
  buttonText: {
    color: colors.background,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    letterSpacing: -0.3,
  },
  helpLink: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 8,
  },
  helpText: {
    fontSize: 15,
    fontFamily: "SF Arabic",
    color: colors.primary,
    textDecorationLine: "underline",
    textDecorationColor: colors.primary,
  },
});
