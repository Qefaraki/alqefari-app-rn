import React, {
  useMemo,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Animated,
  Image,
  Platform,
  AccessibilityInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Canvas, Circle, Group } from "@shopify/react-native-skia";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useStarData } from "../../contexts/StarDataContext";
// Gyroscope is optional - app works without it
let Gyroscope;
try {
  Gyroscope = require("expo-sensors").Gyroscope;
} catch (error) {
  console.log("Gyroscope not available - parallax effects disabled");
}
// SaduNightBackdrop now handled at navigator level
// Try to import MaskedView, but handle the case where it's not available
let MaskedView;
try {
  MaskedView = require("@react-native-masked-view/masked-view").default;
} catch (error) {
  console.warn("MaskedView not available, using fallback");
  MaskedView = null;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

// Create a dense starfield that will be masked by the logo
const createMaskedStarfield = () => {
  const points = [];
  const centerX = SCREEN_WIDTH / 2;
  const centerY = SCREEN_HEIGHT * 0.35;

  // Create a denser grid of stars in the logo area
  const logoWidth = 400; // Extra large logo size
  const logoHeight = 400; // Extra large logo size
  const density = 6; // Closer star spacing for better definition

  for (let x = -logoWidth / 2; x <= logoWidth / 2; x += density) {
    for (let y = -logoHeight / 2; y <= logoHeight / 2; y += density) {
      // Keep most stars for better logo definition
      if (Math.random() > 0.7) continue; // Keep 70% of stars

      // Small jitter to avoid grid look
      const jitterX = (Math.random() - 0.5) * density * 0.7;
      const jitterY = (Math.random() - 0.5) * density * 0.7;

      // Proper star sizes (small points, not big circles)
      let size;
      const rand = Math.random();
      if (rand < 0.1) {
        size = 1.5; // Few bright stars
      } else if (rand < 0.3) {
        size = 1.0; // Some medium stars
      } else {
        size = 0.6; // Mostly tiny stars (points)
      }

      points.push({
        x: centerX + x + jitterX,
        y: centerY + y + jitterY,
        size,
        brightness: 0.6 + Math.random() * 0.4,
        delay: Math.random() * 100, // 2x faster for snappier twinkle
        group: "logo",
      });
    }
  }

  return points;
};

// Background stars generation removed - now using SaduNightBackdrop component

export default function OnboardingScreen({
  navigation,
  setIsGuest,
  onNavigate,
  hideLogo = false,
}) {
  const [animationTime, setAnimationTime] = useState(0);
  const animationRef = useRef();
  const insets = useSafeAreaInsets();
  const { logoStars } = useStarData();
  const [reduceMotion, setReduceMotion] = useState(false);

  // Parallax state
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const parallaxX = useRef(new Animated.Value(0)).current;
  const parallaxY = useRef(new Animated.Value(0)).current;

  // Staged animations
  const logoFade = useRef(new Animated.Value(0)).current;
  const backgroundStarsFade = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;

  const logoRotate = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.95)).current;
  const logoBreath = useRef(new Animated.Value(1)).current;

  // Button scale animations for haptic feedback
  const primaryButtonScale = useRef(new Animated.Value(1)).current;
  const secondaryButtonScale = useRef(new Animated.Value(1)).current;

  // Memoize all stars
  // backgroundStars removed - now using SaduNightBackdrop component
  // Now using shared logoStars from context

  // Check for reduce motion preference
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((isEnabled) => {
      setReduceMotion(isEnabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (isEnabled) => setReduceMotion(isEnabled),
    );

    return () => subscription?.remove();
  }, []);

  // Gyroscope for parallax effect (optional - not available in simulator)
  useEffect(() => {
    if (!reduceMotion) {
      try {
        // Check if Gyroscope is available (not in simulator)
        if (Gyroscope && Gyroscope.setUpdateInterval) {
          Gyroscope.setUpdateInterval(100);
          const subscription = Gyroscope.addListener((data) => {
            // Smooth the values and limit range
            const smoothX = Math.max(-1, Math.min(1, data.y * 0.5)); // device tilt left/right
            const smoothY = Math.max(-1, Math.min(1, data.x * 0.5)); // device tilt up/down

            Animated.parallel([
              Animated.spring(parallaxX, {
                toValue: smoothX * 15, // 15px max movement
                useNativeDriver: true,
                tension: 20,
                friction: 10,
              }),
              Animated.spring(parallaxY, {
                toValue: smoothY * 15,
                useNativeDriver: true,
                tension: 20,
                friction: 10,
              }),
            ]).start();
          });

          return () => subscription?.remove();
        }
      } catch (error) {
        // Gyroscope not available (simulator or web)
        console.log("Gyroscope not available - parallax disabled");
      }
    }
  }, [reduceMotion]);

  useEffect(() => {
    // Staged animation sequence
    // Stage 1: Logo appears almost instantly
    Animated.parallel([
      Animated.timing(logoFade, {
        toValue: 1,
        duration: 200, // Near instant as requested
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 40, // Smooth spring
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Start breathing animation after logo appears
    setTimeout(() => {
      if (!reduceMotion) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(logoBreath, {
              toValue: 1.015, // Much subtler (1.5% growth)
              duration: 4500, // Slower, more natural breathing
              useNativeDriver: true,
              easing: require("react-native").Easing.inOut(
                require("react-native").Easing.ease,
              ),
            }),
            Animated.timing(logoBreath, {
              toValue: 1, // Return to normal size (not smaller)
              duration: 4500,
              useNativeDriver: true,
              easing: require("react-native").Easing.inOut(
                require("react-native").Easing.ease,
              ),
            }),
          ]),
        ).start();
      }
    }, 1000);

    // Stage 2: Background stars fade in after logo has been seen (500ms after logo)
    setTimeout(() => {
      Animated.timing(backgroundStarsFade, {
        toValue: 0.56, // Reduced by 30% from 0.8
        duration: 800, // Faster fade
        useNativeDriver: true,
      }).start();
    }, 500); // Quicker transition

    // Stage 3: Text fades in while stars are appearing
    setTimeout(() => {
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }, 1000); // Overlap with stars

    // Stage 4: Buttons fade in last
    setTimeout(() => {
      Animated.timing(buttonFade, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }).start();
    }, 1800); // 2.5s total (was 3.5s)

    // Start subtle logo rotation after initial animation (unless reduce motion is on)
    if (!reduceMotion) {
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(logoRotate, {
              toValue: 1,
              duration: 25000,
              useNativeDriver: true,
              easing: require("react-native").Easing.inOut(
                require("react-native").Easing.ease,
              ),
            }),
            // Pause at end
            Animated.delay(2000),
            Animated.timing(logoRotate, {
              toValue: 0,
              duration: 25000,
              useNativeDriver: true,
              easing: require("react-native").Easing.inOut(
                require("react-native").Easing.ease,
              ),
            }),
            // Pause at start
            Animated.delay(2000),
          ]),
        ).start();
      }, 2000);
    }

    // Animation frame
    let frameCount = 0;
    const animate = () => {
      frameCount++;
      setAnimationTime(frameCount * 0.016);
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    logoFade,
    backgroundStarsFade,
    contentFade,
    buttonFade,
    logoScale,
    logoRotate,
    logoBreath,
    reduceMotion,
  ]);

  const renderStars = useCallback((stars, time) => {
    // Always render stars in OnboardingScreen

    return stars.map((star, index) => {
      const fadeInProgress = Math.min(1, (time * 1000 - star.delay) / 100);
      if (fadeInProgress <= 0) return null;

      // Use star's brightness property
      const twinkleSpeed = 0.8 + (index % 4) * 0.3;
      const twinkleFactor = Math.sin(time * twinkleSpeed + index);
      const logoOpacity =
        fadeInProgress * star.brightness * (0.5 + (twinkleFactor + 1) * 0.25);

      // Occasional bright flashes
      const flashChance = Math.sin(time * 2 + index * 3);
      const shouldFlash = flashChance > 0.995;
      const finalOpacity = shouldFlash ? 1 : logoOpacity;

      return (
        <Circle
          key={star.id}
          cx={star.x}
          cy={star.y}
          r={star.size}
          color={`rgba(249, 247, 243, ${Math.min(1, Math.max(0, finalOpacity))})`}
        />
      );
    });
  }, []);

  // Button press animations with micro-bounce
  const animateButtonPress = (scaleValue) => {
    Animated.sequence([
      Animated.spring(scaleValue, {
        toValue: 0.98, // Very subtle press
        useNativeDriver: true,
        tension: 200,
        friction: 5,
      }),
      Animated.spring(scaleValue, {
        toValue: 1.02, // Micro-bounce back
        useNativeDriver: true,
        tension: 150,
        friction: 4,
      }),
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 6,
      }),
    ]).start();
  };

  const handleContinue = useCallback(() => {
    animateButtonPress(primaryButtonScale);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Just navigate - no complex handoff needed

    if (onNavigate) {
      onNavigate("PhoneAuth");
      // Don't navigate here - let parent handle it
    } else {
      navigation.navigate("PhoneAuth");
    }
  }, [navigation, primaryButtonScale, onNavigate]);

  const handleExploreAsGuest = useCallback(() => {
    animateButtonPress(secondaryButtonScale);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Set guest mode to true
    if (setIsGuest) {
      setIsGuest(true);
    }
  }, [setIsGuest, secondaryButtonScale]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Star backdrop removed - handled at navigator level */}

      {/* Logo stars with masking - hide during transition */}
      {!hideLogo && MaskedView ? (
        <Animated.View
          style={[
            styles.maskedContainer,
            {
              opacity: logoFade,
              transform: [
                { scale: logoScale }, // Initial scale animation
                { scaleX: logoBreath }, // Breathing only applies after
                { scaleY: logoBreath },
                {
                  rotate: logoRotate.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "5deg"],
                  }),
                },
                { translateX: parallaxX },
                { translateY: parallaxY },
              ],
            },
          ]}
        >
          <MaskedView
            style={{ flex: 1 }}
            maskElement={
              <View style={styles.maskWrapper}>
                <Image
                  source={require("../../../assets/logo/STAR_LOGO.png")}
                  style={styles.maskImage}
                  resizeMode="contain"
                />
              </View>
            }
          >
            <Canvas style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
              {renderStars(logoStars, animationTime)}
            </Canvas>
          </MaskedView>
        </Animated.View>
      ) : !hideLogo ? (
        // Fallback if MaskedView not available
        <>
          <View style={styles.logoContainer} pointerEvents="none">
            <Image
              source={require("../../../assets/logo/STAR_LOGO.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              {
                transform: [
                  { translateX: Animated.multiply(parallaxX, 0.5) }, // Half parallax for depth
                  { translateY: Animated.multiply(parallaxY, 0.5) },
                ],
              },
            ]}
          >
            <Canvas style={StyleSheet.absoluteFillObject}>
              {renderStars(logoStars, animationTime)}
            </Canvas>
          </Animated.View>
        </>
      ) : null}

      {/* Bottom vignette gradient - placed behind content and buttons */}
      <LinearGradient
        colors={[
          "transparent",
          "rgba(0,0,0,0.3)",
          "rgba(0,0,0,0.7)",
          "rgba(0,0,0,0.9)",
        ]}
        locations={[0, 0.3, 0.7, 1]}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: SCREEN_HEIGHT * 0.25, // Bottom quarter of screen
          pointerEvents: "none", // Allow touches to pass through
        }}
      />

      {/* Content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentFade,
          },
        ]}
      >
        <View style={styles.contentInner}>
          <Text style={styles.title}>لكل عائلة عظيمة حكاية.</Text>
          <Text style={styles.subtitle}>وهذه حكاية القفاري.</Text>
        </View>
      </Animated.View>

      {/* Buttons - fade in last */}
      <Animated.View
        style={[
          styles.buttonContainer,
          {
            opacity: buttonFade,
            paddingBottom: Math.max(insets.bottom + 32, 56),
          },
        ]}
      >
        <View style={styles.buttonGroup}>
          <AnimatedTouchableOpacity
            onPress={handleContinue}
            activeOpacity={0.8}
            style={[
              styles.continueButton,
              {
                transform: [{ scale: primaryButtonScale }],
              },
            ]}
          >
            <Text style={styles.continueButtonText}>ابدأ الرحلة</Text>
          </AnimatedTouchableOpacity>

          <Animated.View
            style={[
              styles.skipButton,
              {
                transform: [{ scale: secondaryButtonScale }],
              },
            ]}
          >
            <TouchableOpacity
              onPress={handleExploreAsGuest}
              activeOpacity={0.7}
              style={{ width: "100%", alignItems: "center" }}
            >
              <Text style={styles.skipButtonText}>استكشف كضيف</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent", // Changed to transparent to show backdrop
  },
  maskedContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  maskWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  maskImage: {
    width: 400,
    height: 400,
    marginTop: -(SCREEN_HEIGHT * 0.35),
  },
  logoContainer: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.35 - 200,
    left: SCREEN_WIDTH / 2 - 200,
    width: 400,
    height: 400,
    opacity: 0.2,
  },
  logoImage: {
    width: "100%",
    height: "100%",
    tintColor: "#F9F7F3",
  },
  content: {
    position: "absolute",
    bottom: Platform.isPad ? 264 : 208,
    left: 0,
    right: 0,
    paddingHorizontal: Platform.isPad ? 48 : 24,
    alignItems: "center",
  },
  contentInner: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    color: "#F9F7F3",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
    letterSpacing: -0.5,
    lineHeight: 40,
    marginBottom: 8,
    textAlign: "center",
    writingDirection: "rtl",
  },
  subtitle: {
    fontSize: 24,
    fontWeight: "400",
    color: "#F9F7F3",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
    opacity: 0.8, // Design token 80%
    letterSpacing: -0.3,
    lineHeight: 32,
    textAlign: "center",
    writingDirection: "rtl",
  },
  buttonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Platform.isPad ? 48 : 24,
    paddingTop: 24,
    alignItems: "center",
  },
  buttonGroup: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  continueButton: {
    backgroundColor: "#A13333",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#A13333",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    width: "100%",
  },
  continueButtonText: {
    color: "#F9F7F3",
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  skipButton: {
    paddingVertical: 10,
    alignItems: "center",
  },
  skipButtonText: {
    color: "#D1BBA3",
    fontSize: 16,
    fontWeight: "400",
    fontFamily: "SF Arabic",
  },
});
