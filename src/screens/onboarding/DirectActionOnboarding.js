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
import { LinearGradient } from "expo-linear-gradient";

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
    mainText: "شجرة عائلة القفاري",
    subText: "من الجذور إلى الأغصان",
    visual: "tree",
    primaryAction: "ابدأ الآن",
  },
  {
    id: 2,
    mainText: "سجّل أثرك",
    subText: "احفظ ذكراك للأجيال القادمة",
    visual: "profile",
    primaryAction: "ابدأ الآن",
  },
  {
    id: 3,
    mainText: "صِل رحمك",
    subText: "ابحث عن أقاربك وتواصل معهم",
    visual: "connect",
    primaryAction: "ابدأ الآن",
  },
];

export default function DirectActionOnboarding({
  navigation,
  setIsGuest,
  setUser,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef(null);

  // Core animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Tree animations - 9 nodes
  const treeNodes = useRef(
    [...Array(9)].map(() => ({
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    })),
  ).current;

  // Profile card animation
  const cardFlip = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(100)).current;

  // Search animation - separate native and non-native
  const searchWidth = useRef(new Animated.Value(0)).current; // non-native (width)
  const connectionLine = useRef(new Animated.Value(0)).current; // non-native (width)
  const sparkPosition = useRef(new Animated.Value(0)).current; // native (transform)

  useEffect(() => {
    // Reset all animations
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.8);
    slideAnim.setValue(50);

    // Main entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
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
        duration: 500,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Screen-specific animations
    if (screens[currentIndex].visual === "tree") {
      animateTree();
    } else if (screens[currentIndex].visual === "profile") {
      animateProfileCard();
    } else if (screens[currentIndex].visual === "connect") {
      animateConnection();
    }
  }, [currentIndex]);

  const animateTree = () => {
    // Animate tree nodes appearing one by one
    const animations = treeNodes.map((node, index) => {
      const delay = 400 + index * 80;
      return Animated.parallel([
        Animated.spring(node.scale, {
          toValue: 1,
          friction: 8,
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
      ]);
    });
    Animated.parallel(animations).start();
  };

  const animateProfileCard = () => {
    // Reset card
    cardSlide.setValue(100);
    cardFlip.setValue(0);

    // Slide up first
    Animated.spring(cardSlide, {
      toValue: 0,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // Then flip after delay (separate animation)
    setTimeout(() => {
      Animated.timing(cardFlip, {
        toValue: 180,
        duration: 600,
        useNativeDriver: false, // Keep as false for rotateY interpolation
      }).start();
    }, 800);
  };

  const animateConnection = () => {
    // Reset values
    searchWidth.setValue(0);
    connectionLine.setValue(0);
    sparkPosition.setValue(0);

    // Search bar expands (non-native for width)
    Animated.timing(searchWidth, {
      toValue: 1,
      duration: 800,
      delay: 400,
      useNativeDriver: false,
    }).start();

    // Connection line draws (non-native for width)
    setTimeout(() => {
      Animated.timing(connectionLine, {
        toValue: 1,
        duration: 700,
        useNativeDriver: false,
      }).start();

      // Spark travels along line (native for transform)
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(sparkPosition, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(sparkPosition, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]).start();
      }, 700);
    }, 1000);
  };

  const handlePrimaryAction = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isLastScreen = currentIndex === screens.length - 1;

    if (isLastScreen) {
      // "ابدأ الآن" - go to signup
      navigation.replace("PhoneAuth", { mode: "signup" });
    } else {
      // "تسجيل الدخول" - go to login
      navigation.replace("PhoneAuth", { mode: "login" });
    }
  };

  const handleSecondaryAction = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const isLastScreen = currentIndex === screens.length - 1;

    if (isLastScreen) {
      // "لديك حساب؟" - go to login
      navigation.replace("PhoneAuth", { mode: "login" });
    } else {
      // "إنشاء حساب" - go to signup
      navigation.replace("PhoneAuth", { mode: "signup" });
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (setIsGuest) setIsGuest(true);
    if (setUser) setUser({ isGuest: true, user_metadata: { isGuest: true } });
  };

  const renderTreeVisualization = () => {
    const nodePositions = [
      { top: 0, left: "42%" }, // Root
      { top: 60, left: "25%" }, // Gen 2 left
      { top: 60, right: "25%" }, // Gen 2 right
      { top: 120, left: "10%" }, // Gen 3
      { top: 120, left: "35%" }, // Gen 3
      { top: 120, right: "35%" }, // Gen 3
      { top: 120, right: "10%" }, // Gen 3
      { top: 180, left: "25%" }, // Gen 4
      { top: 180, right: "25%" }, // Gen 4
    ];

    return (
      <View style={styles.treeContainer}>
        {/* Connection lines - drawn behind nodes */}
        <Animated.View
          style={[styles.treeLinesContainer, { opacity: fadeAnim }]}
        >
          <View style={[styles.treeLine, styles.lineRoot]} />
          <View style={[styles.treeLine, styles.lineBranch1]} />
          <View style={[styles.treeLine, styles.lineBranch2]} />
        </Animated.View>

        {/* Tree nodes */}
        {treeNodes.map((node, index) => (
          <Animated.View
            key={index}
            style={[
              styles.treeNode,
              nodePositions[index],
              index === 0 && styles.rootNode,
              {
                opacity: node.opacity,
                transform: [{ scale: node.scale }],
              },
            ]}
          >
            {index === 0 && (
              <View style={styles.nodeInner}>
                <Text style={styles.nodeText}>الجد</Text>
              </View>
            )}
          </Animated.View>
        ))}
      </View>
    );
  };

  const renderProfileVisualization = () => {
    const flipInterpolate = cardFlip.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: ["0deg", "90deg", "180deg"],
    });

    return (
      <Animated.View
        style={[
          styles.profileContainer,
          {
            transform: [
              { translateY: cardSlide },
              { rotateY: flipInterpolate },
            ],
          },
        ]}
      >
        <View style={styles.profileCard}>
          {/* Sadu pattern border */}
          <View style={styles.saduBorder} />

          {/* Photo placeholder */}
          <View style={styles.photoCircle}>
            <Ionicons name="camera" size={32} color={colors.container} />
          </View>

          {/* Name and lineage */}
          <Text style={styles.profileName}>الاسم الكامل</Text>

          <View style={styles.lineageContainer}>
            <Text style={styles.lineageText}>محمد</Text>
            <Text style={styles.lineageConnector}>بن</Text>
            <Text style={styles.lineageText}>أحمد</Text>
            <Text style={styles.lineageConnector}>بن</Text>
            <Text style={styles.lineageText}>عبدالله</Text>
          </View>

          {/* Date placeholder */}
          <Text style={styles.profileDate}>١٤٤٥/٠٦/١٥</Text>
        </View>
      </Animated.View>
    );
  };

  const renderConnectVisualization = () => {
    const searchBarWidth = searchWidth.interpolate({
      inputRange: [0, 1],
      outputRange: ["0%", "100%"],
    });

    const lineWidth = connectionLine.interpolate({
      inputRange: [0, 1],
      outputRange: ["0%", "100%"],
    });

    return (
      <View style={styles.connectContainer}>
        {/* Search bar */}
        <Animated.View style={[styles.searchBar, { width: searchBarWidth }]}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <Text style={styles.searchText}>ابحث: محمد بن...</Text>
        </Animated.View>

        {/* Connection visualization */}
        <View style={styles.connectionContainer}>
          {/* Left profile */}
          <Animated.View style={[styles.profileNode, { opacity: fadeAnim }]}>
            <Ionicons name="person" size={24} color={colors.white} />
          </Animated.View>

          {/* Animated connection line */}
          <Animated.View
            style={[styles.connectionLineContainer, { width: lineWidth }]}
          >
            <LinearGradient
              colors={[colors.secondary, colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.connectionGradient}
            />
          </Animated.View>

          {/* Spark that travels along line */}
          <Animated.View
            style={[
              styles.connectionSpark,
              {
                opacity: sparkPosition,
                transform: [
                  {
                    translateX: sparkPosition.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 150],
                    }),
                  },
                ],
              },
            ]}
          />

          {/* Right profile */}
          <Animated.View
            style={[
              styles.profileNode,
              styles.profileNodeRight,
              { opacity: fadeAnim },
            ]}
          >
            <Ionicons name="person" size={24} color={colors.white} />
          </Animated.View>
        </View>

        {/* Success text */}
        <Animated.Text
          style={[
            styles.connectSuccess,
            {
              opacity: connectionLine.interpolate({
                inputRange: [0.8, 1],
                outputRange: [0, 1],
              }),
            },
          ]}
        >
          تم الاتصال!
        </Animated.Text>
      </View>
    );
  };

  const renderScreen = (screen, index) => {
    return (
      <View key={screen.id} style={styles.screen}>
        <SafeAreaView style={styles.safeArea}>
          {/* Skip button - only on first screen */}
          {index === 0 && (
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipText}>تصفح كضيف</Text>
            </TouchableOpacity>
          )}

          <View style={styles.content}>
            {/* Visual Section */}
            <View style={styles.visualSection}>
              {screen.visual === "tree" && renderTreeVisualization()}
              {screen.visual === "profile" && renderProfileVisualization()}
              {screen.visual === "connect" && renderConnectVisualization()}
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
              <Text style={styles.mainText}>{screen.mainText}</Text>
              <Text style={styles.subText}>{screen.subText}</Text>
            </Animated.View>

            {/* Bottom Section with Actions */}
            <View style={styles.bottomSection}>
              {/* Dots */}
              <View style={styles.dots}>
                {screens.map((_, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.dot,
                      i === currentIndex && styles.dotActive,
                      {
                        opacity: fadeAnim,
                      },
                    ]}
                  />
                ))}
              </View>

              {/* Primary Button */}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handlePrimaryAction}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>
                  {screen.primaryAction}
                </Text>
              </TouchableOpacity>

              {/* Secondary Action */}
              <TouchableOpacity
                onPress={handleSecondaryAction}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>
                  {screen.secondaryAction}
                </Text>
              </TouchableOpacity>
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
  },

  // Visual Section
  visualSection: {
    height: 240,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
  },

  // Tree Visualization
  treeContainer: {
    width: 280,
    height: 240,
    position: "relative",
  },
  treeLinesContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  treeLine: {
    position: "absolute",
    backgroundColor: colors.container + "40",
    height: 2,
  },
  lineRoot: {
    top: 28,
    left: "42%",
    width: 1,
    height: 32,
  },
  lineBranch1: {
    top: 60,
    left: "25%",
    width: "34%",
    transform: [{ rotate: "-15deg" }],
  },
  lineBranch2: {
    top: 60,
    right: "25%",
    width: "34%",
    transform: [{ rotate: "15deg" }],
  },
  treeNode: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.container + "30",
    borderWidth: 2,
    borderColor: colors.container,
    justifyContent: "center",
    alignItems: "center",
  },
  rootNode: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary + "20",
    borderColor: colors.primary,
  },
  nodeInner: {
    justifyContent: "center",
    alignItems: "center",
  },
  nodeText: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: "SF Arabic",
    fontWeight: "600",
  },

  // Profile Visualization
  profileContainer: {
    width: 200,
    height: 260,
    justifyContent: "center",
    alignItems: "center",
  },
  profileCard: {
    width: 200,
    height: 260,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: colors.container + "40",
  },
  saduBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: colors.secondary,
    opacity: 0.3,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  photoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.container,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
    fontFamily: "SF Arabic",
  },
  lineageContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  lineageText: {
    fontSize: 14,
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  lineageConnector: {
    fontSize: 12,
    color: colors.textMuted,
    marginHorizontal: 4,
    fontFamily: "SF Arabic",
  },
  profileDate: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
  },

  // Connect Visualization
  connectContainer: {
    width: 280,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    height: 48,
    backgroundColor: colors.white,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.container + "40",
    marginBottom: 40,
    overflow: "hidden",
  },
  searchText: {
    marginLeft: 12,
    fontSize: 15,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
  },
  connectionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: 280,
    height: 60,
    marginBottom: 20,
  },
  profileNode: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  profileNodeRight: {
    position: "absolute",
    right: 40,
  },
  connectionLineContainer: {
    position: "absolute",
    left: 96,
    height: 2,
    overflow: "hidden",
  },
  connectionGradient: {
    flex: 1,
  },
  connectionSpark: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
    left: 96,
  },
  connectSuccess: {
    fontSize: 14,
    color: colors.primary,
    fontFamily: "SF Arabic",
    fontWeight: "600",
  },

  // Text Section
  textSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  mainText: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: 12,
    fontFamily: "SF Arabic",
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  subText: {
    fontSize: 17,
    color: colors.textMuted,
    textAlign: "center",
    fontFamily: "SF Arabic",
    lineHeight: 24,
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
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  secondaryButton: {
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontFamily: "SF Arabic",
    textDecorationLine: "underline",
    opacity: 0.8,
  },
});
