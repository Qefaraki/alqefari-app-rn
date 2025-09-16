import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Animated,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Svg, { Circle } from "react-native-svg";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Animated components
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Helper to generate logo constellation points
const generateLogoConstellation = () => {
  const points = [];
  const centerX = SCREEN_WIDTH / 2;
  const centerY = SCREEN_HEIGHT * 0.35;
  const radius = 40;

  // Generate circle points (hollow circle)
  for (let angle = 0; angle < 360; angle += 6) {
    const x = centerX + radius * Math.cos((angle * Math.PI) / 180);
    const y = centerY + radius * Math.sin((angle * Math.PI) / 180);
    points.push({
      x,
      y,
      size: Math.random() * 1.5 + 1.5,
      delay: angle * 2,
      brightness: Math.random() * 0.3 + 0.7,
    });
  }

  // Top vertical line
  for (let i = 0; i < 8; i++) {
    points.push({
      x: centerX,
      y: centerY - radius - 15 - i * 3,
      size: Math.random() * 1.2 + 1.3,
      delay: 720 + i * 50,
      brightness: Math.random() * 0.3 + 0.7,
    });
  }

  // Right horizontal line
  for (let i = 0; i < 8; i++) {
    points.push({
      x: centerX + radius + 15 + i * 3,
      y: centerY,
      size: Math.random() * 1.2 + 1.3,
      delay: 1120 + i * 50,
      brightness: Math.random() * 0.3 + 0.7,
    });
  }

  return points;
};

// Arabic text to star constellation - simplified dot matrix approach
const arabicTextToConstellation = (text, x, y, scale = 1) => {
  const constellationMap = {
    س: [
      [0, 0],
      [2, 0],
      [4, 0],
      [6, 0],
      [8, 0],
      [0, -2],
      [2, -3],
      [4, -3],
      [6, -3],
      [8, -2],
      [0, -4],
      [8, -4],
      [0, -6],
      [2, -6],
      [4, -6],
      [6, -6],
      [8, -6],
    ],
    ل: [
      [4, 0],
      [4, -2],
      [4, -4],
      [4, -6],
      [4, -8],
      [4, -10],
      [3, -10],
      [5, -10],
    ],
    ي: [
      [0, 0],
      [2, 0],
      [4, 0],
      [6, 0],
      [0, -2],
      [6, -2],
      [0, -4],
      [2, -4],
      [4, -4],
      [6, -4],
      [2, -6],
      [4, -6],
    ],
    م: [
      [0, 0],
      [2, 0],
      [4, 0],
      [6, 0],
      [0, -2],
      [3, -3],
      [6, -2],
      [0, -4],
      [3, -5],
      [6, -4],
      [0, -6],
      [6, -6],
    ],
    ا: [
      [2, 0],
      [2, -2],
      [2, -4],
      [2, -6],
      [2, -8],
      [2, -10],
    ],
    ن: [
      [0, 0],
      [2, 0],
      [4, 0],
      [6, 0],
      [0, -2],
      [6, -2],
      [0, -4],
      [6, -4],
      [3, -6],
    ],
    ع: [
      [0, 0],
      [2, 0],
      [4, 0],
      [6, 0],
      [0, -2],
      [6, -2],
      [0, -4],
      [2, -4],
      [4, -4],
      [6, -4],
      [6, -6],
    ],
    ب: [
      [0, 0],
      [2, 0],
      [4, 0],
      [6, 0],
      [8, 0],
      [0, -2],
      [8, -2],
      [4, -4],
    ],
    د: [
      [0, 0],
      [2, 0],
      [4, 0],
      [4, -2],
      [4, -4],
      [2, -4],
      [0, -4],
    ],
    ز: [
      [0, 0],
      [2, 0],
      [4, 0],
      [4, -2],
      [4, -4],
      [2, -4],
      [0, -4],
      [2, -6],
    ],
    ج: [
      [0, 0],
      [2, 0],
      [4, 0],
      [6, 0],
      [0, -2],
      [6, -2],
      [0, -4],
      [2, -4],
      [4, -4],
      [6, -4],
      [3, -6],
    ],
    ر: [
      [0, 0],
      [2, 0],
      [4, 0],
      [0, -2],
      [0, -4],
      [2, -4],
    ],
    و: [
      [0, 0],
      [2, 0],
      [4, 0],
      [0, -2],
      [4, -2],
      [0, -4],
      [2, -4],
      [4, -4],
      [2, -6],
    ],
  };

  const points = [];
  let offsetX = 0;

  // Parse text and create constellation
  const chars = text.split("");
  chars.forEach((char, charIndex) => {
    const charPattern = constellationMap[char] || [];
    charPattern.forEach(([dx, dy], i) => {
      points.push({
        x: x + (offsetX + dx * 3) * scale,
        y: y + dy * 3 * scale,
        size: Math.random() * 0.8 + 1.2,
        delay: charIndex * 200 + i * 20,
        brightness: Math.random() * 0.3 + 0.7,
      });
    });
    offsetX += 30; // Space between characters
  });

  return points;
};

