import React, { useState, useRef } from "react";
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const onboardingData = [
  {
    id: 1,
    title: "شجرة عائلة القفاري",
    subtitle: "اكتشف تاريخ عائلتك الممتد عبر الأجيال",
    gradient: ["#667eea", "#764ba2"],
  },
  {
    id: 2,
    title: "ابحث واتصل",
    subtitle: "اعثر على أقاربك وتواصل معهم بسهولة",
    gradient: ["#f093fb", "#f5576c"],
  },
  {
    id: 3,
    title: "ابدأ رحلتك",
    subtitle: "سجل برقم هاتفك واربط ملفك الشخصي",
    gradient: ["#4facfe", "#00f2fe"],
  },
];

export default function SimpleOnboardingScreen({ navigation }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);

  const handleNext = () => {
    if (currentIndex < onboardingData.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      scrollViewRef.current?.scrollTo({
        x: SCREEN_WIDTH * (currentIndex + 1),
        animated: true,
      });
      setCurrentIndex(currentIndex + 1);
    } else {
      handleGetStarted();
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.replace("PhoneAuth");
  };

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.replace("PhoneAuth");
  };

  const renderDots = () => {
    return (
      <View style={styles.dotsContainer}>
        {onboardingData.map((_, index) => {
          const inputRange = [
            (index - 1) * SCREEN_WIDTH,
            index * SCREEN_WIDTH,
            (index + 1) * SCREEN_WIDTH,
          ];

          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 20, 8],
            extrapolate: "clamp",
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: "clamp",
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  width: dotWidth,
                  opacity,
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  const renderPage = (item) => {
    return (
      <View style={styles.page} key={item.id}>
        <LinearGradient
          colors={item.gradient}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <StatusBar barStyle="light-content" />

          <View style={styles.content}>
            {/* Logo */}
            <View style={styles.logoContainer}>
              <Image
                source={require("../../../assets/logo/logo.png")}
                style={styles.logo}
              />
            </View>

            {/* Text Content */}
            <View style={styles.textContainer}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(
            event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
          );
          setCurrentIndex(index);
        }}
        scrollEventThrottle={16}
      >
        {onboardingData.map(renderPage)}
      </ScrollView>

      {/* Skip Button */}
      {currentIndex < onboardingData.length - 1 && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>تخطي</Text>
        </TouchableOpacity>
      )}

      {/* Bottom Section */}
      <View style={styles.bottomContainer}>
        {renderDots()}

        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <View style={styles.nextButtonInner}>
            {currentIndex === onboardingData.length - 1 ? (
              <>
                <Text style={styles.nextButtonText}>ابدأ الآن</Text>
                <Ionicons name="arrow-forward" size={20} color="white" />
              </>
            ) : (
              <Ionicons name="arrow-forward" size={24} color="white" />
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  logoContainer: {
    marginBottom: 60,
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: "contain",
  },
  textContainer: {
    alignItems: "center",
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
    marginBottom: 20,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 18,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    lineHeight: 28,
    paddingHorizontal: 20,
  },
  skipButton: {
    position: "absolute",
    top: 50,
    right: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
  },
  skipText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  bottomContainer: {
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  dotsContainer: {
    flexDirection: "row",
    marginBottom: 30,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "white",
    marginHorizontal: 4,
  },
  nextButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  nextButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#667eea",
    marginRight: 5,
  },
});
