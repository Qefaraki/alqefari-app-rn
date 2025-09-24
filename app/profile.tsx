import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Ionicons name="construct" size={80} color="#D58C4A" />
      <Text style={styles.title}>قريباً</Text>
      <Text style={styles.subtitle}>نعمل على تطوير صفحة الملف الشخصي</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9F7F3",
    padding: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#242121",
    marginTop: 16,
    fontFamily: "SF Arabic",
  },
  subtitle: {
    fontSize: 16,
    color: "#736372",
    marginTop: 8,
    textAlign: "center",
    fontFamily: "SF Arabic",
  },
});