export default function StarfieldOnboardingScreen({ navigation, setIsGuest }) {
  // Animation refs
  const textOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0.9)).current;
  const guestLinkOpacity = useRef(new Animated.Value(0)).current;

  // Starfield state
  const [ambientStars] = useState(() =>
    [...Array(80)].map(() => ({
      x: Math.random() * SCREEN_WIDTH,
      y: Math.random() * SCREEN_HEIGHT,
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.5 + 0.1,
      twinkleSpeed: Math.random() * 3000 + 2000,
    })),
  );

  // Logo constellation
  const logoStars = useMemo(() => generateLogoConstellation(), []);
  const logoStarAnimations = useRef(
    logoStars.map(() => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
      twinkle: new Animated.Value(1),
    })),
  ).current;

  // Name constellations
  const sulaimanStars = useMemo(
    () =>
      arabicTextToConstellation(
        "سليمان",
        SCREEN_WIDTH / 2 - 45,
        SCREEN_HEIGHT * 0.25,
        1.2,
      ),
    [],
  );
  const abdulazizStars = useMemo(
    () =>
      arabicTextToConstellation(
        "عبدالعزيز",
        SCREEN_WIDTH / 2 - 130,
        SCREEN_HEIGHT * 0.48,
        0.9,
      ),
    [],
  );
  const jarbooStars = useMemo(
    () =>
      arabicTextToConstellation(
        "جربوع",
        SCREEN_WIDTH / 2 + 40,
        SCREEN_HEIGHT * 0.48,
        0.9,
      ),
    [],
  );

  // Create animations for each name constellation
  const sulaimanAnimations = useRef(
    sulaimanStars.map(() => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
      twinkle: new Animated.Value(1),
    })),
  ).current;

  const abdulazizAnimations = useRef(
    abdulazizStars.map(() => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
      twinkle: new Animated.Value(1),
    })),
  ).current;

  const jarbooAnimations = useRef(
    jarbooStars.map(() => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
      twinkle: new Animated.Value(1),
    })),
  ).current;

  // Ambient star animations
  const ambientStarAnimations = useRef(
    ambientStars.map(() => ({
      opacity: new Animated.Value(0),
      twinkle: new Animated.Value(1),
    })),
  ).current;

  useEffect(() => {
    // Animate ambient starfield
    ambientStarAnimations.forEach((anim, index) => {
      const star = ambientStars[index];

      // Fade in
      Animated.timing(anim.opacity, {
        toValue: star.opacity,
        duration: 1000,
        delay: index * 20,
        useNativeDriver: true,
      }).start();

      // Continuous twinkle
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim.twinkle, {
            toValue: 0.3,
            duration: star.twinkleSpeed,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim.twinkle, {
            toValue: 1,
            duration: star.twinkleSpeed,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });

    // Animate logo constellation
    setTimeout(() => {
      logoStarAnimations.forEach((anim, index) => {
        const star = logoStars[index];

        Animated.sequence([
          Animated.delay(star.delay),
          Animated.parallel([
            Animated.spring(anim.opacity, {
              toValue: star.brightness,
              friction: 8,
              tension: 40,
              useNativeDriver: true,
            }),
            Animated.spring(anim.scale, {
              toValue: 1,
              friction: 4,
              tension: 40,
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => {
          // Start twinkle
          Animated.loop(
            Animated.sequence([
              Animated.timing(anim.twinkle, {
                toValue: 0.6,
                duration: 2000 + Math.random() * 1000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(anim.twinkle, {
                toValue: 1,
                duration: 2000 + Math.random() * 1000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ]),
          ).start();
        });
      });
    }, 1000);

    // Animate Sulaiman constellation
    setTimeout(() => {
      sulaimanAnimations.forEach((anim, index) => {
        const star = sulaimanStars[index];

        Animated.sequence([
          Animated.delay(star.delay),
          Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: star.brightness,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.spring(anim.scale, {
              toValue: 1,
              friction: 5,
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => {
          // Twinkle effect
          Animated.loop(
            Animated.sequence([
              Animated.timing(anim.twinkle, {
                toValue: 0.5,
                duration: 3000 + Math.random() * 1000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(anim.twinkle, {
                toValue: 1,
                duration: 3000 + Math.random() * 1000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ]),
          ).start();
        });
      });
    }, 2500);

    // Animate sons' constellations
    setTimeout(() => {
      // Abdulaziz
      abdulazizAnimations.forEach((anim, index) => {
        const star = abdulazizStars[index];

        Animated.sequence([
          Animated.delay(star.delay),
          Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: star.brightness * 0.8,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.spring(anim.scale, {
              toValue: 1,
              friction: 5,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      });

      // Jarboo
      jarbooAnimations.forEach((anim, index) => {
        const star = jarbooStars[index];

        Animated.sequence([
          Animated.delay(star.delay + 200),
          Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: star.brightness * 0.8,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.spring(anim.scale, {
              toValue: 1,
              friction: 5,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      });
    }, 4000);

    // Show text and button
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(500),
          Animated.parallel([
            Animated.timing(buttonOpacity, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.spring(buttonScale, {
              toValue: 1,
              friction: 5,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(800),
          Animated.timing(guestLinkOpacity, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
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

      {/* Deep atmospheric gradient background */}
      <LinearGradient
        colors={["#242121", "#1a1818", "#0f0e0e", "#1a1818", "#242121"]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        locations={[0, 0.3, 0.5, 0.7, 1]}
      />

      {/* Radial gradient for depth */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient
          colors={["transparent", "transparent", "#00000040"]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      {/* SVG Starfield Canvas */}
      <Svg
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      >
        {/* Ambient stars */}
        {ambientStars.map((star, index) => (
          <AnimatedCircle
            key={`ambient-${index}`}
            cx={star.x}
            cy={star.y}
            r={star.size}
            fill="#F9F7F3"
            opacity={Animated.multiply(
              ambientStarAnimations[index].opacity,
              ambientStarAnimations[index].twinkle,
            )}
          />
        ))}

        {/* Logo constellation */}
        {logoStars.map((star, index) => (
          <AnimatedCircle
            key={`logo-${index}`}
            cx={star.x}
            cy={star.y}
            r={star.size}
            fill="#D1BBA3"
            opacity={Animated.multiply(
              logoStarAnimations[index].opacity,
              logoStarAnimations[index].twinkle,
            )}
            scale={logoStarAnimations[index].scale}
          />
        ))}

        {/* Sulaiman constellation */}
        {sulaimanStars.map((star, index) => (
          <AnimatedCircle
            key={`sulaiman-${index}`}
            cx={star.x}
            cy={star.y}
            r={star.size}
            fill="#D1BBA3"
            opacity={Animated.multiply(
              sulaimanAnimations[index].opacity,
              sulaimanAnimations[index].twinkle,
            )}
            scale={sulaimanAnimations[index].scale}
          />
        ))}

        {/* Abdulaziz constellation */}
        {abdulazizStars.map((star, index) => (
          <AnimatedCircle
            key={`abdulaziz-${index}`}
            cx={star.x}
            cy={star.y}
            r={star.size}
            fill="#D1BBA3"
            opacity={Animated.multiply(
              abdulazizAnimations[index].opacity,
              abdulazizAnimations[index].twinkle,
            )}
            scale={abdulazizAnimations[index].scale}
          />
        ))}

        {/* Jarboo constellation */}
        {jarbooStars.map((star, index) => (
          <AnimatedCircle
            key={`jarboo-${index}`}
            cx={star.x}
            cy={star.y}
            r={star.size}
            fill="#D1BBA3"
            opacity={Animated.multiply(
              jarbooAnimations[index].opacity,
              jarbooAnimations[index].twinkle,
            )}
            scale={jarbooAnimations[index].scale}
          />
        ))}
      </Svg>

      {/* Guest Link */}
      <Animated.View
        style={[styles.guestLinkContainer, { opacity: guestLinkOpacity }]}
      >
        <TouchableOpacity onPress={handleBrowseAsGuest}>
          <Text style={styles.guestLink}>تصفح كضيف</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Main text content */}
      <Animated.View style={[styles.textContainer, { opacity: textOpacity }]}>
        <Text style={styles.headline}>لكل عائلة عظيمة حكاية.</Text>
        <Text style={styles.subtitle}>وهذه حكاية القفاري.</Text>
      </Animated.View>

      {/* CTA Button */}
      <Animated.View
        style={[
          styles.buttonContainer,
          {
            opacity: buttonOpacity,
            transform: [{ scale: buttonScale }],
          },
        ]}
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

        {/* Page Indicators */}
        <View style={styles.dotsContainer}>
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </Animated.View>
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
