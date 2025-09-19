import React, { useRef, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
  Easing,
} from "react-native";
import { BlurView } from "expo-blur";
import {
  Canvas,
  Circle,
  Group,
  vec,
  Blur,
  Fill,
} from "@shopify/react-native-skia";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Generate star particles that will converge
const generateConvergingStars = () => {
  const stars = [];
  const centerX = SCREEN_WIDTH / 2;
  const centerY = SCREEN_HEIGHT * 0.35;

  // Create stars in a circle around the center
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * Math.PI * 2;
    const distance = 150 + Math.random() * 100;
    stars.push({
      id: i,
      startX: centerX + Math.cos(angle) * distance,
      startY: centerY + Math.sin(angle) * distance,
      endX: centerX + Math.cos(angle) * (10 + Math.random() * 20),
      endY: centerY + Math.sin(angle) * (10 + Math.random() * 20),
      size: 1 + Math.random() * 2,
      delay: Math.random() * 200,
    });
  }
  return stars;
};

export default function StarToEmblemTransition({ isActive, onComplete }) {
  const [stars] = useState(generateConvergingStars);
  const [animationTime, setAnimationTime] = useState(0);
  const animationRef = useRef(null);

  // Main logo animations
  const starLogoOpacity = useRef(new Animated.Value(1)).current;
  const starLogoScale = useRef(new Animated.Value(1)).current;
  const starLogoRotation = useRef(new Animated.Value(0)).current;

  const emblemOpacity = useRef(new Animated.Value(0)).current;
  const emblemScale = useRef(new Animated.Value(0.3)).current;
  const emblemRotation = useRef(new Animated.Value(-45)).current;

  // Effects
  const whiteFlashOpacity = useRef(new Animated.Value(0)).current;
  const glowRadius = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  // Glass card
  const glassScale = useRef(new Animated.Value(0)).current;
  const glassOpacity = useRef(new Animated.Value(0)).current;
  const glassY = useRef(new Animated.Value(30)).current;

  const [phase, setPhase] = useState("idle");
  const [showStarParticles, setShowStarParticles] = useState(false);

  useEffect(() => {
    if (isActive && phase === "idle") {
      startTransformation();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive]);

  const startTransformation = () => {
    setPhase("transforming");
    setShowStarParticles(true);

    // Start particle animation
    let frameCount = 0;
    const animate = () => {
      frameCount++;
      setAnimationTime(frameCount * 16); // 60fps
      if (frameCount < 120) {
        // Run for 2 seconds
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    animationRef.current = requestAnimationFrame(animate);

    // Main animation sequence
    Animated.sequence([
      // Phase 1: Star logo pulses and begins to glow (0-400ms)
      Animated.parallel([
        Animated.sequence([
          Animated.timing(starLogoScale, {
            toValue: 1.2,
            duration: 200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(starLogoScale, {
            toValue: 1.1,
            duration: 200,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(glowOpacity, {
          toValue: 0.8,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(glowRadius, {
          toValue: 1.5,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),

      // Phase 2: Star rotates and morphs (400-800ms)
      Animated.parallel([
        // Star logo spins and shrinks
        Animated.parallel([
          Animated.timing(starLogoRotation, {
            toValue: 180,
            duration: 400,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(starLogoScale, {
            toValue: 0.8,
            duration: 400,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(starLogoOpacity, {
            toValue: 0,
            duration: 400,
            delay: 200,
            useNativeDriver: true,
          }),
        ]),

        // Emblem appears with counter-rotation
        Animated.parallel([
          Animated.timing(emblemRotation, {
            toValue: 0,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(emblemScale, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.back),
            useNativeDriver: true,
          }),
          Animated.timing(emblemOpacity, {
            toValue: 1,
            duration: 300,
            delay: 100,
            useNativeDriver: true,
          }),
        ]),

        // White flash at midpoint
        Animated.sequence([
          Animated.delay(150),
          Animated.timing(whiteFlashOpacity, {
            toValue: 0.6,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(whiteFlashOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
      ]),

      // Phase 3: Glass crystallizes (800-1200ms)
      Animated.parallel([
        Animated.spring(glassScale, {
          toValue: 1,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(glassOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(glassY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setPhase("complete");
      setTimeout(() => {
        setShowStarParticles(false);
        if (onComplete) onComplete();
      }, 300);
    });
  };

  const renderConvergingStars = () => {
    if (!showStarParticles) return null;

    return stars.map((star) => {
      const progress = Math.max(
        0,
        Math.min(1, (animationTime - star.delay) / 800),
      );
      if (progress === 0) return null;

      const x = star.startX + (star.endX - star.startX) * progress;
      const y = star.startY + (star.endY - star.startY) * progress;
      const opacity = (1 - progress) * 0.8;
      const size = star.size * (1 - progress * 0.5);

      return (
        <Circle
          key={star.id}
          cx={x}
          cy={y}
          r={size}
          color={`rgba(249, 247, 243, ${opacity})`}
        />
      );
    });
  };

  if (!isActive && phase === "idle") return null;

  const starRotationDeg = starLogoRotation.interpolate({
    inputRange: [0, 180],
    outputRange: ["0deg", "180deg"],
  });

  const emblemRotationDeg = emblemRotation.interpolate({
    inputRange: [-45, 0],
    outputRange: ["-45deg", "0deg"],
  });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Converging star particles */}
      {showStarParticles && (
        <Canvas style={StyleSheet.absoluteFillObject}>
          <Group>{renderConvergingStars()}</Group>
        </Canvas>
      )}

      {/* White flash overlay */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: "white",
            opacity: whiteFlashOpacity,
          },
        ]}
      />

      {/* Glow effect behind logos */}
      <Animated.View
        style={[
          styles.glowContainer,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowRadius }],
          },
        ]}
      >
        <View style={styles.glowCircle} />
      </Animated.View>

      {/* Star logo that morphs out */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: starLogoOpacity,
            transform: [{ scale: starLogoScale }, { rotate: starRotationDeg }],
          },
        ]}
      >
        <Image
          source={require("../../../assets/logo/STAR_LOGO.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Family emblem that morphs in */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: emblemOpacity,
            transform: [{ scale: emblemScale }, { rotate: emblemRotationDeg }],
          },
        ]}
      >
        <Image
          source={require("../../../assets/logo/AlqefariEmblem.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Glass card that crystallizes */}
      <Animated.View
        style={[
          styles.glassCardContainer,
          {
            opacity: glassOpacity,
            transform: [{ scale: glassScale }, { translateY: glassY }],
          },
        ]}
      >
        <BlurView intensity={15} tint="dark" style={styles.glassCard}>
          <View style={styles.glassOverlay} />
        </BlurView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  glowContainer: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.35 - 120,
    left: SCREEN_WIDTH / 2 - 120,
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  glowCircle: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 40,
    elevation: 10,
  },
  logoContainer: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.35 - 100,
    left: SCREEN_WIDTH / 2 - 100,
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  logo: {
    width: 180,
    height: 180,
  },
  glassCardContainer: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.25,
    left: SCREEN_WIDTH / 2 - 180,
    width: 360,
    height: 450,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  glassCard: {
    width: 360,
    height: 450,
    borderRadius: 20,
    overflow: "hidden",
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
});
