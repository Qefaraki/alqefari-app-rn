import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  ScrollView,
  Animated,
  StatusBar,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Najdi Sadu Color Palette from CLAUDE.md
const colors = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  textMuted: "#24212199", // 60% opacity
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  white: "#FFFFFF",
};

const screens = [
  {
    id: 1,
    topText: "عائلة القفاري",
    mainText: "تواصل مع عائلتك",
    subText: "اكتشف شجرة العائلة",
    showPhone: true,
    phoneContent: "familyTree",
  },
  {
    id: 2,
    topText: "أكثر من ٥٠٠ فرد",
    mainText: "ابحث واتصل بأقاربك",
    subText: "وثّق تاريخ عائلتك",
    showPhone: true,
    phoneContent: "connections",
  },
  {
    id: 3,
    topText: "ابدأ الآن",
    mainText: "انضم لشجرة العائلة",
    subText: "",
    showPhone: true,
    phoneContent: "welcome",
  },
];

export default function MinimalOnboardingScreen({
  navigation,
  setIsGuest,
  setUser,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const phoneScale = useRef(new Animated.Value(0.9)).current;
  const textSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.spring(phoneScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        delay: 400,
        useNativeDriver: true,
      }),
      Animated.timing(textSlide, {
        toValue: 0,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentIndex]);

  const handleContinue = () => {
    if (currentIndex < screens.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      scrollViewRef.current?.scrollTo({
        x: SCREEN_WIDTH * (currentIndex + 1),
        animated: true,
      });
      setCurrentIndex(currentIndex + 1);
      // Reset animations
      fadeAnim.setValue(0);
      phoneScale.setValue(0.95);
      textSlide.setValue(20);
      // Replay animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(phoneScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(textSlide, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Last screen - navigate to auth
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      navigation.replace("PhoneAuth");
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (setIsGuest) setIsGuest(true);
    if (setUser) setUser({ isGuest: true, user_metadata: { isGuest: true } });
  };

  const renderPhoneMockup = (content) => {
    return (
      <Animated.View
        style={[
          styles.phoneContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: phoneScale }],
          },
        ]}
      >
        {/* Phone Frame */}
        <View style={styles.phoneFrame}>
          {/* Notch */}
          <View style={styles.notch} />

          {/* Status Bar */}
          <View style={styles.statusBar}>
            <Text style={styles.time}>9:41</Text>
            <View style={styles.statusIcons}>
              <Ionicons name="cellular" size={14} color="#000" />
              <Ionicons name="wifi" size={14} color="#000" />
              <Ionicons name="battery-full" size={14} color="#000" />
            </View>
          </View>

          {/* Phone Content */}
          <View style={styles.phoneContent}>
            {content === "familyTree" && (
              <View style={styles.treeContent}>
                <View style={styles.familyEmoji}>👨‍👩‍👧‍👦</View>
                <Text style={styles.phoneTitle}>شجرة القفاري</Text>
                <View style={styles.miniCards}>
                  <View style={styles.miniCard}>
                    <Text style={styles.miniCardText}>جد</Text>
                  </View>
                  <View style={styles.miniCard}>
                    <Text style={styles.miniCardText}>أب</Text>
                  </View>
                  <View style={styles.miniCard}>
                    <Text style={styles.miniCardText}>أنت</Text>
                  </View>
                </View>
              </View>
            )}

            {content === "connections" && (
              <View style={styles.connectContent}>
                <View style={styles.notification}>
                  <View style={styles.notificationIcon}>
                    <Text style={styles.emoji}>👋</Text>
                  </View>
                  <View style={styles.notificationText}>
                    <Text style={styles.notificationTitle}>أحمد القفاري</Text>
                    <Text style={styles.notificationSub}>
                      قريب جديد انضم للشجرة
                    </Text>
                  </View>
                  <Text style={styles.notificationTime}>الآن</Text>
                </View>
                <View style={styles.connectionGrid}>
                  {[...Array(6)].map((_, i) => (
                    <View key={i} style={styles.connectionDot} />
                  ))}
                </View>
              </View>
            )}

            {content === "welcome" && (
              <View style={styles.welcomeContent}>
                <Image
                  source={require("../../../assets/logo/Alqefari Emblem (Transparent).png")}
                  style={styles.welcomeLogo}
                  resizeMode="contain"
                />
                <Text style={styles.welcomeTitle}>مرحباً بك</Text>
                <Text style={styles.welcomeSub}>في عائلة القفاري</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderScreen = (screen, index) => {
    return (
      <View key={screen.id} style={styles.screen}>
        <SafeAreaView style={styles.safeArea}>
          {/* Skip button - top left */}
          {index === 0 && (
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipText}>تصفح كضيف</Text>
            </TouchableOpacity>
          )}

          {/* Main Content */}
          <View style={styles.content}>
            {/* Phone Mockup */}
            {screen.showPhone && renderPhoneMockup(screen.phoneContent)}

            {/* Text Content */}
            <Animated.View
              style={[
                styles.textContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: textSlide }],
                },
              ]}
            >
              {screen.topText && (
                <Text style={styles.topText}>{screen.topText}</Text>
              )}
              <Text style={styles.mainText}>{screen.mainText}</Text>
              {screen.subText && (
                <Text style={styles.subText}>{screen.subText}</Text>
              )}
            </Animated.View>

            {/* Dots Indicator */}
            <View style={styles.dots}>
              {screens.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === currentIndex && styles.dotActive]}
                />
              ))}
            </View>

            {/* Bottom CTA */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleContinue}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>
                {index === screens.length - 1 ? "ابدأ الآن" : "التالي"}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(
            event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
          );
          if (index !== currentIndex) {
            setCurrentIndex(index);
          }
        }}
        scrollEventThrottle={16}
      >
        {screens.map(renderScreen)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  safeArea: {
    flex: 1,
  },
  skipButton: {
    position: "absolute",
    top: 60,
    left: 24,
    zIndex: 10,
  },
  skipText: {
    fontSize: 15,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
  },
  content: {
    flex: 1,
    paddingHorizontal: 40,
    paddingTop: 80,
    paddingBottom: 50,
    justifyContent: "space-between",
    alignItems: "center",
  },

  // Phone Mockup Styles
  phoneContainer: {
    marginBottom: 40,
  },
  phoneFrame: {
    width: 240,
    height: 480,
    backgroundColor: "#F8F8F8",
    borderRadius: 40,
    borderWidth: 8,
    borderColor: "#1C1C1E",
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 20,
  },
  notch: {
    position: "absolute",
    top: 10,
    left: "50%",
    marginLeft: -40,
    width: 80,
    height: 25,
    backgroundColor: "#1C1C1E",
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  statusBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 5,
    marginBottom: 20,
  },
  time: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  statusIcons: {
    flexDirection: "row",
    gap: 5,
  },
  phoneContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  // Phone Content Variations
  treeContent: {
    alignItems: "center",
  },
  familyEmoji: {
    fontSize: 60,
    marginBottom: 20,
  },
  phoneTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    marginBottom: 20,
    fontFamily: "SF Arabic",
  },
  miniCards: {
    flexDirection: "row",
    gap: 10,
  },
  miniCard: {
    backgroundColor: colors.accent + "20",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
  },
  miniCardText: {
    fontSize: 12,
    color: colors.accent,
    fontFamily: "SF Arabic",
  },

  connectContent: {
    width: "100%",
  },
  notification: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 20,
  },
  notificationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.secondary + "20",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  emoji: {
    fontSize: 20,
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#000",
    fontFamily: "SF Arabic",
  },
  notificationSub: {
    fontSize: 11,
    color: "#666",
    fontFamily: "SF Arabic",
  },
  notificationTime: {
    fontSize: 11,
    color: "#999",
    fontFamily: "SF Arabic",
  },
  connectionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  connectionDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E5E7",
  },

  welcomeContent: {
    alignItems: "center",
  },
  welcomeLogo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#000",
    marginBottom: 8,
    fontFamily: "SF Arabic",
  },
  welcomeSub: {
    fontSize: 16,
    color: "#666",
    fontFamily: "SF Arabic",
  },

  // Text Content
  textContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  topText: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 12,
    fontFamily: "SF Arabic",
  },
  mainText: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: 8,
    fontFamily: "SF Arabic",
    lineHeight: 36,
  },
  subText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: "center",
    fontFamily: "SF Arabic",
  },

  // Dots
  dots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 30,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E5E5E7",
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 20,
  },

  // Button
  primaryButton: {
    backgroundColor: colors.primary,
    width: "100%",
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
});
