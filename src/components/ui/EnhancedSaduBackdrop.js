import React, {
  useMemo,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  runOnJS,
  FadeIn,
  FadeOut,
  withDelay,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Line } from "react-native-svg";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Star layers for parallax depth - MUCH BRIGHTER for visibility
const STAR_LAYERS = {
  distant: { count: 80, sizeRange: [0.6, 1.8], opacity: 0.7, speed: 0.2 }, // Was 0.3 opacity
  middle: { count: 50, sizeRange: [1.2, 2.8], opacity: 0.85, speed: 0.5 }, // Was 0.5 opacity
  close: { count: 30, sizeRange: [2.2, 4], opacity: 1.0, speed: 1.0 }, // Was 0.7 opacity
};

// Constellation patterns - subtle tree/family connections
const CONSTELLATIONS = [
  // Family tree pattern
  {
    lines: [
      { x1: 0.5, y1: 0.2, x2: 0.45, y2: 0.3 },
      { x1: 0.5, y1: 0.2, x2: 0.55, y2: 0.3 },
      { x1: 0.45, y1: 0.3, x2: 0.42, y2: 0.4 },
      { x1: 0.45, y1: 0.3, x2: 0.48, y2: 0.4 },
    ],
    opacity: 0.08,
  },
];

// Generate stars for a specific layer
const generateLayerStars = (layer, layerIndex) => {
  const stars = [];
  const [minSize, maxSize] = layer.sizeRange;

  for (let i = 0; i < layer.count; i++) {
    stars.push({
      id: `layer-${layerIndex}-star-${i}`,
      x: Math.random(),
      y: Math.random(),
      size: minSize + Math.random() * (maxSize - minSize),
      baseOpacity: layer.opacity * (0.5 + Math.random() * 0.5),
      animationDelay: Math.random() * 3000,
      duration: 3000 + Math.random() * 2000,
      layer: layerIndex,
      speed: layer.speed,
    });
  }

  return stars;
};

// Individual star component with twinkle
const Star = ({ star, scrollY, brightness }) => {
  const twinkle = useSharedValue(0);

  useEffect(() => {
    twinkle.value = withDelay(
      star.animationDelay,
      withRepeat(
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
      ),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const twinkleOpacity = interpolate(
      twinkle.value,
      [0, 1],
      [star.baseOpacity * 0.3, star.baseOpacity],
    );

    // Apply brightness multiplier (for progressive brightening)
    const finalOpacity = twinkleOpacity * brightness.value;

    // Parallax effect based on layer depth
    const parallaxY = scrollY
      ? interpolate(
          scrollY.value,
          [-100, 0, 100],
          [30 * star.speed, 0, -30 * star.speed],
        )
      : 0;
    const parallaxX = scrollY
      ? interpolate(
          scrollY.value,
          [-100, 0, 100],
          [10 * star.speed, 0, -10 * star.speed],
        )
      : 0;

    return {
      opacity: finalOpacity,
      transform: [{ translateY: parallaxY }, { translateX: parallaxX }],
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
          backgroundColor: "#F9F7F3",
        },
        animatedStyle,
      ]}
    />
  );
};

// Shooting star component - warm, golden, dramatic
const ShootingStar = ({
  startX,
  startY,
  endX,
  endY,
  delay = 0,
  onComplete,
}) => {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Delayed start for staggered effect
    const timer = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 150 });
      progress.value = withTiming(
        1,
        {
          duration: 1500, // Slower for dramatic effect
          easing: Easing.inOut(Easing.quad),
        },
        () => {
          // Don't fade out - just complete when off screen
          if (onComplete) {
            runOnJS(onComplete)();
          }
        },
      );
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => {
    const x = interpolate(progress.value, [0, 1], [startX, endX]);
    const y = interpolate(progress.value, [0, 1], [startY, endY]);

    return {
      opacity: opacity.value,
      transform: [{ translateX: x }, { translateY: y }],
    };
  });

  const tailStyle = useAnimatedStyle(() => {
    // Tail fades in then stays visible longer
    const tailOpacity = interpolate(
      progress.value,
      [0, 0.2, 0.8, 1],
      [0, 0.9, 0.7, 0],
    );
    const scaleX = interpolate(
      progress.value,
      [0, 0.3, 0.7, 1],
      [0, 1, 0.8, 0.5],
    );

    return {
      opacity: tailOpacity,
      transform: [{ scaleX }],
    };
  });

  return (
    <>
      {/* Multiple tail segments for gradient effect */}
      {/* Outer glow trail */}
      <Animated.View
        style={[
          {
            position: "absolute",
            left: -10,
            top: -10,
            width: 250,
            height: 20,
            backgroundColor: "#FFA500",
            opacity: 0.3,
            borderRadius: 10,
          },
          animatedStyle,
          tailStyle,
        ]}
      />
      {/* Main tail - warm golden */}
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 0,
            top: -2,
            width: 200,
            height: 4,
            backgroundColor: "#FFD700",
            borderRadius: 2,
          },
          animatedStyle,
          tailStyle,
        ]}
      />
      {/* Inner bright tail */}
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 0,
            top: 0,
            width: 150,
            height: 2,
            backgroundColor: "#FFEB3B",
            borderRadius: 1,
          },
          animatedStyle,
          tailStyle,
        ]}
      />
      {/* Shooting star head - warm golden glow */}
      <Animated.View
        style={[
          {
            position: "absolute",
            left: -8,
            top: -8,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: "#FFFFFF", // White hot center
            shadowColor: "#FFD700",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 25,
          },
          animatedStyle,
        ]}
      />
    </>
  );
};

