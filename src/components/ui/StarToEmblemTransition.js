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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function StarToEmblemTransition({ isActive, onComplete }) {
  // Animation values
  const starScale = useRef(new Animated.Value(1)).current;
  const starRotation = useRef(new Animated.Value(0)).current;
  const starOpacity = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(1)).current;

  const emblemScale = useRef(new Animated.Value(0)).current;
  const emblemOpacity = useRef(new Animated.Value(0)).current;
  const emblemRotation = useRef(new Animated.Value(-180)).current;

  const whiteFlashOpacity = useRef(new Animated.Value(0)).current;

  const glassScale = useRef(new Animated.Value(0)).current;
  const glassOpacity = useRef(new Animated.Value(0)).current;
  const glassBlur = useRef(new Animated.Value(20)).current;

  const shimmerTranslate = useRef(new Animated.Value(-SCREEN_WIDTH)).current;

  const [phase, setPhase] = useState("idle");

  useEffect(() => {
    if (isActive && phase === "idle") {
      startTransformation();
    }
  }, [isActive]);

  const startTransformation = () => {
    setPhase("farewell");

    // Phase 1: Star Farewell (0-400ms)
    const farewellAnims = Animated.parallel([
      // Star pulses brighter
      Animated.sequence([
        Animated.timing(starScale, {
          toValue: 1.1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(starScale, {
          toValue: 1,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      // Glow expands
      Animated.timing(glowOpacity, {
        toValue: 0.5,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(glowScale, {
        toValue: 1.5,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    // Phase 2: Metamorphosis (400-800ms)
    const morphAnims = Animated.parallel([
      // Star rotates and fades
      Animated.timing(starRotation, {
        toValue: 360,
        duration: 400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(starOpacity, {
        toValue: 0,
        duration: 400,
        delay: 100,
        useNativeDriver: true,
      }),
      // White flash peaks
      Animated.sequence([
        Animated.timing(whiteFlashOpacity, {
          toValue: 0.9,
          duration: 200,
          delay: 200,
          useNativeDriver: true,
        }),
        Animated.timing(whiteFlashOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]);

    // Phase 3: Emblem Reveal & Glass Crystallization (800-1200ms)
    const crystallizeAnims = Animated.parallel([
      // Emblem appears with rotation
      Animated.parallel([
        Animated.timing(emblemScale, {
          toValue: 1,
          duration: 400,
          delay: 200,
          easing: Easing.out(Easing.back),
          useNativeDriver: true,
        }),
        Animated.timing(emblemOpacity, {
          toValue: 1,
          duration: 300,
          delay: 200,
          useNativeDriver: true,
        }),
        Animated.timing(emblemRotation, {
          toValue: 0,
          duration: 400,
          delay: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      // Glass crystallizes outward
      Animated.parallel([
        Animated.spring(glassScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          delay: 300,
          useNativeDriver: true,
        }),
        Animated.timing(glassOpacity, {
          toValue: 1,
          duration: 400,
          delay: 300,
          useNativeDriver: true,
        }),
        Animated.timing(glassBlur, {
          toValue: 15,
          duration: 400,
          delay: 300,
          useNativeDriver: false,
        }),
      ]),
      // Glow fades
      Animated.timing(glowOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]);

    // Phase 4: Final shimmer (1200-1500ms)
    const shimmerAnim = Animated.timing(shimmerTranslate, {
      toValue: SCREEN_WIDTH,
      duration: 300,
      delay: 1200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });

    // Execute sequence
    Animated.sequence([farewellAnims, morphAnims, crystallizeAnims]).start(
      () => {
        shimmerAnim.start(() => {
          setPhase("complete");
          if (onComplete) onComplete();
        });
      },
    );
  };

  const starRotationDeg = starRotation.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  const emblemRotationDeg = emblemRotation.interpolate({
    inputRange: [-180, 0],
    outputRange: ["-180deg", "0deg"],
  });

  if (!isActive && phase === "idle") return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
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

      {/* Glow behind logos */}
      <Animated.View
        style={[
          styles.glowContainer,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      >
        <View style={styles.glowCircle} />
      </Animated.View>

      {/* Star logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: starOpacity,
            transform: [{ scale: starScale }, { rotate: starRotationDeg }],
          },
        ]}
      >
        <Image
          source={require("../../../assets/logo/STAR_LOGO.png")}
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
            transform: [{ scale: glassScale }],
          },
        ]}
      >
        <Animated.View style={styles.glassCard}>
          <BlurView intensity={glassBlur} tint="light" style={styles.blur}>
            <View style={styles.glassOverlay} />
          </BlurView>
        </Animated.View>

        {/* Shimmer effect */}
        <Animated.View
          style={[
            styles.shimmer,
            {
              transform: [{ translateX: shimmerTranslate }],
            },
          ]}
        />
      </Animated.View>

      {/* Family emblem */}
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
          source={require("../../../assets/logo/STAR_LOGO.png")}
          style={styles.logo}
          resizeMode="contain"
        />
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
    backgroundColor: "white",
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 50,
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
  },
  logo: {
    width: 200,
    height: 200,
  },
  glassCardContainer: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.35 - 200,
    left: SCREEN_WIDTH / 2 - 180,
    width: 360,
    height: 400,
    alignItems: "center",
    justifyContent: "center",
  },
  glassCard: {
    width: 360,
    height: 400,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  blur: {
    flex: 1,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 100,
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    transform: [{ skewX: "-20deg" }],
  },
});
