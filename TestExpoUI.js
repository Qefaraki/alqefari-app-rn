// Test file to verify correct Expo UI imports based on documentation
import React from "react";
import { View } from "react-native";
import { Host, CircularProgress } from "@expo/ui/swift-ui";

export default function TestExpoUI() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Host matchContents>
        <CircularProgress />
      </Host>
    </View>
  );
}
