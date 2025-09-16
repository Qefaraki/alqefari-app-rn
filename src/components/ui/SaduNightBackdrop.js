import React, { useMemo, useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Sadu constellation patterns - cultural star formations
const SADU_PATTERNS = [
  // Pattern 1: Desert Diamond
  {
    stars: [
      [0.2, 0.15],
      [0.25, 0.2],
      [0.2, 0.25],
      [0.15, 0.2],
    ],
    brightness: 0.9,
  },
  // Pattern 2: Camel's Path
  {
    stars: [
      [0.7, 0.3],
      [0.75, 0.35],
      [0.8, 0.4],
      [0.85, 0.45],
    ],
    brightness: 0.85,
  },
  // Pattern 3: Oasis Triangle
  {
    stars: [
      [0.5, 0.6],
      [0.45, 0.65],
      [0.55, 0.65],
    ],
    brightness: 0.95,
  },
  // Pattern 4: Bedouin Cross
  {
    stars: [
      [0.3, 0.7],
      [0.35, 0.7],
      [0.3, 0.75],
      [0.3, 0.65],
    ],
    brightness: 0.88,
  },
];

// Generate stars with cultural patterns
const generateStars = (count = 80) => {
  const stars = [];

  // Add regular random stars
  for (let i = 0; i < count; i++) {
    stars.push({
      id: `star-${i}`,
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 2 + 1,
      opacity: 0.3 + Math.random() * 0.5,
      animationDelay: Math.random() * 3000,
      duration: 2000 + Math.random() * 3000,
    });
  }

  // Add Sadu pattern stars (brighter and larger)
  SADU_PATTERNS.forEach((pattern, patternIndex) => {
    pattern.stars.forEach((star, starIndex) => {
      stars.push({
        id: `sadu-${patternIndex}-${starIndex}`,
        x: star[0],
        y: star[1],
        size: 3 + Math.random() * 2, // Larger for visibility
        opacity: pattern.brightness,
        animationDelay: patternIndex * 500 + starIndex * 100,
        duration: 3000 + Math.random() * 2000,
        isSadu: true,
      });
    });
  });

  return stars;
};

const Star = ({ star, scrollY }) => {
  const twinkle = useSharedValue(0);

  useEffect(() => {
    twinkle.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: star.duration,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0, {
          duration: star.duration,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const baseOpacity = star.opacity;
    const twinkleOpacity = interpolate(
      twinkle.value,
      [0, 1],
      [baseOpacity * 0.3, baseOpacity],
    );

    // Parallax effect based on scroll/pan
    const parallaxOffset = scrollY
      ? interpolate(scrollY.value, [-100, 0, 100], [20, 0, -20])
      : 0;

    const depth = star.isSadu ? 0.3 : (star.size / 3) * 0.5;

    return {
      opacity: twinkleOpacity,
      transform: [
        {
          translateY: parallaxOffset * depth,
        },
        {
          translateX: parallaxOffset * depth * 0.3,
        },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: star.x * SCREEN_WIDTH,
          top: star.y * SCREEN_HEIGHT,
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
          backgroundColor: star.isSadu ? "#F9F7F3" : "#FFFFFF", // Sadu stars use Al-Jass White
        },
        animatedStyle,
      ]}
    />
  );
};

const SaduNightBackdrop = ({
  children,
  starCount = 80,
  panValue,
  reduceMotion = false,
  style,
  showGradient = true,
}) => {
  const stars = useMemo(() => generateStars(starCount), [starCount]);

  // Animation value for parallax effect
  const scrollY = panValue || useSharedValue(0);

  // Auto-scroll animation if no pan value provided
  useEffect(() => {
    if (!panValue && !reduceMotion) {
      scrollY.value = withRepeat(
        withSequence(
          withTiming(50, {
            duration: 20000,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(-50, {
            duration: 20000,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        true,
      );
    }
  }, [panValue, reduceMotion]);

  return (
    <View style={[styles.container, style]}>
      {/* Deep space gradient background */}
      {showGradient && (
        <LinearGradient
          colors={["#030303", "#0d0d19", "#030303"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {/* Stars layer */}
      <View style={styles.starsContainer} pointerEvents="none">
        {stars.map((star) => (
          <Star
            key={star.id}
            star={star}
            scrollY={reduceMotion ? null : scrollY}
          />
        ))}
      </View>

      {/* Content layer */}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030303",
  },
  starsContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
});

export default SaduNightBackdrop;
