/**
 * TimelineCard Component - Professional Career Timeline
 *
 * LinkedIn-inspired timeline with horizontal accent bars
 * - Year in Najdi Crimson (17px bold)
 * - Event title (15px semibold)
 * - Description (15px regular, muted)
 * - Horizontal bar accent (Desert Ochre)
 * - Professional hierarchy and spacing
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import InfoCard from '../components/InfoCard';
import tokens from '../../../ui/tokens';
import { useSettings } from '../../../../contexts/SettingsContext';
import { formatYearBySettings } from '../../../../utils/dateUtils';

const { colors, spacing, typography } = tokens;

const TimelineCard = React.memo(
  ({ timeline }) => {
    const { settings } = useSettings();

    // Guard: if no timeline, don't render
    if (!Array.isArray(timeline) || timeline.length === 0) {
      return null;
    }

    // Memoize styles
    const styles = useMemo(
      () =>
        StyleSheet.create({
          container: {
            gap: spacing.lg, // 20px between timeline events
          },
          eventRow: {
            flexDirection: 'row',
            gap: spacing.md, // 16px between bar and content
            alignItems: 'flex-start',
          },
          barContainer: {
            paddingTop: 2, // Optical alignment with year text
          },
          bar: {
            width: 24,
            height: 2,
            backgroundColor: colors.najdi.secondary, // Desert Ochre
            borderRadius: 1,
          },
          contentContainer: {
            flex: 1,
            gap: spacing.xxs, // 4px between year, title, description
          },
          year: {
            fontSize: 17, // Larger than before (was 15px)
            fontWeight: '700', // Bold
            color: colors.najdi.primary, // Najdi Crimson
            lineHeight: 22,
            fontFamily: 'SF Arabic',
          },
          title: {
            fontSize: 15, // Standard body
            fontWeight: '600', // Semibold
            color: colors.najdi.text, // Sadu Night
            lineHeight: 20,
            fontFamily: 'SF Arabic',
          },
          description: {
            fontSize: 15, // Same as title but lighter
            fontWeight: '400', // Regular
            color: colors.najdi.textMuted, // Muted
            lineHeight: 22, // Better readability
            fontFamily: 'SF Arabic',
          },
        }),
      []
    );

    return (
      <InfoCard title="الخط الزمني المهني">
        <View style={styles.container}>
          {timeline.map((event, index) => {
            const formattedYear = formatYearBySettings(event.year, settings);
            return (
              <View key={`${event.year}-${index}`} style={styles.eventRow}>
                {/* Horizontal bar accent */}
                <View style={styles.barContainer}>
                  <View style={styles.bar} />
                </View>

                {/* Event content */}
                <View style={styles.contentContainer}>
                  <Text style={styles.year}>{formattedYear}</Text>
                  <Text style={styles.title}>{event.event}</Text>
                  {event.description ? (
                    <Text style={styles.description}>{event.description}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </InfoCard>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if timeline array changed
    const prevTimeline = prevProps.timeline;
    const nextTimeline = nextProps.timeline;

    // Fast check: different lengths = different content
    if (prevTimeline?.length !== nextTimeline?.length) return false;

    // Deep compare timeline events
    return prevTimeline?.every((event, index) => {
      const nextEvent = nextTimeline?.[index];
      return (
        event.year === nextEvent?.year &&
        event.event === nextEvent?.event &&
        event.description === nextEvent?.description
      );
    }) ?? true;
  }
);

TimelineCard.displayName = 'TimelineCard';

export default TimelineCard;
