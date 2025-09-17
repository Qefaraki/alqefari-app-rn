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
// Try to import MaskedView, but handle the case where it's not available
let MaskedView;
try {
  MaskedView = require("@react-native-masked-view/masked-view").default;
} catch (error) {
  console.warn("MaskedView not available, using fallback");
  MaskedView = null;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

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
        delay: Math.random() * 800,
        group: "logo",
      });
    }
  }

  return points;
};

// Generate background stars
const generateBackgroundStars = (count) => {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * SCREEN_WIDTH,
      y: Math.random() * SCREEN_HEIGHT,
      size: Math.random() * 1.5 + 0.5,
      brightness: Math.random() * 0.3 + 0.1,
      delay: Math.random() * 2000,
      group: "background",
    });
  }
  return stars;
};

export default function OnboardingScreen({ navigation, setIsGuest }) {
  const [animationTime, setAnimationTime] = useState(0);
  const animationRef = useRef();
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);

  // Staged animations
  const logoFade = useRef(new Animated.Value(0)).current;
  const backgroundStarsFade = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;

  const logoRotate = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.95)).current;

  // Button scale animations for haptic feedback
  const primaryButtonScale = useRef(new Animated.Value(1)).current;
  const secondaryButtonScale = useRef(new Animated.Value(1)).current;

  // Memoize all stars
  const backgroundStars = useMemo(() => generateBackgroundStars(80), []);
  const logoStars = useMemo(() => createMaskedStarfield(), []);

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

  useEffect(() => {
    // Staged animation sequence
    // Stage 1: Logo fades in first
    Animated.parallel([
      Animated.timing(logoFade, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Stage 2: Background stars fade in (after 1s)
    setTimeout(() => {
      Animated.timing(backgroundStarsFade, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }).start();
    }, 1000);

    // Stage 3: Text fades in (after 2.5s total)
    setTimeout(() => {
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }).start();
    }, 2500);

    // Stage 4: Buttons fade in (after 3.5s total)
    setTimeout(() => {
      Animated.timing(buttonFade, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    }, 3500);

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
    reduceMotion,
  ]);

  const renderStars = useCallback((stars, time) => {
    return stars.map((star, index) => {
      const fadeInProgress = Math.min(1, (time * 1000 - star.delay) / 500);
      if (fadeInProgress <= 0) return null;

      const twinkle = Math.sin(time * 2 + index * 0.5) * 0.2;
      const opacity = star.brightness * fadeInProgress * (1 + twinkle);

      if (star.group === "logo") {
        // Slower, more gentle twinkle effect
        const twinkleSpeed = 0.8 + (index % 4) * 0.3; // Much slower speeds
        const twinkleFactor = Math.sin(time * twinkleSpeed + index);

        // Map sine wave (-1 to 1) to opacity (0.3 to 1.0)
        // Less dramatic range for more subtle twinkling
        const logoOpacity = fadeInProgress * (0.3 + (twinkleFactor + 1) * 0.35);

        // Occasional bright flashes (less frequent)
        const flashChance = Math.sin(time * 2 + index * 3);
        const shouldFlash = flashChance > 0.995;
        const finalOpacity = shouldFlash ? 1 : logoOpacity;

        return (
          <Circle
            key={index}
            cx={star.x}
            cy={star.y}
            r={star.size}
            color={`rgba(249, 247, 243, ${Math.min(1, Math.max(0, finalOpacity))})`}
          />
        );
      }

      return (
        <Circle
          key={index}
          cx={star.x}
          cy={star.y}
          r={star.size}
          color={`rgba(255, 255, 255, ${opacity})`}
        />
      );
    });
  }, []);

  // Button press animations
  const animateButtonPress = (scaleValue) => {
    Animated.sequence([
      Animated.spring(scaleValue, {
        toValue: 0.95,
        useNativeDriver: true,
        tension: 100,
        friction: 3,
      }),
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 40,
        friction: 3,
      }),
    ]).start();
  };

  const handleContinue = useCallback(() => {
    animateButtonPress(primaryButtonScale);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("PhoneAuth");
  }, [navigation, primaryButtonScale]);

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

      {/* Gradient background - much darker */}
      <LinearGradient
        colors={["#030303", "#0d0d19", "#030303"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Background starfield - fades in after logo */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { opacity: backgroundStarsFade },
        ]}
      >
        <Canvas style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
          {renderStars(backgroundStars, animationTime)}
        </Canvas>
      </Animated.View>

      {/* Logo stars with masking */}
      {MaskedView ? (
        <Animated.View
          style={[
            styles.maskedContainer,
            {
              opacity: logoFade,
              transform: [
                { scale: logoScale },
                {
                  rotate: logoRotate.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "5deg"],
                  }),
                },
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
      ) : (
        // Fallback if MaskedView not available
        <>
          <View style={styles.logoContainer} pointerEvents="none">
            <Image
              source={require("../../../assets/logo/STAR_LOGO.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Canvas style={StyleSheet.absoluteFillObject}>
            {renderStars(logoStars, animationTime)}
          </Canvas>
        </>
      )}

      {/* Content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentFade,
          },
        ]}
      >
        <Text style={[styles.title, { writingDirection: "rtl" }]}>
          لكل عائلة عظيمة حكاية.
        </Text>
        <Text style={[styles.subtitle, { writingDirection: "rtl" }]}>
          وهذه حكاية القفاري.
        </Text>
      </Animated.View>

      {/* Buttons - fade in last */}
      <Animated.View
        style={[
          styles.buttonContainer,
          {
            opacity: buttonFade,
            paddingBottom: Math.max(insets.bottom + 20, 40), // Use safe area
          },
        ]}
      >
        <Animated.View
          style={[
            styles.continueButton,
            {
              transform: [{ scale: primaryButtonScale }],
            },
          ]}
        >
          <TouchableOpacity
            onPress={handleContinue}
            activeOpacity={0.8}
            style={{ width: "100%", alignItems: "center" }}
          >
            <Text style={styles.continueButtonText}>ابدأ الرحلة</Text>
          </TouchableOpacity>
        </Animated.View>

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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
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
    top: SCREEN_HEIGHT * 0.65,
    width: SCREEN_WIDTH,
    alignItems: "center",
    paddingHorizontal: Platform.isPad ? 48 : 32, // Grid-based padding
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    color: "#F9F7F3",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
    letterSpacing: -0.5,
    lineHeight: 40,
    marginBottom: 12,
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
    bottom: 0, // Will use paddingBottom for safe area
    width: SCREEN_WIDTH,
    paddingHorizontal: Platform.isPad ? 48 : 32, // Grid-based padding
  },
  continueButton: {
    backgroundColor: "#A13333",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#A13333",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  continueButtonText: {
    color: "#F9F7F3",
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  skipButtonText: {
    color: "#D1BBA3",
    fontSize: 16,
    fontWeight: "400", // Regular weight for secondary action
    fontFamily: "SF Arabic",
  },
});
