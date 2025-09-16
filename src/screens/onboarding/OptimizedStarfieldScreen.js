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
} from "react-native";
import { Canvas, Circle, Group } from "@shopify/react-native-skia";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Parse SVG path and sample points along it
const extractSVGPoints = () => {
  const points = [];
  const centerX = SCREEN_WIDTH / 2;
  const centerY = SCREEN_HEIGHT * 0.35;
  const scale = 0.05; // Scale factor for SVG coordinates

  // Sample key points from the SVG path
  // These are simplified key coordinates from the Alqefari emblem
  const svgKeyPoints = [
    // Main shape points (simplified from the complex path)
    [869, 882],
    [880, 880],
    [890, 875],
    [900, 870],
    [910, 865],
    [920, 860],
    [930, 855],
    [940, 850],
    [950, 845],
    [960, 840],
    [970, 835],
    [980, 830],
    [990, 825],
    [1000, 820],
    [1010, 815],
    [1020, 810],
    [1030, 805],
    [1040, 800],
    [1050, 795],
    [1060, 790],
    [1070, 785],
    [1080, 780],
    [1090, 775],
    [1100, 770],
    [1110, 765],
    [1120, 760],
    [1130, 755],
    [1140, 750],
    [1150, 745],
    [1160, 740],
    [1170, 735],
    [1180, 730],
    [1190, 725],
    [1200, 720],
    [1210, 715],
    [1220, 710],
    [1230, 705],
    [1240, 700],
    [1250, 695],
    [1260, 690],
    [1270, 685],
    [1280, 680],
    [1290, 675],
    [1300, 670],
    [1310, 665],
    [850, 890],
    [840, 895],
    [830, 900],
    [820, 905],
    [810, 910],
    [800, 915],
    [790, 920],
    [780, 925],
    [770, 930],
    [760, 935],
    [750, 940],
    [740, 945],
    [730, 950],
    [720, 955],
    [710, 960],
  ];

  // Convert SVG coordinates to screen coordinates with stars
  svgKeyPoints.forEach(([x, y], i) => {
    points.push({
      x: centerX + (x - 869) * scale,
      y: centerY + (y - 882) * scale,
      size: 1.5 + Math.random() * 0.8,
      brightness: 0.8 + Math.random() * 0.2,
      delay: i * 25,
      group: "logo",
    });
  });

  return points;
};

// Simplified text constellation with fewer points
const generateTextConstellation = (text, baseX, baseY, scale = 1) => {
  const points = [];
  // Very simplified - just outline points
  const patterns = {
    س: [
      [0, 0],
      [6, 0],
      [12, 0],
      [0, -6],
      [6, -6],
      [12, -6],
    ],
    ل: [
      [2, 0],
      [2, -6],
      [2, -12],
    ],
    ي: [
      [0, 0],
      [6, 0],
      [0, -6],
      [6, -6],
    ],
    م: [
      [0, 0],
      [6, 0],
      [0, -6],
      [6, -6],
    ],
    ا: [
      [2, 0],
      [2, -12],
    ],
    ن: [
      [0, 0],
      [6, 0],
      [0, -6],
      [6, -6],
    ],
  };

  let offsetX = 0;
  text.split("").forEach((char, charIndex) => {
    const pattern = patterns[char] || [[0, 0]];
    pattern.forEach(([dx, dy], i) => {
      points.push({
        x: baseX + (offsetX + dx * 3) * scale,
        y: baseY + dy * 3 * scale,
        size: 1.2 + Math.random() * 0.3,
        brightness: 0.7 + Math.random() * 0.2,
        delay: 2000 + charIndex * 100 + i * 30,
        group: "text",
      });
    });
    offsetX += 25;
  });

  return points;
};

// Fewer ambient stars for performance
const generateAmbientStars = (count = 30) => {
  return Array.from({ length: count }, () => ({
    x: Math.random() * SCREEN_WIDTH,
    y: Math.random() * SCREEN_HEIGHT * 0.6,
    size: Math.random() * 0.8 + 0.3,
    brightness: Math.random() * 0.25 + 0.1,
    delay: Math.random() * 800,
    group: "ambient",
  }));
};

// Optimized star rendering component
const StarField = React.memo(({ stars, progress }) => {
  const visibleStars = useMemo(() => {
    return stars.filter((star) => {
      const appearTime = star.delay / 5000;
      return progress > appearTime;
    });
  }, [stars, progress]);

  return (
    <Canvas style={StyleSheet.absoluteFillObject}>
      {visibleStars.map((star, index) => {
        const appearTime = star.delay / 5000;
        const fadeInProgress = Math.min((progress - appearTime) / 0.15, 1);
        const opacity = star.brightness * fadeInProgress;
        const scale = fadeInProgress;
        const color = star.group === "ambient" ? "#F9F7F320" : "#D1BBA3";

        return (
          <Group key={`star-${star.x}-${star.y}`} transform={[{ scale }]}>
            {/* Single glow layer for performance */}
            {star.group !== "ambient" && (
              <Circle
                cx={star.x}
                cy={star.y}
                r={star.size * 2.5}
                color={color}
                opacity={opacity * 0.3}
              />
            )}
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
  );
});

export default function OptimizedStarfieldScreen({ navigation, setIsGuest }) {
  const [progress, setProgress] = useState(0);
  const [showText, setShowText] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const textOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  // Pre-calculate all stars
  const stars = useMemo(() => {
    const ambient = generateAmbientStars(30);
    const logo = extractSVGPoints();
    const sulaiman = generateTextConstellation(
      "سليمان",
      SCREEN_WIDTH / 2 - 40,
      SCREEN_HEIGHT * 0.23,
      1,
    );

    return [...ambient, ...logo, ...sulaiman];
  }, []);

  useEffect(() => {
    let startTime = Date.now();
    let animationId;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min(elapsed / 5000, 1);
      setProgress(newProgress);

      if (newProgress < 1) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animationId = requestAnimationFrame(animate);

    // Show text
    const textTimer = setTimeout(() => {
      setShowText(true);
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }, 5500);

    // Show button
    const buttonTimer = setTimeout(() => {
      setShowButton(true);
      Animated.spring(buttonOpacity, {
        toValue: 1,
        damping: 15,
        stiffness: 100,
        useNativeDriver: true,
      }).start();
    }, 6000);

    return () => {
      cancelAnimationFrame(animationId);
      clearTimeout(textTimer);
      clearTimeout(buttonTimer);
    };
  }, []);

  const handleStart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.replace("PhoneAuth");
  }, [navigation]);

  const handleBrowseAsGuest = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsGuest(true);
  }, [setIsGuest]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background gradient */}
      <LinearGradient
        colors={["#242121", "#1a1818", "#242121"]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        locations={[0, 0.5, 1]}
      />

      {/* Optimized Starfield */}
      <StarField stars={stars} progress={progress} />

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
