import React, { useMemo, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Animated,
} from "react-native";
import { Canvas, Circle, Group } from "@shopify/react-native-skia";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Generate logo constellation points
const generateLogoConstellation = () => {
  const points = [];
  const centerX = SCREEN_WIDTH / 2;
  const centerY = SCREEN_HEIGHT * 0.35;

  // Main circle (hollow)
  const numCirclePoints = 40;
  const radius = 35;
  for (let i = 0; i < numCirclePoints; i++) {
    const angle = (i / numCirclePoints) * Math.PI * 2;
    points.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      size: 1.8 + Math.random() * 0.7,
      brightness: 0.85 + Math.random() * 0.15,
      delay: i * 30,
      group: "logo",
      twinkleOffset: Math.random() * Math.PI * 2,
    });
  }

  // Top line
  for (let i = 0; i < 7; i++) {
    points.push({
      x: centerX + (Math.random() - 0.5) * 2,
      y: centerY - radius - 10 - i * 3.5,
      size: 1.5 + Math.random() * 0.5,
      brightness: 0.8 + Math.random() * 0.2,
      delay: 1200 + i * 40,
      group: "logo",
      twinkleOffset: Math.random() * Math.PI * 2,
    });
  }

  // Right line
  for (let i = 0; i < 7; i++) {
    points.push({
      x: centerX + radius + 10 + i * 3.5,
      y: centerY + (Math.random() - 0.5) * 2,
      size: 1.5 + Math.random() * 0.5,
      brightness: 0.8 + Math.random() * 0.2,
      delay: 1480 + i * 40,
      group: "logo",
      twinkleOffset: Math.random() * Math.PI * 2,
    });
  }

  return points;
};

