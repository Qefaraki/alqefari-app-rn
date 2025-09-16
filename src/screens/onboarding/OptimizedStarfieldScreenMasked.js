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

// Create Sadu geometric patterns as constellations
const createSaduConstellations = () => {
  const constellations = [];

  // Sadu Pattern 1: Diamond shape (top-left quadrant)
  const diamond = {
    centerX: SCREEN_WIDTH * 0.25,
    centerY: SCREEN_HEIGHT * 0.2,
    size: 60,
  };
  // Diamond vertices
  constellations.push(
    { x: diamond.centerX, y: diamond.centerY - diamond.size, isSadu: true }, // top
    { x: diamond.centerX + diamond.size, y: diamond.centerY, isSadu: true }, // right
    { x: diamond.centerX, y: diamond.centerY + diamond.size, isSadu: true }, // bottom
    { x: diamond.centerX - diamond.size, y: diamond.centerY, isSadu: true }, // left
    // Add connecting stars for subtle lines
    {
      x: diamond.centerX + diamond.size / 2,
      y: diamond.centerY - diamond.size / 2,
      isSadu: true,
    },
    {
      x: diamond.centerX + diamond.size / 2,
      y: diamond.centerY + diamond.size / 2,
      isSadu: true,
    },
    {
      x: diamond.centerX - diamond.size / 2,
      y: diamond.centerY + diamond.size / 2,
      isSadu: true,
    },
    {
      x: diamond.centerX - diamond.size / 2,
      y: diamond.centerY - diamond.size / 2,
      isSadu: true,
    },
  );

  // Sadu Pattern 2: Triangle (bottom-right quadrant)
  const triangle = {
    centerX: SCREEN_WIDTH * 0.75,
    centerY: SCREEN_HEIGHT * 0.8,
    size: 50,
  };
  // Triangle vertices and edges
  constellations.push(
    { x: triangle.centerX, y: triangle.centerY - triangle.size, isSadu: true }, // top
    {
      x: triangle.centerX - triangle.size,
      y: triangle.centerY + triangle.size,
      isSadu: true,
    }, // bottom-left
    {
      x: triangle.centerX + triangle.size,
      y: triangle.centerY + triangle.size,
      isSadu: true,
    }, // bottom-right
    // Edge stars
    {
      x: triangle.centerX - triangle.size / 2,
      y: triangle.centerY,
      isSadu: true,
    },
    {
      x: triangle.centerX + triangle.size / 2,
      y: triangle.centerY,
      isSadu: true,
    },
    {
      x: triangle.centerX,
      y: triangle.centerY + triangle.size / 2,
      isSadu: true,
    },
  );

  // Sadu Pattern 3: Zigzag pattern (middle-left)
  const zigzag = {
    startX: SCREEN_WIDTH * 0.15,
    startY: SCREEN_HEIGHT * 0.5,
    width: 80,
    height: 30,
  };
  constellations.push(
    { x: zigzag.startX, y: zigzag.startY, isSadu: true },
    {
      x: zigzag.startX + zigzag.width / 3,
      y: zigzag.startY - zigzag.height,
      isSadu: true,
    },
    {
      x: zigzag.startX + (zigzag.width * 2) / 3,
      y: zigzag.startY,
      isSadu: true,
    },
    {
      x: zigzag.startX + zigzag.width,
      y: zigzag.startY - zigzag.height,
      isSadu: true,
    },
  );

  return constellations;
};

// Generate background stars with layers for parallax
const generateBackgroundStars = () => {
  const stars = [];
  const saduStars = createSaduConstellations();

  // Add Sadu constellation stars first (they should look like regular stars)
  saduStars.forEach((saduStar) => {
    stars.push({
      x: saduStar.x,
      y: saduStar.y,
      size: 0.6, // Same size as small background stars
      brightness: 0.25, // Slightly brighter to be noticeable
      delay: Math.random() * 1000,
      group: "background",
      layer: 1,
      speed: 0.005,
      isSadu: true,
    });
  });

  // Layer 1: Far stars (smallest, slowest)
  for (let i = 0; i < 40; i++) {
    stars.push({
      x: Math.random() * SCREEN_WIDTH * 1.2 - SCREEN_WIDTH * 0.1, // Allow off-screen for wrapping
      y: Math.random() * SCREEN_HEIGHT * 1.2 - SCREEN_HEIGHT * 0.1,
      size: Math.random() * 0.4 + 0.3,
      brightness: Math.random() * 0.15 + 0.05,
      delay: Math.random() * 2000,
      group: "background",
      layer: 1,
      speed: 0.005, // Slowest movement
    });
  }

  // Layer 2: Middle stars (medium)
  for (let i = 0; i < 30; i++) {
    stars.push({
      x: Math.random() * SCREEN_WIDTH * 1.2 - SCREEN_WIDTH * 0.1,
      y: Math.random() * SCREEN_HEIGHT * 1.2 - SCREEN_HEIGHT * 0.1,
      size: Math.random() * 0.8 + 0.5,
      brightness: Math.random() * 0.25 + 0.1,
      delay: Math.random() * 2000,
      group: "background",
      layer: 2,
      speed: 0.01, // Medium speed
    });
  }

  // Layer 3: Near stars (largest, fastest)
  for (let i = 0; i < 20; i++) {
    stars.push({
      x: Math.random() * SCREEN_WIDTH * 1.2 - SCREEN_WIDTH * 0.1,
      y: Math.random() * SCREEN_HEIGHT * 1.2 - SCREEN_HEIGHT * 0.1,
      size: Math.random() * 1.2 + 0.8,
      brightness: Math.random() * 0.35 + 0.15,
      delay: Math.random() * 2000,
      group: "background",
      layer: 3,
      speed: 0.02, // Fastest movement
    });
  }

  return stars;
};

