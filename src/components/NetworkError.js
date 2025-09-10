import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");

const NetworkError = ({ onRetry, message, type = "offline" }) => {
  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRetry?.();
  };

  const getContent = () => {
    switch (type) {
      case "offline":
        return {
          title: "لا يوجد اتصال بالإنترنت",
          subtitle: "تحقق من اتصالك بالشبكة وحاول مرة أخرى",
          icon: "wifi-off",
        };
      case "server":
        return {
          title: "خطأ في الخادم",
          subtitle: "نواجه مشكلة مؤقتة، يرجى المحاولة لاحقاً",
          icon: "cloud-offline",
        };
      case "timeout":
        return {
          title: "انتهت مهلة الاتصال",
          subtitle: "استغرق الطلب وقتاً طويلاً، حاول مرة أخرى",
          icon: "time-outline",
        };
      default:
        return {
          title: message || "حدث خطأ",
          subtitle: "لم نتمكن من إتمام العملية",
          icon: "alert-circle",
        };
    }
  };

  const content = getContent();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Icon Section */}
        <View style={styles.iconContainer}>
          <Image
            source={require("../../assets/logo/Alqefari Emblem (Transparent).png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.errorIconWrapper}>
            <Ionicons
              name={content.icon}
              size={32}
              color="#FF6B6B"
              style={styles.errorIcon}
            />
          </View>
        </View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.subtitle}>{content.subtitle}</Text>
        </View>

        {/* Retry Button */}
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRetry}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>حاول مرة أخرى</Text>
          <Ionicons
            name="refresh"
            size={20}
            color="#FFFFFF"
            style={styles.retryIcon}
          />
        </TouchableOpacity>

        {/* Optional Help Text */}
        <TouchableOpacity style={styles.helpContainer}>
          <Text style={styles.helpText}>هل تحتاج مساعدة؟</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F7",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  content: {
    alignItems: "center",
    maxWidth: 320,
    width: "100%",
  },
  iconContainer: {
    marginBottom: 32,
    alignItems: "center",
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: -20,
    opacity: 0.3,
  },
  errorIconWrapper: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  errorIcon: {
    // Icon styles handled by component
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 8,
    textAlign: "center",
    fontFamily: "SF-Pro-Display-Semibold",
  },
  subtitle: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 22,
    fontFamily: "SF-Pro-Text-Regular",
  },
  retryButton: {
    backgroundColor: "#007AFF",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 200,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    marginRight: 8,
    fontFamily: "SF-Pro-Text-Semibold",
  },
  retryIcon: {
    marginLeft: 4,
  },
  helpContainer: {
    marginTop: 24,
    padding: 8,
  },
  helpText: {
    fontSize: 15,
    color: "#007AFF",
    fontFamily: "SF-Pro-Text-Regular",
  },
});

export default NetworkError;
