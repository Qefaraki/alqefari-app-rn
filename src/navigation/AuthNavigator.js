import React, { useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { createStackNavigator } from "@react-navigation/stack";
import { useFocusEffect } from "@react-navigation/native";
import OnboardingScreen from "../screens/onboarding/OnboardingScreen";
import NajdiPhoneAuthScreen from "../screens/auth/NajdiPhoneAuthScreen";
import NameChainEntryScreen from "../screens/auth/NameChainEntryScreen";
import ProfileMatchingScreen from "../screens/auth/ProfileMatchingScreen";
import EnhancedSaduBackdrop from "../components/ui/EnhancedSaduBackdrop";

const Stack = createStackNavigator();

// Custom fade transition for celestial continuity
const fadeTransition = ({ current, next }) => {
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

  // Trigger shooting stars on success events
  const triggerShootingStar = (count = 1) => {
    backdropRef.current?.triggerShootingStar(count);
  };

  return (
    <View style={styles.container}>
      {/* Persistent star backdrop - never unmounts */}
      <EnhancedSaduBackdrop
        ref={backdropRef}
        onboardingStep={currentStep}
        style={StyleSheet.absoluteFillObject}
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
              onNavigate={(screen) => {
                setCurrentStep(2); // Moving to phone auth
                // Don't trigger shooting star here - we navigate immediately
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="PhoneAuth">
          {(props) => (
            <NajdiPhoneAuthScreen
              {...props}
              onOTPSent={() => {
                backdropRef.current?.triggerShootingStar(1);
              }}
              onOTPVerified={() => {
                setCurrentStep(3); // Moving to name entry
                backdropRef.current?.triggerShootingStar(2);
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="NameChainEntry">
          {(props) => (
            <NameChainEntryScreen
              {...props}
              onSearchSuccess={() => {
                setCurrentStep(4); // Moving to profile matching
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
