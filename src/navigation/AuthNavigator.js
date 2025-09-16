import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import BasicStarfieldScreen from "../screens/onboarding/BasicStarfieldScreen";
import LocketPhoneAuthScreen from "../screens/auth/LocketPhoneAuthScreen";
import NameChainEntryScreen from "../screens/auth/NameChainEntryScreen";
import ProfileMatchingScreen from "../screens/auth/ProfileMatchingScreen";

const Stack = createStackNavigator();

export default function AuthNavigator({ setIsGuest, setUser }) {
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
      <Stack.Screen name="Onboarding" options={{ gestureEnabled: false }}>
        {(props) => (
          <BasicStarfieldScreen
            {...props}
            setIsGuest={setIsGuest}
            setUser={setUser}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="PhoneAuth"
        component={LocketPhoneAuthScreen}
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