// Constellation lines component
const ConstellationLines = ({ brightness }) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(0.08 * brightness.value, {
      duration: 2000,
    });
  }, [brightness.value]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, animatedStyle]}>
      <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT}>
        {CONSTELLATIONS[0].lines.map((line, index) => (
          <Line
            key={index}
            x1={line.x1 * SCREEN_WIDTH}
            y1={line.y1 * SCREEN_HEIGHT}
            x2={line.x2 * SCREEN_WIDTH}
            y2={line.y2 * SCREEN_HEIGHT}
            stroke="#F9F7F3"
            strokeWidth="0.5"
            opacity={0.5}
          />
        ))}
      </Svg>
    </Animated.View>
  );
};

// Main enhanced backdrop component
const EnhancedSaduBackdrop = forwardRef(
  ({ children, onboardingStep = 1, style, showGradient = true }, ref) => {
    // Generate stars for all layers
    const stars = useMemo(() => {
      const allStars = [];
      Object.values(STAR_LAYERS).forEach((layer, index) => {
        allStars.push(...generateLayerStars(layer, index));
      });
      return allStars;
    }, []);

    // Shared values for animations
    const scrollY = useSharedValue(0);
    const brightness = useSharedValue(0.6);
    const [shootingStars, setShootingStars] = React.useState([]);

    // Progressive brightness based on onboarding step
    useEffect(() => {
      const targetBrightness = 0.6 + (onboardingStep - 1) * 0.1; // 0.6 -> 1.0
      brightness.value = withTiming(targetBrightness, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      });
    }, [onboardingStep]);

    // Auto-scroll animation for depth
    useEffect(() => {
      scrollY.value = withRepeat(
        withSequence(
          withTiming(50, {
            duration: 30000,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(-50, {
            duration: 30000,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        true,
      );
    }, []);

    // Trigger shooting star - bottom-left to top-right, full screen travel
    const triggerShootingStar = (count = 1) => {
      const newStars = [];
      for (let i = 0; i < count; i++) {
        // Start from bottom-left area
        const startX = -50 + Math.random() * 100; // Start off-screen left
        const startY = SCREEN_HEIGHT - 100 + Math.random() * 150; // Start near bottom

        // End at top-right area (travel across entire screen)
        const endX = SCREEN_WIDTH + 50 + Math.random() * 100; // End off-screen right
        const endY = -50 - Math.random() * 100; // End above top

        newStars.push({
          id: Date.now() + i,
          startX,
          startY,
          endX,
          endY,
          delay: i * 200, // Stagger multiple stars
        });
      }
      setShootingStars((prev) => [...prev, ...newStars]);
    };

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      triggerShootingStar,
      setBrightness: (value) => {
        brightness.value = withTiming(value, { duration: 1000 });
      },
    }));

    const handleShootingStarComplete = (id) => {
      setShootingStars((prev) => prev.filter((star) => star.id !== id));
    };

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

        {/* Constellation lines (very subtle) */}
        <ConstellationLines brightness={brightness} />

        {/* Multi-layer stars */}
        <View style={styles.starsContainer} pointerEvents="none">
          {stars.map((star) => (
            <Star
              key={star.id}
              star={star}
              scrollY={scrollY}
              brightness={brightness}
            />
          ))}
        </View>

        {/* Shooting stars layer */}
        <View style={styles.shootingStarsContainer} pointerEvents="none">
          {shootingStars.map((star) => (
            <ShootingStar
              key={star.id}
              startX={star.startX}
              startY={star.startY}
              endX={star.endX}
              endY={star.endY}
              delay={star.delay || 0}
              onComplete={() => handleShootingStarComplete(star.id)}
            />
          ))}
        </View>

        {/* Content layer */}
        {children}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030303",
  },
  starsContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  shootingStarsContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    pointerEvents: "none",
  },
});

export default EnhancedSaduBackdrop;
