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

  // Logo animations
  const logoOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(1)).current;

  // Emblem animations
  const emblemOpacity = useRef(new Animated.Value(0)).current;
  const emblemScale = useRef(new Animated.Value(0.8)).current;

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
      if (frame < 120) {
        // 2 seconds at 60fps
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    animationRef.current = requestAnimationFrame(animate);

    // Main animation sequence
    Animated.sequence([
      // Phase 1: Logo pulse and glow (0-400ms)
      Animated.parallel([
        Animated.sequence([
          Animated.timing(logoScale, {
            toValue: 1.1,
            duration: 200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(logoScale, {
            toValue: 1.0,
            duration: 200,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(glowOpacity, {
          toValue: 0.6,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),

      // Phase 2: Logo fades as stars emit (400-800ms)
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        // White flash at transition point
        Animated.sequence([
          Animated.timing(whiteFlashOpacity, {
            toValue: 0.4,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(whiteFlashOpacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]),
      ]),

      // Phase 3: Emblem appears (800-1200ms)
      Animated.parallel([
        Animated.spring(emblemScale, {
          toValue: 1,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(emblemOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        // Glass card crystallizes
        Animated.spring(glassScale, {
          toValue: 1,
          friction: 8,
          tension: 35,
          useNativeDriver: true,
        }),
        Animated.timing(glassOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        // Glow fades
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 600,
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
      const progress = animationFrame / 120; // 0 to 1 over 2 seconds

      // Phase 1: Stars emerge and fly outward (0-40%)
      if (progress <= 0.4) {
        const emergeProgress = progress / 0.4;
        const distance = emergeProgress * 150; // Fly 150px outward
        const x = star.startX + Math.cos(star.angle) * distance;
        const y = star.startY + Math.sin(star.angle) * distance;
        const opacity = emergeProgress * star.brightness;

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

      // Phase 2: Stars arc and converge (40-100%)
      const convergeProgress = (progress - 0.4) / 0.6;

      // Calculate arc path
      const maxDistance = 150;
      const currentDistance = maxDistance * (1 - convergeProgress * 0.8);
      const arcAngle = star.angle + convergeProgress * Math.PI * 0.5;

      const x = centerX + Math.cos(arcAngle) * currentDistance;
      const y = centerY + Math.sin(arcAngle) * currentDistance;
      const opacity = star.brightness * (1 - convergeProgress * 0.7);

      return (
        <Circle
          key={star.id}
          cx={x}
          cy={y}
          r={star.size * (1 - convergeProgress * 0.3)}
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

      {/* Glow effect */}
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

      {/* Original logo (fades out) */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Image
          source={require("../../../assets/logo/STAR_LOGO.png")}
          style={styles.logo}
          resizeMode="contain"
        />
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
