/**
 * LifeEventsSection Component - Pattern 4 (Timeline)
 *
 * Vertical timeline for life events (birth, death, marriages, etc.)
 * - Left-side timeline with dots and connecting lines
 * - Flexible event heights (grows with content)
 * - Birth place and date display
 * - Death place and date display (if applicable)
 * - Dynamic Type support for all text
 * - Token system for styling
 *
 * Usage:
 * <LifeEventsSection
 *   person={profile}
 * />
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import tokens, { useAccessibilitySize, hexWithOpacity } from '../../../ui/tokens';
import { toArabicNumerals } from '../../../../utils/dateUtils';

const { colors, spacing, typography, profileViewer } = tokens;
const { timeline: timelineTokens } = profileViewer;

const LifeEventsSection = ({ person = {} }) => {
  const { shouldUseAlternateLayout } = useAccessibilitySize();

  // Build events list
  const events = useMemo(() => {
    const eventsList = [];

    // Birth event
    if (person?.dob_data) {
      const birthYear = person.dob_data.year;
      const isPublic = person?.dob_is_public !== false;
      const isApproximate = Boolean(person.dob_data.approximate);

      let birthLabel = 'المولد';
      let birthDescription = '';

      if (!isPublic) {
        birthDescription = 'التاريخ مخفي';
      } else if (birthYear) {
        const formattedYear = toArabicNumerals(String(birthYear));
        birthDescription = isApproximate ? `حوالي ${formattedYear}` : formattedYear;
      }

      if (person?.birth_place && birthDescription) {
        birthDescription += ` • ${person.birth_place}`;
      } else if (person?.birth_place) {
        birthDescription = person.birth_place;
      }

      if (birthDescription) {
        eventsList.push({
          id: 'birth',
          label: birthLabel,
          description: birthDescription,
          color: colors.najdi.primary,
        });
      }
    }

    // Death event (if applicable)
    if (person?.dod_data || person?.death_place) {
      const deathYear = person.dod_data?.year;
      const isDeathPublic = person?.dod_is_public !== false;
      const isDeathApproximate = Boolean(person.dod_data?.approximate);

      let deathLabel = 'الوفاة';
      let deathDescription = '';

      if (!isDeathPublic) {
        deathDescription = 'التاريخ مخفي';
      } else if (deathYear) {
        const formattedYear = toArabicNumerals(String(deathYear));
        deathDescription = isDeathApproximate ? `حوالي ${formattedYear}` : formattedYear;
      }

      if (person?.death_place && deathDescription) {
        deathDescription += ` • ${person.death_place}`;
      } else if (person?.death_place) {
        deathDescription = person.death_place;
      }

      if (deathDescription) {
        eventsList.push({
          id: 'death',
          label: deathLabel,
          description: deathDescription,
          color: colors.najdi.secondary,
        });
      }
    }

    return eventsList;
  }, [person]);

  // Memoize styles
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          marginVertical: spacing.sm,
        },
        timelineContainer: {
          paddingLeft: timelineTokens.leftPadding,
          position: 'relative',
        },
        event: {
          minHeight: timelineTokens.eventMinHeight,
          marginBottom: spacing.md,
          position: 'relative',
        },
        // Timeline dots and line (drawn on left)
        timelineIndicator: {
          position: 'absolute',
          left: -timelineTokens.leftPadding + timelineTokens.dotSize / 2 - timelineTokens.dotSize / 2,
          top: 0,
          alignItems: 'center',
          justifyContent: 'flex-start',
        },
        dot: {
          width: timelineTokens.dotSize,
          height: timelineTokens.dotSize,
          borderRadius: timelineTokens.dotSize / 2,
          borderWidth: timelineTokens.dotBorderWidth,
          backgroundColor: 'transparent',
          marginTop: spacing.xs,
        },
        line: {
          width: timelineTokens.lineWidth,
          flex: 1,
          backgroundColor: hexWithOpacity(colors.najdi.text, timelineTokens.lineColorOpacity),  // ✅ Cleaner, reusable
        },
        // Event content (right side of timeline)
        eventContent: {
          flex: 1,
        },
        year: {
          fontSize: timelineTokens.yearFontSize,
          fontWeight: timelineTokens.yearFontWeight,
          color: colors.najdi.text,
          marginBottom: spacing.xxs,
        },
        description: {
          fontSize: timelineTokens.descriptionFontSize,
          fontWeight: '400',
          color: colors.najdi.textMuted,
          lineHeight: 20,
          numberOfLines: timelineTokens.descriptionMaxLines,
        },
        descriptionAccessibility: {
          // Ensure readability in accessibility mode
          fontSize: typography.callout.fontSize,
          lineHeight: 21,
        },
      }),
    [shouldUseAlternateLayout]
  );

  // Guard: if no events, don't render (must be after all hooks)
  if (events.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.timelineContainer}>
        {events.map((event, index) => (
          <View key={event.id} style={styles.event}>
            <View style={styles.timelineIndicator}>
              <View
                style={[
                  styles.dot,
                  {
                    borderColor: event.color,
                  },
                ]}
              />
              {/* Line connecting to next event */}
              {index < events.length - 1 && (
                <View style={styles.line} />
              )}
            </View>

            <View style={styles.eventContent}>
              <Text style={styles.year} numberOfLines={1}>
                {event.label}
              </Text>
              <Text
                style={[
                  styles.description,
                  shouldUseAlternateLayout && styles.descriptionAccessibility,
                ]}
                numberOfLines={timelineTokens.descriptionMaxLines}
              >
                {event.description}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

export default React.memo(LifeEventsSection);
