import React, { useEffect, useRef, useState } from "react";
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
import Svg, { Circle, Path } from "react-native-svg";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Custom Alqefari Logo Component
const AlqefariLogo = ({ size = 60, color = "#D1BBA3", opacity = 1 }) => {
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Glow effect using View */}
      <View
        style={{
          position: "absolute",
          width: size * 1.5,
          height: size * 1.5,
          borderRadius: size * 0.75,
          backgroundColor: color,
          opacity: 0.15,
        }}
      />

      {/* SVG Logo */}
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Main circle */}
        <Circle cx="50" cy="50" r="20" fill={color} opacity={opacity} />

        {/* Line above (not connected) */}
        <Path
          d="M 50 15 L 50 25"
          stroke={color}
          strokeWidth="3"
          opacity={opacity}
          strokeLinecap="round"
        />

        {/* Line to the right (not connected) */}
        <Path
          d="M 75 50 L 85 50"
          stroke={color}
          strokeWidth="3"
          opacity={opacity}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

export default function CelestialOnboardingScreen({ navigation, setIsGuest }) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoGlow = useRef(new Animated.Value(0)).current;

  const founderOpacity = useRef(new Animated.Value(0)).current;
  const founderScale = useRef(new Animated.Value(0.8)).current;

  const leftLineOpacity = useRef(new Animated.Value(0)).current;
  const rightLineOpacity = useRef(new Animated.Value(0)).current;

  const leftSonOpacity = useRef(new Animated.Value(0)).current;
  const leftSonScale = useRef(new Animated.Value(0)).current;
  const rightSonOpacity = useRef(new Animated.Value(0)).current;
  const rightSonScale = useRef(new Animated.Value(0)).current;

  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(30)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0.9)).current;
  const guestLinkOpacity = useRef(new Animated.Value(0)).current;

  const [showStars, setShowStars] = useState(false);
  const starAnimations = useRef(
    [...Array(20)].map(() => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    // Background stars animation
    setTimeout(() => {
      setShowStars(true);
      starAnimations.forEach((star, index) => {
        Animated.sequence([
          Animated.delay(index * 50),
          Animated.parallel([
            Animated.timing(star.opacity, {
              toValue: Math.random() * 0.6 + 0.2,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.spring(star.scale, {
              toValue: 1,
              friction: 4,
              tension: 40,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      });
    }, 500);

    const animationSequence = () => {
      // Step 1: Logo appears with dramatic effect
      Animated.parallel([
        Animated.spring(logoOpacity, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 4,
          tension: 20,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(logoGlow, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
          Animated.timing(logoGlow, {
            toValue: 0.6,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        // Step 2: Founder name appears within the glow
        Animated.parallel([
          Animated.timing(founderOpacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
          Animated.spring(founderScale, {
            toValue: 1,
            friction: 5,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Step 3: Lines draw to sons
          Animated.parallel([
            Animated.timing(leftLineOpacity, {
              toValue: 1,
              duration: 1200,
              useNativeDriver: true,
              easing: Easing.out(Easing.cubic),
            }),
            Animated.timing(rightLineOpacity, {
              toValue: 1,
              duration: 1200,
              useNativeDriver: true,
              easing: Easing.out(Easing.cubic),
            }),
          ]).start(() => {
            // Step 4: Sons appear as glowing stars
            Animated.parallel([
              Animated.sequence([
                Animated.parallel([
                  Animated.timing(leftSonOpacity, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                  }),
                  Animated.spring(leftSonScale, {
                    toValue: 1,
                    friction: 4,
                    tension: 40,
                    useNativeDriver: true,
                  }),
                ]),
              ]),
              Animated.sequence([
                Animated.delay(100),
                Animated.parallel([
                  Animated.timing(rightSonOpacity, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                  }),
                  Animated.spring(rightSonScale, {
                    toValue: 1,
                    friction: 4,
                    tension: 40,
                    useNativeDriver: true,
                  }),
                ]),
              ]),
            ]).start(() => {
              // Step 5: Text and buttons fade in
              Animated.parallel([
                Animated.parallel([
                  Animated.timing(textOpacity, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                  }),
                  Animated.timing(textTranslate, {
                    toValue: 0,
                    duration: 800,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.cubic),
                  }),
                ]),
                Animated.sequence([
                  Animated.delay(300),
                  Animated.parallel([
                    Animated.timing(buttonOpacity, {
                      toValue: 1,
                      duration: 600,
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
                  Animated.delay(600),
                  Animated.timing(guestLinkOpacity, {
                    toValue: 0.4, // Very subtle
                    duration: 600,
                    useNativeDriver: true,
                  }),
                ]),
              ]).start();
            });
          });
        });
      });
    };

    animationSequence();

    // Continuous glow animation for logo
    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(logoGlow, {
          toValue: 0.8,
          duration: 2000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(logoGlow, {
          toValue: 0.4,
          duration: 2000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ]),
    );

    setTimeout(() => glowAnimation.start(), 3000);

    return () => glowAnimation.stop();
  }, []);

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.replace("PhoneAuth");
  };

  const handleBrowseAsGuest = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsGuest(true);
  };

  // Generate random star positions
  const starPositions = useRef(
    [...Array(20)].map(() => ({
      x: Math.random() * SCREEN_WIDTH,
      y: Math.random() * SCREEN_HEIGHT * 0.6,
      size: Math.random() * 2 + 1,
    })),
  ).current;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Subtle texture background gradient */}
      <LinearGradient
        colors={["#242121", "#1a1818", "#242121"]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Background stars */}
      {showStars &&
        starPositions.map((star, index) => (
          <Animated.View
            key={index}
            style={[
              styles.backgroundStar,
              {
                left: star.x,
                top: star.y,
                width: star.size,
                height: star.size,
                opacity: starAnimations[index].opacity,
                transform: [{ scale: starAnimations[index].scale }],
              },
            ]}
          />
        ))}

      {/* Guest Link - Very Subtle */}
      <Animated.View
        style={[styles.guestLinkContainer, { opacity: guestLinkOpacity }]}
      >
        <TouchableOpacity onPress={handleBrowseAsGuest}>
          <Text style={styles.guestLink}>تصفح كضيف</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Main Constellation Container */}
      <View style={styles.constellationContainer}>
        {/* Central Logo with integrated founder name */}
        <View style={styles.logoSection}>
          {/* Logo Glow Background */}
          <Animated.View
            style={[
              styles.logoGlowBackground,
              {
                opacity: logoGlow,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <LinearGradient
              colors={["#D1BBA300", "#D1BBA330", "#D1BBA300"]}
              style={styles.glowGradient}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
          </Animated.View>

          {/* Actual Logo */}
          <Animated.View
            style={[
              styles.logoWrapper,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <AlqefariLogo size={100} color="#D1BBA3" />
          </Animated.View>

          {/* Founder Name - Integrated with logo glow */}
          <Animated.View
            style={[
              styles.founderNameContainer,
              {
                opacity: founderOpacity,
                transform: [{ scale: founderScale }],
              },
            ]}
          >
            <Text style={styles.founderText}>سليمان</Text>
          </Animated.View>
        </View>

        {/* Constellation Lines and Sons using Views */}
        <View style={styles.constellationLines}>
          {/* Left Line */}
          <Animated.View
            style={[
              styles.constellationLine,
              styles.leftLine,
              { opacity: leftLineOpacity },
            ]}
          >
            <LinearGradient
              colors={["#D1BBA360", "#D1BBA320"]}
              style={{ flex: 1 }}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
          </Animated.View>

          {/* Right Line */}
          <Animated.View
            style={[
              styles.constellationLine,
              styles.rightLine,
              { opacity: rightLineOpacity },
            ]}
          >
            <LinearGradient
              colors={["#D1BBA360", "#D1BBA320"]}
              style={{ flex: 1 }}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
          </Animated.View>

          {/* Left Son */}
          <Animated.View
            style={[
              styles.sonContainer,
              styles.leftSon,
              {
                opacity: leftSonOpacity,
                transform: [{ scale: leftSonScale }],
              },
            ]}
          >
            {/* Star glow */}
            <View style={styles.starGlow} />
            {/* Star core */}
            <View style={styles.starCore} />
            {/* Son name */}
            <Text style={styles.sonNameText}>عبدالعزيز</Text>
          </Animated.View>

          {/* Right Son */}
          <Animated.View
            style={[
              styles.sonContainer,
              styles.rightSon,
              {
                opacity: rightSonOpacity,
                transform: [{ scale: rightSonScale }],
              },
            ]}
          >
            {/* Star glow */}
            <View style={styles.starGlow} />
            {/* Star core */}
            <View style={styles.starCore} />
            {/* Son name */}
            <Text style={styles.sonNameText}>جربوع</Text>
          </Animated.View>
        </View>
      </View>

      {/* Text Content */}
      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: textOpacity,
            transform: [{ translateY: textTranslate }],
          },
        ]}
      >
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
  backgroundStar: {
    position: "absolute",
    borderRadius: 50,
    backgroundColor: "#D1BBA3",
    opacity: 0.3,
  },
  guestLinkContainer: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
  },
  guestLink: {
    fontSize: 13,
    color: "#F9F7F340", // Very subtle Al-Jass White
    fontFamily: "System",
    fontWeight: "400",
  },
  constellationContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 100,
  },
  logoGlowBackground: {
    position: "absolute",
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  glowGradient: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  logoWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  founderNameContainer: {
    position: "absolute",
    bottom: -40,
    alignItems: "center",
  },
  founderText: {
    fontSize: 24,
    fontWeight: "600",
    fontFamily: "System",
    color: "#D1BBA3",
    letterSpacing: 1.5,
    textShadowColor: "#D1BBA3",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  constellationLines: {
    position: "absolute",
    width: SCREEN_WIDTH,
    height: 300,
    top: SCREEN_HEIGHT * 0.32,
  },
  constellationLine: {
    position: "absolute",
    width: 2,
    height: 140,
    top: -50,
    left: SCREEN_WIDTH / 2 - 1,
    transformOrigin: "top",
  },
  leftLine: {
    transform: [{ rotate: "-20deg" }],
  },
  rightLine: {
    transform: [{ rotate: "20deg" }],
  },
  sonContainer: {
    position: "absolute",
    alignItems: "center",
    top: 80,
  },
  leftSon: {
    left: SCREEN_WIDTH / 2 - 110,
  },
  rightSon: {
    right: SCREEN_WIDTH / 2 - 110,
  },
  starGlow: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#D1BBA3",
    opacity: 0.15,
  },
  starCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#D1BBA3",
    marginBottom: 12,
    shadowColor: "#D1BBA3",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  sonNameText: {
    fontSize: 18,
    fontFamily: "System",
    color: "#F9F7F3",
    fontWeight: "500",
    letterSpacing: 0.5,
    textShadowColor: "#D1BBA3",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  textContainer: {
    alignItems: "center",
    paddingHorizontal: 30,
    marginBottom: 40,
  },
  headline: {
    fontSize: 30,
    fontWeight: "700",
    fontFamily: "System",
    color: "#F9F7F3",
    marginBottom: 10,
    letterSpacing: 0.8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "400",
    fontFamily: "System",
    color: "#F9F7F3CC",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  buttonContainer: {
    paddingHorizontal: 30,
    paddingBottom: 60,
    alignItems: "center",
  },
  ctaButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 30,
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
