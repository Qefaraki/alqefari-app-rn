import React, { useRef, useState } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { createStackNavigator } from "@react-navigation/stack";
import OnboardingScreen from "../screens/onboarding/OnboardingScreen";
import NajdiPhoneAuthScreen from "../screens/auth/NajdiPhoneAuthScreen";
import NameChainEntryScreen from "../screens/auth/NameChainEntryScreen";
import ProfileMatchingScreen from "../screens/auth/ProfileMatchingScreen";
import EnhancedSaduBackdrop from "../components/ui/EnhancedSaduBackdrop";
import StarToEmblemTransition from "../components/ui/StarToEmblemTransition";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const Stack = createStackNavigator();

// Custom fade transition for celestial continuity
const fadeTransition = ({ current }) => {
  const opacity = current.progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.3, 1],
    extrapolate: "clamp",
  });

  return {
    cardStyle: {
      opacity,
      backgroundColor: "transparent",
    },
    overlayStyle: {
      opacity: 0,
    },
  };
};

export default function AuthNavigator({ setIsGuest, setUser }) {
  const backdropRef = useRef(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [showTransition, setShowTransition] = useState(false);
  const [hideOnboardingLogo, setHideOnboardingLogo] = useState(false);
  const [showPhoneAuthCard, setShowPhoneAuthCard] = useState(false);
  const navigationRef = useRef(null);

  const handleTransitionToPhoneAuth = (navigation) => {
    // Hide onboarding logo
    setHideOnboardingLogo(true);

    // Start the transformation
    setShowTransition(true);

    // Navigate after animation starts
    setTimeout(() => {
      navigation.navigate("PhoneAuth");
      setCurrentStep(2);
    }, 800); // Navigate when morph is happening
  };

  const handleTransitionComplete = () => {
    // Show phone auth card content after transition
    setShowPhoneAuthCard(true);
    setShowTransition(false);
  };

  return (
    <View style={styles.container}>
      {/* Persistent star backdrop - never unmounts */}
      <EnhancedSaduBackdrop
        ref={backdropRef}
        onboardingStep={currentStep}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Star to Emblem transformation layer */}
      <StarToEmblemTransition
        isActive={showTransition}
        onComplete={handleTransitionComplete}
      />

      {/* Navigation with transparent cards */}
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          cardStyle: { backgroundColor: "transparent" },
          cardStyleInterpolator: fadeTransition,
          cardOverlayEnabled: false,
        }}
      >
        <Stack.Screen name="Onboarding" options={{ gestureEnabled: false }}>
          {(props) => (
            <OnboardingScreen
              {...props}
              setIsGuest={setIsGuest}
              setUser={setUser}
              hideLogo={hideOnboardingLogo}
              onNavigate={() => handleTransitionToPhoneAuth(props.navigation)}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="PhoneAuth">
          {(props) => (
            <NajdiPhoneAuthScreen
              {...props}
              showCard={showPhoneAuthCard}
              onOTPSent={() => {
                backdropRef.current?.triggerShootingStar(1);
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="NameChainEntry">
          {(props) => (
            <NameChainEntryScreen
              {...props}
              onSearchSuccess={() => {
                setCurrentStep(4);
                backdropRef.current?.triggerShootingStar(3);
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="ProfileMatching"
          component={ProfileMatchingScreen}
          options={{
            gestureEnabled: true,
            gestureDirection: "horizontal",
          }}
        />
      </Stack.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030303",
  },
});
