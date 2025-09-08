import React from "react";
import { View, Text, StyleSheet } from "react-native";

const SectionCard = ({ title, children }) => {
  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 12,
    textAlign: "right",
    writingDirection: "rtl",
    fontFamily: "SF Arabic",
  },
  content: {
    flex: 1,
  },
});

export default SectionCard;
