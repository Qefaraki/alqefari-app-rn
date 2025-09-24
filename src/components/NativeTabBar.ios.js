import React from "react";
import { View, StyleSheet } from "react-native";

// Since TabView is not available in Expo UI yet, we'll create a custom glass effect tab bar
// using the available GlassEffectContainer and HStack components
import {
  Host,
  HStack,
  Button,
  VStack,
  Text,
  Image,
  Spacer,
  GlassEffectContainer,
} from "@expo/ui/swift-ui";
import { padding } from "@expo/ui/swift-ui/modifiers";

// Native SwiftUI implementation with iOS 26 Liquid Glass using GlassEffectContainer
export default function NativeTabBar({ activeTab, onTabPress }) {
  return (
    <View style={styles.container}>
      <Host
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 85,
        }}
      >
        <GlassEffectContainer variant="regular">
          <HStack
            spacing={0}
            modifiers={[padding({ horizontal: 20, vertical: 8 })]}
          >
            {/* Tree Tab */}
            <Button onPress={() => onTabPress("tree")} variant="plain">
              <VStack spacing={4}>
                <Image
                  systemName={activeTab === "tree" ? "tree.fill" : "tree"}
                  size={24}
                  color={activeTab === "tree" ? "#A13333" : "#736372"}
                />
                <Text
                  size={11}
                  color={activeTab === "tree" ? "#A13333" : "#736372"}
                  weight={activeTab === "tree" ? "semibold" : "regular"}
                >
                  الشجرة
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
        </GlassEffectContainer>
      </Host>
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
  },
});
