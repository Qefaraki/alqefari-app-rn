/**
 * DataFieldsSection Component - Pattern 3 Wrapper
 *
 * Wrapper component that groups multiple InlineFieldRow instances
 * for displaying profile data fields (profession, education, email, etc.)
 *
 * - Groups multiple fields together
 * - Removes bottom divider from last row
 * - Section header support
 * - Token-driven styling
 *
 * Usage:
 * <DataFieldsSection
 *   title="المعلومات المهنية"
 *   fields={[
 *     { icon: 'briefcase', label: 'المهنة', value: 'مهندس' },
 *     { icon: 'school', label: 'التعليم', value: 'البكالوريوس' },
 *   ]}
 * />
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import tokens from '../../ui/tokens';
import InlineFieldRow from './InlineFieldRow';

const { colors, spacing, typography } = tokens;

const DataFieldsSection = ({ title = null, fields = [] }) => {
  // Filter out empty fields
  const validFields = useMemo(() => {
    return fields.filter((field) => field && field.value);
  }, [fields]);

  // Guard: if no valid fields, don't render
  if (validFields.length === 0) {
    return null;
  }

  // Memoize styles
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          marginVertical: spacing.sm,
        },
        sectionTitle: {
          fontSize: typography.headline.fontSize,
          fontWeight: '600',
          color: colors.najdi.text,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          marginBottom: spacing.xs,
        },
        fieldsContainer: {
          // Each InlineFieldRow handles its own styling
        },
      }),
    []
  );

  return (
    <View style={styles.container}>
      {title && (
        <Text style={styles.sectionTitle}>{title}</Text>
      )}
      <View style={styles.fieldsContainer}>
        {validFields.map((field, index) => (
          <InlineFieldRow
            key={field.id || `${field.label}-${index}`}
            icon={field.icon}
            iconColor={field.iconColor}
            label={field.label}
            value={field.value}
            showDivider={index < validFields.length - 1}  // No divider on last row
            testID={field.testID}
            accessibilityLabel={field.accessibilityLabel}
          />
        ))}
      </View>
    </View>
  );
};

export default React.memo(DataFieldsSection);
