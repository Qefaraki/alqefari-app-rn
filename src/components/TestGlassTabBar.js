// Test component directly from the Expo UI documentation
import React from "react";
import { View } from "react-native";
import { Host, Text, HStack } from "@expo/ui/swift-ui";
import { glassEffect, padding } from "@expo/ui/swift-ui/modifiers";

export default function TestGlassTabBar() {
  return (
    <View style={{ flex: 1, backgroundColor: "#F9F7F3" }}>
      {/* Content area */}
      <View style={{ flex: 1 }} />

      {/* Glass tab bar at bottom */}
      <Host style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <HStack
          modifiers={[
            padding({ all: 16 }),
            glassEffect({
              glass: {
                variant: "regular",
              },
            }),
          ]}
        >
          <Text size={16}>Glass effect - regular</Text>
        </HStack>
      </Host>
    </View>
  );
}
