import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import tokens from "../ui/tokens";

export const ListSection = ({ title, children, style }) => {
  return (
    <View style={[styles.section, style]}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
};

export const ListItem = ({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  disabled,
  isDestructive,
  showDivider = true,
  accessibilityLabel,
}) => {
  const content = (
    <View style={styles.itemContent}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.textWrapper}>
        <Text
          style={[
            styles.title,
            isDestructive && { color: tokens.colors.danger },
          ]}
        >
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );

  return (
    <View style={styles.itemWrapper}>
      {onPress ? (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.9}
          onPress={onPress}
          disabled={disabled}
          style={styles.touchable}
          accessibilityLabel={accessibilityLabel || title}
        >
          {content}
        </TouchableOpacity>
      ) : (
        content
      )}
      {showDivider ? <View style={styles.divider} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginHorizontal: tokens.spacing.lg,
    marginBottom: tokens.spacing.xl,
  },
  sectionTitle: {
    fontSize: tokens.typography.footnote.fontSize,
    fontWeight: tokens.typography.footnote.fontWeight,
    lineHeight: tokens.typography.footnote.lineHeight,
    color: tokens.colors.najdi.textMuted,
    marginBottom: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    textAlign: "right",
    writingDirection: "rtl",
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.md,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.divider,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }
      : { elevation: 2 }),
  },
  itemWrapper: {
    backgroundColor: tokens.colors.surface,
  },
  touchable: {
    minHeight: tokens.touchTarget.minimum,
    justifyContent: "center",
  },
  itemContent: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  leading: {
    width: 28,
    alignItems: "center",
  },
  textWrapper: {
    flex: 1,
    alignItems: "flex-end",
  },
  title: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "500",
    color: tokens.colors.najdi.text,
    textAlign: "right",
    writingDirection: "rtl",
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
  },
  subtitle: {
    marginTop: 2,
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.najdi.textMuted,
    textAlign: "right",
    writingDirection: "rtl",
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
  },
  trailing: {
    marginRight: "auto",
    marginLeft: -4,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.colors.divider,
    marginHorizontal: tokens.spacing.lg,
  },
});

export default {
  ListSection,
  ListItem,
};
