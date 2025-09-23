import React from "react";
import {
  View,
  TouchableOpacity,
  Text as RNText,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Try to import Expo UI components, fallback to React Native if not available
let ExpoUIAvailable = false;
let Host, HStack, Button, VStack, Text, Image, Spacer;
let glassEffect, padding, frame, background;

try {
  const SwiftUI = require("@expo/ui/swift-ui");
  Host = SwiftUI.Host;
  HStack = SwiftUI.HStack;
  Button = SwiftUI.Button;
  VStack = SwiftUI.VStack;
  Text = SwiftUI.Text;
  Image = SwiftUI.Image;
  Spacer = SwiftUI.Spacer;

  const Modifiers = require("@expo/ui/swift-ui/modifiers");
  glassEffect = Modifiers.glassEffect;
  padding = Modifiers.padding;
  frame = Modifiers.frame;
  background = Modifiers.background;

  ExpoUIAvailable = true;
} catch (e) {
  console.log("Expo UI not available, using React Native fallback");
}

// Native SwiftUI implementation with iOS 26 Liquid Glass
function NativeTabBarWithExpoUI({ activeTab, onTabPress }) {
  return (
    <Host
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 85,
      }}
    >
      <HStack
        spacing={0}
        modifiers={[
          background("regularMaterial"),
          glassEffect({
            glass: {
              variant: "regular",
            },
          }),
          padding({ all: 8 }),
          frame({ height: 85 }),
        ]}
      >
        {/* Tree Tab */}
        <Button onPress={() => onTabPress("tree")} variant="plain">
          <VStack spacing={4}>
            <Image
              systemName={activeTab === "tree" ? "house.fill" : "house"}
              size={24}
              color={activeTab === "tree" ? "#A13333" : "#736372"}
            />
            <Text
              size={11}
              color={activeTab === "tree" ? "#A13333" : "#736372"}
              weight={activeTab === "tree" ? "semibold" : "regular"}
            >
              الرئيسية
            </Text>
          </VStack>
        </Button>

        <Spacer />

        {/* Settings Tab */}
        <Button onPress={() => onTabPress("settings")} variant="plain">
          <VStack spacing={4}>
            <Image
              systemName={
                activeTab === "settings" ? "gearshape.fill" : "gearshape"
              }
              size={24}
              color={activeTab === "settings" ? "#A13333" : "#736372"}
            />
            <Text
              size={11}
              color={activeTab === "settings" ? "#A13333" : "#736372"}
              weight={activeTab === "settings" ? "semibold" : "regular"}
            >
              الإعدادات
            </Text>
          </VStack>
        </Button>

        <Spacer />

        {/* Profile Tab */}
        <Button onPress={() => onTabPress("profile")} variant="plain">
          <VStack spacing={4}>
            <Image
              systemName={
                activeTab === "profile"
                  ? "person.crop.circle.fill"
                  : "person.crop.circle"
              }
              size={24}
              color={activeTab === "profile" ? "#A13333" : "#736372"}
            />
            <Text
              size={11}
              color={activeTab === "profile" ? "#A13333" : "#736372"}
              weight={activeTab === "profile" ? "semibold" : "regular"}
            >
              الملف
            </Text>
          </VStack>
        </Button>
      </HStack>
    </Host>
  );
}

// Fallback React Native implementation
function NativeTabBarFallback({ activeTab, onTabPress }) {
  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {/* Tree Tab */}
        <TouchableOpacity
          style={styles.tab}
          onPress={() => onTabPress("tree")}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === "tree" ? "home" : "home-outline"}
            size={24}
            color={activeTab === "tree" ? "#A13333" : "#736372"}
          />
          <RNText
            style={[
              styles.tabText,
              activeTab === "tree" && styles.activeTabText,
            ]}
          >
            الرئيسية
          </RNText>
        </TouchableOpacity>

        {/* Settings Tab */}
        <TouchableOpacity
          style={styles.tab}
          onPress={() => onTabPress("settings")}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === "settings" ? "settings" : "settings-outline"}
            size={24}
            color={activeTab === "settings" ? "#A13333" : "#736372"}
          />
          <RNText
            style={[
              styles.tabText,
              activeTab === "settings" && styles.activeTabText,
            ]}
          >
            الإعدادات
          </RNText>
        </TouchableOpacity>

        {/* Profile Tab */}
        <TouchableOpacity
          style={styles.tab}
          onPress={() => onTabPress("profile")}
          activeOpacity={0.7}
        >
          <Ionicons
            name={
              activeTab === "profile"
                ? "person-circle"
                : "person-circle-outline"
            }
            size={24}
            color={activeTab === "profile" ? "#A13333" : "#736372"}
          />
          <RNText
            style={[
              styles.tabText,
              activeTab === "profile" && styles.activeTabText,
            ]}
          >
            الملف
          </RNText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 85,
    backgroundColor: "rgba(249, 247, 243, 0.95)",
    borderTopWidth: 0.5,
    borderTopColor: "#D1BBA340",
  },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 24,
    height: 85,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  tabText: {
    fontSize: 11,
    marginTop: 4,
    color: "#736372",
    fontFamily: "SF Arabic",
  },
  activeTabText: {
    color: "#A13333",
    fontWeight: "600",
  },
});

// Export the appropriate component based on availability
export default function NativeTabBar(props) {
  if (ExpoUIAvailable) {
    return <NativeTabBarWithExpoUI {...props} />;
  } else {
    return <NativeTabBarFallback {...props} />;
  }
}
