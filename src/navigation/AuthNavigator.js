import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import SimpleOnboardingScreen from "../screens/onboarding/SimpleOnboardingScreen";
import PhoneAuthScreen from "../screens/auth/PhoneAuthScreen";
import NameChainEntryScreen from "../screens/auth/NameChainEntryScreen";
import ProfileMatchingScreen from "../screens/auth/ProfileMatchingScreen";

const Stack = createStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        cardStyleInterpolator: ({ current, layouts }) => {
          return {
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                },
              ],
              opacity: current.progress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.5, 1],
              }),
            },
          };
        },
      }}
    >
      <Stack.Screen
        name="Onboarding"
        component={SimpleOnboardingScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name="PhoneAuth"
        component={PhoneAuthScreen}
        options={{
          gestureEnabled: true,
          gestureDirection: "horizontal",
        }}
      />
      <Stack.Screen
        name="NameChainEntry"
        component={NameChainEntryScreen}
        options={{
          gestureEnabled: true,
          gestureDirection: "horizontal",
        }}
      />
      <Stack.Screen
        name="ProfileMatching"
        component={ProfileMatchingScreen}
        options={{
          gestureEnabled: true,
          gestureDirection: "horizontal",
        }}
      />
    </Stack.Navigator>
  );
}
