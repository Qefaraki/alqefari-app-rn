import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  ScrollView,
  Animated,
  StatusBar,
  SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Najdi Sadu Color Palette
const colors = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  textMuted: "#24212199", // 60% opacity
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  white: "#FFFFFF",
};

const screens = [
  {
    id: 1,
    title: "عائلة القفاري",
    subtitle: "أهلاً وسهلاً في شجرة العائلة",
    visual: "tree",
  },
  {
    id: 2,
    title: "شجرتك العائلية",
    subtitle: "ابحث، تواصل، وثّق تاريخ عائلتك",
    visual: "connect",
    features: [
      { icon: "search", text: "ابحث" },
      { icon: "people", text: "تواصل" },
      { icon: "document-text", text: "وثّق" },
    ],
  },
  {
    id: 3,
    title: "ابدأ رحلتك",
    subtitle: "انضم لأكثر من ٥٠٠ فرد من العائلة",
    visual: "start",
  },
];

export default function LocketOnboardingScreen({
  navigation,
  setIsGuest,
  setUser,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentIndex]);

  const handleNext = () => {
    if (currentIndex < screens.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      scrollViewRef.current?.scrollTo({
        x: SCREEN_WIDTH * (currentIndex + 1),
        animated: true,
      });
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.replace("PhoneAuth");
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Set as guest
    if (setIsGuest) setIsGuest(true);
    if (setUser) setUser({ isGuest: true, user_metadata: { isGuest: true } });
  };

  const handleSignIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.replace("PhoneAuth");
  };

  const renderTreeVisual = () => (
    <View style={styles.visualContainer}>
      {/* Animated family tree nodes */}
      <View style={styles.treeContainer}>
        {[...Array(7)].map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.treeNode,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 50],
                      outputRange: [0, 20],
                    }),
                  },
                  { scale: scaleAnim },
                ],
              },
            ]}
          >
            <View style={[styles.nodeInner, i === 0 && styles.primaryNode]} />
          </Animated.View>
        ))}
        {/* Connection lines */}
        <View style={styles.connectionLines} />
      </View>
    </View>
  );

  const renderConnectVisual = () => (
    <View style={styles.visualContainer}>
      <View style={styles.phoneWidget}>
        {/* Phone frame like Locket */}
        <View style={styles.phoneFrame}>
          {/* Grid of family photos */}
          <View style={styles.photoGrid}>
            {[...Array(6)].map((_, i) => (
              <View key={i} style={styles.photoSlot}>
                {i === 0 && (
                  <Image
                    source={require("../../../assets/logo/Alqefari Emblem (Transparent).png")}
                    style={styles.photoThumb}
                  />
                )}
              </View>
            ))}
          </View>
          {/* Widget label */}
          <View style={styles.widgetLabel}>
            <Text style={styles.widgetText}>شجرة القفاري</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderStartVisual = () => (
    <View style={styles.visualContainer}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require("../../../assets/logo/Alqefari Emblem (Transparent).png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.shimmer} />
      </Animated.View>
    </View>
  );

  const renderScreen = (screen, index) => {
    const isLast = index === screens.length - 1;

    return (
      <View key={screen.id} style={styles.screen}>
        <SafeAreaView style={styles.safeArea}>
          {/* Skip button - top right */}
          {!isLast && (
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipText}>تصفح كضيف</Text>
            </TouchableOpacity>
          )}

          {/* Content */}
          <View style={styles.content}>
            {/* Visual */}
            {screen.visual === "tree" && renderTreeVisual()}
            {screen.visual === "connect" && renderConnectVisual()}
            {screen.visual === "start" && renderStartVisual()}

            {/* Text */}
            <View style={styles.textContainer}>
              <Animated.Text
                style={[
                  styles.title,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                {screen.title}
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.subtitle,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                {screen.subtitle}
              </Animated.Text>

              {/* Features pills */}
              {screen.features && (
                <View style={styles.features}>
                  {screen.features.map((feature, i) => (
                    <View key={i} style={styles.featurePill}>
                      <Ionicons
                        name={feature.icon}
                        size={16}
                        color={colors.secondary}
                      />
                      <Text style={styles.featureText}>{feature.text}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* CTAs */}
            <View style={styles.ctaContainer}>
              {isLast ? (
                <>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleGetStarted}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryButtonText}>إنشاء حساب</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSignIn}>
                    <Text style={styles.secondaryButtonText}>تسجيل الدخول</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={handleNext}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-back" size={24} color={colors.white} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Dots */}
          {!isLast && (
            <View style={styles.dots}>
              {screens.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === currentIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}
        </SafeAreaView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(
            event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
          );
          if (index !== currentIndex) {
            setCurrentIndex(index);
            // Reset animations
            fadeAnim.setValue(0);
            slideAnim.setValue(30);
            scaleAnim.setValue(0.95);
            // Replay animations
            Animated.parallel([
              Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
              }),
              Animated.timing(slideAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
              }),
              Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
              }),
            ]).start();
          }
        }}
        scrollEventThrottle={16}
      >
        {screens.map(renderScreen)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  safeArea: {
    flex: 1,
  },
  skipButton: {
    position: "absolute",
    top: 60,
    left: 24,
    zIndex: 10,
  },
  skipText: {
    fontSize: 15,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  visualContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 80,
  },
  treeContainer: {
    width: 200,
    height: 250,
    position: "relative",
  },
  treeNode: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.container,
    justifyContent: "center",
    alignItems: "center",
  },
  nodeInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
  },
  primaryNode: {
    backgroundColor: colors.primary,
  },
  connectionLines: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.2,
  },
  phoneWidget: {
    width: 200,
    height: 280,
    justifyContent: "center",
    alignItems: "center",
  },
  phoneFrame: {
    width: 180,
    height: 240,
    backgroundColor: colors.text,
    borderRadius: 32,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  photoGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoSlot: {
    width: 48,
    height: 48,
    backgroundColor: colors.textMuted + "20",
    borderRadius: 12,
    overflow: "hidden",
  },
  photoThumb: {
    width: "100%",
    height: "100%",
  },
  widgetLabel: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 12,
  },
  widgetText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    fontFamily: "SF Arabic",
  },
  logoContainer: {
    width: 160,
    height: 160,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 140,
    height: 140,
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.secondary,
    opacity: 0.1,
    borderRadius: 80,
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: 12,
    fontFamily: "SF Arabic",
  },
  subtitle: {
    fontSize: 18,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 28,
    fontFamily: "SF Arabic",
  },
  features: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  featurePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.container + "40",
    borderRadius: 20,
  },
  featureText: {
    fontSize: 14,
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  ctaContainer: {
    paddingBottom: 40,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 48,
    paddingVertical: 18,
    borderRadius: 28,
    marginBottom: 16,
    width: SCREEN_WIDTH - 48,
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontFamily: "SF Arabic",
  },
  continueButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  dots: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.container,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
});