// Generate text constellation
const generateTextConstellation = (text, baseX, baseY, scale = 1) => {
  const points = [];
  const patterns = {
    س: [
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
    ل: [
      [2, 0],
      [2, -3],
      [2, -6],
      [2, -9],
      [1, -9],
      [3, -9],
    ],
    ي: [
      [0, 0],
      [3, 0],
      [6, 0],
      [0, -3],
      [6, -3],
      [0, -6],
      [3, -6],
      [6, -6],
      [3, -9],
      [6, -9],
    ],
    م: [
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
    ا: [
      [1.5, 0],
      [1.5, -3],
      [1.5, -6],
      [1.5, -9],
    ],
    ن: [
      [0, 0],
      [3, 0],
      [6, 0],
      [0, -3],
      [6, -3],
      [0, -6],
      [6, -6],
      [3, -9],
    ],
    ع: [
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
    ],
    ب: [
      [0, 0],
      [3, 0],
      [6, 0],
      [9, 0],
      [0, -3],
      [9, -3],
      [4.5, -6],
    ],
    د: [
      [0, 0],
      [3, 0],
      [6, 0],
      [6, -3],
      [3, -6],
      [0, -6],
    ],
    ز: [
      [0, 0],
      [3, 0],
      [6, 0],
      [6, -3],
      [3, -6],
      [0, -6],
      [3, -9],
    ],
    ج: [
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
    ر: [
      [0, 0],
      [3, 0],
      [0, -3],
      [0, -6],
    ],
    و: [
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
  };

  let offsetX = 0;
  text.split("").forEach((char, charIndex) => {
    const pattern = patterns[char] || [];
    pattern.forEach(([dx, dy], i) => {
      points.push({
        x: baseX + (offsetX + dx * 2.5) * scale,
        y: baseY + dy * 2.5 * scale,
        size: 1.1 + Math.random() * 0.4,
        brightness: 0.75 + Math.random() * 0.15,
        delay: 2500 + charIndex * 200 + i * 25,
        group: "text",
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    });
    offsetX += 32;
  });

  return points;
};

// Generate ambient stars
const generateAmbientStars = (count = 50) => {
  return Array.from({ length: count }, () => ({
    x: Math.random() * SCREEN_WIDTH,
    y: Math.random() * SCREEN_HEIGHT * 0.7,
    size: Math.random() * 1 + 0.3,
    brightness: Math.random() * 0.3 + 0.1,
    delay: Math.random() * 1000,
    group: "ambient",
    twinkleOffset: Math.random() * Math.PI * 2,
    twinkleSpeed: 2000 + Math.random() * 2000,
  }));
};

export default function BasicStarfieldScreen({ navigation, setIsGuest }) {
  const [progress, setProgress] = useState(0);
  const [showText, setShowText] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const textOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const animationRef = useRef();
  const startTime = useRef(Date.now());

  // Pre-calculate all stars
  const stars = useMemo(() => {
    const ambient = generateAmbientStars(50);
    const logo = generateLogoConstellation();
    const sulaiman = generateTextConstellation(
      "سليمان",
      SCREEN_WIDTH / 2 - 45,
      SCREEN_HEIGHT * 0.25,
      1.1,
    );
    const abdulaziz = generateTextConstellation(
      "عبدالعزيز",
      SCREEN_WIDTH / 2 - 135,
      SCREEN_HEIGHT * 0.48,
      0.85,
    );
    const jarboo = generateTextConstellation(
      "جربوع",
      SCREEN_WIDTH / 2 + 35,
      SCREEN_HEIGHT * 0.48,
      0.85,
    );

    return [...ambient, ...logo, ...sulaiman, ...abdulaziz, ...jarboo];
  }, []);

  useEffect(() => {
    // Animate progress from 0 to 1
    const animate = () => {
      const elapsed = Date.now() - startTime.current;
      const newProgress = Math.min(elapsed / 5000, 1);
      setProgress(newProgress);

      if (newProgress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    animationRef.current = requestAnimationFrame(animate);

    // Show text after constellation
    setTimeout(() => {
      setShowText(true);
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }, 5500);

    // Show button
    setTimeout(() => {
      setShowButton(true);
      Animated.spring(buttonOpacity, {
        toValue: 1,
        damping: 15,
        stiffness: 100,
        useNativeDriver: true,
      }).start();
    }, 6000);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.replace("PhoneAuth");
  };

  const handleBrowseAsGuest = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsGuest(true);
  };

  // Calculate twinkle for current time
  const currentTime = Date.now() / 1000;

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

      {/* Starfield Canvas */}
      <Canvas style={StyleSheet.absoluteFillObject}>
        {stars.map((star, index) => {
          const appearTime = star.delay / 5000;

          // Calculate star visibility
          let opacity = 0;
          let scale = 0;

          if (progress > appearTime) {
            const fadeInProgress = Math.min((progress - appearTime) / 0.2, 1);
            const twinkle =
              0.7 + 0.3 * Math.sin(currentTime * 2 + (star.twinkleOffset || 0));
            opacity = star.brightness * fadeInProgress * twinkle;
            scale = fadeInProgress;
          }

          const color = star.group === "ambient" ? "#F9F7F3" : "#D1BBA3";

          return (
            <Group key={index} transform={[{ scale }]}>
              {/* Glow effect */}
              <Circle
                cx={star.x}
                cy={star.y}
                r={star.size * 4}
                color={color}
                opacity={opacity * 0.2}
              />
              {/* Mid glow */}
              <Circle
                cx={star.x}
                cy={star.y}
                r={star.size * 2}
                color={color}
                opacity={opacity * 0.4}
              />
              {/* Star core */}
              <Circle
                cx={star.x}
                cy={star.y}
                r={star.size}
                color={color}
                opacity={opacity}
              />
            </Group>
          );
        })}
      </Canvas>

      {/* Guest link */}
      <View style={styles.guestLinkContainer}>
        <TouchableOpacity onPress={handleBrowseAsGuest}>
          <Text style={styles.guestLink}>تصفح كضيف</Text>
        </TouchableOpacity>
      </View>

      {/* Text content */}
      {showText && (
        <Animated.View style={[styles.textContainer, { opacity: textOpacity }]}>
          <Text style={styles.headline}>لكل عائلة عظيمة حكاية.</Text>
          <Text style={styles.subtitle}>وهذه حكاية القفاري.</Text>
        </Animated.View>
      )}

      {/* CTA Button */}
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
