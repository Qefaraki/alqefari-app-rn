import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  StatusBar,
  Animated,
  Easing,
} from "react-native";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function CelestialOnboardingScreen({ navigation, setIsGuest }) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoGlow = useRef(new Animated.Value(0)).current;

  const founderOpacity = useRef(new Animated.Value(0)).current;
  const founderGlow = useRef(new Animated.Value(0)).current;

  const leftLineOpacity = useRef(new Animated.Value(0)).current;
  const rightLineOpacity = useRef(new Animated.Value(0)).current;

  const leftSonOpacity = useRef(new Animated.Value(0)).current;
  const rightSonOpacity = useRef(new Animated.Value(0)).current;

  const textOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const guestLinkOpacity = useRef(new Animated.Value(0)).current;

  const [showConstellation, setShowConstellation] = useState(false);

  useEffect(() => {
    const animationSequence = () => {
      // Step 1: Logo appears with glow
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
          easing: Easing.out(Easing.back),
        }),
        Animated.sequence([
          Animated.timing(logoGlow, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
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
          }),
          Animated.timing(founderGlow, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setShowConstellation(true);

          // Step 3: Lines draw to sons
          Animated.parallel([
            Animated.timing(leftLineOpacity, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(rightLineOpacity, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]).start(() => {
            // Step 4: Sons appear
            Animated.parallel([
              Animated.timing(leftSonOpacity, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
              }),
              Animated.timing(rightSonOpacity, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
              }),
            ]).start(() => {
              // Step 5: Text and buttons fade in
              Animated.stagger(200, [
                Animated.timing(textOpacity, {
                  toValue: 1,
                  duration: 600,
                  useNativeDriver: true,
                }),
                Animated.timing(buttonOpacity, {
                  toValue: 1,
                  duration: 600,
                  useNativeDriver: true,
                }),
                Animated.timing(guestLinkOpacity, {
                  toValue: 1,
                  duration: 600,
                  useNativeDriver: true,
                }),
              ]).start();
            });
          });
        });
      });
    };

    animationSequence();

    // Continuous glow animation
    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(logoGlow, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(logoGlow, {
          toValue: 0.5,
          duration: 2000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ]),
    );

    setTimeout(() => glowAnimation.start(), 2000);

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Guest Link */}
      <Animated.View
        style={[styles.guestLinkContainer, { opacity: guestLinkOpacity }]}
      >
        <TouchableOpacity onPress={handleBrowseAsGuest}>
          <Text style={styles.guestLink}>تصفح كضيف</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Constellation Container */}
      <View style={styles.constellationContainer}>
        {/* Logo with Glow */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          {/* Glow effect behind logo */}
          <Animated.View
            style={[
              styles.logoGlow,
              {
                opacity: logoGlow,
              },
            ]}
          />
          <Image
            source={require("../../../assets/logo/Alqefari Emblem (White Transparent).png")}
            style={styles.logo}
          />
        </Animated.View>

        {/* Founder Name */}
        <Animated.View
          style={[styles.founderContainer, { opacity: founderOpacity }]}
        >
          <Animated.View
            style={[styles.founderGlow, { opacity: founderGlow }]}
          />
          <Text style={styles.founderText}>سليمان</Text>
        </Animated.View>

        {/* Constellation Lines and Sons */}
        {showConstellation && (
          <View style={styles.constellationLines}>
            {/* Left Line and Son */}
            <View style={styles.leftBranch}>
              <Animated.View
                style={[
                  styles.constellationLine,
                  styles.leftLine,
                  { opacity: leftLineOpacity },
                ]}
              />
              <Animated.View
                style={[
                  styles.sonContainer,
                  styles.leftSon,
                  { opacity: leftSonOpacity },
                ]}
              >
                <View style={styles.sonGlow} />
                <View style={styles.sonStar} />
                <Text style={styles.sonText}>عبدالعزيز</Text>
              </Animated.View>
            </View>

            {/* Right Line and Son */}
            <View style={styles.rightBranch}>
              <Animated.View
                style={[
                  styles.constellationLine,
                  styles.rightLine,
                  { opacity: rightLineOpacity },
                ]}
              />
              <Animated.View
                style={[
                  styles.sonContainer,
                  styles.rightSon,
                  { opacity: rightSonOpacity },
                ]}
              >
                <View style={styles.sonGlow} />
                <View style={styles.sonStar} />
                <Text style={styles.sonText}>جربوع</Text>
              </Animated.View>
            </View>
          </View>
        )}
      </View>

      {/* Text Content */}
      <Animated.View style={[styles.textContainer, { opacity: textOpacity }]}>
        <Text style={styles.headline}>لكل عائلة عظيمة حكاية.</Text>
        <Text style={styles.subtitle}>وهذه حكاية القفاري.</Text>
      </Animated.View>

      {/* CTA Button */}
      <Animated.View
        style={[styles.buttonContainer, { opacity: buttonOpacity }]}
      >
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleStart}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaButtonText}>ابدأ الآن</Text>
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
    backgroundColor: "#242121", // Sadu Night
  },
  guestLinkContainer: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
  },
  guestLink: {
    fontSize: 14,
    color: "#D1BBA380", // Camel Hair Beige desaturated
    fontFamily: "SF Arabic",
  },
  constellationContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -50,
  },
  logoContainer: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logo: {
    width: 80,
    height: 80,
    resizeMode: "contain",
    tintColor: "#D1BBA3", // Camel Hair Beige
  },
  logoGlow: {
    position: "absolute",
    width: 150,
    height: 150,
    backgroundColor: "#D1BBA3",
    borderRadius: 75,
    opacity: 0.2,
  },
  founderContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  founderGlow: {
    position: "absolute",
    width: 120,
    height: 40,
    backgroundColor: "#D1BBA3",
    borderRadius: 20,
    opacity: 0.15,
    top: -5,
  },
  founderText: {
    fontSize: 22,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#D1BBA3",
    letterSpacing: 1,
  },
  constellationLines: {
    position: "absolute",
    width: SCREEN_WIDTH,
    height: 200,
    top: 180,
  },
  leftBranch: {
    position: "absolute",
    left: SCREEN_WIDTH / 2 - 80,
    top: 0,
  },
  rightBranch: {
    position: "absolute",
    right: SCREEN_WIDTH / 2 - 80,
    top: 0,
  },
  constellationLine: {
    position: "absolute",
    width: 2,
    height: 120,
    backgroundColor: "#D1BBA3",
    opacity: 0.4,
    left: 40,
  },
  leftLine: {
    transform: [{ rotate: "-15deg" }],
    transformOrigin: "top",
  },
  rightLine: {
    transform: [{ rotate: "15deg" }],
    transformOrigin: "top",
  },
  sonContainer: {
    position: "absolute",
    top: 110,
    alignItems: "center",
    width: 80,
  },
  leftSon: {
    left: -20,
  },
  rightSon: {
    left: 0,
  },
  sonStar: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#D1BBA3",
    marginBottom: 8,
  },
  sonGlow: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D1BBA3",
    opacity: 0.15,
    top: -14,
  },
  sonText: {
    fontSize: 16,
    fontFamily: "SF Arabic",
    color: "#D1BBA3",
    opacity: 0.9,
  },
  textContainer: {
    alignItems: "center",
    paddingHorizontal: 30,
    marginBottom: 40,
  },
  headline: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: "#F9F7F3", // Al-Jass White
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: "#F9F7F3CC", // Al-Jass White with opacity
    letterSpacing: 0.3,
  },
  buttonContainer: {
    paddingHorizontal: 30,
    paddingBottom: 60,
    alignItems: "center",
  },
  ctaButton: {
    backgroundColor: "#A13333", // Najdi Crimson
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 60,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
    width: "100%",
    maxWidth: 300,
  },
  ctaButtonText: {
    color: "#F9F7F3", // Al-Jass White
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SF Arabic",
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
    backgroundColor: "#D1BBA340", // Camel Hair Beige 25% opacity
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
