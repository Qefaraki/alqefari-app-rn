import React, { useMemo, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Animated,
} from "react-native";
import {
  Canvas,
  Circle,
  Group,
  RadialGradient,
  vec,
  useValue,
  useComputedValue,
  Easing,
  useLoop,
  runSpring,
  runTiming,
  mix,
  interpolate,
} from "@shopify/react-native-skia";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Parse SVG path to extract points for constellation
const extractLogoPoints = () => {
  const points = [];
  const centerX = SCREEN_WIDTH / 2;
  const centerY = SCREEN_HEIGHT * 0.35;

  // Main circle outline (hollow)
  const numCirclePoints = 45;
  const radius = 35;
  for (let i = 0; i < numCirclePoints; i++) {
    const angle = (i / numCirclePoints) * Math.PI * 2;
    points.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      size: 1.8 + Math.random() * 0.7,
      brightness: 0.8 + Math.random() * 0.2,
      delay: i * 20,
      group: "logo",
    });
  }

  // Top vertical line (detached)
  for (let i = 0; i < 8; i++) {
    points.push({
      x: centerX + (Math.random() - 0.5) * 2,
      y: centerY - radius - 10 - i * 3,
      size: 1.5 + Math.random() * 0.5,
      brightness: 0.7 + Math.random() * 0.3,
      delay: 900 + i * 30,
      group: "logo",
    });
  }

  // Right horizontal line (detached)
  for (let i = 0; i < 8; i++) {
    points.push({
      x: centerX + radius + 10 + i * 3,
      y: centerY + (Math.random() - 0.5) * 2,
      size: 1.5 + Math.random() * 0.5,
      brightness: 0.7 + Math.random() * 0.3,
      delay: 1140 + i * 30,
      group: "logo",
    });
  }

  return points;
};

// Generate Arabic text constellation points
const generateTextConstellation = (text, baseX, baseY, scale = 1) => {
  const points = [];

  // Simplified dot patterns for Arabic letters
  const patterns = {
    س: {
      // Seen
      dots: [
        [0, 0],
        [3, 0],
        [6, 0],
        [9, 0],
        [12, 0],
        [0, -3],
        [3, -4],
        [6, -4],
        [9, -4],
        [12, -3],
        [0, -6],
        [12, -6],
      ],
    },
    ل: {
      // Lam
      dots: [
        [3, 0],
        [3, -3],
        [3, -6],
        [3, -9],
        [3, -12],
        [2, -12],
        [4, -12],
      ],
    },
    ي: {
      // Ya
      dots: [
        [0, 0],
        [3, 0],
        [6, 0],
        [9, 0],
        [0, -3],
        [9, -3],
        [0, -6],
        [3, -6],
        [6, -6],
        [9, -6],
        [3, -9],
        [6, -9],
      ],
    },
    م: {
      // Meem
      dots: [
        [0, 0],
        [3, 0],
        [6, 0],
        [0, -3],
        [3, -4],
        [6, -3],
        [0, -6],
        [6, -6],
        [3, -9],
      ],
    },
    ا: {
      // Alef
      dots: [
        [2, 0],
        [2, -3],
        [2, -6],
        [2, -9],
        [2, -12],
      ],
    },
    ن: {
      // Noon
      dots: [
        [0, 0],
        [3, 0],
        [6, 0],
        [0, -3],
        [6, -3],
        [0, -6],
        [6, -6],
        [3, -9],
      ],
    },
    ع: {
      // Ain
      dots: [
        [0, 0],
        [3, 0],
        [6, 0],
        [9, 0],
        [0, -3],
        [9, -3],
        [0, -6],
        [3, -6],
        [6, -6],
        [9, -6],
        [9, -9],
      ],
    },
    ب: {
      // Ba
      dots: [
        [0, 0],
        [3, 0],
        [6, 0],
        [9, 0],
        [0, -3],
        [9, -3],
        [4, -6],
      ],
    },
    د: {
      // Dal
      dots: [
        [0, 0],
        [3, 0],
        [6, 0],
        [6, -3],
        [6, -6],
        [3, -6],
        [0, -6],
      ],
    },
    ز: {
      // Zay
      dots: [
        [0, 0],
        [3, 0],
        [6, 0],
        [6, -3],
        [6, -6],
        [3, -6],
        [0, -6],
        [3, -9],
      ],
    },
    ج: {
      // Jeem
      dots: [
        [0, 0],
        [3, 0],
        [6, 0],
        [0, -3],
        [6, -3],
        [0, -6],
        [3, -6],
        [6, -6],
        [3, -9],
      ],
    },
    ر: {
      // Ra
      dots: [
        [0, 0],
        [3, 0],
        [6, 0],
        [0, -3],
        [0, -6],
        [3, -6],
      ],
    },
    و: {
      // Waw
      dots: [
        [0, 0],
        [3, 0],
        [6, 0],
        [0, -3],
        [6, -3],
        [0, -6],
        [3, -6],
        [6, -6],
        [3, -9],
      ],
    },
  };

  let offsetX = 0;
  const chars = text.split("");

  chars.forEach((char, charIndex) => {
    const pattern = patterns[char];
    if (pattern) {
      pattern.dots.forEach(([dx, dy], i) => {
        points.push({
          x: baseX + (offsetX + dx * 2.5) * scale,
          y: baseY + dy * 2.5 * scale,
          size: 1.2 + Math.random() * 0.4,
          brightness: 0.7 + Math.random() * 0.2,
          delay: 2000 + charIndex * 150 + i * 15,
          group: "text",
        });
      });
      offsetX += 35;
    }
  });

  return points;
};

