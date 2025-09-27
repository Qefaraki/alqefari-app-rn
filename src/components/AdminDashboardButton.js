import React, { useState } from "react";
import { View, Pressable, StyleSheet, Modal } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import AdminDashboardRedesigned from "../screens/AdminDashboardRedesigned";

const AdminDashboardButton = ({ user }) => {
  const [showDashboard, setShowDashboard] = useState(false);
  const iconScale = useSharedValue(1);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Tap animation
    iconScale.value = withSequence(
      withTiming(0.9, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(1.05, { duration: 160, easing: Easing.out(Easing.back(1.6)) }),
      withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
    );

    setShowDashboard(true);
  };

  return (
    <>
      <View style={styles.container}>
        {/* Button with shadow wrapper */}
        <View style={styles.shadowWrapper}>
          <Pressable
            onPress={handlePress}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
          >
            {/* Dashboard icon */}
            <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
              <Ionicons name="grid-outline" size={24} color="#A13333" />
            </Animated.View>
          </Pressable>
        </View>
      </View>

      {/* Admin Dashboard Modal */}
      {showDashboard && (
        <Modal
          animationType="slide"
          presentationStyle="fullScreen"
          visible={showDashboard}
          onRequestClose={() => setShowDashboard(false)}
        >
          <AdminDashboardRedesigned
            onClose={() => setShowDashboard(false)}
            user={user}
          />
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 240, // Positioned above AdminToggleButton
    left: 16, // Left side of screen
  },
  shadowWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    // Shadow properties for iOS
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    // Shadow for Android
    elevation: 12,
  },
  button: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 56,
    height: 56,
    backgroundColor: "transparent",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    backgroundColor: "rgba(0,0,0,0.05)",
    transform: [{ scale: 0.96 }],
  },
});

export default AdminDashboardButton;