import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAdminMode } from "../../contexts/AdminModeContext";
import { BlurView } from "expo-blur";

const CompactAdminBar = ({ user, onControlPanelPress, onUserPress }) => {
  const { isAdmin, isAdminMode, toggleAdminMode, loading } = useAdminMode();
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!user || loading || !isAdmin) return null;

  if (isCollapsed) {
    return (
      <View style={styles.collapsedContainer}>
        <TouchableOpacity
          style={styles.collapsedButton}
          onPress={() => setIsCollapsed(false)}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-down" size={20} color="#A13333" />
        </TouchableOpacity>
      </View>
    );
  }

  const Container = Platform.OS === "ios" ? BlurView : View;
  const containerProps =
    Platform.OS === "ios" ? { intensity: 80, tint: "light" } : {};

  return (
    <Container
      style={[
        styles.container,
        Platform.OS === "android" && { backgroundColor: "#F9F7F3" },
      ]}
      {...containerProps}
    >
      <View
        style={[styles.content, Platform.OS !== "ios" && styles.androidContent]}
      >
        {/* User Section */}
        <TouchableOpacity
          style={styles.userSection}
          onPress={onUserPress}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            <Ionicons name="person-circle" size={28} color="#007AFF" />
          </View>
          <Text style={styles.email} numberOfLines={1}>
            {user.email}
          </Text>
        </TouchableOpacity>

        {/* Admin Toggle */}
        <View style={styles.toggleSection}>
          <Text style={styles.toggleLabel}>Admin</Text>
          <Switch
            value={isAdminMode}
            onValueChange={toggleAdminMode}
            trackColor={{ false: "#E5E5E5", true: "#007AFF" }}
            thumbColor="#FFFFFF"
            style={styles.switch}
          />
        </View>

        {/* Control Panel Button */}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={onControlPanelPress}
          activeOpacity={0.7}
        >
          <Ionicons name="shield-checkmark" size={22} color="#007AFF" />
        </TouchableOpacity>

        {/* Collapse Button */}
        <TouchableOpacity
          style={styles.collapseButton}
          onPress={() => setIsCollapsed(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-up" size={16} color="#999" />
        </TouchableOpacity>
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D1BBA340", // Camel Hair Beige 40%
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(249, 247, 243, 0.3)", // Al-Jass White with opacity
  },
  userSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    marginRight: 10,
  },
  email: {
    fontSize: 14,
    color: "#242121", // Sadu Night
    fontWeight: "600",
    flex: 1,
  },
  toggleSection: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
  },
  toggleLabel: {
    fontSize: 13,
    color: "#24212199", // Sadu Night 60%
    marginRight: 8,
    fontWeight: "600",
  },
  switch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
  },
  controlButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#A1333310", // Najdi Crimson 10%
  },
  collapseButton: {
    padding: 6,
    marginLeft: 8,
  },
  collapsedContainer: {
    alignItems: "center",
    paddingVertical: 4,
  },
  collapsedButton: {
    backgroundColor: "#F9F7F3", // Al-Jass White
    paddingHorizontal: 24,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#D1BBA340", // Camel Hair Beige 40%
  },
  androidContent: {
    backgroundColor: "rgba(249, 247, 243, 0.98)", // Al-Jass White
  },
});

export default CompactAdminBar;
