import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
  Easing,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import adminContactService from "../../services/adminContact";
import Surface from "../ui/Surface";
import TabBarDemo from "../../screens/TabBarDemo";
import tokens from "../ui/tokens";

const palette = tokens.colors.najdi;
const emblemSource = require("../../../assets/logo/AlqefariEmblem.png");

const renderSFSymbol = (name, fallback, color, size = 22) => {
  const map = {
    xmark: "close",
    "bubble.left.and.bubble.right.fill": "chatbubbles",
    "checkmark.circle.fill": "checkmark-circle",
    "doc.on.doc": "copy",
    "paperplane.fill": "send",
    "info.circle": "information-circle-outline",
  };

  return <Ionicons name={map[name] || fallback} size={size} color={color} />;
};

const AdminSettingsView = ({ onClose }) => {
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [displayNumber, setDisplayNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showTabBarDemo, setShowTabBarDemo] = useState(false);
  const contentAnimation = useRef(new Animated.Value(0)).current;

  const loadSettings = useCallback(async () => {
    try {
      const [number, display] = await Promise.all([
        adminContactService.getAdminWhatsAppNumber(),
        adminContactService.getDisplayNumber(),
      ]);
      setWhatsappNumber(number);
      setDisplayNumber(display);
    } catch (error) {
      console.error("Error loading settings:", error);
      Alert.alert("خطأ", "تعذر تحميل إعدادات الواتساب. حاول مرة أخرى لاحقاً.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    Animated.timing(contentAnimation, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [contentAnimation]);

  const handleSaveWhatsApp = useCallback(async () => {
    if (!whatsappNumber || whatsappNumber.trim() === "") {
      Alert.alert("تنبيه", "يرجى إدخال رقم الواتساب قبل الحفظ.");
      return;
    }

    setSaving(true);
    try {
      const result = await adminContactService.setAdminWhatsAppNumber(
        whatsappNumber,
      );

      if (!result.success) {
        throw new Error(result.error || "فشل حفظ رقم الواتساب");
      }

      await loadSettings();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("تم الحفظ", "تم تحديث رقم الواتساب بنجاح.");
    } catch (error) {
      console.error("Error saving WhatsApp number:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("خطأ", error.message || "فشل حفظ رقم الواتساب.");
    } finally {
      setSaving(false);
    }
  }, [loadSettings, whatsappNumber]);

  const handleTestWhatsApp = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTesting(true);
    try {
      const result = await adminContactService.openAdminWhatsApp();
      if (!result?.success) {
        Alert.alert(
          "تنبيه",
          "لم نتمكن من فتح واتساب تلقائياً. تحقق من تثبيت التطبيق أو استخدم رابط الويب.",
        );
      }
    } catch (error) {
      console.error("Error testing WhatsApp number:", error);
      Alert.alert("خطأ", "تعذر فتح واتساب. تحقق من الرقم الحالي وحاول مجدداً.");
    } finally {
      setTesting(false);
    }
  }, []);

  const handleCopyNumber = useCallback(async () => {
    if (!whatsappNumber) {
      return;
    }
    try {
      await Clipboard.setStringAsync(whatsappNumber);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert("تم النسخ", "تم نسخ رقم الواتساب إلى الحافظة.");
    } catch (error) {
      console.error("Error copying WhatsApp number:", error);
    }
  }, [whatsappNumber]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tokens.colors.accent} />
          <Text style={styles.loadingText}>جاري تحميل إعدادات الواتساب...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const slideUp = contentAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.flex}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <Image
                  source={emblemSource}
                  style={styles.emblem}
                  resizeMode="contain"
                />
                <View style={styles.titleBlock}>
                  <Text style={styles.title}>إعدادات الواتساب</Text>
                  <Text style={styles.subtitle}>
                    إدارة قناة التواصل الرسمية مع الإدارة
                  </Text>
                </View>
                {onClose ? (
                  <TouchableOpacity
                    onPress={handleClose}
                    style={styles.closeButton}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityLabel="إغلاق الإعدادات"
                    accessibilityRole="button"
                  >
                    {renderSFSymbol("xmark", "close", palette.text, 20)}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.closeButtonPlaceholder} />
                )}
              </View>
            </View>

            <Animated.View
              style={[
                styles.animatedBlock,
                { opacity: contentAnimation, transform: [{ translateY: slideUp }] },
              ]}
            >
              <Surface style={styles.surface} contentStyle={styles.surfaceContent}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIcon}>
                    {renderSFSymbol(
                      "bubble.left.and.bubble.right.fill",
                      "chatbubbles",
                      tokens.colors.accent,
                      20,
                    )}
                  </View>
                  <View style={styles.sectionText}>
                    <Text style={styles.sectionTitle}>رقم التواصل عبر واتساب</Text>
                    <Text style={styles.sectionSubtitle}>
                      هذا الرقم يظهر في كامل لوحة التحكم ويستخدم للرد على الأعضاء.
                    </Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>الرقم الحالي</Text>
                <View style={styles.currentNumberRow}>
                  <Text style={styles.currentNumber}>
                    {displayNumber || "—"}
                  </Text>
                  <TouchableOpacity
                    style={styles.inlineAction}
                    onPress={handleCopyNumber}
                    activeOpacity={0.8}
                    accessibilityLabel="نسخ رقم الواتساب"
                    disabled={!whatsappNumber}
                  >
                    {renderSFSymbol("doc.on.doc", "copy", palette.textMuted, 18)}
                    <Text style={styles.inlineActionText}>نسخ</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>تحديث الرقم</Text>
                <TextInput
                  style={styles.input}
                  value={whatsappNumber}
                  onChangeText={setWhatsappNumber}
                  placeholder="+966501234567"
                  keyboardType="phone-pad"
                  textAlign="left"
                  placeholderTextColor={`${palette.textMuted}66`}
                  accessibilityLabel="حقل إدخال رقم الواتساب"
                  returnKeyType="done"
                  autoCapitalize="none"
                />
                <Text style={styles.helperText}>
                  استخدم الصيغة الدولية مع رمز الدولة (مثال: +966501234567).
                </Text>

                <View style={styles.buttonStack}>
                  <TouchableOpacity
                    style={[styles.primaryButton, saving && styles.disabledButton]}
                    onPress={handleSaveWhatsApp}
                    activeOpacity={0.85}
                    disabled={saving}
                    accessibilityLabel="حفظ رقم الواتساب"
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <View style={styles.buttonContent}>
                        {renderSFSymbol(
                          "checkmark.circle.fill",
                          "checkmark-circle",
                          "#FFFFFF",
                          20,
                        )}
                        <Text style={styles.primaryButtonText}>حفظ الرقم</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.secondaryButton,
                      testing && styles.disabledButton,
                    ]}
                    onPress={handleTestWhatsApp}
                    activeOpacity={0.85}
                    disabled={testing}
                    accessibilityLabel="اختبار فتح واتساب"
                  >
                    {testing ? (
                      <ActivityIndicator size="small" color={tokens.colors.accent} />
                    ) : (
                      <View style={styles.buttonContent}>
                        {renderSFSymbol(
                          "paperplane.fill",
                          "send",
                          tokens.colors.accent,
                          18,
                        )}
                        <Text style={styles.secondaryButtonText}>
                          اختبار فتح واتساب
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.tertiaryButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowTabBarDemo(true);
                    }}
                    activeOpacity={0.85}
                    accessibilityLabel="اختبار تصاميم التبويبات"
                  >
                    <View style={styles.buttonContent}>
                      {renderSFSymbol(
                        "layers-outline",
                        "layers-outline",
                        palette.text,
                        18,
                      )}
                      <Text style={styles.tertiaryButtonText}>
                        اختبار تصاميم التبويبات
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </Surface>
            </Animated.View>

            <Animated.View
              style={[
                styles.animatedBlock,
                styles.infoWrapper,
                {
                  opacity: contentAnimation,
                  transform: [{ translateY: slideUp }],
                },
              ]}
            >
              <View style={styles.infoCard}>
                <View style={styles.infoIcon}>
                  {renderSFSymbol(
                    "info.circle",
                    "information-circle-outline",
                    palette.secondary,
                    20,
                  )}
                </View>
                <Text style={styles.infoText}>
                  يتم استخدام هذا الرقم في كل مكان يتواصل فيه الأعضاء مع
                  الإدارة. لضبط الرسائل الجاهزة، توجه إلى قسم قوالب رسائل
                  الواتساب في لوحة التحكم.
                </Text>
              </View>
            </Animated.View>
          </ScrollView>
        </View>

        {/* TabBar Demo Modal */}
        <Modal
          visible={showTabBarDemo}
          animationType="slide"
          presentation="fullScreen"
        >
          <TabBarDemo
            onClose={() => setShowTabBarDemo(false)}
          />
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: tokens.spacing.xxl,
  },
  header: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  emblem: {
    width: 44,
    height: 44,
    tintColor: palette.text,
  },
  titleBlock: {
    flex: 1,
    marginHorizontal: tokens.spacing.sm,
  },
  title: {
    ...tokens.typography.largeTitle,
    color: palette.text,
    textAlign: "right",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  subtitle: {
    ...tokens.typography.subheadline,
    color: palette.textMuted,
    marginTop: 4,
    textAlign: "right",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  closeButton: {
    width: tokens.touchTarget.minimum,
    height: tokens.touchTarget.minimum,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonPlaceholder: {
    width: tokens.touchTarget.minimum,
    height: tokens.touchTarget.minimum,
  },
  animatedBlock: {
    paddingHorizontal: tokens.spacing.lg,
  },
  surface: {
    marginTop: tokens.spacing.md,
  },
  surfaceContent: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${tokens.colors.accent}12`,
  },
  sectionText: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    ...tokens.typography.title3,
    color: palette.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  sectionSubtitle: {
    ...tokens.typography.footnote,
    color: palette.textMuted,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  fieldLabel: {
    ...tokens.typography.subheadline,
    color: palette.textMuted,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  currentNumberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    backgroundColor: `${palette.container}22`,
    borderRadius: tokens.radii.md,
  },
  currentNumber: {
    ...tokens.typography.headline,
    color: palette.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  inlineAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inlineActionText: {
    ...tokens.typography.footnote,
    color: palette.textMuted,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  input: {
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: palette.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
    backgroundColor: tokens.colors.surface,
  },
  helperText: {
    ...tokens.typography.caption1,
    color: palette.textMuted,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  buttonStack: {
    gap: tokens.spacing.sm,
  },
  primaryButton: {
    backgroundColor: tokens.colors.accent,
    borderRadius: tokens.radii.md,
    minHeight: tokens.touchTarget.minimum,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    minHeight: tokens.touchTarget.minimum,
    alignItems: "center",
    justifyContent: "center",
  },
  tertiaryButton: {
    backgroundColor: `${palette.container}20`,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: `${palette.container}40`,
    minHeight: tokens.touchTarget.minimum,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryButtonText: {
    ...tokens.typography.callout,
    color: "#FFFFFF",
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  secondaryButtonText: {
    ...tokens.typography.callout,
    color: tokens.colors.accent,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  tertiaryButtonText: {
    ...tokens.typography.callout,
    color: palette.text,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  infoWrapper: {
    marginTop: tokens.spacing.md,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
    backgroundColor: `${palette.container}26`,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
  },
  infoIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${palette.secondary}22`,
  },
  infoText: {
    flex: 1,
    ...tokens.typography.footnote,
    lineHeight: 20,
    color: palette.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.xl,
  },
  loadingText: {
    ...tokens.typography.body,
    textAlign: "center",
    color: palette.textMuted,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
});

export default AdminSettingsView;
