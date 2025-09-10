import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";

const NetworkErrorView = ({
  onRetry,
  isRetrying = false,
  errorType = "network",
  customMessage = null,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Subtle entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRetry?.();
  };

  const getContent = () => {
    switch (errorType) {
      case "network":
        return {
          title: "لا يوجد اتصال",
          subtitle: "تحقق من اتصالك بالإنترنت",
        };
      case "empty":
        return {
          title: "لا توجد بيانات",
          subtitle: "لم نتمكن من العثور على البيانات",
        };
      case "error":
      default:
        return {
          title: "حدث خطأ",
          subtitle: customMessage || "لم نتمكن من تحميل البيانات",
        };
    }
  };

  const content = getContent();

  const WifiIcon = () => (
    <Svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 18l.01 0"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.172 15.172a4 4 0 0 1 5.656 0"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.343 12.343a8 8 0 0 1 11.314 0"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        {/* Logo - Hero Element */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Image
            source={require("../../assets/logo/Alqefari Emblem (Transparent).png")}
            style={styles.logo}
            resizeMode="contain"
          />

          {/* Small error indicator with custom WiFi SVG */}
          <View style={styles.errorBadge}>
            {errorType === "network" ? (
              <WifiIcon />
            ) : errorType === "empty" ? (
              <Ionicons name="folder-outline" size={22} color="#fff" />
            ) : (
              <Ionicons name="alert-circle" size={22} color="#fff" />
            )}
          </View>
        </Animated.View>

        {/* Title */}
        <Text style={styles.title}>{content.title}</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>{content.subtitle}</Text>

        {/* iOS-style Button - Using TouchableOpacity */}
        <TouchableOpacity
          style={[styles.button, isRetrying && styles.buttonDisabled]}
          onPress={handleRetry}
          disabled={isRetrying}
          activeOpacity={0.8}
        >
          {isRetrying ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>حاول مرة أخرى</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  content: {
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
  },
  logoContainer: {
    width: 160,
    height: 160,
    marginBottom: 40,
    position: "relative",
  },
  logo: {
    width: "100%",
    height: "100%",
    opacity: 1,
  },
  errorBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 12,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  subtitle: {
    fontSize: 17,
    color: "#8E8E93",
    marginBottom: 44,
    textAlign: "center",
    lineHeight: 24,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: "#C7C7CC",
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    marginLeft: 8,
  },
});

export default NetworkErrorView;
