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
  const { logoStars, renderLocation, setRenderLocation, setStarPhase } =
    useStarData();
  const [animationTime, setAnimationTime] = useState(0);
  const [currentPhase, setCurrentPhase] = useState("idle");
  const animationRef = useRef(null);

  // Main logo animations
  const starLogoOpacity = useRef(new Animated.Value(1)).current;
  const starLogoScale = useRef(new Animated.Value(1)).current;

  const emblemOpacity = useRef(new Animated.Value(0)).current;
  const emblemScale = useRef(new Animated.Value(0.5)).current;

  // Effects
  const whiteFlashOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  // Glass card
  const glassScale = useRef(new Animated.Value(0)).current;
  const glassOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive && currentPhase === "idle") {
      startTransformation();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive]);

  const startTransformation = () => {
    setCurrentPhase("starting");

    // Take control of star rendering from onboarding
    setTimeout(() => {
      setRenderLocation("transition");
      setStarPhase("breaking");
    }, 50);

    // Start animation timer for star movement
    let frameCount = 0;
    const animate = () => {
      frameCount++;
      setAnimationTime(frameCount);
      if (frameCount < 180) {
        // 3 seconds at 60fps
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    animationRef.current = requestAnimationFrame(animate);

    // Main animation sequence
    Animated.sequence([
      // Phase 1: Stars break apart (0-600ms)
      Animated.parallel([
        Animated.timing(glowOpacity, {
          toValue: 0.6,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(starLogoOpacity, {
          toValue: 0,
          duration: 600,
          delay: 200,
          useNativeDriver: true,
        }),
      ]),

      // Phase 2: Stars swirl and converge (600-1200ms)
      Animated.parallel([
        // White flash at transformation point
        Animated.sequence([
          Animated.delay(200),
          Animated.timing(whiteFlashOpacity, {
            toValue: 0.5,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(whiteFlashOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        // Emblem appears
        Animated.parallel([
          Animated.timing(emblemScale, {
            toValue: 1,
            duration: 600,
            delay: 300,
            easing: Easing.out(Easing.back),
            useNativeDriver: true,
          }),
          Animated.timing(emblemOpacity, {
            toValue: 1,
            duration: 500,
            delay: 400,
            useNativeDriver: true,
          }),
        ]),
      ]),

      // Phase 3: Glass materializes (1200-1600ms)
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
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setCurrentPhase("complete");
      setRenderLocation("none");
      setStarPhase("emblem");
      if (onComplete) onComplete();
    });
  };

  const renderAnimatedStars = () => {
    // Only render when we're the active renderer
    if (currentPhase === "idle" || renderLocation !== "transition") return null;

    return logoStars.map((star) => {
      // Calculate animation progress (0 to 180 frames = 3 seconds)
      const progress = animationTime / 180;

      // Phase 1: Break apart (0-0.3)
      if (progress <= 0.3) {
        const breakProgress = progress / 0.3;
        const angle = Math.atan2(
          star.originY - SCREEN_HEIGHT * 0.35,
          star.originX - SCREEN_WIDTH / 2,
        );
        const distance =
          30 + (star.type === "anchor" ? 50 : 30) * breakProgress;
        const x = star.originX + Math.cos(angle) * distance * breakProgress;
        const y = star.originY + Math.sin(angle) * distance * breakProgress;
        const opacity = star.brightness * (1 - breakProgress * 0.3);

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

      // Phase 2: Swirl (0.3-0.6)
      if (progress <= 0.6) {
        const swirlProgress = (progress - 0.3) / 0.3;
        const angle = swirlProgress * Math.PI * 1.5 + star.delay * 0.01;
        const radius = 60 + Math.sin(swirlProgress * Math.PI) * 40;
        const x = SCREEN_WIDTH / 2 + Math.cos(angle) * radius;
        const y = SCREEN_HEIGHT * 0.35 + Math.sin(angle) * radius;
        const opacity = star.brightness * 0.7;

        return (
          <Circle
            key={star.id}
            cx={x}
            cy={y}
            r={star.size * (1 + swirlProgress * 0.2)}
            color={`rgba(249, 247, 243, ${opacity})`}
          />
        );
      }

      // Phase 3: Form emblem (0.6-1.0)
      const formProgress = (progress - 0.6) / 0.4;
      const currentX =
        star.originX + (star.emblemX - star.originX) * formProgress;
      const currentY =
        star.originY + (star.emblemY - star.originY) * formProgress;
      const opacity = star.brightness * (1 - formProgress * 0.8);

      return (
        <Circle
          key={star.id}
          cx={currentX}
          cy={currentY}
          r={star.size * (1 - formProgress * 0.5)}
          color={`rgba(249, 247, 243, ${opacity})`}
        />
      );
    });
  };

  if (!isActive && currentPhase === "idle") return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Animated stars */}
      <Canvas style={StyleSheet.absoluteFillObject}>
        <Group>{renderAnimatedStars()}</Group>
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

      {/* Star logo (fades out) */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: starLogoOpacity,
            transform: [{ scale: starLogoScale }],
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
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 50,
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
