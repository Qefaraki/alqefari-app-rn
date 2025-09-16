import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
  SafeAreaView,
  Easing,
} from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Line } from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const colors = {
  background: "#242121", // Sadu Night
  textPrimary: "#F9F7F3", // Al-Jass White
  glow: "#D1BBA3", // Camel Hair Beige
  cta: "#A13333", // Najdi Crimson
  indicator: "#F9F7F320",
  indicatorActive: "#D1BBA3",
  guestLink: "#D1BBA380",
  focus: "#957EB5",
};

const AnimatedLine = Animated.createAnimatedComponent(Line);

const AMBIENT_STARS = [
  { top: 72, left: 40, size: 4 },
  { top: 136, right: 56, size: 3 },
  { top: 24, right: 112, size: 5 },
  { bottom: 168, left: 88, size: 3 },
  { bottom: 120, right: 120, size: 4 },
];

export default function OrganicTreeOnboarding({ navigation, setIsGuest, setUser }) {
  const heroWidth = Math.min(SCREEN_WIDTH * 0.82, 320);
  const heroHeight = 280;
  const centerX = heroWidth / 2;
  const centerY = heroHeight * 0.32;
  const branchY = heroHeight * 0.74;
  const branchOffset = heroWidth * 0.26;
  const leftX = centerX - branchOffset;
  const rightX = centerX + branchOffset;
  const branchStartY = centerY + heroHeight * 0.1;

  const leftLineLength = Math.hypot(centerX - leftX, branchY - branchStartY);
  const rightLineLength = Math.hypot(rightX - centerX, branchY - branchStartY);

  const originGlow = useRef(new Animated.Value(0)).current;
  const starPulse = useRef(new Animated.Value(0)).current;
  const constellationProgress = useRef(new Animated.Value(0)).current;
  const branchStars = useRef([
    { scale: new Animated.Value(0.4), opacity: new Animated.Value(0) },
    { scale: new Animated.Value(0.4), opacity: new Animated.Value(0) },
  ]).current;
  const textFade = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(16)).current;
  const ctaFade = useRef(new Animated.Value(0)).current;
  const ctaTranslate = useRef(new Animated.Value(20)).current;
  const indicatorFade = useRef(new Animated.Value(0)).current;

  const ambientStarAnimations = useRef(
    AMBIENT_STARS.map(() => new Animated.Value(0.4)),
  ).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(starPulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(starPulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseAnimation.start();

    const branchReveal = Animated.stagger(
      140,
      branchStars.map((node) =>
        Animated.parallel([
          Animated.spring(node.scale, {
            toValue: 1,
            friction: 6,
            tension: 60,
            useNativeDriver: true,
          }),
          Animated.timing(node.opacity, {
            toValue: 1,
            duration: 360,
            useNativeDriver: true,
          }),
        ]),
      ),
    );

    Animated.sequence([
      Animated.timing(originGlow, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(constellationProgress, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      branchReveal,
      Animated.parallel([
        Animated.timing(textFade, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(textTranslate, {
          toValue: 0,
          duration: 520,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(ctaFade, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(ctaTranslate, {
          toValue: 0,
          duration: 520,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(indicatorFade, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();

    const twinkles = ambientStarAnimations.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 260),
          Animated.timing(value, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.4,
            duration: 1100,
            useNativeDriver: true,
          }),
        ]),
      ),
    );

    twinkles.forEach((animation) => animation.start());

    return () => {
      pulseAnimation.stop();
      twinkles.forEach((animation) => animation.stop());
    };
  }, [ambientStarAnimations, branchStars, constellationProgress, originGlow, starPulse, textFade, textTranslate, ctaFade, ctaTranslate, indicatorFade]);

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.replace("PhoneAuth");
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (setIsGuest) setIsGuest(true);
    if (setUser) setUser({ isGuest: true, user_metadata: { isGuest: true } });
  };

  const leftDashOffset = constellationProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [leftLineLength, 0],
  });
  const rightDashOffset = constellationProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [rightLineLength, 0],
  });
  const pulseScale = starPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const haloScale = starPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.container}>
        <LinearGradient
          colors={["#1F1A18", "#242121", "#181414"]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        <View pointerEvents="none" style={styles.ambientLayer}>
          {AMBIENT_STARS.map((star, index) => {
            const positionStyle = {
              ...(star.top !== undefined ? { top: star.top } : {}),
              ...(star.bottom !== undefined ? { bottom: star.bottom } : {}),
              ...(star.left !== undefined ? { left: star.left } : {}),
              ...(star.right !== undefined ? { right: star.right } : {}),
            };
            return (
              <Animated.View
                key={`ambient-star-${index}`}
                style={[
                  styles.ambientStar,
                  positionStyle,
                  {
                    width: star.size,
                    height: star.size,
                    borderRadius: star.size / 2,
                    opacity: ambientStarAnimations[index],
                  },
                ]}
              />
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>تصفح كضيف</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <Animated.View
            style={[
              styles.heroContainer,
              { width: heroWidth, height: heroHeight },
            ]}
          >
            <Svg width={heroWidth} height={heroHeight}>
              <AnimatedLine
                x1={centerX}
                y1={branchStartY}
                x2={leftX}
                y2={branchY}
                stroke={colors.glow}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeDasharray={[leftLineLength, leftLineLength]}
                strokeDashoffset={leftDashOffset}
                strokeOpacity={0.9}
              />
              <AnimatedLine
                x1={centerX}
                y1={branchStartY}
                x2={rightX}
                y2={branchY}
                stroke={colors.glow}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeDasharray={[rightLineLength, rightLineLength]}
                strokeDashoffset={rightDashOffset}
                strokeOpacity={0.9}
              />
            </Svg>

            <Animated.View
              style={[
                styles.originHalo,
                {
                  top: centerY - 88,
                  left: centerX - 88,
                  transform: [{ scale: haloScale }],
                  opacity: originGlow,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.originStar,
                {
                  top: centerY - 24,
                  left: centerX - 24,
                  transform: [{ scale: pulseScale }],
                  opacity: originGlow,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.originCore,
                {
                  top: centerY - 10,
                  left: centerX - 10,
                  opacity: originGlow,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.originLineVertical,
                {
                  top: centerY - 60,
                  left: centerX - 1,
                  opacity: originGlow,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.originLineHorizontal,
                {
                  top: centerY - 2,
                  left: centerX + 20,
                  opacity: originGlow,
                },
              ]}
            />

            {branchStars.map((node, index) => {
              const isLeft = index === 0;
              const positionStyle = isLeft
                ? { top: branchY - 16, left: leftX - 16 }
                : { top: branchY - 16, left: rightX - 16 };
              return (
                <Animated.View
                  key={`branch-star-${index}`}
                  style={[
                    styles.branchStar,
                    positionStyle,
                    {
                      opacity: node.opacity,
                      transform: [{ scale: node.scale }],
                    },
                  ]}
                />
              );
            })}
          </Animated.View>

          <Animated.View
            style={[
              styles.textContainer,
              {
                opacity: textFade,
                transform: [{ translateY: textTranslate }],
              },
            ]}
          >
            <Text style={styles.headline}>لكل عائلة عظيمة حكاية.</Text>
            <Text style={styles.subtitle}>وهذه حكاية القفاري.</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.buttonContainer,
              {
                opacity: ctaFade,
                transform: [{ translateY: ctaTranslate }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleStart}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>ابدأ الآن</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[styles.indicators, { opacity: indicatorFade }]}>
            <View style={[styles.indicator, styles.indicatorActive]} />
            <View style={styles.indicator} />
            <View style={styles.indicator} />
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  ambientLayer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
  },
  ambientStar: {
    position: "absolute",
    backgroundColor: colors.glow,
  },
  skipButton: {
    position: "absolute",
    top: 16,
    right: 24,
    padding: 8,
    zIndex: 10,
  },
  skipText: {
    fontSize: 14,
    color: colors.guestLink,
    fontFamily: "SF Arabic",
    fontWeight: "400",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 32,
  },
  heroContainer: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  originHalo: {
    position: "absolute",
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: "rgba(209, 187, 163, 0.18)",
    shadowColor: colors.glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 40,
  },
  originStar: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(209, 187, 163, 0.85)",
    shadowColor: colors.glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
  },
  originCore: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.textPrimary,
  },
  originLineVertical: {
    position: "absolute",
    width: 2,
    height: 36,
    borderRadius: 2,
    backgroundColor: colors.glow,
  },
  originLineHorizontal: {
    position: "absolute",
    width: 32,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.glow,
  },
  branchStar: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(209, 187, 163, 0.72)",
    shadowColor: colors.glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  textContainer: {
    alignItems: "center",
    gap: 16,
  },
  headline: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    fontFamily: "SF Arabic",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.textPrimary,
    fontFamily: "SF Arabic",
    textAlign: "center",
    opacity: 0.9,
  },
  buttonContainer: {
    width: "100%",
  },
  primaryButton: {
    backgroundColor: colors.cta,
    borderRadius: 10,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 32,
    shadowColor: colors.cta,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  indicators: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.indicator,
  },
  indicatorActive: {
    width: 14,
    backgroundColor: colors.indicatorActive,
    shadowColor: colors.glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
});
