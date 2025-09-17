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

// Star layers for parallax depth
const STAR_LAYERS = {
  distant: { count: 60, sizeRange: [0.5, 1.5], opacity: 0.3, speed: 0.2 },
  middle: { count: 40, sizeRange: [1, 2.5], opacity: 0.5, speed: 0.5 },
  close: { count: 20, sizeRange: [2, 3.5], opacity: 0.7, speed: 1.0 },
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

// Shooting star component
const ShootingStar = ({ startX, startY, endX, endY, onComplete }) => {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 200 });
    progress.value = withTiming(
      1,
      {
        duration: 800,
        easing: Easing.out(Easing.quad),
      },
      () => {
        opacity.value = withTiming(0, { duration: 200 }, () => {
          if (onComplete) {
            runOnJS(onComplete)();
          }
        });
      },
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const x = interpolate(progress.value, [0, 1], [startX, endX]);
    const y = interpolate(progress.value, [0, 1], [startY, endY]);

    return {
      opacity: opacity.value,
      transform: [{ translateX: x }, { translateY: y }],
    };
  });

  const tailStyle = useAnimatedStyle(() => {
    const tailOpacity = interpolate(progress.value, [0, 0.3, 1], [0, 0.6, 0]);
    const scaleX = interpolate(progress.value, [0, 0.5, 1], [0, 1, 0.3]);

    return {
      opacity: tailOpacity,
      transform: [{ scaleX }],
    };
  });

  return (
    <>
      {/* Shooting star tail */}
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 0,
            top: 0,
            width: 100,
            height: 2,
            backgroundColor: "#F9F7F3",
          },
          animatedStyle,
          tailStyle,
        ]}
      />
      {/* Shooting star head */}
      <Animated.View
        style={[
          {
            position: "absolute",
            left: -4,
            top: -4,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: "#F9F7F3",
            shadowColor: "#F9F7F3",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 10,
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

    // Trigger shooting star
    const triggerShootingStar = (count = 1) => {
      const newStars = [];
      for (let i = 0; i < count; i++) {
        const startX = Math.random() * SCREEN_WIDTH;
        const startY = Math.random() * SCREEN_HEIGHT * 0.3;
        const endX = startX + (Math.random() - 0.5) * 300;
        const endY = startY + 200 + Math.random() * 100;

        newStars.push({
          id: Date.now() + i,
          startX,
          startY,
          endX,
          endY,
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
