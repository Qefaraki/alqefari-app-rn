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
import Svg, {
  Path,
  Circle,
  G,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from "react-native-svg";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

// Najdi Sadu Color Palette from CLAUDE.md
const colors = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  textMuted: "#24212199", // 60% opacity
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  white: "#FFFFFF",
  gold: "#D4AF37", // Golden for special elements
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

export default function OrganicTreeOnboarding({
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

  // Tree growth animations
  const trunkGrowth = useRef(new Animated.Value(0)).current;
  const leftBranchGrowth = useRef(new Animated.Value(0)).current;
  const rightBranchGrowth = useRef(new Animated.Value(0)).current;
  const rootPulse = useRef(new Animated.Value(1)).current;

  // Node animations - for blooming effect
  const nodeAnimations = useRef({
    root: { scale: new Animated.Value(0), opacity: new Animated.Value(0) },
    left: { scale: new Animated.Value(0), opacity: new Animated.Value(0) },
    right: { scale: new Animated.Value(0), opacity: new Animated.Value(0) },
    descendants: [...Array(12)].map(() => ({
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    })),
  }).current;

  // Particle animations
  const particles = useRef(
    [...Array(6)].map(() => ({
      translateY: new Animated.Value(0),
      opacity: new Animated.Value(0),
    })),
  ).current;

  // Profile card animation
  const cardSlide = useRef(new Animated.Value(100)).current;
  const cardRotate = useRef(new Animated.Value(0)).current;

  // Connection animation
  const connectionWidth = useRef(new Animated.Value(0)).current;
  const sparkTravel = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reset all animations
    resetAnimations();

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
      animateOrganicTree();
    } else if (screens[currentIndex].visual === "profile") {
      animateProfileCard();
    } else if (screens[currentIndex].visual === "connect") {
      animateConnection();
    }
  }, [currentIndex]);

  const resetAnimations = () => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.8);
    slideAnim.setValue(50);
    trunkGrowth.setValue(0);
    leftBranchGrowth.setValue(0);
    rightBranchGrowth.setValue(0);
    Object.values(nodeAnimations).forEach((node) => {
      if (node.scale) {
        node.scale.setValue(0);
        node.opacity.setValue(0);
      } else if (Array.isArray(node)) {
        node.forEach((n) => {
          n.scale.setValue(0);
          n.opacity.setValue(0);
        });
      }
    });
  };

  const animateOrganicTree = () => {
    // 1. Root node appears with pulse
    Animated.sequence([
      Animated.parallel([
        Animated.spring(nodeAnimations.root.scale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          delay: 500,
          useNativeDriver: true,
        }),
        Animated.timing(nodeAnimations.root.opacity, {
          toValue: 1,
          duration: 300,
          delay: 500,
          useNativeDriver: true,
        }),
      ]),
      // 2. Pulse effect on root
      Animated.loop(
        Animated.sequence([
          Animated.timing(rootPulse, {
            toValue: 1.1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(rootPulse, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
      ),
    ]).start();

    // 3. Trunk grows upward
    setTimeout(() => {
      Animated.timing(trunkGrowth, {
        toValue: 1,
        duration: 800,
        useNativeDriver: false,
      }).start();
    }, 800);

    // 4. Branches split and grow
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(leftBranchGrowth, {
          toValue: 1,
          duration: 700,
          useNativeDriver: false,
        }),
        Animated.timing(rightBranchGrowth, {
          toValue: 1,
          duration: 700,
          delay: 100,
          useNativeDriver: false,
        }),
      ]).start();
    }, 1400);

    // 5. Main branch nodes bloom
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(nodeAnimations.left.scale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(nodeAnimations.left.opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(nodeAnimations.right.scale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          delay: 100,
          useNativeDriver: true,
        }),
        Animated.timing(nodeAnimations.right.opacity, {
          toValue: 1,
          duration: 300,
          delay: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }, 2000);

    // 6. Descendant nodes appear in clusters
    setTimeout(() => {
      nodeAnimations.descendants.forEach((node, index) => {
        const delay = index * 50;
        Animated.parallel([
          Animated.spring(node.scale, {
            toValue: 0.7,
            friction: 8,
            tension: 40,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(node.opacity, {
            toValue: 0.4,
            duration: 300,
            delay,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 2400);

    // 7. Floating particles
    setTimeout(() => {
      particles.forEach((particle, index) => {
        Animated.loop(
          Animated.sequence([
            Animated.parallel([
              Animated.timing(particle.translateY, {
                toValue: -100,
                duration: 4000,
                delay: index * 500,
                useNativeDriver: true,
              }),
              Animated.sequence([
                Animated.timing(particle.opacity, {
                  toValue: 0.6,
                  duration: 1000,
                  useNativeDriver: true,
                }),
                Animated.timing(particle.opacity, {
                  toValue: 0,
                  duration: 3000,
                  useNativeDriver: true,
                }),
              ]),
            ]),
            Animated.parallel([
              Animated.timing(particle.translateY, {
                toValue: 0,
                duration: 0,
                useNativeDriver: true,
              }),
              Animated.timing(particle.opacity, {
                toValue: 0,
                duration: 0,
                useNativeDriver: true,
              }),
            ]),
          ]),
        ).start();
      });
    }, 2800);
  };

  const animateProfileCard = () => {
    cardSlide.setValue(100);
    cardRotate.setValue(0);

    Animated.sequence([
      Animated.spring(cardSlide, {
        toValue: 0,
        friction: 8,
        tension: 40,
        delay: 400,
        useNativeDriver: true,
      }),
      Animated.timing(cardRotate, {
        toValue: 1,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateConnection = () => {
    connectionWidth.setValue(0);
    sparkTravel.setValue(0);

    Animated.sequence([
      Animated.timing(connectionWidth, {
        toValue: 1,
        duration: 1000,
        delay: 600,
        useNativeDriver: false,
      }),
      Animated.timing(sparkTravel, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
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

  const renderOrganicTree = () => {
    return (
      <View style={styles.treeContainer}>
        {/* Alqefari Logo */}
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

        {/* SVG Tree Structure */}
        <Svg width={300} height={280} style={styles.svgTree}>
          <Defs>
            <SvgLinearGradient
              id="trunkGradient"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <Stop
                offset="0%"
                stopColor={colors.container}
                stopOpacity="0.8"
              />
              <Stop
                offset="100%"
                stopColor={colors.primary}
                stopOpacity="0.6"
              />
            </SvgLinearGradient>
          </Defs>

          {/* Animated trunk */}
          <AnimatedPath
            d="M 150,180 Q 150,140 150,120"
            stroke="url(#trunkGradient)"
            strokeWidth="3"
            fill="none"
            strokeDasharray="60"
            strokeDashoffset={trunkGrowth.interpolate({
              inputRange: [0, 1],
              outputRange: [60, 0],
            })}
          />

          {/* Left branch - curved */}
          <AnimatedPath
            d="M 150,120 Q 120,100 90,90"
            stroke={colors.secondary}
            strokeWidth="2.5"
            fill="none"
            strokeDasharray="70"
            strokeDashoffset={leftBranchGrowth.interpolate({
              inputRange: [0, 1],
              outputRange: [70, 0],
            })}
            opacity={0.8}
          />

          {/* Right branch - curved */}
          <AnimatedPath
            d="M 150,120 Q 180,100 210,90"
            stroke={colors.secondary}
            strokeWidth="2.5"
            fill="none"
            strokeDasharray="70"
            strokeDashoffset={rightBranchGrowth.interpolate({
              inputRange: [0, 1],
              outputRange: [70, 0],
            })}
            opacity={0.8}
          />

          {/* Sub-branches */}
          {leftBranchGrowth && (
            <>
              <AnimatedPath
                d="M 90,90 Q 80,75 70,70"
                stroke={colors.container}
                strokeWidth="1.5"
                fill="none"
                opacity={leftBranchGrowth.interpolate({
                  inputRange: [0.5, 1],
                  outputRange: [0, 0.5],
                })}
              />
              <AnimatedPath
                d="M 90,90 Q 90,75 90,70"
                stroke={colors.container}
                strokeWidth="1.5"
                fill="none"
                opacity={leftBranchGrowth.interpolate({
                  inputRange: [0.5, 1],
                  outputRange: [0, 0.5],
                })}
              />
            </>
          )}
        </Svg>

        {/* Root Node - سليمان */}
        <Animated.View
          style={[
            styles.rootNode,
            {
              opacity: nodeAnimations.root.opacity,
              transform: [
                {
                  scale: Animated.multiply(
                    nodeAnimations.root.scale,
                    rootPulse,
                  ),
                },
              ],
            },
          ]}
        >
          <Text style={styles.rootText}>سليمان</Text>
        </Animated.View>

        {/* Left Branch - جربوع */}
        <Animated.View
          style={[
            styles.leftBranchNode,
            {
              opacity: nodeAnimations.left.opacity,
              transform: [{ scale: nodeAnimations.left.scale }],
            },
          ]}
        >
          <Text style={styles.branchText}>جربوع</Text>
        </Animated.View>

        {/* Right Branch - عبدالعزيز */}
        <Animated.View
          style={[
            styles.rightBranchNode,
            {
              opacity: nodeAnimations.right.opacity,
              transform: [{ scale: nodeAnimations.right.scale }],
            },
          ]}
        >
          <Text style={styles.branchText}>عبدالعزيز</Text>
        </Animated.View>

        {/* Descendant nodes - clustered naturally */}
        {nodeAnimations.descendants.slice(0, 5).map((node, index) => (
          <Animated.View
            key={`left-${index}`}
            style={[
              styles.descendantNode,
              {
                left: 50 + index * 15,
                top: 50 - index * 5,
                opacity: node.opacity,
                transform: [{ scale: node.scale }],
              },
            ]}
          />
        ))}

        {nodeAnimations.descendants.slice(5, 12).map((node, index) => (
          <Animated.View
            key={`right-${index}`}
            style={[
              styles.descendantNode,
              {
                right: 50 + index * 15,
                top: 50 - index * 5,
                opacity: node.opacity,
                transform: [{ scale: node.scale }],
              },
            ]}
          />
        ))}

        {/* Floating particles */}
        {particles.map((particle, index) => (
          <Animated.View
            key={index}
            style={[
              styles.particle,
              {
                left: 50 + Math.random() * 200,
                bottom: 20 + Math.random() * 50,
                opacity: particle.opacity,
                transform: [{ translateY: particle.translateY }],
              },
            ]}
          />
        ))}
      </View>
    );
  };

  const renderProfileVisualization = () => {
    const rotateInterpolate = cardRotate.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "5deg"],
    });

    return (
      <Animated.View
        style={[
          styles.profileContainer,
          {
            transform: [
              { translateY: cardSlide },
              { rotate: rotateInterpolate },
            ],
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
          <View style={styles.profileDivider} />
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

          <Animated.View style={[styles.connectionLine, { width: lineWidth }]}>
            <View style={styles.connectionGradient} />
          </Animated.View>

          <Animated.View
            style={[
              styles.sparkDot,
              {
                opacity: sparkTravel,
                transform: [
                  {
                    translateX: sparkTravel.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 180],
                    }),
                  },
                ],
              },
            ]}
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
          style={[
            styles.connectSuccess,
            {
              opacity: sparkTravel.interpolate({
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
              {screen.visual === "tree" && renderOrganicTree()}
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
    height: 340,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },

  // Organic Tree
  treeContainer: {
    width: 300,
    height: 340,
    position: "relative",
    alignItems: "center",
  },
  logoAtTop: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    zIndex: 2,
  },
  treeLogo: {
    width: 50,
    height: 50,
    opacity: 0.8,
  },
  svgTree: {
    position: "absolute",
    top: 40,
  },
  rootNode: {
    position: "absolute",
    top: 160,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 3,
    borderColor: colors.gold + "40",
  },
  rootText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.white,
    fontFamily: "SF Arabic",
  },
  leftBranchNode: {
    position: "absolute",
    top: 100,
    left: 60,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.secondary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  rightBranchNode: {
    position: "absolute",
    top: 100,
    right: 60,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.secondary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  branchText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.white,
    fontFamily: "SF Arabic",
  },
  descendantNode: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.container + "50",
    borderWidth: 1.5,
    borderColor: colors.container + "30",
  },
  particle: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gold,
  },

  // Profile Card
  profileContainer: {
    width: 220,
    height: 280,
    justifyContent: "center",
    alignItems: "center",
  },
  profileCard: {
    width: 220,
    height: 280,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.container + "30",
  },
  saduBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: colors.primary,
    opacity: 0.15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  photoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
    borderWidth: 3,
    borderColor: colors.container + "50",
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 12,
    fontFamily: "SF Arabic",
  },
  lineageContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  lineageText: {
    fontSize: 15,
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  lineageConnector: {
    fontSize: 13,
    color: colors.textMuted,
    marginHorizontal: 5,
    fontFamily: "SF Arabic",
  },
  profileDivider: {
    width: 60,
    height: 1,
    backgroundColor: colors.container + "30",
    marginVertical: 12,
  },
  profileDate: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
  },

  // Connection
  connectContainer: {
    width: 280,
    height: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    height: 52,
    width: 260,
    backgroundColor: colors.white,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    borderWidth: 1.5,
    borderColor: colors.container + "30",
    marginBottom: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchText: {
    marginLeft: 12,
    fontSize: 16,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
  },
  connectionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: 260,
    height: 80,
    marginBottom: 20,
  },
  profileNode: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  profileNodeRight: {
    position: "absolute",
    right: 0,
  },
  connectionLine: {
    position: "absolute",
    left: 64,
    height: 3,
    backgroundColor: colors.secondary + "30",
    borderRadius: 1.5,
  },
  connectionGradient: {
    flex: 1,
    backgroundColor: colors.secondary,
    opacity: 0.5,
  },
  sparkDot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.gold,
    left: 58,
    zIndex: 4,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  connectSuccess: {
    fontSize: 16,
    color: colors.primary,
    fontFamily: "SF Arabic",
    fontWeight: "600",
    marginTop: 8,
  },

  // Text Section
  textSection: {
    alignItems: "center",
    marginBottom: 20,
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

  // Button
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
