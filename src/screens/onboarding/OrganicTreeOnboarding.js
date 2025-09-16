import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
  SafeAreaView,
} from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Line } from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Najdi Sadu Palette - Museum Quality
const colors = {
  background: "#F9F7F3", // Al-Jass White
  node: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  primary: "#A13333", // Najdi Crimson
  white: "#FFFFFF",
};

export default function OrganicTreeOnboarding({
  navigation,
  setIsGuest,
  setUser,
}) {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const headlineFade = useRef(new Animated.Value(0)).current;
  const subtitleFade = useRef(new Animated.Value(0)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;
  const indicatorFade = useRef(new Animated.Value(0)).current;

  // Tree node animations
  const nodeAnims = useRef([
    new Animated.Value(0), // Root
    new Animated.Value(0), // Left child
    new Animated.Value(0), // Right child
    new Animated.Value(0), // Bottom left
    new Animated.Value(0), // Bottom right
  ]).current;

  useEffect(() => {
    // Elegant entrance sequence
    Animated.sequence([
      // Tree fades in first
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 12,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      // Then nodes appear one by one
      Animated.stagger(
        150,
        nodeAnims.map((anim) =>
          Animated.spring(anim, {
            toValue: 1,
            friction: 10,
            tension: 50,
            useNativeDriver: true,
          }),
        ),
      ),
      // Finally text and buttons
      Animated.parallel([
        Animated.timing(headlineFade, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleFade, {
          toValue: 1,
          duration: 500,
          delay: 200,
          useNativeDriver: true,
        }),
        Animated.timing(buttonFade, {
          toValue: 1,
          duration: 500,
          delay: 400,
          useNativeDriver: true,
        }),
        Animated.timing(indicatorFade, {
          toValue: 1,
          duration: 500,
          delay: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.replace("PhoneAuth");
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (setIsGuest) setIsGuest(true);
    if (setUser) setUser({ isGuest: true, user_metadata: { isGuest: true } });
  };

  const renderSaduPattern = () => (
    <View style={styles.patternContainer}>
      <View style={styles.patternRow}>
        {[...Array(8)].map((_, i) => (
          <View key={i} style={styles.patternDiamond} />
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Subtle Sadu Pattern Background */}
      {renderSaduPattern()}

      {/* Skip Link - Top Right, Subtle */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>تصفح كضيف</Text>
      </TouchableOpacity>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Elegant Family Tree */}
        <Animated.View
          style={[
            styles.treeContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Svg width={200} height={140} style={styles.svg}>
            {/* Connecting Lines - Thin and Elegant */}
            <Line
              x1="100"
              y1="30"
              x2="60"
              y2="70"
              stroke={colors.text}
              strokeWidth="1"
              opacity="0.3"
            />
            <Line
              x1="100"
              y1="30"
              x2="140"
              y2="70"
              stroke={colors.text}
              strokeWidth="1"
              opacity="0.3"
            />
            <Line
              x1="60"
              y1="70"
              x2="40"
              y2="110"
              stroke={colors.text}
              strokeWidth="1"
              opacity="0.2"
            />
            <Line
              x1="60"
              y1="70"
              x2="80"
              y2="110"
              stroke={colors.text}
              strokeWidth="1"
              opacity="0.2"
            />
            <Line
              x1="140"
              y1="70"
              x2="120"
              y2="110"
              stroke={colors.text}
              strokeWidth="1"
              opacity="0.2"
            />
            <Line
              x1="140"
              y1="70"
              x2="160"
              y2="110"
              stroke={colors.text}
              strokeWidth="1"
              opacity="0.2"
            />
          </Svg>

          {/* Tree Nodes - Sophisticated Design */}
          {/* Root Node */}
          <Animated.View
            style={[
              styles.node,
              styles.nodeRoot,
              {
                opacity: nodeAnims[0],
                transform: [{ scale: nodeAnims[0] }],
              },
            ]}
          >
            <Text style={styles.nodeText}>سليمان</Text>
          </Animated.View>

          {/* Second Level */}
          <Animated.View
            style={[
              styles.node,
              styles.nodeLeft,
              {
                opacity: nodeAnims[1],
                transform: [{ scale: nodeAnims[1] }],
              },
            ]}
          >
            <Text style={styles.nodeText}>عبدالعزيز</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.node,
              styles.nodeRight,
              {
                opacity: nodeAnims[2],
                transform: [{ scale: nodeAnims[2] }],
              },
            ]}
          >
            <Text style={styles.nodeText}>جربوع</Text>
          </Animated.View>

          {/* Third Level - Smaller Nodes */}
          <Animated.View
            style={[
              styles.nodeSmall,
              styles.nodeBottomLeft1,
              {
                opacity: nodeAnims[3],
                transform: [{ scale: nodeAnims[3] }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.nodeSmall,
              styles.nodeBottomLeft2,
              {
                opacity: nodeAnims[3],
                transform: [{ scale: nodeAnims[3] }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.nodeSmall,
              styles.nodeBottomRight1,
              {
                opacity: nodeAnims[4],
                transform: [{ scale: nodeAnims[4] }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.nodeSmall,
              styles.nodeBottomRight2,
              {
                opacity: nodeAnims[4],
                transform: [{ scale: nodeAnims[4] }],
              },
            ]}
          />
        </Animated.View>

        {/* Hero Copy - Museum Typography */}
        <View style={styles.textContainer}>
          <Animated.Text style={[styles.headline, { opacity: headlineFade }]}>
            لكل عائلة عظيمة حكاية.
          </Animated.Text>
          <Animated.Text style={[styles.subtitle, { opacity: subtitleFade }]}>
            وهذه حكاية القفاري.
          </Animated.Text>
        </View>

        {/* Primary CTA */}
        <Animated.View
          style={[styles.buttonContainer, { opacity: buttonFade }]}
        >
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleStart}
            activeOpacity={0.9}
          >
            <Text style={styles.buttonText}>ابدأ الآن</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Page Indicators */}
        <Animated.View style={[styles.indicators, { opacity: indicatorFade }]}>
          <View style={[styles.indicator, styles.indicatorActive]} />
          <View style={styles.indicator} />
          <View style={styles.indicator} />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Subtle Sadu Pattern
  patternContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.03, // Very subtle
  },
  patternRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 100,
  },
  patternDiamond: {
    width: 30,
    height: 30,
    backgroundColor: colors.text,
    transform: [{ rotate: "45deg" }],
  },

  // Skip Button - Subtle
  skipButton: {
    position: "absolute",
    top: 50,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    fontSize: 14,
    color: colors.text,
    opacity: 0.5,
    fontFamily: "SF Arabic",
    fontWeight: "400",
  },

  // Content
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },

  // Tree Container
  treeContainer: {
    width: 200,
    height: 140,
    marginBottom: 60,
    position: "relative",
  },
  svg: {
    position: "absolute",
    top: 0,
    left: 0,
  },

  // Tree Nodes - Sophisticated
  node: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.node,
    borderWidth: 1,
    borderColor: colors.text,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  nodeRoot: {
    top: 0,
    left: 72, // Center: (200-56)/2
  },
  nodeLeft: {
    top: 40,
    left: 32,
  },
  nodeRight: {
    top: 40,
    right: 32,
  },
  nodeSmall: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.node,
    borderWidth: 1,
    borderColor: colors.text,
    opacity: 0.6,
  },
  nodeBottomLeft1: {
    bottom: 0,
    left: 28,
  },
  nodeBottomLeft2: {
    bottom: 0,
    left: 56,
  },
  nodeBottomRight1: {
    bottom: 0,
    right: 56,
  },
  nodeBottomRight2: {
    bottom: 0,
    right: 28,
  },
  nodeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
  },

  // Typography - Museum Quality
  textContainer: {
    alignItems: "center",
    marginBottom: 50,
  },
  headline: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "400",
    color: colors.text,
    opacity: 0.7,
    fontFamily: "SF Arabic",
    textAlign: "center",
  },

  // CTA Button
  buttonContainer: {
    width: "100%",
    marginBottom: 30,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },

  // Page Indicators
  indicators: {
    flexDirection: "row",
    gap: 8,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text,
    opacity: 0.2,
  },
  indicatorActive: {
    backgroundColor: colors.primary,
    opacity: 1,
    width: 18,
  },
});
