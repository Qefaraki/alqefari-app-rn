/**
 * DataFieldsSection Component - Pattern 3 Wrapper with Smart Categorization
 *
 * Enhanced wrapper that intelligently groups and displays profile data fields
 *
 * Features:
 * - Auto-categorizes fields (Personal, Professional, Contact, Other)
 * - Category headers with mini-dividers
 * - Alternating subtle row backgrounds for readability
 * - Flexible field grouping
 * - Token-driven styling
 *
 * Field Categories:
 * - Personal: birth_place, current_residence, nationality
 * - Professional: profession, education, workplace
 * - Contact: phone, email (if included in data fields)
 * - Other: Any other fields not in above categories
 *
 * Usage:
 * <DataFieldsSection
 *   fields={[
 *     { category: 'professional', icon: 'briefcase', label: 'المهنة', value: 'مهندس' },
 *     { category: 'professional', icon: 'school', label: 'التعليم', value: 'البكالوريوس' },
 *   ]}
 *   enableCategorization={true}
 * />
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import tokens, { hexWithOpacity } from '../../../ui/tokens';
import InlineFieldRow from './InlineFieldRow';

const { colors, spacing, profileViewer } = tokens;
const { dataFieldCategories } = profileViewer;

// Category configuration with display labels
const CATEGORIES = {
  personal: {
    label: 'المعلومات الشخصية',
    order: 1,
    fields: ['birth_place', 'current_residence', 'nationality'],
  },
  professional: {
    label: 'المعلومات المهنية',
    order: 2,
    fields: ['profession', 'education', 'workplace', 'professional_title'],
  },
  contact: {
    label: 'معلومات التواصل',
    order: 3,
    fields: ['phone', 'email', 'website'],
  },
  other: {
    label: 'معلومات أخرى',
    order: 4,
    fields: [],  // Catchall category
  },
};

// Determine field category based on field key
const getFieldCategory = (fieldKey) => {
  for (const [category, config] of Object.entries(CATEGORIES)) {
    if (config.fields.includes(fieldKey)) {
      return category;
    }
  }
  return 'other';
};

const DataFieldsSection = ({ fields = [], enableCategorization = true }) => {
  // Filter out empty fields
  const validFields = useMemo(() => {
    return fields.filter((field) => field && field.value);
  }, [fields]);

  // Guard: if no valid fields, don't render
  if (validFields.length === 0) {
    return null;
  }

  // Group and sort fields by category if enabled
  const groupedFields = useMemo(() => {
    if (!enableCategorization) {
      return { other: validFields };
    }

    const groups = {};
    validFields.forEach((field) => {
      const category = field.category || getFieldCategory(field.fieldKey || '');
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(field);
    });

    return groups;
  }, [validFields, enableCategorization]);

  // Sort categories by order
  const sortedCategories = useMemo(() => {
    return Object.keys(groupedFields)
      .filter((cat) => groupedFields[cat].length > 0)
      .sort((a, b) => (CATEGORIES[a]?.order || 999) - (CATEGORIES[b]?.order || 999));
  }, [groupedFields]);

  // Memoize styles
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          marginVertical: spacing.sm,
        },
        categorySection: {
          marginVertical: dataFieldCategories.categoryGap,
        },
        categoryHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          marginBottom: spacing.sm,
          gap: spacing.xs,
        },
        categoryDividerLine: {
          flex: 1,
          height: 1,
          backgroundColor: hexWithOpacity(colors.najdi.text, dataFieldCategories.dividerOpacity),
        },
        categoryTitle: {
          fontSize: dataFieldCategories.headerFontSize,
          fontWeight: dataFieldCategories.headerFontWeight,
          color: colors.najdi.textMuted,
          paddingHorizontal: spacing.xs,
        },
        fieldsContainer: {
          // Flexible container
        },
        fieldRowWrapper: {
          backgroundColor: 'transparent',
        },
        // Alternating subtle background
        fieldRowAlternate: {
          backgroundColor: hexWithOpacity(colors.najdi.background, dataFieldCategories.alternateRowOpacity),
        },
      }),
    []
  );

  return (
    <View style={styles.container}>
      {sortedCategories.map((category) => {
        const categoryConfig = CATEGORIES[category];
        const categoryFields = groupedFields[category];

        return (
          <View key={category} style={styles.categorySection}>
            {/* Category Header with Dividers */}
            {enableCategorization && categoryFields.length > 0 && (
              <View style={styles.categoryHeader}>
                <View style={styles.categoryDividerLine} />
                <Text style={styles.categoryTitle}>{categoryConfig?.label || category}</Text>
                <View style={styles.categoryDividerLine} />
              </View>
            )}

            {/* Fields in Category */}
            <View style={styles.fieldsContainer}>
              {categoryFields.map((field, index) => (
                <View
                  key={field.id || `${field.label}-${index}`}
                  style={[
                    styles.fieldRowWrapper,
                    enableCategorization && index % 2 === 1 && styles.fieldRowAlternate,
                  ]}
                >
                  <InlineFieldRow
                    icon={field.icon}
                    iconColor={field.iconColor}
                    label={field.label}
                    value={field.value}
                    showDivider={index < categoryFields.length - 1}  // No divider on last in category
                    testID={field.testID}
                    accessibilityLabel={field.accessibilityLabel}
                  />
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default React.memo(DataFieldsSection);
