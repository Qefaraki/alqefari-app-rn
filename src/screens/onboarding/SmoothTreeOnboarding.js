import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Circle,
  G,
} from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Soft, premium color palette inspired by Locket
const colors = {
  background: "#FAFAFA",
  cardBg: "#FFFFFF",
  primary: "#E85D75", // Soft coral red
  primaryLight: "#F5A3B3", // Light pink
  secondary: "#FF9B71", // Warm orange
  tertiary: "#FFD4C4", // Peach
  text: "#1C1C1E",
  textSecondary: "#8E8E93",
  border: "#F2F2F7",
  shadow: "#000000",
};

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const screens = [
  {
    id: 1,
    title: "شجرة عائلة القفاري",
    subtitle: "من الجذور إلى الأغصان",
    visual: "tree",
  },
];

export default function SmoothTreeOnboarding({
  navigation,
  setIsGuest,
  setUser,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Tree animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Node animations with smooth transitions
  const rootNode = useRef({
    scale: new Animated.Value(0),
    opacity: new Animated.Value(0),
  }).current;

  const leftNode = useRef({
    scale: new Animated.Value(0),
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(-20),
  }).current;

  const rightNode = useRef({
    scale: new Animated.Value(0),
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(-20),
  }).current;

  // Connection lines
  const leftLine = useRef(new Animated.Value(0)).current;
  const rightLine = useRef(new Animated.Value(0)).current;

  // Descendant nodes (5 per branch)
  const descendants = useRef(
    [...Array(10)].map(() => ({
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(-10),
    })),
  ).current;

  // Subtle floating animation
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Main entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Animate tree
    animateTree();

    // Start floating animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const animateTree = () => {
    // 1. Root appears with smooth scale
    Animated.parallel([
      Animated.spring(rootNode.scale, {
        toValue: 1,
        delay: 300,
        friction: 10,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(rootNode.opacity, {
        toValue: 1,
        duration: 400,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Lines grow
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(leftLine, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(rightLine, {
          toValue: 1,
          duration: 400,
          delay: 50,
          useNativeDriver: false,
        }),
      ]).start();
    }, 500);

    // 3. Branch nodes appear
    setTimeout(() => {
      Animated.parallel([
        // Left node
        Animated.parallel([
          Animated.spring(leftNode.scale, {
            toValue: 1,
            friction: 10,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.timing(leftNode.opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(leftNode.translateY, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        // Right node
        Animated.parallel([
          Animated.spring(rightNode.scale, {
            toValue: 1,
            friction: 10,
            tension: 40,
            delay: 100,
            useNativeDriver: true,
          }),
          Animated.timing(rightNode.opacity, {
            toValue: 1,
            duration: 300,
            delay: 100,
            useNativeDriver: true,
          }),
          Animated.timing(rightNode.translateY, {
            toValue: 0,
            duration: 400,
            delay: 100,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }, 700);

    // 4. Descendants fade in smoothly
    setTimeout(() => {
      descendants.forEach((node, index) => {
        const delay = index * 60;
        Animated.parallel([
          Animated.spring(node.scale, {
            toValue: 1,
            friction: 10,
            tension: 40,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(node.opacity, {
            toValue: 1,
            duration: 300,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(node.translateY, {
            toValue: 0,
            duration: 400,
            delay,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 1000);
  };

  const handleStart = () => {
    navigation.replace("PhoneAuth");
  };

  const handleGuest = () => {
    setIsGuest(true);
    setUser(null);
  };

  const renderTree = () => {
    return (
      <Animated.View
        style={[
          styles.treeContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }, { translateY: floatAnim }],
          },
        ]}
      >
        {/* Logo at top */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>آل</Text>
          </View>
        </View>

        {/* SVG for smooth lines */}
        <Svg width={300} height={250} style={styles.svgContainer}>
          <Defs>
            <SvgLinearGradient
              id="lineGradient"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.3" />
              <Stop
                offset="100%"
                stopColor={colors.secondary}
                stopOpacity="0.1"
              />
            </SvgLinearGradient>
          </Defs>

          {/* Left connection line */}
          <AnimatedPath
            d="M 150,80 Q 120,110 90,140"
            stroke="url(#lineGradient)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="70"
            strokeDashoffset={leftLine.interpolate({
              inputRange: [0, 1],
              outputRange: [70, 0],
            })}
          />

          {/* Right connection line */}
          <AnimatedPath
            d="M 150,80 Q 180,110 210,140"
            stroke="url(#lineGradient)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="70"
            strokeDashoffset={rightLine.interpolate({
              inputRange: [0, 1],
              outputRange: [70, 0],
            })}
          />

          {/* Descendant lines - subtle and elegant */}
          {[0, 1, 2, 3, 4].map((i) => (
            <AnimatedPath
              key={`left-line-${i}`}
              d={`M 90,160 L ${70 + i * 10},190`}
              stroke={colors.border}
              strokeWidth="1"
              fill="none"
              strokeLinecap="round"
              opacity={descendants[i].opacity}
            />
          ))}

          {[0, 1, 2, 3, 4].map((i) => (
            <AnimatedPath
              key={`right-line-${i}`}
              d={`M 210,160 L ${190 + i * 10},190`}
              stroke={colors.border}
              strokeWidth="1"
              fill="none"
              strokeLinecap="round"
              opacity={descendants[i + 5].opacity}
            />
          ))}
        </Svg>

        {/* Root Node - سليمان */}
        <Animated.View
          style={[
            styles.rootNodeContainer,
            {
              opacity: rootNode.opacity,
              transform: [{ scale: rootNode.scale }],
            },
          ]}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.rootNode}
          >
            <Text style={styles.rootText}>سليمان</Text>
          </LinearGradient>
        </Animated.View>

        {/* Left Branch - عبدالعزيز */}
        <Animated.View
          style={[
            styles.leftNodeContainer,
            {
              opacity: leftNode.opacity,
              transform: [
                { scale: leftNode.scale },
                { translateY: leftNode.translateY },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[colors.secondary, colors.tertiary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.branchNode}
          >
            <Text style={styles.branchText}>عبدالعزيز</Text>
          </LinearGradient>
        </Animated.View>

        {/* Right Branch - جربوع */}
        <Animated.View
          style={[
            styles.rightNodeContainer,
            {
              opacity: rightNode.opacity,
              transform: [
                { scale: rightNode.scale },
                { translateY: rightNode.translateY },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[colors.secondary, colors.tertiary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.branchNode}
          >
            <Text style={styles.branchText}>جربوع</Text>
          </LinearGradient>
        </Animated.View>

        {/* Descendant nodes - left */}
        {[0, 1, 2, 3, 4].map((i) => (
          <Animated.View
            key={`left-desc-${i}`}
            style={[
              styles.descendantNode,
              {
                left: 60 + i * 10,
                top: 200,
                opacity: descendants[i].opacity,
                transform: [
                  { scale: descendants[i].scale },
                  { translateY: descendants[i].translateY },
                ],
              },
            ]}
          />
        ))}

        {/* Descendant nodes - right */}
        {[0, 1, 2, 3, 4].map((i) => (
          <Animated.View
            key={`right-desc-${i}`}
            style={[
              styles.descendantNode,
              {
                right: 60 + i * 10,
                top: 200,
                opacity: descendants[i + 5].opacity,
                transform: [
                  { scale: descendants[i + 5].scale },
                  { translateY: descendants[i + 5].translateY },
                ],
              },
            ]}
          />
        ))}
      </Animated.View>
    );
  };

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Skip button */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleGuest}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>تصفح كضيف</Text>
          </TouchableOpacity>

          {/* Tree visualization */}
          <View style={styles.visualContainer}>{renderTree()}</View>

          {/* Text content */}
          <View style={styles.textContainer}>
            <Text style={styles.title}>{screens[currentIndex].title}</Text>
            <Text style={styles.subtitle}>
              {screens[currentIndex].subtitle}
            </Text>
          </View>

          {/* Pagination dots */}
          <View style={styles.pagination}>
            {screens.map((_, index) => (
              <View
                key={index}
                style={[styles.dot, index === currentIndex && styles.activeDot]}
              />
            ))}
          </View>

          {/* CTA Button */}
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleStart}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientButton}
            >
              <Text style={styles.ctaText}>ابدأ الآن</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  skipButton: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  skipText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontFamily: "SF Arabic",
  },
  visualContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
  },
  treeContainer: {
    width: 300,
    height: 300,
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    zIndex: 10,
  },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardBg,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  logoText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.primary,
    fontFamily: "SF Arabic",
  },
  svgContainer: {
    position: "absolute",
    top: 30,
  },
  rootNodeContainer: {
    position: "absolute",
    top: 60,
  },
  rootNode: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  rootText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.cardBg,
    fontFamily: "SF Arabic",
  },
  leftNodeContainer: {
    position: "absolute",
    left: 65,
    top: 140,
  },
  rightNodeContainer: {
    position: "absolute",
    right: 65,
    top: 140,
  },
  branchNode: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  branchText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.cardBg,
    fontFamily: "SF Arabic",
  },
  descendantNode: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.tertiary,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    color: colors.textSecondary,
    fontFamily: "SF Arabic",
    lineHeight: 24,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: colors.secondary,
    width: 24,
  },
  ctaButton: {
    marginBottom: 24,
  },
  gradientButton: {
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.cardBg,
    fontFamily: "SF Arabic",
  },
});
