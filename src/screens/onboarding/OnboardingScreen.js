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
    title: "مرحباً بك في شجرة العائلة",
    subtitle: "اكتشف تاريخ عائلتك وتواصل مع أقاربك",
    image: require("../../../assets/logo/logo.png"),
    icon: "people-outline",
    gradient: ["#667eea", "#764ba2"],
    features: [
      { icon: "search", text: "ابحث عن أقاربك بسهولة" },
      { icon: "git-network", text: "استكشف شجرة العائلة الكاملة" },
      { icon: "shield-checkmark", text: "معلوماتك آمنة ومحمية" },
    ],
  },
  {
    id: 2,
    title: "تواصل مع عائلتك",
    subtitle: "شارك الذكريات والقصص مع أفراد عائلتك",
    image: require("../../../assets/logo/logo.png"),
    icon: "heart-outline",
    gradient: ["#f093fb", "#f5576c"],
    features: [
      { icon: "camera", text: "شارك الصور والذكريات" },
      { icon: "chatbubbles", text: "تواصل مع الأقارب" },
      { icon: "time", text: "احفظ تاريخ العائلة" },
    ],
  },
  {
    id: 3,
    title: "ابدأ رحلتك",
    subtitle: "سجل الآن واكتشف مكانك في شجرة العائلة",
    image: require("../../../assets/logo/logo.png"),
    icon: "rocket-outline",
    gradient: ["#4facfe", "#00f2fe"],
    features: [
      { icon: "person-add", text: "إنشاء حساب سريع" },
      { icon: "link", text: "ربط ملفك الشخصي" },
      { icon: "create", text: "تحديث معلوماتك" },
    ],
  },
];

export default function OnboardingScreen({ navigation }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleNext = () => {
    if (currentIndex < onboardingData.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        scrollViewRef.current?.scrollTo({
          x: SCREEN_WIDTH * (currentIndex + 1),
          animated: true,
        });
        setCurrentIndex(currentIndex + 1);

        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
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
            outputRange: [8, 24, 8],
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
                  backgroundColor:
                    index === currentIndex ? "#fff" : "rgba(255,255,255,0.5)",
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  const renderPage = (item, index) => {
    return (
      <View style={styles.page} key={item.id}>
        <LinearGradient
          colors={item.gradient}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <StatusBar barStyle="light-content" />

          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            {/* Logo/Image Section */}
            <View style={styles.imageContainer}>
              <View style={styles.imageWrapper}>
                <Image source={item.image} style={styles.image} />
                <View style={styles.iconOverlay}>
                  <Ionicons name={item.icon} size={40} color="white" />
                </View>
              </View>
            </View>

            {/* Text Content */}
            <View style={styles.textContainer}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>

              {/* Features List */}
              <View style={styles.featuresList}>
                {item.features.map((feature, idx) => (
                  <Animated.View
                    key={idx}
                    style={[
                      styles.featureItem,
                      {
                        opacity: fadeAnim,
                        transform: [
                          {
                            translateY: fadeAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [20, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <View style={styles.featureIcon}>
                      <Ionicons name={feature.icon} size={20} color="white" />
                    </View>
                    <Text style={styles.featureText}>{feature.text}</Text>
                  </Animated.View>
                ))}
              </View>
            </View>
          </Animated.View>
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
          if (index !== currentIndex) {
            setCurrentIndex(index);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            // Animate content change
            Animated.sequence([
              Animated.timing(fadeAnim, {
                toValue: 0.3,
                duration: 100,
                useNativeDriver: true,
              }),
              Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }),
            ]).start();
          }
        }}
        scrollEventThrottle={16}
      >
        {onboardingData.map((item, index) => renderPage(item, index))}
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
          <LinearGradient
            colors={["rgba(255,255,255,0.9)", "rgba(255,255,255,1)"]}
            style={styles.nextButtonGradient}
          >
            {currentIndex === onboardingData.length - 1 ? (
              <>
                <Text style={styles.nextButtonText}>ابدأ الآن</Text>
                <Ionicons name="arrow-forward" size={20} color="#4facfe" />
              </>
            ) : (
              <>
                <Text style={styles.nextButtonText}>التالي</Text>
                <Ionicons name="arrow-forward" size={20} color="#667eea" />
              </>
            )}
          </LinearGradient>
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
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    paddingTop: 80,
    paddingHorizontal: 30,
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  imageWrapper: {
    width: 180,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: 120,
    height: 120,
    resizeMode: "contain",
  },
  iconOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.5)",
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
    marginBottom: 15,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 18,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 26,
  },
  featuresList: {
    marginTop: 20,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },
  featureText: {
    fontSize: 16,
    color: "white",
    flex: 1,
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
    paddingHorizontal: 30,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  nextButton: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 300,
  },
  nextButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#667eea",
    marginRight: 8,
  },
});