// Generate ambient starfield
const generateAmbientStars = (count = 80) => {
  return Array.from({ length: count }, () => ({
    x: Math.random() * SCREEN_WIDTH,
    y: Math.random() * SCREEN_HEIGHT * 0.7,
    size: Math.random() * 1.2 + 0.3,
    brightness: Math.random() * 0.4 + 0.1,
    delay: Math.random() * 1000,
    group: "ambient",
  }));
};

// Star Component with Skia animations
const Star = ({ star, index, globalProgress }) => {
  // Individual star appearance animation
  const appearDelay = star.delay / 5000; // Normalize to 0-1
  const starProgress = useComputedValue(() => {
    const p = globalProgress.current;
    const start = appearDelay;
    const end = Math.min(start + 0.2, 1);
    return interpolate(p, [start, end], [0, 1], "clamp");
  }, [globalProgress]);

  // Twinkle animation (continuous loop)
  const twinkle = useLoop({
    duration: 2000 + (index % 3) * 1000,
    easing: Easing.inOut(Easing.ease),
  });

  // Compute final opacity
  const opacity = useComputedValue(() => {
    const baseOpacity = star.brightness * starProgress.current;
    const twinkleEffect = mix(twinkle.current, 0.7, 1);
    return baseOpacity * twinkleEffect;
  }, [starProgress, twinkle]);

  // Compute scale for appearance
  const scale = useComputedValue(() => {
    return mix(starProgress.current, 0, 1);
  }, [starProgress]);

  // Star color based on group
  const color = star.group === "ambient" ? "#F9F7F3" : "#D1BBA3";

  return (
    <Group transform={[{ scale }]}>
      <Circle cx={star.x} cy={star.y} r={star.size * 2} opacity={opacity * 0.3}>
        <RadialGradient
          c={vec(star.x, star.y)}
          r={star.size * 4}
          colors={[color, "transparent"]}
        />
      </Circle>
      <Circle
        cx={star.x}
        cy={star.y}
        r={star.size}
        color={color}
        opacity={opacity}
      />
    </Group>
  );
};

