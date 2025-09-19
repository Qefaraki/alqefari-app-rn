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
import { Canvas, Circle, Group } from "@shopify/react-native-skia";
import { useStarData } from "../../contexts/StarDataContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function StarToEmblemTransition({ isActive, onComplete }) {
  const { emissionStars, centerX, centerY } = useStarData();
  const [animationFrame, setAnimationFrame] = useState(0);
  const animationRef = useRef(null);

  // Emblem animations
  const emblemOpacity = useRef(new Animated.Value(0)).current;
  const emblemScale = useRef(new Animated.Value(0.5)).current;

  // Effects
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const whiteFlashOpacity = useRef(new Animated.Value(0)).current;

  // Glass card
  const glassScale = useRef(new Animated.Value(0)).current;
  const glassOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      startTransformation();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive]);

  const startTransformation = () => {
    // Start frame animation for star particles
    let frame = 0;
    const animate = () => {
      frame++;
      setAnimationFrame(frame);
      if (frame < 150) {
        // 2.5 seconds at 60fps
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    animationRef.current = requestAnimationFrame(animate);

    // Main animation sequence
    Animated.sequence([
      // Phase 1: Glow builds up (0-300ms)
      Animated.timing(glowOpacity, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      }),

      // Phase 2: White flash as stars burst (300-600ms)
      Animated.parallel([
        Animated.sequence([
          Animated.timing(whiteFlashOpacity, {
            toValue: 0.5,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(whiteFlashOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(glowOpacity, {
          toValue: 0.2,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),

      // Phase 3: Emblem and glass appear (600-1200ms)
      Animated.parallel([
        // Emblem scales in
        Animated.spring(emblemScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          delay: 200,
          useNativeDriver: true,
        }),
        Animated.timing(emblemOpacity, {
          toValue: 1,
          duration: 500,
          delay: 200,
          useNativeDriver: true,
        }),
        // Glass card materializes
        Animated.spring(glassScale, {
          toValue: 1,
          friction: 7,
          tension: 35,
          delay: 400,
          useNativeDriver: true,
        }),
        Animated.timing(glassOpacity, {
          toValue: 1,
          duration: 600,
          delay: 400,
          useNativeDriver: true,
        }),
        // Glow fades completely
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      if (onComplete) onComplete();
    });
  };

  const renderEmissionStars = () => {
    if (animationFrame === 0) return null;

    return emissionStars.map((star) => {
      const progress = animationFrame / 150; // 0 to 1 over 2.5 seconds

      // Check if star should be visible yet (staggered emergence)
      const starDelay = star.delay / 16; // Convert to frames
      if (animationFrame < starDelay) return null;

      const starProgress = (animationFrame - starDelay) / 150;

      // Phase 1: Explosive burst outward (0-45%)
      if (starProgress <= 0.45) {
        const burstProgress = starProgress / 0.45;
        // Exponential acceleration for explosive feel
        const distance = Math.pow(burstProgress, 1.8) * 250 * star.speed;

        const x = star.startX + Math.cos(star.angle) * distance;
        const y = star.startY + Math.sin(star.angle) * distance;

        // Quick fade in, maintain brightness during burst
        const opacity = Math.min(1, burstProgress * 3) * star.brightness;

        return (
          <Circle
            key={star.id}
            cx={x}
            cy={y}
            r={star.size}
            color={`rgba(249, 247, 243, ${opacity})`}
          />
        );
      }

      // Phase 2: Arc and converge (45-100%)
      const convergeProgress = (starProgress - 0.45) / 0.55;

      // Spiral inward
      const maxDistance = 250 * star.speed;
      const spiralAngle = star.angle + convergeProgress * Math.PI * 0.7;
      const currentDistance = maxDistance * Math.pow(1 - convergeProgress, 1.5);

      const x = centerX + Math.cos(spiralAngle) * currentDistance;
      const y = centerY + Math.sin(spiralAngle) * currentDistance;

      // Fade and shrink as converging
      const opacity = star.brightness * Math.pow(1 - convergeProgress, 2);
      const size = star.size * (1 - convergeProgress * 0.6);

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

  if (!isActive) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Emission stars */}
      <Canvas style={StyleSheet.absoluteFillObject}>
        <Group>{renderEmissionStars()}</Group>
      </Canvas>

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

      {/* Glow effect behind emblem */}
      <Animated.View
        style={[
          styles.glowContainer,
          {
            opacity: glowOpacity,
          },
        ]}
      >
        <View style={styles.glowCircle} />
      </Animated.View>

      {/* Family emblem (fades in) */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: emblemOpacity,
            transform: [{ scale: emblemScale }],
          },
        ]}
      >
        <Image
          source={require("../../../assets/logo/AlqefariEmblem.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Glass card */}
      <Animated.View
        style={[
          styles.glassCardContainer,
          {
            opacity: glassOpacity,
            transform: [{ scale: glassScale }],
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
    top: SCREEN_HEIGHT * 0.35 - 150,
    left: SCREEN_WIDTH / 2 - 150,
    width: 300,
    height: 300,
    alignItems: "center",
    justifyContent: "center",
  },
  glowCircle: {
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 40,
  },
  logoContainer: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.35 - 100,
    left: SCREEN_WIDTH / 2 - 100,
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
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
  },
  glassCard: {
    width: 360,
    height: 450,
    borderRadius: 20,
    overflow: "hidden",
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
});
