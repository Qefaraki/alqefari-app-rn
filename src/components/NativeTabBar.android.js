import React from "react";
import { View, StyleSheet } from "react-native";
import { Button } from "@expo/ui/jetpack-compose";

export default function NativeTabBar({ activeTab, onTabPress }) {
  return (
    <View style={styles.container}>
      {/* Tree Tab */}
      <Button
        style={styles.tabButton}
        variant={activeTab === "tree" ? "filled" : "text"}
        leadingIcon={activeTab === "tree" ? "filled.Forest" : "outlined.Forest"}
        onPress={() => onTabPress("tree")}
        color={activeTab === "tree" ? "#A13333" : undefined}
        elementColors={
          activeTab !== "tree"
            ? {
                contentColor: "#736372",
              }
            : undefined
        }
      >
        الشجرة
      </Button>

      {/* Settings Tab */}
      <Button
        style={styles.tabButton}
        variant={activeTab === "settings" ? "filled" : "text"}
        leadingIcon={
          activeTab === "settings" ? "filled.Settings" : "outlined.Settings"
        }
        onPress={() => onTabPress("settings")}
        color={activeTab === "settings" ? "#A13333" : undefined}
        elementColors={
          activeTab !== "settings"
            ? {
                contentColor: "#736372",
              }
            : undefined
        }
      >
        الإعدادات
      </Button>

      {/* Profile Tab */}
      <Button
        style={styles.tabButton}
        variant={activeTab === "profile" ? "filled" : "text"}
        leadingIcon={
          activeTab === "profile"
            ? "filled.AccountCircle"
            : "outlined.AccountCircle"
        }
        onPress={() => onTabPress("profile")}
        color={activeTab === "profile" ? "#A13333" : undefined}
        elementColors={
          activeTab !== "profile"
            ? {
                contentColor: "#736372",
              }
            : undefined
        }
      >
        الملف
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#F9F7F3",
    paddingVertical: 8,
    paddingHorizontal: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderTopWidth: 1,
    borderTopColor: "#D1BBA340",
    height: 70,
  },
  tabButton: {
    flex: 1,
    marginHorizontal: 4,
    minHeight: 48,
  },
});
