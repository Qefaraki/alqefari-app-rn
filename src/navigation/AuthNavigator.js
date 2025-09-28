import React, { useRef, useState } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { createStackNavigator } from "@react-navigation/stack";
import OnboardingScreen from "../screens/onboarding/OnboardingScreen";
import NajdiPhoneAuthScreen from "../screens/auth/NajdiPhoneAuthScreen";
import ProfileLinkingScreen from "../screens/auth/ProfileLinkingScreen";
import ContactAdminScreen from "../screens/auth/ContactAdminScreen";
import EnhancedSaduBackdrop from "../components/ui/EnhancedSaduBackdrop";
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
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="PhoneAuth">
          {(props) => (
            <NajdiPhoneAuthScreen
              {...props}
              onOTPSent={() => {
                backdropRef.current?.triggerShootingStar(1);
                setCurrentStep(2);
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="ProfileLinking">
          {(props) => (
            <ProfileLinkingScreen
              {...props}
              onProfileLinked={() => {
                setCurrentStep(4);
                backdropRef.current?.triggerShootingStar(3);
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="ContactAdmin"
          component={ContactAdminScreen}
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
