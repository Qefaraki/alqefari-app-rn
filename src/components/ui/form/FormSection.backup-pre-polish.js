import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import tokens from '../tokens';

/**
 * Shared form section surface for profile editor.
 * Provides consistent spacing, typography, and optional description node.
 */
const FormSection = ({
  title,
  description,
  badge,
  spacing = 'md',
  children,
  footer,
  style,
}) => {
  const spacingValue = spacing === 'lg' ? tokens.spacing.lg : tokens.spacing.md;

  return (
    <View style={[styles.container, { gap: spacingValue }, style]}>
      {(title || description || badge) && (
        <View style={styles.header}>
          <View style={styles.titleColumn}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {description ? (
              <Text style={styles.description}>{description}</Text>
            ) : null}
          </View>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={styles.body}>{children}</View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
};

FormSection.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  badge: PropTypes.string,
  spacing: PropTypes.oneOf(['md', 'lg']),
  children: PropTypes.node.isRequired,
  footer: PropTypes.node,
  style: PropTypes.object,
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  titleColumn: {
    flex: 1,
    gap: tokens.spacing.xxs,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  description: {
    fontSize: 13,
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
    lineHeight: 18,
  },
  badge: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xxs,
    backgroundColor: `${tokens.colors.najdi.container  }25`,
    borderRadius: tokens.radii.sm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.najdi.primary,
  },
  body: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${tokens.colors.najdi.container  }35`,
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  footer: {
    paddingTop: tokens.spacing.sm,
  },
});

export default FormSection;
