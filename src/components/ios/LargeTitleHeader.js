import React from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import tokens from "../ui/tokens";

const LargeTitleHeader = ({
  title,
  subtitle,
  emblemSource,
  actions,
  style,
  rightSlot,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        {emblemSource ? (
          <Image
            source={emblemSource}
            resizeMode="contain"
            style={styles.emblem}
          />
        ) : null}
        <View style={styles.titleWrapper}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {actions ? (
          <View style={styles.actions}>{actions}</View>
        ) : rightSlot ? (
          <View style={styles.actions}>{rightSlot}</View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.sm,
    paddingTop: tokens.spacing.lg,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
  },
  emblem: {
    width: 50,
    height: 50,
    tintColor: tokens.colors.najdi.text,
    marginTop: Platform.select({ ios: 0, default: -2 }),
  },
  titleWrapper: {
    flex: 1,
  },
  title: {
    fontSize: tokens.typography.largeTitle.fontSize,
    fontWeight: tokens.typography.largeTitle.fontWeight,
    lineHeight: tokens.typography.largeTitle.lineHeight,
    color: tokens.colors.najdi.text,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
  },
  subtitle: {
    fontSize: tokens.typography.subheadline.fontSize,
    fontWeight: tokens.typography.subheadline.fontWeight,
    lineHeight: tokens.typography.subheadline.lineHeight,
    color: tokens.colors.najdi.textMuted,
    marginTop: 4,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
});

export default LargeTitleHeader;
