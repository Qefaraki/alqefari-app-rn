import React from "react";
import { View, Text as RNText, StyleSheet } from "react-native";

// Test if we can import Expo UI at all
let ExpoUIWorking = false;
let Host, Text, Button;

try {
  const UI = require("@expo/ui/swift-ui");
  Host = UI.Host;
  Text = UI.Text;
  Button = UI.Button;
  ExpoUIWorking = true;
  console.log("✅ Expo UI imported successfully!");
  console.log("Available components:", Object.keys(UI));
} catch (error) {
  console.log("❌ Expo UI import failed:", error.message);
}

export default function TestSimpleExpoUI() {
  if (!ExpoUIWorking) {
    return (
      <View style={styles.container}>
        <RNText style={styles.error}>
          Expo UI not available{"\n"}
          The native module is not linked in this build
        </RNText>
      </View>
    );
  }

  try {
    return (
      <View style={styles.container}>
        <Host matchContents>
          <Text>Hello from SwiftUI!</Text>
          <Button onPress={() => console.log("Button pressed!")}>
            <Text>Test Button</Text>
          </Button>
        </Host>
      </View>
    );
  } catch (error) {
    return (
      <View style={styles.container}>
        <RNText style={styles.error}>
          Error rendering Expo UI:{"\n"}
          {error.message}
        </RNText>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9F7F3",
  },
  error: {
    color: "#A13333",
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
