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
} from "react-native";
import { Canvas, Circle, Group } from "@shopify/react-native-skia";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import MaskedView from "@react-native-masked-view/masked-view";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Create a dense starfield that will be masked by the logo
const createMaskedStarfield = () => {
  const points = [];
  const centerX = SCREEN_WIDTH / 2;
  const centerY = SCREEN_HEIGHT * 0.35;

  // Create a denser grid of stars in the logo area
  const logoWidth = 300; // Larger logo size
  const logoHeight = 300; // Larger logo size
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

// Create star constellations for ancestor names (masked versions)
const createNameStarfield = (width, height) => {
  const points = [];
  const density = 2; // Much denser star field for high fidelity

  for (let x = 0; x <= width; x += density) {
    for (let y = 0; y <= height; y += density) {
      // Keep almost all stars for maximum definition
      if (Math.random() > 0.85) continue; // Keep 85% of stars

      // Minimal jitter to maintain text clarity
      const jitterX = (Math.random() - 0.5) * density * 0.3;
      const jitterY = (Math.random() - 0.5) * density * 0.3;

      // Smaller, more uniform star sizes for text readability
      let size;
      const rand = Math.random();
      if (rand < 0.05) {
        size = 1.0; // Very few bright stars
      } else if (rand < 0.25) {
        size = 0.7; // Some medium stars
      } else {
        size = 0.4; // Mostly tiny stars for definition
      }

      points.push({
        x: x + jitterX,
        y: y + jitterY,
        size,
        brightness: 0.8 + Math.random() * 0.2, // Higher baseline brightness
        delay: Math.random() * 300,
        group: "name",
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

export default function OptimizedStarfieldScreenMasked({ navigation }) {
  const [animationTime, setAnimationTime] = useState(0);
  const animationRef = useRef();

  // Staged animations
  const logoFade = useRef(new Animated.Value(0)).current;
  const namesFade = useRef(new Animated.Value(0)).current;
  const backgroundStarsFade = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;

  const logoRotate = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.95)).current;

  // Drift animations for names (shooting star effect)
  const namesDrift = useRef(new Animated.Value(0)).current;

  // Memoize all stars
  const backgroundStars = useMemo(() => generateBackgroundStars(80), []);
  const logoStars = useMemo(() => createMaskedStarfield(), []);

  // Create stars for each name with higher resolution
  const sulimanStars = useMemo(() => createNameStarfield(250, 100), []);
  const abdulazizStars = useMemo(() => createNameStarfield(200, 80), []);
  const jarbooStars = useMemo(() => createNameStarfield(200, 80), []);

  useEffect(() => {
    // Staged animation sequence
    // Stage 1: Names appear early but ultra-subtle (immediately)
    Animated.timing(namesFade, {
      toValue: 0.15, // Ultra-subtle, barely visible
      duration: 2500,
      useNativeDriver: true,
    }).start();

    // Start slow drift animation for names
    Animated.loop(
      Animated.sequence([
        Animated.timing(namesDrift, {
          toValue: 1,
          duration: 30000, // Very slow 30-second drift
          useNativeDriver: true,
        }),
        Animated.timing(namesDrift, {
          toValue: 0,
          duration: 30000,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Stage 2: Logo fades in as the main focus (after 0.5s)
    setTimeout(() => {
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
    }, 500);

    // Stage 3: Background stars fade in (after 2s)
    setTimeout(() => {
      Animated.timing(backgroundStarsFade, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }).start();
    }, 2000);

    // Stage 4: Text fades in (after 3s total)
    setTimeout(() => {
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }).start();
    }, 3000);

    // Stage 5: Buttons fade in (after 4s total)
    setTimeout(() => {
      Animated.timing(buttonFade, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    }, 4000);

    // Start subtle logo rotation after initial animation
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoRotate, {
            toValue: 1,
            duration: 20000,
            useNativeDriver: true,
          }),
          Animated.timing(logoRotate, {
            toValue: 0,
            duration: 20000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }, 2000);

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
    namesFade,
    backgroundStarsFade,
    contentFade,
    buttonFade,
    logoScale,
    logoRotate,
    namesDrift,
  ]);

  const renderStars = useCallback((stars, time) => {
    return stars.map((star, index) => {
      const fadeInProgress = Math.min(1, (time * 1000 - star.delay) / 250); // Halved from 500 to 250 for 2x speed
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

      if (star.group === "name") {
        // Ultra-subtle name stars - barely visible unless you focus
        const twinkleSpeed = 0.3 + (index % 3) * 0.2; // Very slow twinkle
        const twinkleFactor = Math.sin(time * twinkleSpeed + index);

        // ULTRA LOW opacity - max 20%, typically 10-15%
        const baseOpacity = 0.1; // 10% base
        const twinkleRange = 0.05; // Only 5% variance
        const nameOpacity =
          fadeInProgress *
          (baseOpacity + (twinkleFactor + 1) * twinkleRange * 0.5);

        // Very subtle warm white, not beige - to blend with background
        const color = `rgba(249, 247, 243, ${Math.min(0.2, Math.max(0, nameOpacity))})`;

        // Smaller stars for subtlety
        return (
          <Circle
            key={index}
            cx={star.x}
            cy={star.y}
            r={star.size * 0.7} // Smaller stars
            color={color}
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

  const handleContinue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("PhoneAuth");
  }, [navigation]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("PhoneAuth");
  }, [navigation]);

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

      {/* Ancestor names as star constellations with PNG masks */}

      {/* سليمان - above logo */}
      {MaskedView && (
        <Animated.View
          style={[
            styles.sulimanContainer,
            {
              opacity: namesFade,
              transform: [
                {
                  translateX: namesDrift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 15], // Subtle rightward drift
                  }),
                },
                {
                  translateY: namesDrift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -8], // Slight upward drift
                  }),
                },
              ],
            },
          ]}
        >
          <MaskedView
            style={styles.nameMaskContainer}
            maskElement={
              <View style={styles.nameMaskWrapper}>
                <Image
                  source={require("../../../assets/star_names/suliman.png")}
                  style={styles.sulimanMask}
                  resizeMode="contain"
                />
              </View>
            }
          >
            <Canvas style={{ width: 250, height: 100 }}>
              {renderStars(sulimanStars, animationTime)}
            </Canvas>
          </MaskedView>
        </Animated.View>
      )}

      {/* عبدالعزيز - below left */}
      {MaskedView && (
        <Animated.View
          style={[
            styles.abdulazizContainer,
            {
              opacity: namesFade,
              transform: [
                {
                  translateX: namesDrift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -12], // Subtle leftward drift
                  }),
                },
                {
                  translateY: namesDrift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 10], // Slight downward drift
                  }),
                },
              ],
            },
          ]}
        >
          <MaskedView
            style={styles.nameMaskContainer}
            maskElement={
              <View style={styles.nameMaskWrapper}>
                <Image
                  source={require("../../../assets/star_names/abdulaziz.png")}
                  style={styles.sonNameMask}
                  resizeMode="contain"
                />
              </View>
            }
          >
            <Canvas style={{ width: 200, height: 80 }}>
              {renderStars(abdulazizStars, animationTime)}
            </Canvas>
          </MaskedView>
        </Animated.View>
      )}

      {/* جربوع - below right */}
      {MaskedView && (
        <Animated.View
          style={[
            styles.jarbooContainer,
            {
              opacity: namesFade,
              transform: [
                {
                  translateX: namesDrift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 20], // Subtle rightward drift
                  }),
                },
                {
                  translateY: namesDrift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 12], // Slight downward drift
                  }),
                },
              ],
            },
          ]}
        >
          <MaskedView
            style={styles.nameMaskContainer}
            maskElement={
              <View style={styles.nameMaskWrapper}>
                <Image
                  source={require("../../../assets/star_names/jarboo.png")}
                  style={styles.sonNameMask}
                  resizeMode="contain"
                />
              </View>
            }
          >
            <Canvas style={{ width: 200, height: 80 }}>
              {renderStars(jarbooStars, animationTime)}
            </Canvas>
          </MaskedView>
        </Animated.View>
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
          },
        ]}
      >
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>ابدأ الرحلة</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipButtonText}>تخطي</Text>
        </TouchableOpacity>
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
    width: 300,
    height: 300,
    marginTop: -(SCREEN_HEIGHT * 0.35),
  },
  logoContainer: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.35 - 150,
    left: SCREEN_WIDTH / 2 - 150,
    width: 300,
    height: 300,
    opacity: 0.2,
  },
  logoImage: {
    width: "100%",
    height: "100%",
    tintColor: "#F9F7F3",
  },
  content: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.65, // Moved lower
    width: SCREEN_WIDTH,
    alignItems: "center",
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    color: "#F9F7F3",
    fontFamily: "System", // Better for Arabic rendering
    marginBottom: 12,
    textAlign: "center",
    writingDirection: "rtl", // Right-to-left for Arabic
  },
  subtitle: {
    fontSize: 24,
    fontWeight: "400",
    color: "#F9F7F3",
    fontFamily: "System", // Better for Arabic rendering
    opacity: 0.95,
    textAlign: "center",
    writingDirection: "rtl", // Right-to-left for Arabic
  },
  buttonContainer: {
    position: "absolute",
    bottom: 50,
    width: SCREEN_WIDTH,
    paddingHorizontal: 32,
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
    fontWeight: "500",
    fontFamily: "SF Arabic",
    opacity: 0.7,
  },
  // Name constellation containers
  sulimanContainer: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.12, // Above logo
    left: SCREEN_WIDTH / 2 - 125,
    width: 250,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  abdulazizContainer: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.52, // Below logo, left side
    left: SCREEN_WIDTH / 2 - 200,
    width: 200,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  jarbooContainer: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.52, // Below logo, right side
    right: SCREEN_WIDTH / 2 - 200,
    width: 200,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  nameMaskContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  nameMaskWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  sulimanMask: {
    width: 250,
    height: 100,
  },
  sonNameMask: {
    width: 200,
    height: 80,
  },
});
