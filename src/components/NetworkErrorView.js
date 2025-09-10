import React from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const NetworkErrorView = ({
  onRetry,
  isRetrying = false,
  errorType = "network", // network | empty | error
  customMessage = null,
}) => {
  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRetry?.();
  };

  // Choose appropriate icon and message based on error type
  const getContent = () => {
    switch (errorType) {
      case "network":
        return {
          title: "لا يوجد اتصال بالإنترنت",
          subtitle: "تحقق من اتصالك بالشبكة وحاول مرة أخرى",
          icon: "wifi-outline",
        };
      case "empty":
        return {
          title: "لا توجد بيانات",
          subtitle: "لم نتمكن من العثور على أي بيانات للعرض",
          icon: "folder-open-outline",
        };
      case "error":
      default:
        return {
          title: "حدث خطأ",
          subtitle: customMessage || "حدث خطأ أثناء تحميل البيانات",
          icon: "warning-outline",
        };
    }
  };

  const content = getContent();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo or Icon */}
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/logo/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          {/* Overlay icon for error type */}
          <View style={styles.iconOverlay}>
            <View style={styles.iconCircle}>
              <Ionicons name={content.icon} size={32} color="#666" />
            </View>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{content.title}</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>{content.subtitle}</Text>

        {/* Retry Button */}
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
            isRetrying && styles.retryButtonDisabled,
          ]}
          onPress={handleRetry}
          disabled={isRetrying}
        >
          {isRetrying ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <>
              <Ionicons name="refresh" size={20} color="#007AFF" />
              <Text style={styles.retryText}>حاول مرة أخرى</Text>
            </>
          )}
        </Pressable>

        {/* Additional help text for network errors */}
        {errorType === "network" && (
          <View style={styles.helpContainer}>
            <Text style={styles.helpText}>نصائح:</Text>
            <Text style={styles.helpItem}>• تحقق من اتصال WiFi</Text>
            <Text style={styles.helpItem}>• تحقق من البيانات الخلوية</Text>
            <Text style={styles.helpItem}>• جرب إعادة تشغيل التطبيق</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  content: {
    alignItems: "center",
    maxWidth: 320,
  },
  logoContainer: {
    width: 120,
    height: 120,
    marginBottom: 32,
    position: "relative",
  },
  logo: {
    width: "100%",
    height: "100%",
    opacity: 0.3,
  },
  iconOverlay: {
    position: "absolute",
    bottom: -8,
    right: -8,
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 12,
    textAlign: "center",
    fontFamily: "System",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 32,
    textAlign: "center",
    lineHeight: 24,
    fontFamily: "System",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 8,
  },
  retryButtonPressed: {
    transform: [{ scale: 0.98 }],
    shadowOpacity: 0.02,
  },
  retryButtonDisabled: {
    opacity: 0.6,
  },
  retryText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
    fontFamily: "System",
  },
  helpContainer: {
    marginTop: 48,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "100%",
  },
  helpText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 12,
    textAlign: "right",
    fontFamily: "System",
  },
  helpItem: {
    fontSize: 14,
    color: "#666",
    marginBottom: 6,
    textAlign: "right",
    fontFamily: "System",
  },
});

export default NetworkErrorView;
