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
    mainText: "شجرة عائلة القفاري",
    subText: "من الجذور إلى الأغصان",
    visual: "tree",
  },
  {
    id: 2,
    mainText: "سجّل أثرك",
    subText: "احفظ ذكراك للأجيال القادمة",
    visual: "profile",
  },
  {
    id: 3,
    mainText: "صِل رحمك",
    subText: "ابحث عن أقاربك وتواصل معهم",
    visual: "connect",
  },
];

export default function FinalOnboarding({ navigation, setIsGuest, setUser }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef(null);

  // Core animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Tree animations - for the nodes
  const treeNodes = useRef(
    [...Array(7)].map(() => ({
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    })),
  ).current;

  // Profile card animation
  const cardSlide = useRef(new Animated.Value(100)).current;

  // Connection animation
  const connectionWidth = useRef(new Animated.Value(0)).current;

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
      const delay = 600 + index * 100;
      return Animated.parallel([
        Animated.spring(node.scale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(node.opacity, {
          toValue: index > 2 ? 0.3 : 1, // Fade non-main branches
          duration: 300,
          delay,
          useNativeDriver: true,
        }),
      ]);
    });
    Animated.parallel(animations).start();
  };

  const animateProfileCard = () => {
    cardSlide.setValue(100);
    Animated.spring(cardSlide, {
      toValue: 0,
      friction: 8,
      tension: 40,
      delay: 400,
      useNativeDriver: true,
    }).start();
  };

  const animateConnection = () => {
    connectionWidth.setValue(0);
    Animated.timing(connectionWidth, {
      toValue: 1,
      duration: 1000,
      delay: 600,
      useNativeDriver: false,
    }).start();
  };

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.replace("PhoneAuth");
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (setIsGuest) setIsGuest(true);
    if (setUser) setUser({ isGuest: true, user_metadata: { isGuest: true } });
  };

  const renderTreeVisualization = () => {
    return (
      <View style={styles.treeContainer}>
        {/* Alqefari Logo at top */}
        <Animated.View
          style={[
            styles.logoAtTop,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Image
            source={require("../../../assets/logo/Alqefari Emblem (Transparent).png")}
            style={styles.treeLogo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Connection lines */}
        <Animated.View
          style={[styles.treeLinesContainer, { opacity: fadeAnim }]}
        >
          <View style={styles.mainTrunk} />
          <View style={styles.leftBranch} />
          <View style={styles.rightBranch} />
        </Animated.View>

        {/* Root Node - سليمان */}
        <Animated.View
          style={[
            styles.treeNode,
            styles.rootNodePosition,
            styles.rootNode,
            {
              opacity: treeNodes[0].opacity,
              transform: [{ scale: treeNodes[0].scale }],
            },
          ]}
        >
          <Text style={styles.rootText}>سليمان</Text>
        </Animated.View>

        {/* Main Branch Left - جربوع */}
        <Animated.View
          style={[
            styles.treeNode,
            styles.leftNodePosition,
            styles.mainBranchNode,
            {
              opacity: treeNodes[1].opacity,
              transform: [{ scale: treeNodes[1].scale }],
            },
          ]}
        >
          <Text style={styles.branchText}>جربوع</Text>
        </Animated.View>

        {/* Main Branch Right - عبدالعزيز */}
        <Animated.View
          style={[
            styles.treeNode,
            styles.rightNodePosition,
            styles.mainBranchNode,
            {
              opacity: treeNodes[2].opacity,
              transform: [{ scale: treeNodes[2].scale }],
            },
          ]}
        >
          <Text style={styles.branchText}>عبدالعزيز</Text>
        </Animated.View>

        {/* Faded descendant nodes */}
        {[3, 4, 5, 6].map((index) => (
          <Animated.View
            key={index}
            style={[
              styles.treeNode,
              styles.fadedNode,
              index === 3 && styles.fadedNode1,
              index === 4 && styles.fadedNode2,
              index === 5 && styles.fadedNode3,
              index === 6 && styles.fadedNode4,
              {
                opacity: treeNodes[index].opacity,
                transform: [{ scale: treeNodes[index].scale }],
              },
            ]}
          />
        ))}
      </View>
    );
  };

  const renderProfileVisualization = () => {
    return (
      <Animated.View
        style={[
          styles.profileContainer,
          {
            transform: [{ translateY: cardSlide }],
            opacity: fadeAnim,
          },
        ]}
      >
        <View style={styles.profileCard}>
          <View style={styles.saduBorder} />
          <View style={styles.photoCircle}>
            <Ionicons name="camera" size={32} color={colors.container} />
          </View>
          <Text style={styles.profileName}>الاسم الكامل</Text>
          <View style={styles.lineageContainer}>
            <Text style={styles.lineageText}>محمد</Text>
            <Text style={styles.lineageConnector}>بن</Text>
            <Text style={styles.lineageText}>أحمد</Text>
            <Text style={styles.lineageConnector}>بن</Text>
            <Text style={styles.lineageText}>عبدالله</Text>
          </View>
          <Text style={styles.profileDate}>١٤٤٥/٠٦/١٥</Text>
        </View>
      </Animated.View>
    );
  };

  const renderConnectVisualization = () => {
    const lineWidth = connectionWidth.interpolate({
      inputRange: [0, 1],
      outputRange: ["0%", "100%"],
    });

    return (
      <View style={styles.connectContainer}>
        <Animated.View style={[styles.searchBar, { opacity: fadeAnim }]}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <Text style={styles.searchText}>ابحث: محمد بن...</Text>
        </Animated.View>

        <View style={styles.connectionContainer}>
          <Animated.View style={[styles.profileNode, { opacity: fadeAnim }]}>
            <Ionicons name="person" size={24} color={colors.white} />
          </Animated.View>

          <Animated.View
            style={[styles.connectionLine, { width: lineWidth }]}
          />

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

        <Animated.Text
          style={[styles.connectSuccess, { opacity: connectionWidth }]}
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

              {/* Single Button - ابدأ الآن */}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleStart}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>ابدأ الآن</Text>
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
    paddingTop: 80,
  },

  // Visual Section
  visualSection: {
    height: 320,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  // Tree Visualization
  treeContainer: {
    width: 300,
    height: 320,
    position: "relative",
    alignItems: "center",
  },
  logoAtTop: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    zIndex: 1,
  },
  treeLogo: {
    width: 60,
    height: 60,
    opacity: 0.9,
  },
  treeLinesContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  mainTrunk: {
    position: "absolute",
    top: 60,
    left: "50%",
    marginLeft: -1,
    width: 2,
    height: 60,
    backgroundColor: colors.container + "60",
  },
  leftBranch: {
    position: "absolute",
    top: 118,
    left: "30%",
    width: "20%",
    height: 2,
    backgroundColor: colors.container + "60",
    transform: [{ rotate: "-25deg" }],
  },
  rightBranch: {
    position: "absolute",
    top: 118,
    right: "30%",
    width: "20%",
    height: 2,
    backgroundColor: colors.container + "60",
    transform: [{ rotate: "25deg" }],
  },
  treeNode: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  rootNodePosition: {
    top: 100,
    left: "50%",
    marginLeft: -35,
  },
  rootNode: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  rootText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
    fontFamily: "SF Arabic",
  },
  leftNodePosition: {
    top: 180,
    left: "20%",
  },
  rightNodePosition: {
    top: 180,
    right: "20%",
  },
  mainBranchNode: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.secondary,
    justifyContent: "center",
    alignItems: "center",
  },
  branchText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.white,
    fontFamily: "SF Arabic",
  },
  fadedNode: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.container + "30",
    borderWidth: 1,
    borderColor: colors.container + "20",
  },
  fadedNode1: {
    top: 250,
    left: "10%",
  },
  fadedNode2: {
    top: 250,
    left: "35%",
  },
  fadedNode3: {
    top: 250,
    right: "35%",
  },
  fadedNode4: {
    top: 250,
    right: "10%",
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
    width: 240,
    backgroundColor: colors.white,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.container + "40",
    marginBottom: 40,
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
    width: 240,
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
    right: 0,
  },
  connectionLine: {
    position: "absolute",
    left: 56,
    height: 2,
    backgroundColor: colors.secondary,
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
    marginBottom: 30,
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

  // Single Button
  primaryButton: {
    backgroundColor: colors.primary,
    width: "100%",
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
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
});
