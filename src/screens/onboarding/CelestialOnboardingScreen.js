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
  ImageBackground,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Shadow } from "react-native-shadow-2";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Line } from "react-native-svg";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Custom Alqefari Logo Component with correct geometry
const AlqefariLogo = ({ size = 100, color = "#D1BBA3", strokeWidth = 2.5 }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Hollow circle (stroke only, no fill) */}
      <Circle
        cx="50"
        cy="50"
        r="25"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
      />

      {/* Horizontal line above */}
      <Line
        x1="50"
        y1="10"
        x2="50"
        y2="20"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Horizontal line to the right */}
      <Line
        x1="80"
        y1="50"
        x2="90"
        y2="50"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
};

// Glowing Star Component
const GlowingStar = ({ size = 12, color = "#D1BBA3" }) => {
  return (
    <Shadow
      distance={0}
      startColor={`${color}60`}
      endColor="transparent"
      offset={[0, 0]}
      paintInside={false}
      style={{
        borderRadius: size / 2,
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        }}
      />
    </Shadow>
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
    [...Array(15)].map(() => ({
      opacity: new Animated.Value(0),
      twinkle: new Animated.Value(1),
    })),
  ).current;

  useEffect(() => {
    // Background stars animation
    setTimeout(() => {
      setShowStars(true);
      starAnimations.forEach((star, index) => {
        // Initial appearance
        Animated.timing(star.opacity, {
          toValue: Math.random() * 0.4 + 0.2,
          duration: 1000,
          delay: index * 100,
          useNativeDriver: true,
        }).start();

        // Twinkle effect
        Animated.loop(
          Animated.sequence([
            Animated.timing(star.twinkle, {
              toValue: 0.3,
              duration: 2000 + Math.random() * 2000,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.ease),
            }),
            Animated.timing(star.twinkle, {
              toValue: 1,
              duration: 2000 + Math.random() * 2000,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.ease),
            }),
          ]),
        ).start();
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
            toValue: 0.7,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        // Step 2: Founder name appears
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
          // Step 3: Lines appear
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
            // Step 4: Sons appear
            Animated.parallel([
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
              // Step 5: Text and buttons
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
                    toValue: 0.3,
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

    // Continuous glow pulse for logo
    const glowPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(logoGlow, {
          toValue: 0.9,
          duration: 2000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(logoGlow, {
          toValue: 0.6,
          duration: 2000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ]),
    );

    setTimeout(() => glowPulse.start(), 3000);

    return () => glowPulse.stop();
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
    [...Array(15)].map(() => ({
      x: Math.random() * SCREEN_WIDTH,
      y: Math.random() * SCREEN_HEIGHT * 0.5,
      size: Math.random() * 2 + 1,
    })),
  ).current;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Sadu Pattern Texture Background */}
      <ImageBackground
        source={require("../../../assets/white_sadu.png")}
        style={StyleSheet.absoluteFillObject}
        imageStyle={styles.backgroundTexture}
        resizeMode="repeat"
      >
        {/* Dark gradient overlay */}
        <LinearGradient
          colors={["#242121", "#1a1818", "#242121"]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </ImageBackground>

      {/* Twinkling background stars */}
      {showStars &&
        starPositions.map((star, index) => (
          <Animated.View
            key={index}
            style={[
              styles.backgroundStar,
              {
                left: star.x,
                top: star.y,
                opacity: Animated.multiply(
                  starAnimations[index].opacity,
                  starAnimations[index].twinkle,
                ),
              },
            ]}
          >
            <GlowingStar size={star.size} color="#D1BBA3" />
          </Animated.View>
        ))}

      {/* Guest Link */}
      <Animated.View
        style={[styles.guestLinkContainer, { opacity: guestLinkOpacity }]}
      >
        <TouchableOpacity onPress={handleBrowseAsGuest}>
          <Text style={styles.guestLink}>تصفح كضيف</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Main Constellation */}
      <View style={styles.constellationContainer}>
        {/* Logo with glow */}
        <Animated.View
          style={[
            styles.logoSection,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Shadow
            distance={0}
            startColor={`#D1BBA3${Math.round(0.4 * 255).toString(16)}`}
            endColor="transparent"
            offset={[0, 0]}
            paintInside={false}
            style={styles.logoShadow}
          >
            <Animated.View style={{ opacity: logoGlow }}>
              <AlqefariLogo size={100} color="#D1BBA3" strokeWidth={2.5} />
            </Animated.View>
          </Shadow>

          {/* Founder name positioned directly below logo */}
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
        </Animated.View>

        {/* Glowing constellation lines */}
        <View style={styles.constellationLines}>
          {/* Left glowing line */}
          <Animated.View
            style={[styles.leftLineContainer, { opacity: leftLineOpacity }]}
          >
            <Shadow
              distance={0}
              startColor="#D1BBA340"
              endColor="transparent"
              offset={[0, 0]}
              paintInside={false}
              style={styles.lineStyle}
            >
              <View style={[styles.constellationLine, styles.leftLine]}>
                <LinearGradient
                  colors={["#D1BBA380", "#D1BBA320"]}
                  style={{ flex: 1, width: 2 }}
                />
              </View>
            </Shadow>
          </Animated.View>

          {/* Right glowing line */}
          <Animated.View
            style={[styles.rightLineContainer, { opacity: rightLineOpacity }]}
          >
            <Shadow
              distance={0}
              startColor="#D1BBA340"
              endColor="transparent"
              offset={[0, 0]}
              paintInside={false}
              style={styles.lineStyle}
            >
              <View style={[styles.constellationLine, styles.rightLine]}>
                <LinearGradient
                  colors={["#D1BBA380", "#D1BBA320"]}
                  style={{ flex: 1, width: 2 }}
                />
              </View>
            </Shadow>
          </Animated.View>

          {/* Left Son with adjacent name */}
          <Animated.View
            style={[
              styles.leftSonContainer,
              {
                opacity: leftSonOpacity,
                transform: [{ scale: leftSonScale }],
              },
            ]}
          >
            <View style={styles.starWithName}>
              <Shadow
                distance={0}
                startColor="#D1BBA360"
                endColor="transparent"
                offset={[0, 0]}
                paintInside={false}
                style={{ borderRadius: 6 }}
              >
                <View style={styles.starCore} />
              </Shadow>
              <Text style={styles.sonNameText}>عبدالعزيز</Text>
            </View>
          </Animated.View>

          {/* Right Son with adjacent name */}
          <Animated.View
            style={[
              styles.rightSonContainer,
              {
                opacity: rightSonOpacity,
                transform: [{ scale: rightSonScale }],
              },
            ]}
          >
            <View style={styles.starWithName}>
              <Shadow
                distance={0}
                startColor="#D1BBA360"
                endColor="transparent"
                offset={[0, 0]}
                paintInside={false}
                style={{ borderRadius: 6 }}
              >
                <View style={styles.starCore} />
              </Shadow>
              <Text style={styles.sonNameText}>جربوع</Text>
            </View>
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
  backgroundTexture: {
    opacity: 0.05, // Very subtle Sadu pattern
  },
  backgroundStar: {
    position: "absolute",
  },
  guestLinkContainer: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
  },
  guestLink: {
    fontSize: 13,
    color: "#F9F7F340",
    fontFamily: "System",
    fontWeight: "400",
  },
  constellationContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -30,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 120,
  },
  logoShadow: {
    borderRadius: 50,
  },
  founderNameContainer: {
    marginTop: 20,
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
  leftLineContainer: {
    position: "absolute",
    left: SCREEN_WIDTH / 2 - 1,
    top: -40,
  },
  rightLineContainer: {
    position: "absolute",
    left: SCREEN_WIDTH / 2 - 1,
    top: -40,
  },
  lineStyle: {
    width: 2,
    height: 140,
  },
  constellationLine: {
    width: 2,
    height: 140,
  },
  leftLine: {
    transform: [{ rotate: "-20deg" }],
    transformOrigin: "top",
  },
  rightLine: {
    transform: [{ rotate: "20deg" }],
    transformOrigin: "top",
  },
  leftSonContainer: {
    position: "absolute",
    left: SCREEN_WIDTH / 2 - 120,
    top: 90,
  },
  rightSonContainer: {
    position: "absolute",
    right: SCREEN_WIDTH / 2 - 120,
    top: 90,
  },
  starWithName: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  starCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#D1BBA3",
  },
  sonNameText: {
    fontSize: 18,
    fontFamily: "System",
    color: "#F9F7F3",
    fontWeight: "500",
    letterSpacing: 0.5,
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
