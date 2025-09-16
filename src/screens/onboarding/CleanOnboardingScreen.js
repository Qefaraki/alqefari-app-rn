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
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Najdi Sadu Color Palette from CLAUDE.md
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
    topText: "عائلة القفاري",
    mainText: "تواصل مع عائلتك",
    subText: "اكتشف شجرة العائلة",
    visual: "tree",
  },
  {
    id: 2,
    topText: "أكثر من ٥٠٠ فرد",
    mainText: "ابحث واتصل بأقاربك",
    subText: "صلة رحم وتوثيق",
    visual: "stats",
  },
  {
    id: 3,
    topText: "",
    mainText: "ابدأ رحلتك",
    subText: "انضم لشجرة عائلة القفاري",
    visual: "logo",
    showAuth: true,
  },
];

export default function CleanOnboardingScreen({
  navigation,
  setIsGuest,
  setUser,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const nodeAnimations = useRef(
    [...Array(7)].map(() => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    // Entry animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Animate tree nodes sequentially
    if (screens[currentIndex].visual === "tree") {
      nodeAnimations.forEach((anim, index) => {
        Animated.spring(anim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          delay: 400 + index * 100,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [currentIndex]);

  const handleNext = () => {
    if (currentIndex < screens.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      scrollViewRef.current?.scrollTo({
        x: SCREEN_WIDTH * (currentIndex + 1),
        animated: true,
      });
      setCurrentIndex(currentIndex + 1);
      // Reset animations
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.95);
      slideAnim.setValue(20);
      nodeAnimations.forEach((anim) => anim.setValue(0));
      // Replay
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.replace("PhoneAuth");
  };

  const handleSignIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.replace("PhoneAuth");
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (setIsGuest) setIsGuest(true);
    if (setUser) setUser({ isGuest: true, user_metadata: { isGuest: true } });
  };

  const renderTreeVisualization = () => (
    <View style={styles.treeContainer}>
      {/* Animated tree nodes forming a family tree */}
      <Animated.View
        style={[
          styles.treeNode,
          styles.node1,
          {
            opacity: nodeAnimations[0],
            transform: [{ scale: nodeAnimations[0] }],
          },
        ]}
      >
        <View style={styles.nodeInner} />
      </Animated.View>

      <Animated.View
        style={[
          styles.treeNode,
          styles.node2,
          {
            opacity: nodeAnimations[1],
            transform: [{ scale: nodeAnimations[1] }],
          },
        ]}
      >
        <View style={styles.nodeInner} />
      </Animated.View>

      <Animated.View
        style={[
          styles.treeNode,
          styles.node3,
          {
            opacity: nodeAnimations[2],
            transform: [{ scale: nodeAnimations[2] }],
          },
        ]}
      >
        <View style={[styles.nodeInner, styles.primaryNodeInner]} />
      </Animated.View>

      {/* Connection lines */}
      <Animated.View
        style={[styles.treeLine, styles.line1, { opacity: fadeAnim }]}
      />
      <Animated.View
        style={[styles.treeLine, styles.line2, { opacity: fadeAnim }]}
      />
    </View>
  );

  const renderStatsVisualization = () => (
    <Animated.View
      style={[
        styles.statsContainer,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Text style={styles.bigNumber}>٥٠٠+</Text>
      <Text style={styles.bigNumberLabel}>فرد من العائلة</Text>

      <View style={styles.pillsContainer}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>أنت</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>أب</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>جد</Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderLogoVisualization = () => (
    <Animated.View
      style={[
        styles.logoContainer,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.logoGlow} />
      <Image
        source={require("../../../assets/logo/Alqefari Emblem (Transparent).png")}
        style={styles.logo}
        resizeMode="contain"
      />
    </Animated.View>
  );

  const renderScreen = (screen, index) => {
    const isLast = screen.showAuth;

    return (
      <View key={screen.id} style={styles.screen}>
        <SafeAreaView style={styles.safeArea}>
          {/* Skip button */}
          {index === 0 && (
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipText}>تصفح كضيف</Text>
            </TouchableOpacity>
          )}

          <View style={styles.content}>
            {/* Visual Section */}
            <View style={styles.visualSection}>
              {screen.visual === "tree" && renderTreeVisualization()}
              {screen.visual === "stats" && renderStatsVisualization()}
              {screen.visual === "logo" && renderLogoVisualization()}
            </View>

            {/* Text Section */}
            <Animated.View
              style={[
                styles.textSection,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {screen.topText && (
                <Text style={styles.topText}>{screen.topText}</Text>
              )}
              <Text style={styles.mainText}>{screen.mainText}</Text>
              {screen.subText && (
                <Text style={styles.subText}>{screen.subText}</Text>
              )}
            </Animated.View>

            {/* Bottom Section */}
            <View style={styles.bottomSection}>
              {/* Dots */}
              <View style={styles.dots}>
                {screens.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, i === currentIndex && styles.dotActive]}
                  />
                ))}
              </View>

              {/* Buttons */}
              {isLast ? (
                <>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleStart}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryButtonText}>ابدأ الآن</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSignIn}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>تسجيل الدخول</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleNext}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>التالي</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
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
        onMomentumScrollEnd={(event) => {
          const index = Math.round(
            event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
          );
          if (index !== currentIndex) {
            setCurrentIndex(index);
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
    paddingHorizontal: 40,
    paddingTop: 100,
    paddingBottom: 50,
  },

  // Visual Section
  visualSection: {
    height: 280,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
  },

  // Tree Visualization
  treeContainer: {
    width: 200,
    height: 200,
    position: "relative",
  },
  treeNode: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.container,
    justifyContent: "center",
    alignItems: "center",
  },
  nodeInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
  },
  primaryNodeInner: {
    backgroundColor: colors.primary,
  },
  node1: {
    top: 0,
    left: 72,
  },
  node2: {
    top: 60,
    left: 40,
  },
  node3: {
    top: 60,
    left: 104,
  },
  treeLine: {
    position: "absolute",
    backgroundColor: colors.container,
    height: 2,
  },
  line1: {
    top: 28,
    left: 68,
    width: 60,
    transform: [{ rotate: "-30deg" }],
  },
  line2: {
    top: 28,
    right: 68,
    width: 60,
    transform: [{ rotate: "30deg" }],
  },

  // Stats Visualization
  statsContainer: {
    alignItems: "center",
  },
  bigNumber: {
    fontSize: 72,
    fontWeight: "700",
    color: colors.primary,
    fontFamily: "SF Arabic",
  },
  bigNumberLabel: {
    fontSize: 18,
    color: colors.text,
    marginBottom: 24,
    fontFamily: "SF Arabic",
  },
  pillsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  pill: {
    backgroundColor: colors.container + "40",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.container,
  },
  pillText: {
    fontSize: 14,
    color: colors.text,
    fontFamily: "SF Arabic",
  },

  // Logo Visualization
  logoContainer: {
    width: 160,
    height: 160,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  logo: {
    width: 120,
    height: 120,
  },
  logoGlow: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.secondary,
    opacity: 0.1,
  },

  // Text Section
  textSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  topText: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 12,
    fontFamily: "SF Arabic",
  },
  mainText: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: 8,
    fontFamily: "SF Arabic",
    lineHeight: 40,
  },
  subText: {
    fontSize: 17,
    color: colors.textMuted,
    textAlign: "center",
    fontFamily: "SF Arabic",
  },

  // Bottom Section
  bottomSection: {
    position: "absolute",
    bottom: 50,
    left: 40,
    right: 40,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.container + "40",
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },

  // Buttons
  primaryButton: {
    backgroundColor: colors.primary,
    width: "100%",
    paddingVertical: 18,
    borderRadius: 28,
    alignItems: "center",
    marginBottom: 16,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  secondaryButton: {
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontFamily: "SF Arabic",
    textDecorationLine: "underline",
  },
});