export default function SkiaStarfieldScreen({ navigation, setIsGuest }) {
  // Master animation progress (0 to 1 over 5 seconds)
  const globalProgress = useValue(0);

  // Text and button animations (using React Native Animated)
  const [showText, setShowText] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const textOpacity = React.useRef(new Animated.Value(0)).current;
  const buttonOpacity = React.useRef(new Animated.Value(0)).current;

  // Pre-calculate all star positions
  const stars = useMemo(() => {
    const ambient = generateAmbientStars(80);
    const logo = extractLogoPoints();
    const sulaiman = generateTextConstellation(
      "سليمان",
      SCREEN_WIDTH / 2 - 50,
      SCREEN_HEIGHT * 0.25,
      1.1,
    );
    const abdulaziz = generateTextConstellation(
      "عبدالعزيز",
      SCREEN_WIDTH / 2 - 140,
      SCREEN_HEIGHT * 0.48,
      0.9,
    );
    const jarboo = generateTextConstellation(
      "جربوع",
      SCREEN_WIDTH / 2 + 30,
      SCREEN_HEIGHT * 0.48,
      0.9,
    );

    return [...ambient, ...logo, ...sulaiman, ...abdulaziz, ...jarboo];
  }, []);

  useEffect(() => {
    // Run main animation sequence
    runTiming(globalProgress, 1, {
      duration: 5000,
      easing: Easing.out(Easing.cubic),
    });

    // Animate text after constellation
    setTimeout(() => {
      setShowText(true);
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }, 5500);

    // Animate button
    setTimeout(() => {
      setShowButton(true);
      Animated.spring(buttonOpacity, {
        toValue: 1,
        damping: 15,
        stiffness: 100,
        useNativeDriver: true,
      }).start();
    }, 6000);
  }, []);

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.replace("PhoneAuth");
  };

  const handleBrowseAsGuest = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsGuest(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background gradient */}
      <LinearGradient
        colors={["#242121", "#1a1818", "#0f0e0e", "#1a1818", "#242121"]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        locations={[0, 0.3, 0.5, 0.7, 1]}
      />

      {/* Skia Canvas for all stars */}
      <Canvas style={StyleSheet.absoluteFillObject}>
        {stars.map((star, index) => (
          <Star
            key={index}
            star={star}
            index={index}
            globalProgress={globalProgress}
          />
        ))}
      </Canvas>

      {/* Guest link */}
      <View style={styles.guestLinkContainer}>
        <TouchableOpacity onPress={handleBrowseAsGuest}>
          <Text style={styles.guestLink}>تصفح كضيف</Text>
        </TouchableOpacity>
      </View>

      {/* Text content with React Native animation */}
      {showText && (
        <Animated.View style={[styles.textContainer, { opacity: textOpacity }]}>
          <Text style={styles.headline}>لكل عائلة عظيمة حكاية.</Text>
          <Text style={styles.subtitle}>وهذه حكاية القفاري.</Text>
        </Animated.View>
      )}

      {/* CTA Button with React Native animation */}
      {showButton && (
        <Animated.View
          style={[styles.buttonContainer, { opacity: buttonOpacity }]}
        >
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleStart}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#A13333", "#8A2B2B"]}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.ctaButtonText}>ابدأ الآن</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Page indicators */}
          <View style={styles.dotsContainer}>
            <View style={[styles.dot, styles.activeDot]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#242121",
  },
  guestLinkContainer: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
  },
  guestLink: {
    fontSize: 13,
    color: "#F9F7F340",
    fontFamily: "System",
    fontWeight: "400",
  },
  textContainer: {
    position: "absolute",
    bottom: 160,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 30,
  },
  headline: {
    fontSize: 30,
    fontWeight: "700",
    fontFamily: "System",
    color: "#F9F7F3",
    marginBottom: 10,
    letterSpacing: 0.8,
    textAlign: "center",
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "400",
    fontFamily: "System",
    color: "#F9F7F3CC",
    letterSpacing: 0.5,
    textAlign: "center",
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 50,
    left: 30,
    right: 30,
    alignItems: "center",
  },
  ctaButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
    width: "100%",
    maxWidth: 320,
    shadowColor: "#A13333",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaButtonText: {
    color: "#F9F7F3",
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "System",
    letterSpacing: 0.5,
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D1BBA320",
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: "#D1BBA3",
    shadowColor: "#D1BBA3",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
});
