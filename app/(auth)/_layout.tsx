import { Stack } from "expo-router";
import React from "react";
import SaduNightBackdrop from "../../src/components/ui/SaduNightBackdrop";

export default function AuthLayout() {
  return (
    <SaduNightBackdrop
      starCount={100}
      starOpacity={0.8}
      showGradient={true}
      style={{ flex: 1 }}
    >
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
          cardStyle: { backgroundColor: "transparent" },
          animation: "fade"
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
            cardStyle: { backgroundColor: "transparent" }
          }}
        />
        <Stack.Screen
          name="phone-auth"
          options={{
            headerShown: false,
            cardStyle: { backgroundColor: "transparent" }
          }}
        />
        <Stack.Screen
          name="profile-linking"
          options={{
            headerShown: false,
            cardStyle: { backgroundColor: "transparent" }
          }}
        />
        <Stack.Screen
          name="contact-admin"
          options={{
            headerShown: false,
            cardStyle: { backgroundColor: "transparent" }
          }}
        />
      </Stack>
    </SaduNightBackdrop>
  );
}