export default function OptimizedStarfieldScreenMasked({ navigation }) {
  const [animationTime, setAnimationTime] = useState(0);
  const animationRef = useRef();

  // Staged animations
  const logoFade = useRef(new Animated.Value(0)).current;
  const backgroundStarsFade = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;

  const logoRotate = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.95)).current;

  // Memoize all stars
  const backgroundStars = useMemo(() => generateBackgroundStars(), []);
  const logoStars = useMemo(() => createMaskedStarfield(), []);

  // Parallax animation state
  const [parallaxOffset, setParallaxOffset] = useState({ x: 0, y: 0 });

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

    // Animation frame with parallax
    let frameCount = 0;
    const animate = () => {
      frameCount++;
      const time = frameCount * 0.016;
      setAnimationTime(time);

      // Update parallax offset (drift from top-right to bottom-left)
      const cycleTime = 75; // 75 second loop
      const progress = (time % cycleTime) / cycleTime;
      setParallaxOffset({
        x: progress * SCREEN_WIDTH * 0.15, // Drift 15% of screen width
        y: progress * SCREEN_HEIGHT * 0.15, // Drift 15% of screen height
      });

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
  ]);

  const renderStars = useCallback((stars, time, offset = { x: 0, y: 0 }) => {
    return stars.flatMap((star, index) => {
      const fadeInProgress = Math.min(1, (time * 1000 - star.delay) / 500);
      if (fadeInProgress <= 0) return null;

      const twinkle = Math.sin(time * 2 + index * 0.5) * 0.2;
      const opacity = star.brightness * fadeInProgress * (1 + twinkle);

      // Apply parallax offset for background stars
      let x = star.x;
      let y = star.y;

      if (star.group === "background" && star.layer) {
        // Apply parallax based on layer speed
        x = star.x - offset.x * star.speed * 100;
        y = star.y - offset.y * star.speed * 100;

        // Wrap around screen edges
        x =
          (((x % (SCREEN_WIDTH * 1.2)) + SCREEN_WIDTH * 1.2) %
            (SCREEN_WIDTH * 1.2)) -
          SCREEN_WIDTH * 0.1;
        y =
          (((y % (SCREEN_HEIGHT * 1.2)) + SCREEN_HEIGHT * 1.2) %
            (SCREEN_HEIGHT * 1.2)) -
          SCREEN_HEIGHT * 0.1;
      }

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

        // Create multi-layer glow effect
        const glowElements = [];

        // Only add glow to some stars for performance
        if (index % 3 === 0) {
          // Outer glow - very subtle
          glowElements.push(
            <Circle
              key={`${index}-glow`}
              cx={star.x}
              cy={star.y}
              r={star.size * 2.5}
              color={`rgba(209, 187, 163, ${Math.min(0.05, Math.max(0, finalOpacity * 0.05))})`}
            />,
          );
        }

        // Main star
        glowElements.push(
          <Circle
            key={index}
            cx={star.x}
            cy={star.y}
            r={star.size}
            color={`rgba(249, 247, 243, ${Math.min(1, Math.max(0, finalOpacity))})`}
          />,
        );

        return glowElements;
      }

      return (
        <Circle
          key={index}
          cx={x}
          cy={y}
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
          {renderStars(backgroundStars, animationTime, parallaxOffset)}
        </Canvas>
      </Animated.View>

      {/* Outer Aura Glow - Layer 2 */}
      <Animated.View
        style={[
          styles.glowContainer,
          {
            opacity: logoFade.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.25], // Increased to 25% opacity for more visible glow
            }),
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={["#D1BBA3", "#D1BBA300"]} // Using hex transparency for smoother gradient
          locations={[0, 0.7]} // Concentrate glow in center
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0, y: 0 }}
          style={styles.glowGradient}
        />
      </Animated.View>

      {/* Logo stars with masking - Layer 1 with particle blur */}
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
          <Text style={styles.skipButtonText}>استكشف كضيف</Text>
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
  glowContainer: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.35 - 250,
    left: SCREEN_WIDTH / 2 - 250,
    width: 500,
    height: 500,
  },
  glowGradient: {
    flex: 1,
    borderRadius: 250,
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
    top: SCREEN_HEIGHT * 0.72, // Increased from 0.65 to create more space below logo
    width: SCREEN_WIDTH,
    alignItems: "center",
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    color: "#F9F7F3",
    fontFamily: "System",
    marginBottom: 12,
    textAlign: "center",
    writingDirection: "rtl",
  },
  subtitle: {
    fontSize: 24,
    fontWeight: "400",
    color: "#F9F7F3",
    fontFamily: "System",
    opacity: 0.95,
    textAlign: "center",
    writingDirection: "rtl",
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
    fontWeight: "400", // Regular font weight for secondary action
    fontFamily: "SF Arabic",
  },
});
